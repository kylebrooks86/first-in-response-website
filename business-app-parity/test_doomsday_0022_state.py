"""Recovery metadata diagnostics on synthetic SQLite only; no remote execution."""
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parent
SQL = (ROOT / 'DOOMSDAY_0022_STATE_READ_ONLY.sql').read_text()
INDEX = 'idx_payments_stripe_provider_unique'
MIGRATION = '0022_stripe_provider_uniqueness.sql'


class RecoveryState(unittest.TestCase):
    def test_target_recovery_states_are_read_only(self):
        cases = [
            ('absent', [], None, 'BOTH_ABSENT_REVIEW_PREFLIGHT'),
            ('complete', [MIGRATION], 'canonical', 'BOTH_PRESENT_REVIEW_EXACT_DEFINITION'),
            ('index only', [], 'canonical', 'STOP_INDEX_WITHOUT_JOURNAL'),
            ('journal only', [MIGRATION], None, 'STOP_JOURNAL_WITHOUT_INDEX'),
            ('duplicate journal', [MIGRATION, MIGRATION], 'canonical', 'STOP_DUPLICATE_JOURNAL_ENTRIES'),
            ('unexpected journal', ['0022_unreviewed.sql'], None, 'STOP_UNEXPECTED_JOURNAL_NAME'),
            ('nonunique index', [MIGRATION], f'CREATE INDEX {INDEX} ON payments(provider_id) WHERE provider_id GLOB \'cs_*\'', 'STOP_INDEX_METADATA_MISMATCH'),
            ('wrong column', [MIGRATION], f'CREATE UNIQUE INDEX {INDEX} ON payments(id) WHERE id IS NOT NULL', 'STOP_INDEX_METADATA_MISMATCH'),
            ('nonpartial index', [MIGRATION], f'CREATE UNIQUE INDEX {INDEX} ON payments(provider_id)', 'STOP_INDEX_METADATA_MISMATCH'),
            ('wrong predicate needs review', [MIGRATION], f'CREATE UNIQUE INDEX {INDEX} ON payments(provider_id) WHERE provider_id GLOB \'wrong_*\'', 'BOTH_PRESENT_REVIEW_EXACT_DEFINITION'),
        ]
        self.assertEqual(len([q for q in re.sub(r'--[^\n]*', '', SQL).split(';') if q.strip()]), 1)
        for target in ('live', 'doomsday', 'staging'):
            migrations = ROOT / 'adapters' / target / 'drizzle'
            for label, journal, index_sql, expected in cases:
                with self.subTest(target=target, state=label), sqlite3.connect(':memory:') as db:
                    for path in sorted(migrations.glob('*.sql')):
                        if not path.name.endswith('_stripe_provider_uniqueness.sql'):
                            db.executescript(path.read_text())
                    db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)')
                    db.executemany('INSERT INTO d1_migrations(name) VALUES(?)', [(name,) for name in journal])
                    if index_sql:
                        db.executescript((ROOT / 'adapters/doomsday/drizzle' / MIGRATION).read_text() if index_sql == 'canonical' else index_sql)
                    before, changes = list(db.iterdump()), db.total_changes
                    # SQLite query_only enforces that the diagnostic cannot mutate data/schema.
                    db.execute('PRAGMA query_only=ON')
                    result = db.execute(SQL)
                    rows = result.fetchall()
                    self.assertEqual(len(rows), 1)
                    self.assertEqual(rows[0][0], expected)
                    self.assertEqual(list(db.iterdump()), before)
                    self.assertEqual(db.total_changes, changes)
                    if index_sql and index_sql != 'canonical':
                        self.assertIn(index_sql, rows[0])

    def test_missing_journal_is_a_blocking_error(self):
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE payments(id TEXT,provider_id TEXT)')
            db.execute('PRAGMA query_only=ON')
            with self.assertRaises(sqlite3.OperationalError):
                db.execute(SQL)

    def test_missing_payments_table_stops(self):
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE d1_migrations(name TEXT)')
            db.execute('PRAGMA query_only=ON')
            self.assertEqual(db.execute(SQL).fetchone()[0], 'STOP_MISSING_PAYMENTS_TABLE')


if __name__ == '__main__':
    unittest.main(verbosity=2)
