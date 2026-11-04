"""Owner-facing D1 screenshot query: aggregate only, no remote access or writes."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SQL = (ROOT / "DOOMSDAY_0022_OWNER_CONSOLE_READ_ONLY.sql").read_text()
MIGRATION = (ROOT / "adapters/doomsday/drizzle/0022_stripe_provider_uniqueness.sql").read_text()
MIGRATION_NAME = "0022_stripe_provider_uniqueness.sql"


def fixture(*, journal=False, index=False, providers=()):
    db = sqlite3.connect(":memory:")
    db.executescript("""CREATE TABLE payments(id TEXT PRIMARY KEY,provider_id TEXT);
        CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL);""")
    db.executemany("INSERT INTO payments(id,provider_id) VALUES (?,?)",
                   [(str(i), provider) for i, provider in enumerate(providers)])
    if index:
        db.executescript(MIGRATION)
    if journal:
        db.execute("INSERT INTO d1_migrations(name) VALUES(?)", (MIGRATION_NAME,))
    db.commit()
    return db


def probe(db):
    before = list(db.iterdump())
    changes = db.total_changes
    db.execute("PRAGMA query_only=ON")
    rows = db.execute(SQL).fetchall()
    assert len(rows) == 1, "Screenshot query must return exactly one aggregate row"
    assert before == list(db.iterdump()), "D1 evidence query changed database data"
    assert changes == db.total_changes, "D1 evidence query wrote data"
    return tuple(rows[0])


class ScreenshotEvidence(unittest.TestCase):
    def test_safe_single_select_only(self):
        statements = [s.strip() for s in re.sub(r"(?m)^\s*--[^\n]*$", "", SQL).split(";") if s.strip()]
        self.assertEqual(len(statements), 1)
        self.assertTrue(statements[0].startswith("SELECT\n"))
        self.assertFalse(re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH|VACUUM)\b",
                                   statements[0], re.I))
        self.assertNotIn("r.id AS", statements[0])
        self.assertNotIn("SELECT *", statements[0])
        self.assertEqual(SQL.count("AS migration_0022_rows"), 1)
        self.assertEqual(SQL.count("AS index_0022_rows"), 1)
        self.assertEqual(SQL.count("AS duplicate_provider_groups"), 1)

    def test_known_owner_0021_state_is_not_migration_approval(self):
        with fixture() as db:
            self.assertEqual(probe(db), (0, 0, 0))

    def test_unapplied_index_and_journal_separately_visible(self):
        for index, journal, expected in [(False, True, (1,0,0)),
                                         (True, False, (0,1,0)),
                                         (True, True, (1,1,0))]:
            with self.subTest(index=index,journal=journal), fixture(index=index, journal=journal) as db:
                self.assertEqual(probe(db), expected)

    def test_duplicate_checkout_and_refund_provider_groups_detected(self):
        with fixture(providers=['cs_test','cs_test','refund:abc','refund:abc',
                                'Cash','Cash','CS_case','CS_case',None,None]) as db:
            self.assertEqual(probe(db), (0,0,2))

    def test_unrelated_manual_references_do_not_block(self):
        with fixture(providers=['cash','cash','manual-reference','manual-reference',None,None]) as db:
            self.assertEqual(probe(db), (0,0,0))

    def test_index_enforces_uniqueness_after_future_reviewed_apply(self):
        with fixture(index=True,journal=True,providers=['cs_ok','refund:ok','Cash','Cash']) as db:
            self.assertEqual(probe(db), (1,1,0))
            db.execute("PRAGMA query_only=OFF")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("INSERT INTO payments VALUES ('z','cs_ok')")
            self.assertEqual(probe(db), (1,1,0))

    def test_missing_journal_or_payments_is_error_not_zero(self):
        for ddl in ["CREATE TABLE payments(id TEXT,provider_id TEXT);",
                    "CREATE TABLE d1_migrations(id INTEGER,name TEXT);"]:
            with self.subTest(ddl=ddl), sqlite3.connect(":memory:") as db:
                db.executescript(ddl)
                db.execute("PRAGMA query_only=ON")
                with self.assertRaises(sqlite3.OperationalError):
                    db.execute(SQL)


if __name__ == "__main__":
    unittest.main(verbosity=2)
