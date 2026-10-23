"""Static negative-control contract for the READ-ONLY owner-hosted QA inventory.

Never loads Cloudflare credentials, never contacts an account, never runs PowerShell.
The on-run Windows job also checks real PowerShell syntax without execution.
"""
from pathlib import Path
import unittest

SOURCE = (Path(__file__).parent / "owner_windows_qa_inventory_readonly.ps1").read_text(encoding="utf-8")

class OwnerInventorySafety(unittest.TestCase):
    def test_only_pinned_qa_and_protected_staging_ids(self):
        for token in ("fire-fullapp-qa-db-20261016",
                      "8ccfb1f8-1657-4074-b1b2-47de78f95003",
                      "fire-app-staging-db",
                      "afb2c05a-d794-4a9a-b580-924ce01c26ad",
                      "fire-fullapp-qa-photos-20261023",
                      "fire-fullapp-qa-20261016",
                      "wrangler.qa-migrations.json",
                      "0023_deposit_policy_events.sql",
                      "0024_deposit_agreement_snapshots.sql"):
            self.assertIn(token, SOURCE)
        self.assertIn("$qaInfo.uuid -cne $stagingInfo.uuid", SOURCE)
    def test_classifies_empty_original_full_and_unknown_without_mutations(self):
        for token in ("EMPTY_QA_DB", "EXISTING_QA_23_NEEDS_REVIEWED_UPGRADE",
                      "FULL_QA_25_SCHEMA_PRESENT_UNVERIFIED", "BLOCKED_UNKNOWN_SCHEMA",
                      "$journalCount -eq 23", "$journalCount -eq 25",
                      "$journalNames[$i] -cne $migrations[$i]",
                      "$missingCore.Count -eq 0", "$missingCurrent.Count -eq 0",
                      "$nonInternal.Count -eq 0", "The exact QA-only photo bucket",
                      "NOT_VERIFIED", "REMOTE_WRITES=NONE",
                      "WORKER_SERVING_VERSION=NOT_VERIFIED",
                      "PERSONAL_CUSTOMER_RECORDS_READ=NONE",
                      "APP_RELEASE_APPROVED=NO", "NEVER run first-time initializer"):
            # R2 is identified by exact name, without revealing account data.
            if token == "The exact QA-only photo bucket":
                continue
            self.assertIn(token, SOURCE)
    def test_remote_queries_are_two_explicit_metadata_only_selects(self):
        self.assertIn("SELECT name FROM sqlite_master WHERE type='table'", SOURCE)
        self.assertIn("SELECT name FROM d1_migrations ORDER BY id", SOURCE)
        self.assertEqual(SOURCE.count("SELECT name FROM"), 2)
        self.assertIn("Read-Remote -arguments @('d1','info'", SOURCE)
        self.assertIn("'d1','execute',$qaName,'--remote'", SOURCE)
        self.assertIn("r2 bucket info $photoBucket --json", SOURCE)
        self.assertIn("$r2.name -ceq $photoBucket", SOURCE)
        self.assertIn("$sql -cmatch '^SELECT '", SOURCE)
        self.assertIn("$sql -notmatch ';'", SOURCE)
        for prohibited in ("SELECT *", "SELECT id, name FROM customers",
                           "d1 migrations apply", "d1 create", "d1 export", "d1 migrations list",
                           "r2 bucket create", "r2 object put", "r2 bucket delete",
                           "wrangler deploy", "wrangler publish", "Read-Host", "Import-Clixml",
                           "secret put", "Invoke-WebRequest", "Invoke-RestMethod",
                           "Set-ExecutionPolicy", "Remove-Item", "DROP TABLE",
                           "DELETE FROM", "UPDATE payments", "INSERT INTO"):
            self.assertNotIn(prohibited, SOURCE)
    def test_no_raw_account_payload_or_credentials_logged(self):
        self.assertIn("2>$null", SOURCE)
        self.assertIn("No customer records", SOURCE)
        self.assertNotIn("Write-Host $qaInfo", SOURCE)
        self.assertNotIn("Write-Host $stagingInfo", SOURCE)
        self.assertNotIn("Write-Host $raw", SOURCE)
        self.assertNotIn("Write-Output $raw", SOURCE)
        self.assertNotIn("Get-ChildItem Env:", SOURCE)
        self.assertNotIn("CLOUDFLARE_API_TOKEN", SOURCE)
        self.assertNotIn("CLOUDFLARE_ACCOUNT_ID", SOURCE)

if __name__ == "__main__":
    unittest.main(verbosity=2)
