"""FIRE Job # source-only SQLite negative controls; no provider connection."""
from pathlib import Path
import sqlite3
import unittest

ROOT=Path(__file__).resolve().parent
DOOMSDAY=ROOT/'adapters'/'doomsday'/'drizzle'
SCHEMA=ROOT/'job-numbering'/'job_numbers_v1.sql'

class JobNumberingTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        files=sorted(DOOMSDAY.glob('[0-9][0-9][0-9][0-9]_*.sql'))
        self.assertEqual(len(files),25)
        for path in files: self.db.executescript(path.read_text(encoding='utf8'))
        objects={r[0] for r in self.db.execute("SELECT name FROM sqlite_master")}
        self.assertNotIn('fire_job_numbers',objects)
        self.db.executescript(SCHEMA.read_text(encoding='utf8'))
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute("INSERT INTO customers(id,name,created_at) VALUES('customer','FIRE Synthetic','2026-10-29T00:00:00Z')")

    def estimate(self,identity,status='draft'):
        self.db.execute("""INSERT INTO estimates
          (id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at)
          VALUES (?,'customer',?,10000,0,10000,5000,'2026-10-29T00:00:00Z')""",(identity,status))

    def first(self,identity):
        self.estimate(identity)
        self.db.execute("INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,'2026-10-29T00:00:00Z')",(identity,))
        self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_numbers WHERE root_estimate_id=?",(identity,identity))
        return self.db.execute('SELECT job_number FROM fire_job_estimate_links WHERE estimate_id=?',(identity,)).fetchone()[0]

    def test_unique_increasing_jobs_and_repeat_customer(self):
        self.assertEqual(self.first('a'),1)
        self.assertEqual(self.first('b'),2)
        self.assertEqual(self.first('c'),3)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],3)

    def test_quote_replacement_retains_the_same_number(self):
        self.assertEqual(self.first('original'),1)
        self.db.execute("UPDATE estimates SET status='superseded' WHERE id='original'")
        self.estimate('replacement')
        changed=self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_estimate_links WHERE estimate_id=?",('replacement','original'))
        self.assertEqual(changed.rowcount,1)
        self.assertEqual(self.db.execute("SELECT job_number FROM fire_job_estimate_links WHERE estimate_id='replacement'").fetchone()[0],1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM fire_job_numbers").fetchone()[0],1)

    def test_completed_count_excludes_draft_declined_and_deduplicates_revisions(self):
        self.first('done')
        self.first('declined')
        self.first('draft')
        self.db.execute("UPDATE estimates SET status='completed' WHERE id='done'")
        self.db.execute("UPDATE estimates SET status='declined' WHERE id='declined'")
        self.estimate('done-replacement','completed')
        self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_estimate_links WHERE estimate_id=?",('done-replacement','done'))
        count=self.db.execute("SELECT COUNT(DISTINCT links.job_number) FROM fire_job_estimate_links links JOIN estimates e ON e.id=links.estimate_id WHERE e.status='completed'").fetchone()[0]
        self.assertEqual(count,1)

    def test_duplicate_estimate_link_or_number_cannot_be_allocated(self):
        self.first('one')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES ('one',1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES (1,'different','2026-10-29')")

    def test_mapping_number_and_links_are_immutable(self):
        self.first('one')
        for sql in ("UPDATE fire_job_numbers SET job_number=99 WHERE job_number=1",
                    "DELETE FROM fire_job_numbers WHERE job_number=1",
                    "UPDATE fire_job_estimate_links SET job_number=99 WHERE estimate_id='one'",
                    "DELETE FROM fire_job_estimate_links WHERE estimate_id='one'"):
            with self.subTest(sql=sql),self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)

    def test_no_reuse_after_deleted_unallocated_estimate(self):
        self.first('one')
        self.estimate('two')
        self.db.execute("INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES ('two','2026-10-29')")
        self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES ('two',2)")
        self.first('three')
        self.assertEqual(self.db.execute("SELECT job_number FROM fire_job_estimate_links WHERE estimate_id='three'").fetchone()[0],3)

    def test_foreign_keys_prevent_orphans(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES ('missing',999)")
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(),[])
        self.assertEqual(self.db.execute("PRAGMA integrity_check").fetchone(),('ok',))

    def test_prototype_cannot_be_reapplied_silently(self):
        with self.assertRaises(sqlite3.OperationalError):
            self.db.executescript(SCHEMA.read_text())
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM fire_job_numbers").fetchone()[0],0)

if __name__=='__main__':
    unittest.main()
