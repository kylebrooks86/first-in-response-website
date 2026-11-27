"""Synthetic regression for offline, no-secrets/no-network D1 dump restoration."""
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from verify_doomsday_d1_export import migration_baseline, review_export, D1_DATABASE_UUID


def fixture(folder, *, modify=None, name="synthetic.sql"):
    migrations, _ = migration_baseline()
    db = sqlite3.connect(":memory:")
    try:
        for migration in migrations:
            db.executescript(migration.read_text(encoding="utf-8"))
        db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
        db.executemany("INSERT INTO d1_migrations(name) VALUES (?)",
                       [(file.name,) for file in migrations])
        db.execute("INSERT INTO customers(id,name,created_at) VALUES (?,?,?)",
                   ("synthetic-private-customer", "TEST PRIVATE CUSTOMER", "2026-10-15"))
        db.execute("""INSERT INTO estimates
            (id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at)
            VALUES ('synthetic-estimate','synthetic-private-customer','completed',
                    10000,10000,5000,'2026-10-15')""")
        db.execute("""INSERT INTO payments
            (id,estimate_id,type,amount_cents,status,provider_id,created_at)
            VALUES ('synthetic-payment','synthetic-estimate','Card',10000,'paid',
                    'cs_secret-fixture','2026-10-15')""")
        if modify is not None:
            modify(db)
        result = "\n".join(db.iterdump()) + "\n"
        path = Path(folder) / name
        path.write_text(result, encoding="utf-8")
        return path
    finally:
        db.close()


class D1ExportOfflineRestore(unittest.TestCase):
    def test_full_synthetic_export_restores_and_only_emits_safe_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            file = fixture(folder)
            original = file.read_bytes()
            sha = hashlib.sha256(original).hexdigest()
            receipt = review_export(file, expected_sha256=sha)
            self.assertTrue(receipt["offlineRestorationValidated"])
            self.assertTrue(all(receipt["checks"].values()))
            self.assertEqual(receipt["expectedBaselineMigrationCount"],22)
            self.assertEqual(receipt["assertedD1DatabaseUuid"],D1_DATABASE_UUID)
            self.assertTrue(receipt["suppliedExpectedExportHashMatched"])
            self.assertFalse(receipt["ownerExportSourceIndependentlyAuthenticated"])
            self.assertFalse(receipt["exportCompletenessAgainstLiveDatabaseVerified"])
            self.assertFalse(receipt["migrationAuthorized"])
            self.assertFalse(receipt["releaseGateAccepted"])
            self.assertEqual(file.read_bytes(), original)
            output=json.dumps(receipt)
            for secret in ("TEST PRIVATE CUSTOMER","cs_secret-fixture",
                           "synthetic-private-customer","synthetic-estimate"):
                self.assertNotIn(secret,output)

    def test_wrong_owner_export_hash_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            file = fixture(folder)
            with self.assertRaisesRegex(ValueError,"checksum differs"):
                review_export(file,expected_sha256="0"*64)

    def test_0022_applied_to_export_is_rejected_for_prechange_snapshot(self):
        def changed(db):
            source = (Path(__file__).resolve().parent/
                      "adapters/doomsday/drizzle/0022_stripe_provider_uniqueness.sql")
            db.executescript(source.read_text())
            db.execute("INSERT INTO d1_migrations(name) VALUES "
                       "('0022_stripe_provider_uniqueness.sql')")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["offlineRestorationValidated"])
            self.assertFalse(receipt["checks"]["baselineJournalExactly0000Through0021"])
            self.assertFalse(receipt["checks"]["nextMigrationIndexAbsent"])

    def test_missing_migration_journal_row_is_detected(self):
        def changed(db):
            db.execute("DELETE FROM d1_migrations "
                       "WHERE name='0021_manual_processing_fees.sql'")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["offlineRestorationValidated"])
            self.assertFalse(receipt["checks"]["baselineJournalExactly0000Through0021"])

    def test_missing_index_blocks_source_schema_match(self):
        def changed(db):
            db.execute("DROP INDEX idx_payments_estimate_status")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["checks"]["applicationSchemaMatchesCandidatePre0022"])

    def test_duplicate_stripe_provider_references_block(self):
        def changed(db):
            db.execute("""INSERT INTO payments
                (id,estimate_id,type,amount_cents,status,provider_id,created_at)
                VALUES ('duplicate','synthetic-estimate','Card',1000,'paid',
                        'cs_secret-fixture','2026-10-15')""")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["checks"]["fourFinancialLedgerAnomalyCountsZero"])

    def test_invalid_foreign_key_is_reported_without_leaking_customer_id(self):
        def changed(db):
            db.execute("""INSERT INTO payments
                (id,estimate_id,type,amount_cents,status,provider_id,created_at)
                VALUES ('orphan','DO-NOT-LEAK','Cash',100,'paid','cash:synthetic',
                        '2026-10-15')""")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["checks"]["foreignKeysClean"])
            self.assertNotIn("DO-NOT-LEAK",json.dumps(receipt))

    def test_unknown_trigger_is_rejected(self):
        def changed(db):
            db.execute("""CREATE TRIGGER unapproved_trigger AFTER UPDATE ON customers
                BEGIN UPDATE customers SET name='changed' WHERE id=NEW.id; END""")
        with tempfile.TemporaryDirectory() as folder:
            receipt=review_export(fixture(folder,modify=changed))
            self.assertFalse(receipt["checks"]["applicationSchemaMatchesCandidatePre0022"])

    def test_malformed_export_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/"bad.sql"
            file.write_text("CREATE TABLE changed(;")
            with self.assertRaises(sqlite3.Error):
                review_export(file)

    def test_export_cannot_attach_another_database(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/"malicious.sql"
            file.write_text("ATTACH DATABASE '/tmp/unsafe-d1-export.db' AS other;")
            with self.assertRaises(sqlite3.Error):
                review_export(file)
            self.assertFalse(Path("/tmp/unsafe-d1-export.db").exists())

    def test_dangerous_pragma_cannot_be_used_in_dump(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/"danger.sql"
            file.write_text("PRAGMA writable_schema=ON;")
            with self.assertRaises(sqlite3.Error):
                review_export(file)

    def test_refuse_missing_or_symbolic_link_source(self):
        with tempfile.TemporaryDirectory() as folder:
            file=fixture(folder)
            linked=Path(folder)/"symlink.sql"
            linked.symlink_to(file)
            with self.assertRaisesRegex(ValueError,"regular local"):
                review_export(linked)
            with self.assertRaisesRegex(ValueError,"regular local"):
                review_export(Path(folder)/"missing.sql")


if __name__ == "__main__":
    unittest.main(verbosity=2)
