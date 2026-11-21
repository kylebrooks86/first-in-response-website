"""Strict negative tests of the isolated staging 22-to-25 rehearsal."""
import sqlite3
import tempfile
from pathlib import Path
import unittest
from rehearse_staging_22_to_25 import Blocked, rehearse, TAIL

BASE = """CREATE TABLE customers(id TEXT PRIMARY KEY);
CREATE TABLE estimates(id TEXT PRIMARY KEY REFERENCES customers(id));
CREATE TABLE payments(id TEXT PRIMARY KEY, provider_id TEXT);
CREATE TABLE payment_refunds(id TEXT PRIMARY KEY);
CREATE TABLE payment_checkout_sessions(id TEXT PRIMARY KEY);
CREATE TABLE sqliteX_owner_backup_data(id TEXT PRIMARY KEY, payload TEXT NOT NULL);"""
TAIL_SQL = (
 "CREATE UNIQUE INDEX idx_payments_stripe_provider_unique ON payments(provider_id) WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*';",
 """CREATE TABLE deposit_policy_events(id TEXT PRIMARY KEY REFERENCES estimates(id), estimate_id TEXT, confirmation_id TEXT, actor_email TEXT, mode TEXT, previous_total_cents INTEGER, previous_deposit_cents INTEGER, new_deposit_cents INTEGER, paid_principal_cents INTEGER, created_at TEXT);
 CREATE INDEX idx_deposit_policy_events_estimate_time ON deposit_policy_events(id);
 CREATE TRIGGER deposit_policy_events_no_update BEFORE UPDATE ON deposit_policy_events BEGIN SELECT RAISE(ABORT,'immutable'); END;
 CREATE TRIGGER deposit_policy_events_no_delete BEFORE DELETE ON deposit_policy_events BEGIN SELECT RAISE(ABORT,'immutable'); END;""",
 """CREATE TABLE deposit_agreement_snapshots(event_id TEXT PRIMARY KEY REFERENCES deposit_policy_events(id), estimate_id TEXT, document_version TEXT, document_digest TEXT, total_cents INTEGER, deposit_cents INTEGER, mode TEXT, scope_json TEXT, agreement_text TEXT, signed_name TEXT, photo_release TEXT, signed_at TEXT, accepted_at TEXT);
 CREATE INDEX idx_deposit_agreement_snapshots_estimate ON deposit_agreement_snapshots(event_id);
 CREATE TRIGGER deposit_agreement_snapshots_no_update BEFORE UPDATE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'immutable'); END;
 CREATE TRIGGER deposit_agreement_snapshots_no_delete BEFORE DELETE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'immutable'); END;""",
)

class RehearsalTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='fire-staging-rehearsal-')
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name) / "migrations"
        self.root.mkdir()
        for number in range(22):
            (self.root / f'{number:04d}_historical.sql').write_text(BASE if number == 0 else 'SELECT 1;')
        for name, sql in zip(TAIL, TAIL_SQL):
            (self.root / name).write_text(sql)

    def export(self, *, collision=False, wrong_order=False, already=False,
               journal_ids=None):
        path = self.root.parent / 'owner-private-export.sql'
        with sqlite3.connect(':memory:') as db:
            for p in sorted(self.root.glob('*.sql')):
                if p.name.startswith(('0022_', '0023_', '0024_')):
                    continue
                db.executescript(p.read_text())
            db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
            names = sorted(p.name for p in self.root.glob('*.sql') if p.name[:4].isdigit() and p.name[:4] < '0022')
            if wrong_order:
                names[0], names[1] = names[1], names[0]
            ids = list(range(1, len(names)+1)) if journal_ids is None else journal_ids
            self.assertEqual(len(ids), len(names))
            db.executemany('INSERT INTO d1_migrations(id, name) VALUES (?, ?)', zip(ids, names))
            if collision:
                db.executemany("INSERT INTO payments(id, provider_id) VALUES (?, 'cs_collision')", [('a',), ('b',)])
            else:
                db.execute("INSERT INTO payments(id, provider_id) VALUES ('a','cs_synthetic')")
            db.execute("INSERT INTO sqliteX_owner_backup_data(id,payload) VALUES ('owner-test-row','preserve-this-private-row')")
            if already:
                db.execute('CREATE TABLE deposit_policy_events(id TEXT)')
            db.commit()
            path.write_text('\n'.join(db.iterdump())+'\n')
        return path

    def test_source_rehearsal_passes_without_remote_work(self):
        report = rehearse(self.root)
        self.assertTrue(report['rehearsalPassed'])
        self.assertEqual(report['preservedExistingTables'], 7)
        self.assertFalse(report['actualCloudflareD1Migrated'])
        self.assertEqual(len(report['appliedInMemory']), 3)
        self.assertFalse(report['privateExportReplayedInMemory'])
        self.assertTrue(report['syntheticTailBehaviorVerified'])

    def test_private_export_rehearsal_preserves_all_existing_rows(self):
        report = rehearse(self.root, self.export())
        self.assertEqual(report['baseline'], 'owner-private-export')
        self.assertTrue(report['privateExportReplayedInMemory'])
        self.assertTrue(report['rehearsalPassed'])
        self.assertEqual(report['preservedExistingTables'], 7)
        self.assertTrue(report['syntheticTailBehaviorVerified'])

    def test_rejects_duplicate_stripe_provider_ids(self):
        with self.assertRaisesRegex(Blocked, 'collision'):
            rehearse(self.root, self.export(collision=True))

    def test_rejects_swapped_journal_even_if_names_match(self):
        with self.assertRaisesRegex(Blocked, 'exact 22-migration'):
            rehearse(self.root, self.export(wrong_order=True))

    def test_rejects_shifted_journal_ids_even_when_names_are_exact(self):
        with self.assertRaisesRegex(Blocked, 'journal IDs must start at 1'):
            rehearse(self.root, self.export(journal_ids=list(range(2, 24))))

    def test_rejects_zero_based_journal_ids_even_when_names_are_exact(self):
        with self.assertRaisesRegex(Blocked, 'journal IDs must start at 1'):
            rehearse(self.root, self.export(journal_ids=list(range(22))))

    def test_rejects_gapped_journal_ids_even_when_names_are_exact(self):
        ids = list(range(1, 23))
        ids[10:] = [value + 1 for value in ids[10:]]
        with self.assertRaisesRegex(Blocked, 'journal IDs must start at 1'):
            rehearse(self.root, self.export(journal_ids=ids))

    def test_rejects_partially_applied_schema(self):
        with self.assertRaisesRegex(Blocked, 'already exist'):
            rehearse(self.root, self.export(already=True))

    def test_rejects_changed_private_rows_in_legitimate_sqlitex_table(self):
        # A pending migration must not silently delete records from a real sqliteX table.
        sql = self.root / TAIL[-1]
        sql.write_text(sql.read_text() + '\nDELETE FROM sqliteX_owner_backup_data;\n')
        with self.assertRaisesRegex(Blocked, 'Existing table data/columns changed'):
            rehearse(self.root, self.export())

    def test_rejects_unreviewed_sqlitex_object_created_by_tail(self):
        # The old LIKE 'sqlite_%' treated '_' as a wildcard and hid this table.
        sql = self.root / TAIL[-1]
        sql.write_text(sql.read_text() + '\nCREATE TABLE sqliteX_unreviewed_business_data(id TEXT PRIMARY KEY);\n')
        with self.assertRaisesRegex(Blocked, 'Unreviewed post-upgrade schema objects'):
            rehearse(self.root)

    def test_rejects_named_but_nonunique_provider_index(self):
        # Names alone previously passed. Real checkout/refund duplicates must fail.
        sql = self.root / TAIL[0]
        sql.write_text(sql.read_text().replace('CREATE UNIQUE INDEX', 'CREATE INDEX'))
        with self.assertRaisesRegex(Blocked, 'Stripe provider uniqueness'):
            rehearse(self.root)

    def test_rejects_named_but_noop_policy_update_trigger(self):
        sql = self.root / TAIL[1]
        sql.write_text(sql.read_text().replace("SELECT RAISE(ABORT,'immutable')",
                                               'SELECT 1', 1))
        with self.assertRaisesRegex(Blocked, 'deposit_policy_events UPDATE'):
            rehearse(self.root)

    def test_rejects_named_but_noop_agreement_delete_trigger(self):
        sql = self.root / TAIL[2]
        original = "BEFORE DELETE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'immutable')"
        self.assertIn(original, sql.read_text())
        sql.write_text(sql.read_text().replace(original,
                       'BEFORE DELETE ON deposit_agreement_snapshots BEGIN SELECT 1'))
        with self.assertRaisesRegex(Blocked, 'deposit_agreement_snapshots DELETE'):
            rehearse(self.root)

    def test_rejects_missing_migration(self):
        (self.root / '0017_historical.sql').unlink()
        with self.assertRaisesRegex(Blocked, '25-file'):
            rehearse(self.root)


class OwnerWindowsStagingBackupGuardTests(unittest.TestCase):
    def test_owner_export_is_consent_locked_and_reviews_complete_22_to_25_tail(self):
        # STATIC read of reviewed source only: NEVER invoke Wrangler or an owner backup.
        ps1 = (Path(__file__).resolve().parent /
               "owner_windows_doomsday_backup.ps1").read_text(encoding="utf-8")
        self.assertIn("[switch]$Export", ps1)
        self.assertIn("if (-not $Export)", ps1)
        self.assertIn("Read-Host ('Remote export can temporarily interrupt D1 queries.", ps1)
        self.assertIn("$consent -cne ('EXPORT ' + $uuid)", ps1)
        self.assertIn("afb2c05a-d794-4a9a-b580-924ce01c26ad", ps1)
        self.assertIn("$foundDb.Count -ne 1", ps1)
        self.assertIn("rehearse_staging_22_to_25.py", ps1)
        self.assertIn("$rehearsal --sql-export $path", ps1)
        self.assertIn("$checksumAfter -cne $checksum", ps1)
        self.assertIn("PRIVATE", ps1.upper())
        self.assertIn("photos", ps1.lower())
        self.assertNotIn("rehearse_doomsday_0022_export.py", ps1)
        self.assertNotIn("d1 migrations apply", ps1)
        self.assertNotIn("wrangler deploy", ps1)


if __name__ == '__main__':
    unittest.main()
