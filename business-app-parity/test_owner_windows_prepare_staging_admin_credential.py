"""Source-only, no-provider regression for owner Windows STAGING credential preparation."""
from pathlib import Path
import unittest

SRC=(Path(__file__).resolve().parent/"owner_windows_prepare_staging_admin_credential.ps1").read_text(encoding="utf-8")

class StagingCredentialSafety(unittest.TestCase):
    def test_exact_target_only_and_no_cloud_mutation(self):
        for name in ("fire-app-independent-staging",
                     "afb2c05a-d794-4a9a-b580-924ce01c26ad",
                     "FIRE_ADMIN_PASSWORD_HASH"):
            self.assertIn(name,SRC)
        for forbidden in ("Invoke-WebRequest","Invoke-RestMethod","Invoke-Expression",
                          "Start-Process","wrangler secret","wrangler versions",
                          "wrangler deploy","d1 execute","Stripe-Secret",
                          "Export-Csv","Set-Clipboard"):
            self.assertNotIn(forbidden,SRC)
        self.assertNotIn("FIRE_NEW_LIVE_PASSWORD_HASH",SRC)
        self.assertNotIn("FIRE_QA_PASSWORD_HASH",SRC)

    def test_dry_run_precedes_secret_prompt_or_file_mutation(self):
        self.assertIn("param([switch]$Prepare)",SRC)
        self.assertIn("if (-not $Prepare)",SRC)
        self.assertIn("DRY RUN ONLY",SRC)
        self.assertLess(SRC.index("if (-not $Prepare)"),SRC.index("Read-Host"))
        self.assertLess(SRC.index("if (-not $Prepare)"),SRC.index("Export-Clixml"))
        self.assertIn("if (Test-Path -LiteralPath $file)",SRC)
        self.assertIn("refusing overwrite or rotation",SRC)
        self.assertIn("-NoClobber",SRC)

    def test_hash_only_and_user_bound_encryption(self):
        for term in ("-AsSecureString","SecureStringToBSTR","ZeroFreeBSTR",
                     "Read-Host 'New STAGING-only private passphrase'",
                     "Read-Host 'Confirm STAGING-only private passphrase'",
                     "StringComparison]::Ordinal","SHA256",
                     "ToLowerInvariant()","$plain.Length -lt 24",
                     "$plain.Length -gt 128","ConvertTo-SecureString -String $hash",
                     "Export-Clixml","$env:LOCALAPPDATA","Windows_NT",
                     "uploadedToProvider = $false","deploymentAuthorized = $false"):
            self.assertIn(term,SRC)
        self.assertNotIn("Write-Host $plain",SRC)
        self.assertNotIn("Write-Host $hash",SRC)
        self.assertNotIn("Write-Host $confirm",SRC)
        self.assertNotIn("Export-Clixml -LiteralPath $file -Force",SRC)
        self.assertEqual(SRC.count("Export-Clixml -LiteralPath $file -NoClobber"),1)

    def test_reuse_and_paid_services_not_introduced(self):
        for token in ("NEW unique","Never reuse","Cloudflare","STAGING-only"):
            self.assertIn(token,SRC)
        for forbidden in ("r2_buckets", "R2 Storage", "Create token",
                          "FIRE_SESSION_SECRET = ", "STRIPE_SECRET_KEY = "):
            self.assertNotIn(forbidden,SRC)

if __name__=="__main__":
    unittest.main(verbosity=2)
