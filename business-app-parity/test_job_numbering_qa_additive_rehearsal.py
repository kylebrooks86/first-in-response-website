"""FIRE QA permanent Job # additive backfill — SYNTHETIC SOURCE-ONLY test.

Replays the real 25-migration QA schema into SQLite :memory:, injects seven
synthetic estimates, invoices, payment and revision history, and rehearses the
existing immutable Job # prototype. It never connects to D1, opens an owner
archive, writes a provider, or generates a hosted migration. No deployment.
"""
from pathlib import Path
import importlib.util
import json
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parent
QA_MIGRATIONS = ROOT / 'adapters' / 'doomsday' / 'drizzle'

def source_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError('Reviewed source-only numbering module unavailable')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

JOB = source_module('fire_job_qa_synthetic', ROOT / 'job-numbering' / 'preflight_job_history.py')
COMBINED = source_module('fire_job_qa_content_fingerprint',
                         ROOT / 'release' / 'combined_numbering_history_preflight.py')

class SyntheticQaJobNumberActivationRehearsal(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.assertEqual(self.db.execute('PRAGMA database_list').fetchall()[0][2], '')
        self.db.enable_load_extension(False)
        # No remote/provider path. These are source migrations in disposable RAM.
        migrations = sorted(QA_MIGRATIONS.glob('[0-9][0-9][0-9][0-9]_*.sql'))
        self.assertEqual(len(migrations), 25, 'Only reviewed 25-migration QA baseline is supported')
        self.assertTrue(migrations[0].name.startswith('0000_'))
        self.assertTrue(migrations[-1].name.startswith('0024_'))
        for migration in migrations:
            self.db.executescript(migration.read_text(encoding='utf8'))
        self.db.execute('PRAGMA foreign_keys=ON')
        self.assertEqual(self.db.execute('PRAGMA foreign_keys').fetchone()[0], 1)
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        tables = {r[0] for r in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertFalse({'fire_job_numbers','fire_job_estimate_links'} & tables)

    def insert_customer(self, ident, day):
        self.db.execute(
            "INSERT INTO customers(id,name,created_at) VALUES(?,?,?)",
            (ident, 'Synthetic '+ident, '2026-10-%02dT10:00:00Z' % day)
        )

    def insert_estimate(self, ident, customer, status, day):
        self.db.execute(
            """INSERT INTO estimates
            (id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (ident, customer, status, 14000, 0, 14000, 7000,
             '2026-10-%02dT12:00:00Z' % day)
        )

    def seed_real_shaped_history(self):
        for customer, day in [('cust-a',1),('cust-b',2),('cust-c',3)]:
            self.insert_customer(customer, day)
        entries = [
            ('quote-01','cust-a','superseded', 4),
            ('quote-02','cust-a','completed', 5),  # revision of quote-01
            ('quote-03','cust-a','scheduled', 6),  # different job, same customer
            ('quote-04','cust-b','completed', 7),
            ('quote-05','cust-b','declined', 8),
            ('quote-06','cust-c','draft', 9),
            ('quote-07','cust-c','approved',10),
        ]
        for entry in entries:
            self.insert_estimate(*entry)
        revision = {'version':1,'originalId':'quote-01','replacementId':'quote-02'}
        self.db.execute(
            'INSERT INTO message_templates(key,body,updated_at) VALUES (?,?,?)',
            ('fire:quote-revision:v1:quote-01', json.dumps(revision), '2026-10-05T12:00:00Z')
        )
        self.db.execute(
            """INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at)
            VALUES ('invoice-01','quote-02','cust-a','sent',14000,'2026-10-05T13:00:00Z')"""
        )
        self.db.execute(
            """INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at)
            VALUES ('payment-01','quote-02','Deposit',7000,'paid','2026-10-05T14:00:00Z')"""
        )

    def test_qa_25_additive_backfill_preserves_every_original_row(self):
        self.seed_real_shaped_history()
        before = COMBINED.original_table_fingerprint(self.db)
        plan = JOB.analyze(self.db)
        self.assertEqual(plan['estimateCount'], 7)
        self.assertEqual(plan['distinctJobs'], 6)
        self.assertEqual(plan['revisionLinks'], 1)
        self.assertEqual(plan['completedJobs'], 2)
        self.assertEqual(plan['mapping']['quote-01'], plan['mapping']['quote-02'])
        self.assertNotEqual(plan['mapping']['quote-01'], plan['mapping']['quote-03'])
        proof = JOB.rehearse_in_memory(self.db,plan)
        self.assertTrue(proof['inMemoryBackfillRehearsalPassed'])
        self.assertFalse(proof['hostedMigrationApplied'])
        self.assertEqual(COMBINED.original_table_fingerprint(self.db),before,
                         'An existing customer, estimate, finance, or signed record changed')
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone(),('ok',))
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],6)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0],7)
        self.assertEqual(self.db.execute(
            "SELECT COUNT(DISTINCT l.job_number) FROM fire_job_estimate_links l "
            "JOIN estimates e ON e.id=l.estimate_id WHERE e.status='completed'"
        ).fetchone()[0],2)
        invoice_job = self.db.execute(
            'SELECT l.job_number FROM invoices i JOIN fire_job_estimate_links l '
            'ON i.estimate_id=l.estimate_id WHERE i.id=?',('invoice-01',)
        ).fetchone()[0]
        self.assertEqual(invoice_job,plan['mapping']['quote-02'])
        self.assertEqual(self.db.execute(
            "SELECT amount_cents FROM payments WHERE id='payment-01'").fetchone()[0],7000)
        self.assertEqual(self.db.execute(
            "SELECT total_cents FROM invoices WHERE id='invoice-01'").fetchone()[0],14000)
        trigger_names={r[0] for r in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'fire_job_%'")}
        self.assertEqual(trigger_names,{
            'fire_job_numbers_no_update','fire_job_numbers_no_delete',
            'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete'
        })
        for sql in (
            'UPDATE fire_job_numbers SET job_number=99 WHERE job_number=1',
            'DELETE FROM fire_job_numbers WHERE job_number=1',
            "UPDATE fire_job_estimate_links SET job_number=999 WHERE estimate_id='quote-01'",
            "DELETE FROM fire_job_estimate_links WHERE estimate_id='quote-01'",
        ):
            with self.subTest(sql=sql),self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        # A new unrelated quote gets the NEXT serial, never an existing one;
        # the saved revision continues to share the original immutable ID.
        self.insert_estimate('quote-08','cust-a','draft',11)
        self.db.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES "
            "('quote-08','2026-10-11T12:00:00Z')"
        )
        self.db.execute(
            "INSERT INTO fire_job_estimate_links(estimate_id,job_number) "
            "SELECT 'quote-08',job_number FROM fire_job_numbers "
            "WHERE root_estimate_id='quote-08'"
        )
        self.assertEqual(self.db.execute(
            "SELECT job_number FROM fire_job_estimate_links WHERE estimate_id='quote-08'"
        ).fetchone()[0],7)
        self.assertEqual(self.db.execute(
            "SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'"
        ).fetchone()[0],7)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_fresh_live_starts_at_one_without_importing_qa_jobs(self):
        # Contract for the future launch, NOT an assertion that actual LIVE D1
        # is empty. QA and LIVE must have separately bound physical databases.
        self.insert_customer('synthetic-qa-customer',1)
        for number in range(1,8):
            self.insert_estimate(
                'qa-quote-%02d' % number,'synthetic-qa-customer',
                'completed' if number == 1 else 'draft',number+3
            )
        qa_plan=JOB.analyze(self.db)
        self.assertEqual(qa_plan['distinctJobs'],7)
        self.assertEqual(qa_plan['revisionLinks'],0)
        self.assertEqual(qa_plan['completedJobs'],1)
        JOB.rehearse_in_memory(self.db,qa_plan)

        # Stand-in for an independently provisioned, genuinely empty LIVE.
        # NEVER copy the synthetic QA estimate/number rows into this database.
        live=sqlite3.connect(':memory:')
        self.addCleanup(live.close)
        migrations=sorted(QA_MIGRATIONS.glob('[0-9][0-9][0-9][0-9]_*.sql'))
        self.assertEqual(len(migrations),25)
        for migration in migrations:
            live.executescript(migration.read_text(encoding='utf8'))
        live.execute('PRAGMA foreign_keys=ON')
        self.assertEqual(live.execute('SELECT COUNT(*) FROM estimates').fetchone()[0],0)
        live_plan=JOB.analyze(live)
        self.assertEqual(live_plan['distinctJobs'],0)
        JOB.rehearse_in_memory(live,live_plan)
        live.execute(
            "INSERT INTO customers(id,name,created_at) VALUES "
            "('live-first','Synthetic live-test only','2026-11-08T10:00:00Z')"
        )
        live.execute(
            "INSERT INTO estimates(id,customer_id,status,subtotal_cents,"
            "discount_cents,total_cents,deposit_cents,created_at) VALUES "
            "('live-quote-01','live-first','draft',10000,0,10000,5000,"
            "'2026-11-08T11:00:00Z')"
        )
        live.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES "
            "('live-quote-01','2026-11-08T11:00:00Z')"
        )
        self.assertEqual(live.execute(
            "SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='live-quote-01'"
        ).fetchone()[0],1)
        self.assertEqual(live.execute(
            "SELECT COUNT(*) FROM fire_job_numbers").fetchone()[0],1)
        self.assertEqual(live.execute('PRAGMA foreign_key_check').fetchall(),[])

        # QA remains its own counter: its seven numbered test jobs precede 8.
        self.insert_estimate('qa-quote-08','synthetic-qa-customer','draft',11)
        self.db.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES "
            "('qa-quote-08','2026-10-11T12:00:00Z')"
        )
        self.assertEqual(self.db.execute(
            "SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='qa-quote-08'"
        ).fetchone()[0],8)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],8)
        self.assertEqual(live.execute(
            'SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],1)

    def test_real_live_history_must_be_backfilled_not_reset(self):
        # If LIVE has any real prelaunch records, zeroing its permanent serial
        # would break history. Backfill preserved records before activation.
        self.insert_customer('live-real-example',1)
        self.insert_estimate('live-existing-01','live-real-example','completed',4)
        self.insert_estimate('live-existing-02','live-real-example','draft',5)
        plan=JOB.analyze(self.db)
        self.assertEqual(plan['distinctJobs'],2)
        JOB.rehearse_in_memory(self.db,plan)
        self.insert_estimate('live-new-job','live-real-example','draft',6)
        self.db.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES "
            "('live-new-job','2026-10-06T12:00:00Z')"
        )
        self.assertEqual(self.db.execute(
            "SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='live-new-job'"
        ).fetchone()[0],3)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_superseded_without_verified_audit_cannot_be_backfilled(self):
        self.insert_customer('cust-a',1)
        self.insert_estimate('quote-01','cust-a','superseded',4)
        with self.assertRaises(JOB.HistoryBlocked):
            JOB.analyze(self.db)
        self.assertIsNone(self.db.execute(
            "SELECT name FROM sqlite_master WHERE name='fire_job_numbers'").fetchone())

    def test_cross_customer_revision_cannot_borrow_another_job_number(self):
        self.insert_customer('cust-a',1)
        self.insert_customer('cust-b',2)
        self.insert_estimate('quote-01','cust-a','superseded',4)
        self.insert_estimate('quote-02','cust-b','completed',5)
        audit={'version':1,'originalId':'quote-01','replacementId':'quote-02'}
        self.db.execute(
            'INSERT INTO message_templates(key,body,updated_at) VALUES (?,?,?)',
            ('fire:quote-revision:v1:quote-01',json.dumps(audit),'2026-10-05T12:00:00Z')
        )
        with self.assertRaises(JOB.HistoryBlocked):
            JOB.analyze(self.db)
        self.assertIsNone(self.db.execute(
            "SELECT name FROM sqlite_master WHERE name='fire_job_numbers'").fetchone())

    def test_empty_qa_history_starts_at_one_without_fabricated_rows(self):
        plan=JOB.analyze(self.db)
        self.assertEqual(plan['estimateCount'],0)
        self.assertEqual(plan['distinctJobs'],0)
        JOB.rehearse_in_memory(self.db,plan)
        self.assertEqual(self.db.execute(
            'SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0],0)
        self.insert_customer('first-customer',1)
        self.insert_estimate('first-job','first-customer','draft',4)
        self.db.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) "
            "VALUES ('first-job','2026-10-04T12:00:00Z')"
        )
        self.assertEqual(self.db.execute(
            "SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='first-job'"
        ).fetchone()[0],1)

if __name__=='__main__':
    unittest.main()
