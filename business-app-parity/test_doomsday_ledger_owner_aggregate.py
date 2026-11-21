"""Synthetic-only tests for one owner-safe aggregate D1 refund/FK diagnostic."""
import re
import sqlite3
import unittest
from pathlib import Path

SQL = (Path(__file__).resolve().parent /
       "DOOMSDAY_LEDGER_OWNER_AGGREGATE_READ_ONLY.sql").read_text()
COLUMNS = ("invalid_refund_links", "succeeded_refund_ledger_mismatches",
           "over_reserved_payment_groups", "foreign_key_violations")


def fixture():
    db = sqlite3.connect(":memory:")
    db.executescript("""
      PRAGMA foreign_keys=OFF;
      CREATE TABLE estimates(id TEXT PRIMARY KEY);
      CREATE TABLE payments(
        id TEXT PRIMARY KEY, estimate_id TEXT REFERENCES estimates(id),
        status TEXT, amount_cents INTEGER, type TEXT, provider_id TEXT);
      CREATE TABLE payment_refunds(
        id TEXT PRIMARY KEY, payment_id TEXT REFERENCES payments(id),
        estimate_id TEXT, amount_cents INTEGER, status TEXT);
      INSERT INTO estimates VALUES ('estimate-synthetic');
      INSERT INTO payments VALUES
        ('original','estimate-synthetic','paid',1000,'Card','cs_synthetic'),
        ('credit','estimate-synthetic','paid',-250,'Refund',
         'refund:original:refund-1');
      INSERT INTO payment_refunds VALUES
        ('refund-1','original','estimate-synthetic',250,'succeeded'),
        ('refund-2','original','estimate-synthetic',500,'pending');
    """)
    return db


def read_only_probe(db):
    before = list(db.iterdump())
    changed = db.total_changes
    db.execute("PRAGMA query_only=ON")
    cursor = db.execute(SQL)
    assert tuple(x[0] for x in cursor.description) == COLUMNS
    rows = cursor.fetchall()
    assert len(rows) == 1
    assert all(isinstance(x, int) and x >= 0 for x in rows[0])
    assert list(db.iterdump()) == before
    assert db.total_changes == changed
    return tuple(rows[0])


class SafeOwnerLedgerQuery(unittest.TestCase):
    def test_single_select_with_aggregate_only_columns(self):
        code = re.sub(r"(?m)^\s*--[^\n]*$", "", SQL).strip()
        self.assertEqual(len([s for s in code.split(";") if s.strip()]), 1)
        self.assertTrue(code.startswith("SELECT\n"))
        self.assertFalse(re.search(
            r"\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|VACUUM|PRAGMA)\b",
            code, re.I))
        self.assertEqual(code.count("COUNT(*)"), 4)
        for name in COLUMNS:
            self.assertEqual(code.count("AS " + name), 1)

    def test_clean_original_refund_and_pending_reservation(self):
        with fixture() as db:
            self.assertEqual(read_only_probe(db), (0, 0, 0, 0))

    def test_missing_original_payment_is_counted_and_not_exposed(self):
        with fixture() as db:
            db.execute("INSERT INTO payment_refunds VALUES "
                       "('orphan','missing','estimate-synthetic',50,'failed')")
            result=read_only_probe(db)
            self.assertEqual(result[0], 1)
            self.assertGreaterEqual(result[3], 1)

    def test_mismatched_refund_ownership_is_counted(self):
        with fixture() as db:
            db.execute("UPDATE payment_refunds SET estimate_id='other' "
                       "WHERE id='refund-2'")
            self.assertEqual(read_only_probe(db), (1, 0, 0, 0))

    def test_wrong_succeeded_refund_ledger_amount_detected(self):
        with fixture() as db:
            db.execute("UPDATE payments SET amount_cents=-249 WHERE id='credit'")
            self.assertEqual(read_only_probe(db), (0, 1, 0, 0))

    def test_missing_succeeded_refund_ledger_detected(self):
        with fixture() as db:
            db.execute("DELETE FROM payments WHERE id='credit'")
            self.assertEqual(read_only_probe(db), (0, 1, 0, 0))

    def test_excess_pending_plus_succeeded_refunds_detected(self):
        with fixture() as db:
            db.execute("UPDATE payment_refunds SET amount_cents=800 WHERE id='refund-2'")
            self.assertEqual(read_only_probe(db), (0, 0, 1, 0))

    def test_foreign_key_failure_detected_without_record_details(self):
        with fixture() as db:
            db.execute("INSERT INTO payments VALUES "
                       "('unknown-estimate','not-a-customer','paid',100,"
                       "'Cash','manual-test')")
            self.assertEqual(read_only_probe(db), (0, 0, 0, 1))

    def test_missing_ledger_schema_is_error_not_zero(self):
        with sqlite3.connect(":memory:") as db:
            db.execute("CREATE TABLE payments(id TEXT)")
            db.execute("PRAGMA query_only=ON")
            with self.assertRaises(sqlite3.OperationalError):
                db.execute(SQL).fetchall()


if __name__ == "__main__":
    unittest.main(verbosity=2)
