"""Fail-closed tests for the owner-approved QA 23-to-25 migration pathway.

The tests read local pinned SQL and PowerShell source ONLY.
No Cloudflare, Wrangler, customer records, or remote writes.
"""
from pathlib import Path
import shutil
import tempfile
import unittest

from verify_qa_23_to_25_sql import verify
from review_qa_update_schema import QAReviewStop

ROOT = Path(__file__).parent
SOURCE = (ROOT / "owner_windows_qa_upgrade_23_to_25.ps1").read_text(encoding="utf-8")
DRIZZLE = ROOT / "adapters" / "doomsday" / "drizzle"

class QAUpgradeProtection(unittest.TestCase):
    def test_real_original_and_exact_appended_sql_blobs_are_pinned(self):
        report = verify(DRIZZLE)
        self.assertEqual(report["expectedOldMigrationCount"],23)
        self.assertEqual(report["candidateMigrationCount"],25)
        self.assertEqual(report["approvedAdditions"],[
            "0023_deposit_policy_events.sql","0024_deposit_agreement_snapshots.sql"])
        self.assertTrue(report["sourceHistoryVerified"])
        self.assertFalse(report["remoteWrites"])
        self.assertFalse(report["migrationApproved"])
    def test_tampered_or_missing_addition_refused(self):
        with tempfile.TemporaryDirectory() as dirname:
            candidate = Path(dirname)
            for sql in DRIZZLE.glob("*.sql"):
                shutil.copy2(sql,candidate/sql.name)
            with (candidate/"0024_deposit_agreement_snapshots.sql").open("ab") as out:
                out.write(b"\n-- unauthorized line\n")
            with self.assertRaisesRegex(QAReviewStop,"migration content differs"):
                verify(candidate)
            shutil.copy2(DRIZZLE/"0024_deposit_agreement_snapshots.sql",candidate/"0024_deposit_agreement_snapshots.sql")
            (candidate/"0023_deposit_policy_events.sql").unlink()
            with self.assertRaisesRegex(QAReviewStop,"missing/new migration"):
                verify(candidate)
    def test_history_alteration_and_extra_sql_refused(self):
        with tempfile.TemporaryDirectory() as dirname:
            candidate=Path(dirname)
            for sql in DRIZZLE.glob("*.sql"):
                shutil.copy2(sql,candidate/sql.name)
            with (candidate/"0019_refund_ledger_unique.sql").open("ab") as out:
                out.write(b"\n-- unreviewed history\n")
            with self.assertRaisesRegex(QAReviewStop,"migration content differs"):
                verify(candidate)
            shutil.copy2(DRIZZLE/"0019_refund_ledger_unique.sql",candidate/"0019_refund_ledger_unique.sql")
            (candidate/"0025_surprise.sql").write_text("DELETE FROM customers;")
            with self.assertRaisesRegex(QAReviewStop,"missing/new migration"):
                verify(candidate)
    def test_review_precedes_remote_auth_and_owner_consent_precedes_writes(self):
        for snippet in (
            "[switch]$Apply","[Parameter(Mandatory=$true)][string]$ExpectedCommit",
            "$head -ceq $ExpectedCommit","$head -ceq $origin",
            "$dirty.Count -eq 0","--candidate $drizzle",
            "$identity.qaUuid -ceq $qaUuid","$identity.stagingUuid -ceq $protectedUuid",
            "SELECT (SELECT GROUP_CONCAT(name,'|'","FROM d1_migrations ORDER BY id",
            "[string]$before.names -ceq ($oldNames -join '|')",
            "[int]$before.core_tables -eq 6",
            "[int]$before.new_tables -eq 0",
            "[int]$before.new_triggers -eq 0",
            "[int]$before.provider_index -eq 1",
            "if (-not $Apply)","Read-Host",
            "$again = ReadSchema","$after = ReadSchema",
            "d1 migrations apply $qaName --remote",
            "[string]$after.names -ceq ($ordered -join '|')",
            "[int]$after.new_tables -eq 2","[int]$after.new_triggers -eq 2",
            "NO WORKER PUBLISHED",
        ):
            with self.subTest(snippet=snippet): self.assertIn(snippet,SOURCE)
        self.assertLess(SOURCE.index("$head -ceq $ExpectedCommit"),SOURCE.index("d1 list --json"))
        self.assertLess(SOURCE.index("verify_qa_23_to_25_sql.py"),SOURCE.index("d1 list --json"))
        self.assertLess(SOURCE.index("if (-not $Apply)"),SOURCE.index("Read-Host"))
        self.assertLess(SOURCE.index("Read-Host"),SOURCE.index("$again = ReadSchema"))
        self.assertLess(SOURCE.index("$again = ReadSchema"),SOURCE.index("d1 migrations apply $qaName --remote"))
        self.assertLess(SOURCE.index("d1 migrations apply $qaName --remote"),SOURCE.index("$after = ReadSchema"))
        self.assertEqual(SOURCE.count("d1 migrations apply $qaName --remote"),1)
    def test_exact_qa_scope_and_no_staging_writes_or_secret_handling(self):
        for identity in (
            "fire-fullapp-qa-20261016",
            "fire-fullapp-qa-db-20261016",
            "8ccfb1f8-1657-4074-b1b2-47de78f95003",
            "fire-app-staging-db",
            "afb2c05a-d794-4a9a-b580-924ce01c26ad",
            "wrangler.qa-migrations.json",
        ):
            self.assertIn(identity,SOURCE)
        for forbidden in (
            "d1 migrations apply $protectedName",
            "d1 create","r2 bucket create","r2 object put","secret put",
            "wrangler deploy","stripe.com","Import-Clixml","Invoke-RestMethod",
            "DROP TABLE","DELETE FROM","UPDATE customers","SELECT * FROM customers",
            "Remove-Item",
        ):
            self.assertNotIn(forbidden,SOURCE)
        self.assertNotIn("d1 migrations list",SOURCE)

if __name__=="__main__":
    unittest.main(verbosity=2)
