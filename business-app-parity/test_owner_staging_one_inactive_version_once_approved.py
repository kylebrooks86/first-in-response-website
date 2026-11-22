"""Static fail-closed scope checks for owner-only STAGING version uploader. No provider calls."""
from pathlib import Path
import re
import unittest

SOURCE = (Path(__file__).parent / 'owner_staging_one_inactive_version_once_approved.ps1').read_text()

class InactiveStagingVersionGuard(unittest.TestCase):
    def test_only_one_inactive_upload_invocation(self):
        self.assertEqual(SOURCE.count("versions','upload'"), 1)
        self.assertEqual(SOURCE.count('& npx @uploadArgs'), 1)
        self.assertIn("if(-not $Execute)", SOURCE)
        self.assertIn("FileMode]::CreateNew", SOURCE)
        self.assertLess(SOURCE.index("FileMode]::CreateNew"), SOURCE.index('& npx @uploadArgs'))
        self.assertIn("if($attempted)", SOURCE)

    def test_exact_only_staging_target_and_pinned_current_traffic(self):
        for marker in (
            "fire-app-independent-staging",
            "afb2c05a-d794-4a9a-b580-924ce01c26ad",
            "10215e59-2ff0-485c-92f6-11d7f0405060",
            "7838d0ea-be89-49c6-9984-d3b021082d72",
            "VerifyServing", "percentage -eq 100", "inactiveTrafficPercent=0"
        ):
            self.assertIn(marker, SOURCE)

    def test_private_hash_preserved_payment_and_no_activation(self):
        for marker in (
            "Import-Clixml", "SecureStringToBSTR", "FIRE_ADMIN_PASSWORD_HASH",
            "FIRE_SESSION_SECRET", "FIRE_STRIPE_MODE", "disabled",
            "--secrets-file", "--keep-vars", "--strict", "Remove-Item -LiteralPath $tmp",
            "paymentCredentialNamesPreserved"
        ):
            self.assertIn(marker, SOURCE)
        args = re.search(r"\$uploadArgs=@\((.*?)\)", SOURCE, flags=re.S)
        self.assertIsNotNone(args)
        self.assertNotRegex(args.group(1), r"(?i)\x27(?:deploy|delete|secret|r2|migrate)\x27")
        self.assertNotIn("wrangler secret put", SOURCE.split("function ApiGet", 1)[1].lower())
        self.assertNotIn("wrangler versions deploy", SOURCE.split("function ApiGet", 1)[1].lower())

    def test_exact_account_and_environment_isolation_without_relogging(self):
        self.assertIn("$env:CLOUDFLARE_ACCOUNT_ID=$account", SOURCE)
        self.assertIn("Remove-Item Env:CLOUDFLARE_ENV", SOURCE)
        self.assertIn("Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL)", SOURCE)
        self.assertIn("Push-Location -LiteralPath $candidate", SOURCE)
        self.assertIn("Pop-Location", SOURCE)
        self.assertIn("$previousAccount", SOURCE)
        self.assertIn("$previousWranglerEnv", SOURCE)
        self.assertLess(SOURCE.index("Push-Location -LiteralPath $candidate"), SOURCE.index("& npx @uploadArgs"))
        self.assertLess(SOURCE.index("Remove-Item Env:CLOUDFLARE_ENV"), SOURCE.index("& npx @uploadArgs"))
        self.assertNotIn("wrangler login", SOURCE.lower())
        self.assertNotIn("wrangler versions deploy", SOURCE.lower())

    def test_no_provider_write_in_default_preflight(self):
        before = SOURCE.split("if(-not $Execute)", 1)[1].split("return", 1)[0]
        self.assertNotIn("ApiGet", before)
        self.assertNotIn("npx @uploadArgs", before)
        self.assertIn("Cloudflare not contacted", before)

if __name__ == '__main__':
    unittest.main()
