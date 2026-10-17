"""Fail-closed regression checks for Windows-only QA credential preparation.

This does not execute production PowerShell or obtain private keys.
"""
from pathlib import Path
import re
import unittest

SOURCE = (Path(__file__).resolve().parent /
          "owner_windows_prepare_qa_credentials.ps1").read_text(encoding="utf-8")


class QACredentialPreparationContract(unittest.TestCase):
    def test_no_cloud_calls_or_worker_creation(self):
        for forbidden in (
            "wrangler.cmd", "wrangler.exe", "npx", "Invoke-WebRequest",
            "Invoke-RestMethod", "d1 execute", "d1 create",
            "d1 migrations apply", "secret put", "deploy",
        ):
            if forbidden == "deploy":
                # Narration may mention deployment; commands and functionality may not.
                continue
            self.assertNotIn(forbidden, SOURCE)
        self.assertNotIn("Start-Process", SOURCE)
        self.assertNotIn("Invoke-Expression", SOURCE)

    def test_dry_run_default_precedes_any_private_prompt_or_mutation(self):
        self.assertIn("param([switch]$Prepare)", SOURCE)
        self.assertIn("if (-not $Prepare)", SOURCE)
        self.assertIn("DRY RUN ONLY", SOURCE)
        self.assertLess(SOURCE.index("if (-not $Prepare)"),
                        SOURCE.index("Read-Host"))
        self.assertLess(SOURCE.index("if (-not $Prepare)"),
                        SOURCE.index("$record | Export-Clixml -LiteralPath $target -NoClobber"))
        self.assertIn("if (Test-Path -LiteralPath $target)", SOURCE)
        self.assertIn("Refusing to overwrite", SOURCE)
        self.assertIn("-NoClobber", SOURCE)

    def test_secrets_protected_and_private(self):
        for required in (
            "Read-Host", "-AsSecureString", "ZeroFreeBSTR", "SHA256",
            "RandomNumberGenerator", "ConvertTo-SecureString",
            "Export-Clixml", "$env:LOCALAPPDATA", "Windows DPAPI",
            "DO NOT share", "[Array]::Clear",
        ):
            with self.subTest(phrase=required):
                self.assertIn(required, SOURCE)
        self.assertNotIn("ConvertFrom-SecureString -AsPlainText", SOURCE)
        self.assertNotIn("Write-Host $clear", SOURCE)
        self.assertNotIn("Write-Host $hash", SOURCE)
        self.assertNotIn("Write-Host $sessionString", SOURCE)
        self.assertNotIn("Set-Clipboard", SOURCE)

    def test_correct_qa_identity_and_no_existing_binding(self):
        self.assertIn("fire-fullapp-qa-20261016.kyle-bfc.workers.dev", SOURCE)
        self.assertIn("fire-fullapp-qa-db-20261016", SOURCE)
        self.assertIn("8ccfb1f8-1657-4074-b1b2-47de78f95003", SOURCE)
        self.assertNotIn("afb2c05a-d794-4a9a-b580-924ce01c26ad", SOURCE)
        self.assertNotIn("fire-app-staging-db", SOURCE)
        self.assertIn("24-128", SOURCE)
        self.assertIn("Existing FIRE credentials", SOURCE)

    def test_only_one_protected_private_output(self):
        self.assertEqual(SOURCE.count("Export-Clixml -LiteralPath $target -NoClobber"), 1)
        self.assertNotRegex(SOURCE, r"(?i)(out-file|set-content|add-content|tee-object|writealltext)")
        self.assertNotIn("Export-Csv", SOURCE)


if __name__ == "__main__":
    unittest.main(verbosity=2)
