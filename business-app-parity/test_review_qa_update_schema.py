"""Strict negative controls for the read-only, pinned existing-QA schema review."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from review_qa_update_schema import (
    FIRST_QA_SOURCE, HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS,
    QAReviewStop, review
)

ROOT = Path(__file__).parent
SOURCE = ROOT / "adapters" / "doomsday" / "drizzle"
CHECKPOINT = "3d2c9f05e038c15e7ef0d372fd0af5d26bb7ca0b"


class ExistingQAReadOnlyDriftReview(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fire-qa-schema-review-")
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.first, self.latest = root / "old" / "drizzle", root / "new" / "drizzle"
        self.first.mkdir(parents=True)
        self.latest.mkdir(parents=True)
        for file in sorted(SOURCE.glob("*.sql")):
            if file.name in HISTORICAL_GIT_BLOBS:
                shutil.copyfile(file, self.first / file.name)
            shutil.copyfile(file, self.latest / file.name)

    def check_stop(self, fragment):
        with self.assertRaisesRegex(QAReviewStop, fragment):
            review(self.first, self.latest, CHECKPOINT)

    def test_exact_real_migrations_report_two_additions_and_no_approval(self):
        result = review(self.first, self.latest, CHECKPOINT)
        self.assertEqual(result["result"], "CODE_ONLY_QA_UPDATE_BLOCKED")
        self.assertEqual(result["pinnedOriginalSource"], FIRST_QA_SOURCE)
        self.assertEqual((result["originalSqlCount"], result["candidateSqlCount"]), (23, 25))
        self.assertEqual([row["name"] for row in result["additionalMigrations"]], sorted(NEW_GIT_BLOBS))
        self.assertTrue(result["originalMigrationsByteIdentical"])
        for key in ("codeOnlyUpdateEligible", "hostedJournalVerified", "migrationPermissionGranted", "publicationAuthorized"):
            self.assertFalse(result[key])
        self.assertIn("owner approval", result["requiredNextStep"])

    def test_existing_historical_migration_modified_refused(self):
        file = self.latest / "0007_open_bloodaxe.sql"
        file.write_bytes(file.read_bytes() + b"\n-- silent rewrite\n")
        self.check_stop("pinned history")

    def test_first_release_archive_modified_refused(self):
        file = self.first / "0007_open_bloodaxe.sql"
        file.write_bytes(file.read_bytes() + b"\n-- altered first-release SQL\n")
        self.check_stop("pinned history")

    def test_new_audit_migration_modified_refused(self):
        file = self.latest / "0023_deposit_policy_events.sql"
        file.write_bytes(file.read_bytes() + b"\n-- forged\n")
        self.check_stop("pinned history")

    def test_signed_document_migration_modified_refused(self):
        file = self.latest / "0024_deposit_agreement_snapshots.sql"
        file.write_bytes(file.read_bytes() + b"\nDROP TABLE payments;\n")
        self.check_stop("pinned history")

    def test_missing_original_or_new_file_refused(self):
        (self.latest / "0022_stripe_provider_uniqueness.sql").unlink()
        self.check_stop("missing/new migration filenames")

    def test_unexpected_new_migration_refused(self):
        (self.latest / "0025_unreviewed.sql").write_text("CREATE TABLE unsafe (id TEXT);")
        self.check_stop("missing/new migration filenames")

    def test_swapped_first_release_directory_refused(self):
        (self.first / "0022_stripe_provider_uniqueness.sql").unlink()
        self.check_stop("missing/new migration filenames")

    def test_symlink_sql_refused(self):
        target = self.latest / "0024_deposit_agreement_snapshots.sql"
        target.unlink()
        target.symlink_to(self.first / "0022_stripe_provider_uniqueness.sql")
        self.check_stop("linked SQL migration")

    def test_invalid_or_mixed_revision_refused(self):
        with self.assertRaisesRegex(QAReviewStop, "complete exact reviewed candidate SHA"):
            review(self.first, self.latest, "main")

    def test_cli_remains_read_only_and_emits_review_json(self):
        program = ROOT / "review_qa_update_schema.py"
        s = program.read_text()
        for forbidden in ("wrangler", "deploy --", "secret put", "d1 execute",
                          "subprocess", "os.system", "write_text(", "write_bytes(",
                          "open(", "unlink(", "requests.", "urllib.", "PowerShell"):
            self.assertNotIn(forbidden, s, forbidden)
        outcome = subprocess.run(
            [sys.executable, str(program), "--baseline", str(self.first),
             "--candidate", str(self.latest), "--checkpoint", CHECKPOINT],
            capture_output=True, text=True, timeout=15, check=True
        )
        packet = json.loads(outcome.stdout)
        self.assertFalse(packet["publicationAuthorized"])
        self.assertEqual(packet["candidateSourceCommit"], CHECKPOINT)
        self.assertEqual(outcome.stderr, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
