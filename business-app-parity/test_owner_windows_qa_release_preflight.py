"""Read-only QA release preflight contract; no Cloudflare account, DPAPI or D1 accessed."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
SCRIPT = (ROOT / "owner_windows_qa_release_preflight.ps1").read_text(encoding="utf-8")
CFG = (ROOT / "wrangler.qa-migrations.json").read_text(encoding="utf-8")

class QAPostMigrationReadOnlyContract(unittest.TestCase):
    def test_only_approved_resource_identity(self):
        self.assertIn("fire-fullapp-qa-20261016", SCRIPT)
        self.assertIn("fire-fullapp-qa-db-20261016", SCRIPT)
        self.assertIn("8ccfb1f8-1657-4074-b1b2-47de78f95003", SCRIPT)
        self.assertIn("afb2c05a-d794-4a9a-b580-924ce01c26ad", SCRIPT)
        self.assertIn("fire-app-staging-db", SCRIPT)
        self.assertIn("Exactly one QA D1 binding required", SCRIPT)
        self.assertIn("Wrong database or unreviewed schema binding", SCRIPT)
        self.assertIn("wrangler.qa-migrations.json", SCRIPT)
        self.assertNotIn("fire-app-independent-staging --remote", SCRIPT)

    def test_read_only_no_upload_or_deploy_commands(self):
        self.assertIn("param()", SCRIPT)
        self.assertNotIn("d1 list --json", SCRIPT)
        self.assertEqual(SCRIPT.count("d1 info $qaName --json"), 1)
        self.assertEqual(SCRIPT.count("d1 info $protectedName --json"), 1)
        self.assertIn("$info.uuid -cne $protectedInfo.uuid", SCRIPT)
        self.assertIn("Cloudflare read-only protected staging D1 info", SCRIPT)
        self.assertIn("d1 execute $qaName --remote", SCRIPT)
        self.assertEqual(len(re.findall(r"(?m)^\s*\$rawQuery\s*=\s*@", SCRIPT)), 1)
        self.assertNotRegex(SCRIPT, r"(?m)^\s*(?:&\s*\$wrangler\.Source|wrangler(?:\.cmd)?)\s+(?:deploy|secret|publish|delete|upload|d1\s+migrations)")
        self.assertNotRegex(SCRIPT, r"(?m)^\s*.*\s(?:d1\s+execute|d1\s+migrations)\s+.*\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|apply)\b")
        for forbidden in ("Invoke-Expression", "Start-Process", "Set-Clipboard", "Export-Clixml",
                          "Remove-Item", "Set-Content", "Out-File"):
            self.assertNotIn(forbidden, SCRIPT)
        self.assertEqual(SCRIPT.count("d1 execute $qaName --remote"), 1)
        self.assertIn('"--command=$sql"', SCRIPT)
        self.assertIn("SELECT (SELECT COUNT(*)", SCRIPT)

    def test_credential_record_never_created_or_exposed(self):
        self.assertIn("Import-Clixml -LiteralPath $privatePath", SCRIPT)
        self.assertIn("FIRE-QA-Private\\qa-owner-secrets.xml", SCRIPT)
        self.assertIn("sessionSigningSecret -is [System.Security.SecureString]", SCRIPT)
        self.assertIn("passwordSha256 -cmatch", SCRIPT)
        self.assertIn("$record = $null", SCRIPT)
        for forbidden in ("Write-Host $record", "Write-Host $privatePath",
                          "Write-Host $sql", "ConvertFrom-SecureString",
                          "SecureStringToBSTR", "passwordSha256 |", "sessionSigningSecret |"):
            self.assertNotIn(forbidden, SCRIPT)

    def test_already_migrated_schema_required(self):
        for required in ("[int]$info.num_tables -gt 0", "'d1_migrations'",
                         "'payment_refunds'", "'customer_photos'",
                         "idx_payments_stripe_provider_unique",
                         "[int]$row.migration_count -eq 23",
                         "[int]$row.required_tables -eq 7",
                         "[int]$row.provider_index -eq 1"):
            with self.subTest(required=required):
                self.assertIn(required, SCRIPT)
        self.assertNotIn("num_tables -eq 0", SCRIPT)
        self.assertNotIn("migrations apply", SCRIPT)
        self.assertIn('STOP BEFORE PUBLISH', SCRIPT)

    def test_source_only_no_remote_changes_in_tests(self):
        self.assertIn("Cloudflare read-only QA schema query", SCRIPT)
        self.assertIn("Cloudflare read-only QA D1 info", SCRIPT)
        self.assertIn("Get-Command 'wrangler.cmd'", SCRIPT)
        self.assertNotIn("fire-app-dr", SCRIPT)
        self.assertIn('"--config=$configPath"', SCRIPT)
        self.assertIn("synthetic", (ROOT / "adapters/qa/vite.config.ts").read_text())

if __name__ == "__main__":
    unittest.main(verbosity=2)
