"""Disposable SQLite contract checks; no production migrations or customer data."""
import sqlite3
import unittest
from pathlib import Path

class PropertyContracts(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('CREATE TABLE customers(id TEXT PRIMARY KEY,address TEXT)')
        self.db.executemany('INSERT INTO customers VALUES (?,?)', [('a', 'Synthetic default'), ('b', 'Synthetic other')])
        self.db.executescript((Path(__file__).resolve().parents[1] / 'db/candidate-customer-properties.sql').read_text())
        self.db.execute("INSERT INTO customer_properties VALUES('p','a','Synthetic Property','Building A',1,1,'2026-10-14T00:00:00Z')")
    def tearDown(self):
        self.db.close()
    def rejected(self, sql):
        before = self.db.execute('SELECT * FROM customer_properties').fetchall()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql)
        self.assertEqual(before, self.db.execute('SELECT * FROM customer_properties').fetchall())
    def test_address_is_immutable(self):
        self.rejected("UPDATE customer_properties SET address='Synthetic overwrite' WHERE id='p'")
    def test_customer_ownership_is_immutable(self):
        self.rejected("UPDATE customer_properties SET customer_id='b' WHERE id='p'")
    def test_deletion_is_rejected(self):
        self.rejected("DELETE FROM customer_properties WHERE id='p'")
    def test_orphan_is_rejected(self):
        self.rejected("INSERT INTO customer_properties VALUES('orphan','missing','Synthetic','',1,1,'now')")
    def test_blank_address_is_rejected(self):
        self.rejected("INSERT INTO customer_properties VALUES('blank','a',' ','',1,1,'now')")
    def test_archive_requires_exact_revision_transition_and_retains_record(self):
        self.rejected("UPDATE customer_properties SET active=0 WHERE id='p'")
        self.db.execute("UPDATE customer_properties SET active=0,revision=revision+1 WHERE id='p' AND active=1 AND revision=1")
        self.assertEqual(self.db.execute("SELECT active,revision,address FROM customer_properties WHERE id='p'").fetchone(), (0, 2, 'Synthetic Property'))
        self.rejected("UPDATE customer_properties SET active=1,revision=3 WHERE id='p'")
    def test_identical_address_buildings_are_not_merged(self):
        self.db.execute("INSERT INTO customer_properties VALUES('second','a','Synthetic Property','Building B',1,1,'now')")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM customer_properties').fetchone()[0], 2)

if __name__ == '__main__':
    unittest.main(verbosity=2)
