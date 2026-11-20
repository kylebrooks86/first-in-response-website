"""One-clone, source-only FIRE Customer # / Job # safety acceptance.

Synthetic SQLite and temporary files only. Never touches Cloudflare, Stripe,
owner private backups, or a hosted Worker.
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fire_combined_numbering_rehearsal',
                                             ROOT/'release'/'combined_numbering_history_preflight.py')
preflight=importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

class CombinedNumberingHistoryTests(unittest.TestCase):
    def make_db(self):
        db=sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        db.executescript("""
            PRAGMA foreign_keys=ON;
            CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,created_at TEXT NOT NULL);
            CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),
                status TEXT NOT NULL,created_at TEXT NOT NULL);
            CREATE TABLE message_templates(key TEXT PRIMARY KEY,body TEXT NOT NULL);
            CREATE TABLE payments(id TEXT PRIMARY KEY,estimate_id TEXT REFERENCES estimates(id),
                amount_cents INTEGER NOT NULL);
            INSERT INTO customers VALUES ('cust-a','Sample customer A','first@invalid.test','9185550123','2026-10-01T12:00:00Z');
            INSERT INTO customers VALUES ('cust-b','Sample customer B','second@invalid.test','9185550345','2026-10-02T12:00:00Z');
            INSERT INTO estimates VALUES ('root-a','cust-a','superseded','2026-10-03T12:00:00Z');
            INSERT INTO estimates VALUES ('revised-a','cust-a','completed','2026-10-04T12:00:00Z');
            INSERT INTO estimates VALUES ('root-b','cust-b','completed','2026-10-05T12:00:00Z');
            INSERT INTO message_templates VALUES
              ('fire:quote-revision:v1:root-a','{"version":1,"originalId":"root-a","replacementId":"revised-a"}');
            INSERT INTO payments VALUES ('pay-001','revised-a',44000);
        """)
        return db

    def test_combined_history_rehearsal_preserves_original_rows(self):
        db=self.make_db()
        original=preflight.original_table_fingerprint(db)
        result=preflight.combined_rehearsal(db)
        self.assertEqual(result['historicalCustomers'],2)
        self.assertEqual(result['distinctJobs'],2)
        self.assertEqual(result['estimateJobLinks'],3)
        self.assertEqual(result['quoteRevisionLinks'],1)
        self.assertEqual(result['completedJobs'],2)
        self.assertTrue(result['historicalContentPreserved'])
        self.assertFalse(result['numberedRestoreV2Ready'])
        self.assertFalse(result['remoteD1Changed'])
        self.assertFalse(result['hostedMigrationApplied'])
        self.assertEqual(preflight.original_table_fingerprint(db),original)
        self.assertEqual(db.execute('SELECT amount_cents FROM payments').fetchone()[0],44000)
        self.assertEqual(db.execute('SELECT job_number FROM fire_job_estimate_links WHERE estimate_id="root-a"').fetchone(),
                         db.execute('SELECT job_number FROM fire_job_estimate_links WHERE estimate_id="revised-a"').fetchone())
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute('DELETE FROM fire_customer_numbers')
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute('UPDATE fire_job_estimate_links SET job_number=999')

    def test_empty_original_records_preserve_empty_numbering(self):
        db=self.make_db()
        db.execute('DELETE FROM payments')
        db.execute('DELETE FROM message_templates')
        db.execute('DELETE FROM estimates')
        db.execute('DELETE FROM customers')
        report=preflight.combined_rehearsal(db)
        self.assertEqual((report['historicalCustomers'],report['distinctJobs'],report['estimateJobLinks']), (0,0,0))
        self.assertEqual(report['productionGatesClosed'],0)

    def test_duplicate_customer_email_blocks_before_number_schema(self):
        db=self.make_db()
        db.execute("UPDATE customers SET email='first@invalid.test' WHERE id='cust-b'")
        with self.assertRaises(preflight.CUSTOMER.CustomerHistoryBlocked):
            preflight.combined_rehearsal(db)
        self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='fire_customer_numbers'").fetchone())

    def test_cross_customer_revision_blocks_before_mutations(self):
        db=self.make_db()
        db.execute("UPDATE estimates SET customer_id='cust-b' WHERE id='revised-a'")
        with self.assertRaisesRegex(preflight.JOB.HistoryBlocked,'two customers'):
            preflight.combined_rehearsal(db)
        self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='fire_customer_numbers'").fetchone())

    def test_utc_offset_and_mixed_precision_are_denied_before_backfill(self):
        for timestamp in ('2026-10-03T13:00:00+01:00','2026-10-03T12:00:00.000Z'):
            with self.subTest(timestamp=timestamp):
                db=self.make_db()
                db.execute('UPDATE estimates SET created_at=? WHERE id="root-a"',(timestamp,))
                with self.assertRaises(preflight.JOB.HistoryBlocked):
                    preflight.combined_rehearsal(db)
                self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='fire_job_numbers'").fetchone())

    def test_refuses_existing_schema_and_nonmemory_db(self):
        db=self.make_db()
        db.execute('CREATE TABLE fire_customer_numbers(customer_number INTEGER)')
        with self.assertRaises(preflight.CombinedHistoryBlocked):
            preflight.combined_rehearsal(db)
        with tempfile.TemporaryDirectory() as t:
            file=Path(t)/'synthetic.sqlite'
            physical=sqlite3.connect(str(file))
            self.addCleanup(physical.close)
            with self.assertRaises(preflight.CombinedHistoryBlocked):
                preflight.combined_rehearsal(physical)

    def test_default_main_does_not_read_or_open_a_file(self):
        output=io.StringIO()
        with contextlib.redirect_stdout(output):
            rc=preflight.main([])
        data=json.loads(output.getvalue())
        self.assertEqual(rc,0)
        self.assertFalse(data['privateFileRead'])
        self.assertFalse(data['numberingEnabled'])
        self.assertFalse(data['remoteD1Changed'])

    def test_explicit_private_sql_inspection_uses_counts_only(self):
        db=self.make_db()
        # Synthetic dump is local to disposable test directory; never real QA data.
        dump='\n'.join(db.iterdump())
        with tempfile.TemporaryDirectory() as t:
            path=Path(t)/'synthetic-only.sql'
            path.write_text(dump,encoding='utf-8')
            stdout=io.StringIO()
            with contextlib.redirect_stdout(stdout):
                rc=preflight.main(['--inspect','--sql-export',str(path)])
            result=json.loads(stdout.getvalue())
            self.assertEqual(rc,0)
            self.assertEqual(result['historicalCustomers'],2)
            self.assertEqual(result['distinctJobs'],2)
            self.assertNotIn('cust-a',stdout.getvalue())
            self.assertNotIn('first@invalid.test',stdout.getvalue())
            self.assertNotIn('pay-001',stdout.getvalue())
            self.assertNotIn(str(path),stdout.getvalue())
            self.assertEqual(path.read_text(encoding='utf-8'),dump)

    def test_malicious_attach_is_denied_without_leaking_paths(self):
        with tempfile.TemporaryDirectory() as t:
            file=Path(t)/'synthetic-unsafe.sql'
            file.write_text("ATTACH DATABASE '/tmp/should-not-be-created.sqlite' AS external;",encoding='utf-8')
            err=io.StringIO()
            with contextlib.redirect_stderr(err):
                rc=preflight.main(['--inspect','--sql-export',str(file)])
            self.assertEqual(rc,1)
            self.assertIn('BLOCKED:',err.getvalue())
            self.assertNotIn(str(file),err.getvalue())
            self.assertNotIn('/tmp/',err.getvalue())

if __name__=='__main__':
    unittest.main()
