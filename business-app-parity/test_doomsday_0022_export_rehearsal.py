"""Synthetic only: restore an owner-shaped SQL dump and rehearse 0022 in RAM."""
import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from test_doomsday_export_restore import fixture
from rehearse_doomsday_0022_export import rehearse_export, reviewed_migration_sql


class LocalGate5Rehearsal(unittest.TestCase):
    def test_valid_owner_shaped_export_rehearses_index_and_exact_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            source = fixture(directory)
            before = source.read_bytes()
            checksum = hashlib.sha256(before).hexdigest()
            report = rehearse_export(source, expected_sha256=checksum)
            self.assertTrue(report["pre0022ExportRestorationValidated"])
            self.assertTrue(report["localMigration0022RehearsalPassed"])
            self.assertTrue(report["localRollbackPreservedPre0022State"])
            self.assertFalse(report["hostedDatabaseChanged"])
            self.assertFalse(report["liveMigrationAuthorized"])
            self.assertFalse(report["releaseGateAccepted"])
            self.assertEqual(report["officialReleaseReadinessPercent"], 30)
            self.assertEqual(report["ownerExportSha256"], checksum)
            self.assertEqual(source.read_bytes(), before)
            serialized = json.dumps(report)
            for sensitive in ("TEST PRIVATE CUSTOMER", "cs_secret-fixture",
                              "synthetic-private-customer", "synthetic-estimate"):
                self.assertNotIn(sensitive, serialized)

    def test_collision_fails_closed_before_index_or_journal_change(self):
        def add_duplicate(db):
            db.execute("""INSERT INTO payments(id,estimate_id,type,amount_cents,
                       status,provider_id,created_at) VALUES
                       ('dupe','synthetic-estimate','Card',1000,'paid',
                       'cs_secret-fixture','2026-10-15')""")
        with tempfile.TemporaryDirectory() as directory:
            source = fixture(directory, modify=add_duplicate)
            before = source.read_bytes()
            result = rehearse_export(source)
            self.assertFalse(result["pre0022ExportRestorationValidated"])
            self.assertFalse(result["localMigration0022RehearsalPassed"])
            self.assertTrue(result["stoppedBeforeRehearsal"])
            self.assertEqual(source.read_bytes(), before)

    def test_post_0022_export_is_not_treated_as_pre_migration_backup(self):
        def apply_beforehand(db):
            _, _ = reviewed_migration_sql()
            db.executescript(Path(__file__).resolve().parent.joinpath(
                "adapters/doomsday/drizzle/0022_stripe_provider_uniqueness.sql").read_text())
            db.execute("INSERT INTO d1_migrations(name) VALUES ('0022_stripe_provider_uniqueness.sql')")
        with tempfile.TemporaryDirectory() as directory:
            result = rehearse_export(fixture(directory,modify=apply_beforehand))
            self.assertFalse(result["localMigration0022RehearsalPassed"])
            self.assertTrue(result["stoppedBeforeRehearsal"])

    def test_incomplete_source_and_wrong_sha_cannot_rehearse(self):
        with tempfile.TemporaryDirectory() as directory:
            source = fixture(directory)
            with self.assertRaisesRegex(ValueError, "checksum differs"):
                rehearse_export(source, expected_sha256="0"*64)
            source.write_text("CREATE TABLE unrelated(id INTEGER);")
            with self.assertRaises((sqlite3.Error, ValueError)):
                rehearse_export(source)

    def test_migration_ddl_drift_is_blocked_without_running_it(self):
        ddl, original_sha = reviewed_migration_sql()
        self.assertIn("CREATE UNIQUE INDEX", ddl)
        self.assertEqual(len(original_sha), 64)
        with mock.patch("rehearse_doomsday_0022_export.CANDIDATE") as path:
            path.read_text.return_value="DROP TABLE payments;"
            with self.assertRaisesRegex(ValueError, "reviewed additive DDL"):
                reviewed_migration_sql()
        with mock.patch("rehearse_doomsday_0022_export.CANDIDATE") as path:
            path.read_text.return_value=ddl.replace("CREATE UNIQUE INDEX", "CREATE INDEX") + ";"
            with self.assertRaisesRegex(ValueError, "reviewed additive DDL"):
                reviewed_migration_sql()

if __name__=="__main__":
    unittest.main(verbosity=2)
