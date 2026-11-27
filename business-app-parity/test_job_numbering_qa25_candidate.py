"""FIRE QA25 historical seven-Job SQL candidate — OFFLINE SQLite only.

This test applies all 25 reviewed QA SQL migration files to an in-memory DB,
then exercises a separate source-only SQL candidate. No actual QA/production
database, owner private export, device photos, Cloudflare API, or provider writes.
"""
import sqlite3
import unittest
from pathlib import Path
import importlib.util

ROOT=Path(__file__).resolve().parent
MIG=ROOT/'adapters'/'doomsday'/'drizzle'
CANDIDATE=ROOT/'job-numbering'/'qa25_job_numbers_seven_job_offline_candidate.sql'

def load_fingerprint():
    file=ROOT/'release'/'combined_numbering_history_preflight.py'
    spec=importlib.util.spec_from_file_location('fire_qa25_numbered_fingerprint',file)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.original_table_fingerprint

FINGERPRINT=load_fingerprint()

class Qa25JobNumberSqlContract(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.enable_load_extension(False)
        files=sorted(MIG.glob('[0-9][0-9][0-9][0-9]_*.sql'))
        self.assertEqual(len(files),25)
        self.assertTrue(files[0].name.startswith('0000_'))
        self.assertTrue(files[-1].name.startswith('0024_'))
        for file in files:
            self.db.executescript(file.read_text(encoding='utf8'))
        # The Wrangler-managed journal isn't among application source SQL
        # files, so create only a synthetic journal in this disposable clone.
        self.db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY, name TEXT UNIQUE)')
        self.db.executemany('INSERT INTO d1_migrations(id,name) VALUES(?,?)',
                            [(index+1,file.name) for index,file in enumerate(files)])
        self.db.commit()
        self.db.execute('PRAGMA foreign_keys=ON')
        self.assertEqual(self.db.execute('PRAGMA foreign_keys').fetchone()[0],1)
        self.sql=CANDIDATE.read_text(encoding='utf8')
        self.assertTrue(self.sql.lstrip().startswith('-- FIRE permanent Job #'))
        self.assertIn('NEVER run this file with Wrangler',self.sql)
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone(),('ok',))
        self.assertEqual(self.db.execute('PRAGMA database_list').fetchall()[0][2],'')

    def seed_seven_jobs(self):
        for n in range(1,4):
            self.db.execute(
                'INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',
                (f'cust-{n}',f'Offline synthetic customer {n}',f'2026-10-{n:02d}T09:00:00Z')
            )
        for n in range(1,8):
            self.db.execute(
                """INSERT INTO estimates
                 (id,customer_id,status,subtotal_cents,discount_cents,
                  total_cents,deposit_cents,created_at)
                 VALUES (?,?,?,?,?,?,?,?)""",
                (f'quote-{n:02d}',f'cust-{(n%3)+1}',
                 'completed' if n==2 else 'draft',14000,0,14000,7000,
                 f'2026-10-{n+3:02d}T12:00:00Z')
            )
        self.db.execute(
            """INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at)
               VALUES('inv-01','quote-02','cust-3','sent',14000,'2026-10-05T14:00:00Z')"""
        )
        for n in range(1,4):
            self.db.execute(
                """INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at)
                   VALUES(?,?,?,?,?,?)""",
                (f'pay-{n:02d}','quote-02','Deposit',7000,'paid',
                 f'2026-10-{n+5:02d}T14:00:00Z')
            )
        self.db.commit()
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM customer_photos').fetchone()[0],0)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

    def apply_and_verify(self):
        # SQLite executescript SQL is explicitly BEGIN...COMMIT. On an
        # unexpected error, rollback to verify all-or-nothing offline.
        try:
            self.db.executescript(self.sql)
        except sqlite3.Error:
            self.db.rollback()
            raise

    def assert_no_numbered_schema(self):
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE name IN "
            "('fire_job_numbers','fire_job_estimate_links')"
        ).fetchone()[0],0)

    def test_exact_qa_baseline_immutable_and_next_number_is_eight(self):
        self.seed_seven_jobs()
        original=FINGERPRINT(self.db)
        self.apply_and_verify()
        self.assertEqual(FINGERPRINT(self.db),original)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],7)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0],7)
        self.assertEqual(self.db.execute(
            'SELECT seq FROM sqlite_sequence WHERE name=?',('fire_job_numbers',)
        ).fetchone()[0],7)
        rows=self.db.execute(
            'SELECT job_number,root_estimate_id FROM fire_job_numbers ORDER BY job_number'
        ).fetchall()
        self.assertEqual(rows,[(n,f'quote-{n:02d}') for n in range(1,8)])
        self.assertEqual(self.db.execute(
            "SELECT l.job_number FROM invoices i JOIN fire_job_estimate_links l "
            "ON l.estimate_id=i.estimate_id WHERE i.id='inv-01'"
        ).fetchone(),(2,))
        self.assertEqual(self.db.execute(
            "SELECT COUNT(DISTINCT l.job_number) FROM fire_job_estimate_links l "
            "JOIN estimates e ON e.id=l.estimate_id WHERE e.status='completed'"
        ).fetchone(),(1,))
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone(),('ok',))
        for statement in (
            'UPDATE fire_job_numbers SET job_number=9 WHERE job_number=1',
            'DELETE FROM fire_job_numbers WHERE job_number=1',
            "UPDATE fire_job_estimate_links SET job_number=8 WHERE estimate_id='quote-01'",
            "DELETE FROM fire_job_estimate_links WHERE estimate_id='quote-01'"
        ):
            with self.subTest(statement=statement),self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(statement)
        self.db.execute(
            """INSERT INTO estimates(id,customer_id,status,subtotal_cents,
                 discount_cents,total_cents,deposit_cents,created_at)
                 VALUES('quote-08','cust-2','draft',14000,0,14000,7000,'2026-10-12T12:00:00Z')"""
        )
        self.db.execute(
            """INSERT INTO fire_job_numbers(root_estimate_id,created_at)
                 VALUES('quote-08','2026-10-12T12:00:00Z')"""
        )
        self.db.execute(
            """INSERT INTO fire_job_estimate_links(estimate_id,job_number)
                 SELECT 'quote-08',job_number FROM fire_job_numbers
                 WHERE root_estimate_id='quote-08'"""
        )
        self.assertEqual(self.db.execute(
            "SELECT job_number FROM fire_job_estimate_links WHERE estimate_id='quote-08'"
        ).fetchone(),(8,))

    def test_changed_estimate_count_fails_before_creating_any_tables(self):
        self.seed_seven_jobs()
        self.db.execute("DELETE FROM estimates WHERE id='quote-07'")
        self.db.commit()
        original=FINGERPRINT(self.db)
        with self.assertRaises(sqlite3.IntegrityError):
            self.apply_and_verify()
        self.assert_no_numbered_schema()
        self.assertEqual(FINGERPRINT(self.db),original)

    def test_revision_audit_blocks_zero_revision_only_candidate(self):
        self.seed_seven_jobs()
        self.db.execute(
            "INSERT INTO message_templates(key,body,updated_at) VALUES(?,?,?)",
            ('fire:quote-revision:v1:quote-01','{"version":1,"originalId":"quote-01","replacementId":"quote-02"}',
             '2026-10-10T12:00:00Z')
        )
        self.db.commit()
        original=FINGERPRINT(self.db)
        with self.assertRaises(sqlite3.IntegrityError):
            self.apply_and_verify()
        self.assert_no_numbered_schema()
        self.assertEqual(FINGERPRINT(self.db),original)

    def test_existing_partial_number_table_blocks_second_run(self):
        self.seed_seven_jobs()
        self.apply_and_verify()
        original=FINGERPRINT(self.db)
        with self.assertRaises(sqlite3.IntegrityError):
            self.apply_and_verify()
        self.assertEqual(FINGERPRINT(self.db),original)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],7)

    def test_unexpected_payment_count_fails_closed(self):
        self.seed_seven_jobs()
        self.db.execute("DELETE FROM payments WHERE id='pay-03'")
        self.db.commit()
        original=FINGERPRINT(self.db)
        with self.assertRaises(sqlite3.IntegrityError):
            self.apply_and_verify()
        self.assert_no_numbered_schema()
        self.assertEqual(FINGERPRINT(self.db),original)

    def test_d1_migration_candidate_parity_and_atomic_rehearsal(self):
        # D1 migration file deliberately has no explicit transaction syntax;
        # Cloudflare's migration executor provides the migration transaction.
        # We model that boundary ONLY inside a disposable SQLite clone.
        source=ROOT/'job-numbering'/'qa25_job_numbers_seven_job_d1_candidate.sql'
        d1sql=source.read_text(encoding='utf8')
        self.assertNotIn('BEGIN IMMEDIATE;',d1sql)
        self.assertFalse(any(line.lstrip().startswith('COMMIT;')
                             for line in d1sql.splitlines()))
        offline_body=self.sql[self.sql.index('CREATE TEMP TABLE _fire_job_qa25_precondition'):]
        offline_body=offline_body.replace(
            'CREATE TEMP TABLE _fire_job_qa25_precondition',
            'CREATE TABLE _fire_job_qa25_precondition'
        ).replace('\nCOMMIT;\n','\n')
        d1body=d1sql[d1sql.index('CREATE TABLE _fire_job_qa25_precondition'):]
        self.assertEqual(d1body,offline_body,
                         'D1 candidate must stay statement-identical to validated offline SQL')
        self.seed_seven_jobs()
        before=FINGERPRINT(self.db)
        self.db.executescript('BEGIN IMMEDIATE;\n'+d1body+'\nCOMMIT;')
        self.assertEqual(FINGERPRINT(self.db),before)
        self.assertEqual(self.db.execute(
            'SELECT seq FROM sqlite_sequence WHERE name=?',('fire_job_numbers',)
        ).fetchone(),(7,))
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone(),('ok',))

    def test_d1_candidate_fail_closed_under_simulated_rollback(self):
        source=ROOT/'job-numbering'/'qa25_job_numbers_seven_job_d1_candidate.sql'
        d1sql=source.read_text(encoding='utf8')
        body=d1sql[d1sql.index('CREATE TABLE _fire_job_qa25_precondition'):]
        self.seed_seven_jobs()
        self.db.execute("DELETE FROM payments WHERE id='pay-03'")
        self.db.commit()
        old=FINGERPRINT(self.db)
        with self.assertRaises(sqlite3.IntegrityError):
            try:
                self.db.executescript('BEGIN IMMEDIATE;\n'+body+'\nCOMMIT;')
            finally:
                self.db.rollback()
        self.assert_no_numbered_schema()
        self.assertEqual(FINGERPRINT(self.db),old)
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone(),('ok',))

    def test_candidate_is_not_a_hosted_migration(self):
        self.assertFalse(str(CANDIDATE).replace('\\','/').find('/drizzle/')>=0)
        self.assertIn('BEGIN IMMEDIATE;',self.sql)
        self.assertIn('COMMIT;',self.sql)
        self.assertNotIn('wrangler d1 execute',self.sql)
        self.assertNotIn('FIRE_JOB_NUMBERS_CANDIDATE=',self.sql)

if __name__=='__main__':
    unittest.main()
