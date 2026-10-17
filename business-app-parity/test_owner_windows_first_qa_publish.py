"""Safe-first-publish source contracts. NEVER uploads or executes PowerShell/Cloudflare."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT = (ROOT / "owner_windows_first_qa_publish.ps1").read_text(encoding="utf-8")

class FirstQAPublishContract(unittest.TestCase):
    def test_default_is_non_mutating_with_separate_typed_approval(self):
        self.assertIn("param([switch]$Publish)", SCRIPT)
        self.assertIn("if (-not $Publish)", SCRIPT)
        self.assertIn("REVIEW ONLY PASS. No secrets uploaded", SCRIPT)
        self.assertIn("return", SCRIPT)
        self.assertIn("Read-Host ('To authorize this exact QA-only first publication, type '", SCRIPT)
        self.assertIn("Require ($typed -ceq $approval)", SCRIPT)
        for action in ("wrangler deploy", "deploy --config $manifest --secrets-file",
                       "ConvertTo-Json -Compress", "FileStream]::new($secretFile"):
            # Ensure remote code and sensitive temporary file creation are gated.
            self.assertGreater(SCRIPT.index(action), SCRIPT.index("if (-not $Publish)"))

    def test_pinned_exact_candidate_and_both_d1_resources(self):
        for item in ("f650d25b18d23bc9f71a4d55c9322bfd5870ef75",
                     "fire-fullapp-qa-20261016",
                     "fire-fullapp-qa-db-20261016",
                     "8ccfb1f8-1657-4074-b1b2-47de78f95003",
                     "fire-app-staging-db", "afb2c05a-d794-4a9a-b580-924ce01c26ad",
                     "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev",
                     "work/fire-business-app-parity-2026-10-08",
                     "verify_materialized_candidate.py",
                     "--built",
                     "check_qa_runtime_config.mjs",
                     "Read-CheckedD1 $qaName $qaUuid",
                     "Read-CheckedD1 $stagingName $stagingUuid"):
            with self.subTest(item=item): self.assertIn(item, SCRIPT)
        self.assertNotIn("d1 list", SCRIPT)

    def test_never_reads_or_prints_private_values_in_dry_run(self):
        self.assertIn("Import-Clixml -LiteralPath $privateFile", SCRIPT)
        self.assertIn("($record.workerName -ceq $workerName", SCRIPT)
        self.assertIn("sessionSigningSecret -is [Security.SecureString]", SCRIPT)
        self.assertIn("passwordSha256 -cmatch", SCRIPT)
        self.assertIn("values hidden", SCRIPT)
        for forbidden in ("Write-Host $record", "Write-Output $record",
                          "Write-Host $secretClear", "Write-Host $json",
                          "Export-Clixml", "ConvertFrom-SecureString", "Set-Clipboard",
                          "Invoke-WebRequest", "Invoke-RestMethod"):
            self.assertNotIn(forbidden, SCRIPT)

    def test_first_publish_only_if_worker_absent(self):
        self.assertIn("$wrangler deployments list --name $workerName", SCRIPT)
        self.assertIn("$LASTEXITCODE -ne 0", SCRIPT)
        self.assertIn("$probeText -match '10007'", SCRIPT)
        self.assertIn("$probeText -match 'does not exist'", SCRIPT)
        self.assertLess(SCRIPT.index("Worker name is occupied or Cloudflare result ambiguous"),
                        SCRIPT.index("$typed = Read-Host"))
        self.assertLess(SCRIPT.index("$typed = Read-Host"), SCRIPT.index("$secretFile = Join-Path"))

    def test_single_secret_file_and_cleanup_even_if_deploy_fails(self):
        self.assertIn("FIRE-QA-Private", SCRIPT)
        self.assertIn("'qa-owner-secrets.xml'", SCRIPT)
        self.assertIn("qa-firstpublish-", SCRIPT)
        self.assertIn("FileMode]::CreateNew", SCRIPT)
        self.assertIn("FileSecurity]::new()", SCRIPT)
        self.assertIn("SetAccessRuleProtection($true, $false)", SCRIPT)
        self.assertIn("AddAccessRule($rule)", SCRIPT)
        self.assertIn("$stream.SetAccessControl($security)", SCRIPT)
        self.assertIn("FIRE_QA_PASSWORD_HASH = $record.passwordSha256", SCRIPT)
        self.assertIn("FIRE_QA_SESSION_SECRET = $secretClear", SCRIPT)
        self.assertIn("Marshal]::ZeroFreeBSTR", SCRIPT)
        self.assertIn("Remove-Item -LiteralPath $secretFile -Force", SCRIPT)
        self.assertIn("} finally {", SCRIPT)
        self.assertIn("Array]::Clear($bytes", SCRIPT)
        self.assertEqual(len(re.findall(r"&\s*\$wrangler deploy --config", SCRIPT)), 1)
        self.assertNotRegex(SCRIPT, r"(?m)^\s*&.*\b(?:migrations|d1 execute|secret put|secret bulk|delete)\b")

if __name__ == "__main__":
    unittest.main(verbosity=2)
