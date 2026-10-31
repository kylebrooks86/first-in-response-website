"""All tests are synthetic local SQLite; no private records or network."""
import sqlite3
import sys
import tempfile
from pathlib import Path
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parent))
from preflight_customer_history import (
    analyze,read_export,rehearse_in_memory,CustomerHistoryBlocked
)

def synthetic():
    db=sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript("""CREATE TABLE customers(
        id TEXT PRIMARY KEY,created_at TEXT NOT NULL,
        email TEXT,phone TEXT
    );
    INSERT INTO customers VALUES ('later','2026-10-02T00:00:00Z','later@example.invalid','9185550001');
    INSERT INTO customers VALUES ('tie-z','2026-10-01T00:00:00Z','z@example.invalid','9185550002');
    INSERT INTO customers VALUES ('tie-a','2026-10-01T00:00:00Z','a@example.invalid','9185550003');
    """)
    return db

class CustomerHistoryPreflight(unittest.TestCase):
    def test_stable_historical_backfill_untouched_origins(self):
        db=synthetic()
        try:
            plan=analyze(db)
            self.assertEqual(plan['mapping'],{'tie-a':1,'tie-z':2,'later':3})
            self.assertEqual(plan['timestampTies'],1)
            result=rehearse_in_memory(db,plan)
            self.assertTrue(result['inMemoryBackfillRehearsalPassed'])
            self.assertFalse(result['hostedMigrationApplied'])
            self.assertEqual(db.execute('SELECT customer_id,customer_number FROM fire_customer_numbers ORDER BY customer_number').fetchall(),
                             [('tie-a',1),('tie-z',2),('later',3)])
            with self.assertRaisesRegex(sqlite3.DatabaseError,'permanent'):
                db.execute('UPDATE fire_customer_numbers SET customer_number=21 WHERE customer_id=\'tie-a\'')
            with self.assertRaisesRegex(sqlite3.DatabaseError,'reused'):
                db.execute('DELETE FROM fire_customer_numbers WHERE customer_id=\'tie-a\'')
            db.execute("INSERT INTO customers VALUES ('future','2027-01-01T00:00:00Z',NULL,NULL)")
            db.execute("INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES ('future','2027-01-01T00:00:00Z')")
            self.assertEqual(db.execute("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='future'").fetchone(),(4,))
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
        finally:
            db.close()

    def test_first_launch_zero_customers_has_no_fake_serial_and_starts_at_one(self):
        db=sqlite3.connect(':memory:')
        try:
            db.execute('PRAGMA foreign_keys=ON')
            db.executescript("""CREATE TABLE customers(id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,email TEXT,phone TEXT);""")
            plan=analyze(db)
            self.assertEqual(plan['historicalCustomers'],0)
            self.assertEqual(plan['mapping'],{})
            self.assertTrue(rehearse_in_memory(db,plan)['inMemoryBackfillRehearsalPassed'])
            self.assertIsNone(db.execute("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").fetchone())
            db.execute("INSERT INTO customers VALUES ('first','2026-11-01T00:00:00Z',NULL,NULL)")
            db.execute("INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES('first','2026-11-01T00:00:00Z')")
            self.assertEqual(db.execute("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='first'").fetchone(),(1,))
        finally:
            db.close()

    def test_duplicate_email_refused_without_migration(self):
        db=synthetic()
        try:
            db.execute("UPDATE customers SET email=' A@example.invalid ' WHERE id='later'")
            with self.assertRaisesRegex(CustomerHistoryBlocked,'email'):
                analyze(db)
            self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='fire_customer_numbers'").fetchone())
        finally:
            db.close()

    def test_duplicate_normalized_phone_refused(self):
        db=synthetic()
        try:
            db.execute("UPDATE customers SET phone='(918) 555-0003' WHERE id='later'")
            with self.assertRaisesRegex(CustomerHistoryBlocked,'phone'):
                analyze(db)
        finally:
            db.close()

    def test_missing_timestamp_timezone_refused(self):
        db=synthetic()
        try:
            db.execute("UPDATE customers SET created_at='2026-10-01' WHERE id='later'")
            with self.assertRaises(CustomerHistoryBlocked):
                analyze(db)
        finally:
            db.close()

    def test_utc_offset_must_not_silently_change_number_order(self):
        db=synthetic()
        try:
            db.execute("UPDATE customers SET created_at='2026-10-01T01:00:00+01:00' WHERE id='later'")
            with self.assertRaisesRegex(CustomerHistoryBlocked,'canonical UTC'):
                analyze(db)
        finally:
            db.close()

    def test_mixed_utc_timestamp_precision_is_blocked(self):
        db=synthetic()
        try:
            db.execute("UPDATE customers SET created_at='2026-10-01T00:00:00.000Z' WHERE id='later'")
            with self.assertRaisesRegex(CustomerHistoryBlocked,'precisions'):
                analyze(db)
        finally:
            db.close()

    def test_existing_number_table_blocks_renumbering(self):
        db=synthetic()
        try:
            rehearse_in_memory(db,analyze(db))
            with self.assertRaisesRegex(CustomerHistoryBlocked,'already exists'):
                analyze(db)
        finally:
            db.close()

    def test_missing_schema_refused(self):
        db=sqlite3.connect(':memory:')
        try:
            with self.assertRaisesRegex(CustomerHistoryBlocked,'identity fields'):
                analyze(db)
        finally:
            db.close()

    def test_private_sql_only_restored_in_memory(self):
        sql="""CREATE TABLE customers(id TEXT PRIMARY KEY, created_at TEXT NOT NULL,
            email TEXT,phone TEXT);
        INSERT INTO customers VALUES ('private-a','2026-05-01T00:00:00Z',NULL,NULL);
        """
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'owner-export.sql'
            file.write_text(sql,encoding='utf-8')
            original=file.read_bytes()
            plan=read_export(file)
            self.assertEqual(plan['historicalCustomers'],1)
            self.assertTrue(plan['inMemoryBackfillRehearsalPassed'])
            self.assertEqual(file.read_bytes(),original)
            # Do not accept a symlink as a private export.
            alias=Path(directory)/'symlink.sql'
            alias.symlink_to(file)
            with self.assertRaises(CustomerHistoryBlocked):
                read_export(alias)

    def test_disallow_export_with_existing_serial_mapping(self):
        sql="""CREATE TABLE customers(id TEXT PRIMARY KEY,created_at TEXT);
        CREATE TABLE fire_customer_numbers(customer_number INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id TEXT NOT NULL);
        INSERT INTO customers VALUES ('private-a','2026-05-01T00:00:00Z');
        INSERT INTO fire_customer_numbers(customer_id) VALUES ('private-a');
        """
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'existing.sql'
            file.write_text(sql)
            with self.assertRaisesRegex(CustomerHistoryBlocked,'already exists'):
                read_export(file)

if __name__=='__main__':
    unittest.main()
