"""Safe-first-publish source contracts. NEVER uploads or executes PowerShell/Cloudflare."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT = (ROOT / "owner_windows_first_qa_publish.ps1").read_text(encoding="utf-8")

class FirstQAPublishContract(unittest.TestCase):
    def test_default_is_non_mutating_with_separate_typed_approval(self):
        self.assertIn("[switch]$Publish,", SCRIPT)
        self.assertIn("if (-not $Publish)", SCRIPT)
        self.assertIn("REVIEW ONLY PASS. No secrets uploaded", SCRIPT)
        self.assertIn("return", SCRIPT)
        self.assertIn("Read-Host ('To authorize this exact QA-only first publication, type '", SCRIPT)
        self.assertIn("Require ($typed -ceq $approval)", SCRIPT)
        # The earlier 'wrangler deploy --help' is read-only; only the exact
        # executable publish invocation must be after explicit -Publish gating.
        for action in ("& $remoteWrangler.Source deploy --config $deployManifest --secrets-file",
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

    def test_exact_sha_and_explicit_branch_before_cloudflare_or_secrets(self):
        for required in ("[string]$CandidateBranch", "[string]$CandidateCommit",
                         "Only an explicitly named FIRE development branch may be reviewed",
                         "Exact reviewed candidate SHA is required",
                         "Read-only Git exact commit check", "Read-only fetched remote branch check",
                         "$head -ceq $originHead -and $head -ceq $reviewedCandidateCommit",
                         "Unreviewed source SHA or stale fetched branch"):
            self.assertIn(required, SCRIPT)
        self.assertLess(SCRIPT.index("$head -ceq $originHead"),
                        SCRIPT.index("Import-Clixml -LiteralPath $privateFile"))
        self.assertLess(SCRIPT.index("$head -ceq $originHead"),
                        SCRIPT.index("Read-CheckedD1 $qaName $qaUuid"))
        self.assertLess(SCRIPT.index("$head -ceq $originHead"),
                        SCRIPT.index("$typed = Read-Host"))

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
        self.assertIn("$remoteWrangler.Source deployments list --name $workerName", SCRIPT)
        self.assertIn("$remoteWrangler.Source deploy --help", SCRIPT)
        self.assertIn("$remoteWrangler.Source d1 info $name --json", SCRIPT)
        self.assertIn("Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue", SCRIPT)
        self.assertIn("Authenticated global Wrangler CLI missing", SCRIPT)
        self.assertIn("A separately installed global Wrangler is required", SCRIPT)
        self.assertNotIn("& $builtWrangler d1", SCRIPT)
        # Windows PowerShell 5.1 converts Wrangler's expected stderr 10007
        # into ErrorRecord; capture its complete text without swallowing other
        # errors or loosening the no-overwrite requirement.
        self.assertIn("$oldErrorActionPreference = $ErrorActionPreference", SCRIPT)
        self.assertIn("$ErrorActionPreference = 'Continue'", SCRIPT)
        self.assertIn("$ErrorActionPreference = $oldErrorActionPreference", SCRIPT)
        self.assertIn("$probeExitCode = $LASTEXITCODE", SCRIPT)
        self.assertIn("$probeExitCode -is [int] -and $probeExitCode -ne 0", SCRIPT)
        self.assertIn("$probeText -match 'This Worker does not exist on your account'", SCRIPT)
        self.assertIn("$probeText -match '\\[code:\\s*10007\\]'", SCRIPT)
        self.assertNotIn("$probe = @($_.ToString())", SCRIPT)
        self.assertLess(SCRIPT.index("$ErrorActionPreference = $oldErrorActionPreference"),
                        SCRIPT.index("Require ($probeExitCode -is [int]"))
        self.assertLess(SCRIPT.index("Require ($probeExitCode -is [int]"),
                        SCRIPT.index("$typed = Read-Host"))
        self.assertLess(SCRIPT.index("Worker name is occupied or Cloudflare result ambiguous"),
                        SCRIPT.index("$typed = Read-Host"))
        self.assertLess(SCRIPT.index("$typed = Read-Host"), SCRIPT.index("$secretFile = Join-Path"))

    def test_private_photo_bucket_is_read_only_verified_before_publish(self):
        self.assertIn("$qaPhotoBucket = 'fire-fullapp-qa-photos-20261023'", SCRIPT)
        self.assertIn("$remoteWrangler.Source r2 bucket info $bucketName --json", SCRIPT)
        self.assertIn("Require ($info.name -ceq $bucketName)", SCRIPT)
        self.assertIn("Read-CheckedR2 $qaPhotoBucket", SCRIPT)
        self.assertLess(SCRIPT.index("if (-not $Publish)"), SCRIPT.index("Read-CheckedR2 $qaPhotoBucket"))
        self.assertLess(SCRIPT.index("Read-CheckedR2 $qaPhotoBucket"), SCRIPT.index("$typed = Read-Host"))
        self.assertIn("$qaUuid + ' ' + $qaPhotoBucket + ' ' + $reviewedCandidateCommit", SCRIPT)

    def test_single_secret_file_and_cleanup_even_if_deploy_fails(self):
        self.assertIn("FIRE-QA-Private", SCRIPT)
        self.assertIn("prepare_qa_deploy_config.mjs", SCRIPT)
        self.assertIn("& $node.Source $prepareDeploy $manifest $deployManifest", SCRIPT)
        self.assertIn("& $remoteWrangler.Source deploy --dry-run --config $deployManifest --name $workerName", SCRIPT)
        self.assertIn("Wrangler no-upload QA first-release dry run", SCRIPT)
        self.assertIn("Remove-Item -LiteralPath $deployManifest -Force", SCRIPT)
        self.assertNotIn("& $remoteWrangler.Source deploy --config $manifest", SCRIPT)
        self.assertLess(SCRIPT.index("--dry-run --config $deployManifest"), SCRIPT.index("$typed = Read-Host"))
        self.assertLess(SCRIPT.index("$typed = Read-Host"), SCRIPT.index("--config $deployManifest --secrets-file"))
        self.assertIn("'qa-owner-secrets.xml'", SCRIPT)
        self.assertIn("qa-firstpublish-", SCRIPT)
        self.assertIn("FileMode]::CreateNew", SCRIPT)
        self.assertIn("FileSecurity]::new()", SCRIPT)
        self.assertIn("An earlier QA temporary secrets file is still present", SCRIPT)
        self.assertIn("Get-ChildItem -LiteralPath $privateDir -Filter 'qa-firstpublish-*.json'", SCRIPT)
        self.assertIn("[Security.AccessControl.FileSystemRights]::Write,", SCRIPT)
        self.assertIn("[IO.FileShare]::None, 4096, [IO.FileOptions]::None, $security)", SCRIPT)
        self.assertIn("[IO.File]::GetAccessControl($secretFile,", SCRIPT)
        self.assertIn("$effective.AreAccessRulesProtected", SCRIPT)
        self.assertIn("$permissions.Count -eq 1", SCRIPT)
        self.assertIn("$permissions[0].IdentityReference.Value -eq $identity.Value", SCRIPT)
        self.assertIn("$permissions[0].AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow", SCRIPT)
        self.assertIn("[IO.FileMode]::Open,", SCRIPT)
        self.assertLess(SCRIPT.index("GetAccessControl($secretFile,"), SCRIPT.index("$stream.Write($bytes"))
        self.assertNotIn("$stream.SetAccessControl($security)", SCRIPT)
        self.assertIn("SetAccessRuleProtection($true, $false)", SCRIPT)
        self.assertIn("AddAccessRule($rule)", SCRIPT)
        self.assertIn("FIRE_QA_PASSWORD_HASH = $record.passwordSha256", SCRIPT)
        self.assertIn("FIRE_QA_SESSION_SECRET = $secretClear", SCRIPT)
        self.assertIn("Marshal]::ZeroFreeBSTR", SCRIPT)
        self.assertIn("Remove-Item -LiteralPath $secretFile -Force", SCRIPT)
        self.assertIn("} finally {", SCRIPT)
        self.assertIn("Array]::Clear($bytes", SCRIPT)
        self.assertEqual(len(re.findall(r"&\s*\$remoteWrangler\.Source deploy --config", SCRIPT)), 1)
        self.assertNotRegex(SCRIPT, r"(?m)^\s*&.*\b(?:migrations|d1 execute|secret put|secret bulk|delete)\b")

if __name__ == "__main__":
    unittest.main(verbosity=2)
