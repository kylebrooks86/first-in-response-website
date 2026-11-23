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

    def test_built_code_must_match_exact_qa_master_plus_staging_overlay(self):
        self.assertIn("verify_materialized_candidate.py",SOURCE)
        self.assertIn("independent-staging $candidate --built",SOURCE)
        self.assertIn("identicalToSharedPlusAuthorizedAdapter -eq $true",SOURCE)
        self.assertIn("sourceProof.exactSourceFiles -gt 100",SOURCE)
        self.assertIn("sourceJobNumberModeRequested -eq $false",SOURCE)
        self.assertIn("sourceQuickAuthModeRequested -eq $false",SOURCE)
        self.assertLess(SOURCE.index("independent-staging $candidate --built"),
                        SOURCE.index("FileMode]::CreateNew"))

    def test_no_provider_write_in_default_preflight(self):
        before = SOURCE.split("if(-not $Execute)", 1)[1].split("return", 1)[0]
        self.assertNotIn("ApiGet", before)
        self.assertNotIn("npx @uploadArgs", before)
        self.assertIn("Cloudflare not contacted", before)


    def test_one_shot_reconciler_is_get_only_and_cannot_consume_another_attempt(self):
        read_only = (Path(__file__).parent / 'owner_staging_one_attempt_readonly_reconcile.ps1').read_text()
        self.assertEqual(re.findall(r'-Method\s+(\w+)', read_only), ['Get'])
        self.assertNotRegex(read_only, r'(?i)\b(?:post|put|patch|delete)\b.{0,24}\bworkers\b')
        for forbidden in ('versions\',\'upload', '--secrets-file', 'FileMode]::CreateNew',
                          'wrangler login', 'Invoke-WebRequest', 'Import-Clixml'):
            self.assertNotIn(forbidden, read_only)
        for required in (
            'fire-app-independent-staging', 'FIRE-STAGING-Private',
            'g404-one-inactive-version-attempt-20261122.lock',
            'CLOUDFLARE_ACCOUNT_ID=$account', 'Remove-Item Env:CLOUDFLARE_ENV',
            'auth token --json', 'GetOnly \'/deployments?page=1&per_page=1\'',
            'GetOnly \'/versions?page=1&per_page=100\'',
            'GetOnly (\'/versions/\'+$entry.id)',
            "FIRE_ADMIN_PASSWORD_HASH", "FIRE_STRIPE_MODE",
            "FIRE_SESSION_SECRET", "disabled", "r2_bucket", "database_id -ceq $db",
            "payment -join '|'", "oldPayment -join '|'", "NO RETRY",
            "gate4Accepted=$false", "uploadRetryAuthorized=$false",
            "remoteCodeBytesVerified=$false", "oldVersionStillAt100Percent"
        ):
            self.assertIn(required, read_only)
        self.assertLess(read_only.index('GetOnly \'/deployments?page=1&per_page=1\''),
                        read_only.index('GetOnly \'/versions?page=1&per_page=100\''))

    def test_readonly_inventory_paginates_and_reports_only_redacted_fail_reason(self):
        read_only = (Path(__file__).parent / 'owner_staging_one_attempt_readonly_reconcile.ps1').read_text()
        for marker in (
            'for($page=1;$page -le 3;$page++)',
            "GetOnly '/versions?page=1&per_page=100'",
            'GetOnly (\'/versions?page=\'+$page+\'&per_page=100\')',
            "VERSION_LIST_ITEMS_MISSING",
            "VERSION_LIST_WINDOW_NOT_FULLY_COVERED",
            "VERSION_LIST_NOT_NEWEST_FIRST",
            "TOO_MANY_RECENT_VERSIONS_FOR_SAFE_CLASSIFICATION",
            "GET_TRANSPORT_OR_OTHER_HTTP_ERROR",
            "GET_HTTP_",
            "NO RETRY; NO CLOUD WRITE."
        ):
            self.assertIn(marker, read_only)
        self.assertEqual(read_only.count('Invoke-RestMethod -Method Get'), 1)
        self.assertIn("Need ($covered) 'VERSION_LIST_WINDOW_NOT_FULLY_COVERED'", read_only)
        self.assertIn("if($items.Count -lt 100", read_only)
        self.assertNotIn("Write-Host $_", read_only)
        self.assertNotIn("Write-Host $response", read_only)
        self.assertNotIn("FileMode]::CreateNew", read_only)
        self.assertNotIn("wrangler login", read_only)


    def test_readonly_get_accepts_null_errors_only_when_success_and_result_valid(self):
        # Cloudflare Workers version APIs can return success:true/errors:null.
        # PowerShell @($null).Count is 1; the old generic guard rejected that.
        read_only = (Path(__file__).parent / 'owner_staging_one_attempt_readonly_reconcile.ps1').read_text()
        get_only = read_only.split('function GetOnly', 1)[1].split('function Binding', 1)[0]
        self.assertIn("$providerErrors=@()", get_only)
        self.assertIn("if($null -ne $response.errors){$providerErrors=@($response.errors)}", get_only)
        self.assertIn("Need ($response.success -eq $true) 'GET_RESPONSE_SUCCESS_FALSE'", get_only)
        self.assertIn("Need ($providerErrors.Count -eq 0) 'GET_RESPONSE_ERRORS_PRESENT'", get_only)
        self.assertIn("Need ($null -ne $response.result) 'GET_RESPONSE_RESULT_MISSING'", get_only)
        self.assertNotIn("@($response.errors).Count -eq 0", get_only)
        self.assertEqual(get_only.count('Invoke-RestMethod -Method Get'), 1)
        for forbidden in ('Invoke-RestMethod -Method Post', 'wrangler login', 'versions\',\'upload'):
            self.assertNotIn(forbidden, get_only)


class SyntheticLocalStagingDryRunGuard(unittest.TestCase):
    """Code-only safety checks: never executes Wrangler, PowerShell or Cloudflare."""

    @classmethod
    def setUpClass(cls):
        cls.source = (Path(__file__).parent / 'owner_staging_synthetic_local_upload_dryrun.ps1').read_text()

    def test_consumed_attempt_is_required_but_never_reset_or_reused(self):
        s = self.source
        for marker in ('g404-one-inactive-version-attempt-20261122.lock',
                       'Test-Path -LiteralPath $lock -PathType Leaf',
                       'FIRE_STAGING_SYNTHETIC_LOCAL_UPLOAD_DRY_RUN_PASS',
                       'No upload attempted by this diagnostic',
                       'Do not retry the spent attempt'):
            self.assertIn(marker, s)
        self.assertNotIn('FileMode]::CreateNew', s)
        self.assertNotIn('Remove-Item -LiteralPath $lock', s)
        self.assertNotIn('Import-Clixml', s)
        self.assertNotIn('SecureStringToBSTR', s)

    def test_local_synthetic_only_never_real_upload(self):
        s = self.source
        for marker in ('--no-install', 'wrangler@4.162.0',
                       "'versions','upload'", "'--dry-run'", "'--secrets-file'",
                       "'--keep-vars'", "'--strict'", "('0' * 64)",
                       'CLOUDFLARE_CF_FETCH_ENABLED', "'false'",
                       'Remove-Item Env:CLOUDFLARE_ACCOUNT_ID',
                       'Remove-Item Env:CLOUDFLARE_ENV'):
            self.assertIn(marker, s)
        self.assertEqual(s.count("'versions','upload'"), 1)
        self.assertEqual(s.count("'--dry-run'"), 1)
        for forbidden in ('wrangler login', 'wrangler versions deploy',
                          'wrangler secret put', 'Invoke-RestMethod',
                          'Invoke-WebRequest', 'CLOUDFLARE_API_TOKEN=
,
                          'FileMode]::OpenOrCreate'):
            self.assertNotIn(forbidden, s)
        self.assertLess(s.index('verify_materialized_candidate.py'),
                        s.index("('0' * 64)"))

    def test_native_stderr_does_not_preempt_exit_code_classification(self):
        s = self.source
        for marker in ('function InvokeLocalNpx([string[]]$Arguments)',
                       "$ErrorActionPreference = 'Continue'",
                       '$ErrorActionPreference = $savedPreference',
                       '$captured = (& npx @Arguments 2>&1 | Out-String)',
                       '$exitCode = $LASTEXITCODE',
                       '$versionRun = InvokeLocalNpx',
                       '$dryRun = InvokeLocalNpx $arguments',
                       '$status = $dryRun.exitCode',
                       'LOCAL_CLI_OPTION_REJECTED',
                       'LOCAL_INPUT_OR_MODULE_MISSING',
                       'REMOTE_PREFLIGHT_OR_PROVIDER_CHECK'):
            self.assertIn(marker, s)
        self.assertEqual(s.count('& npx @Arguments 2>&1 | Out-String'), 1)
        self.assertNotIn('& npx @arguments 2>&1 | Out-String)', s)
        self.assertLess(s.index('$status = $dryRun.exitCode'),
                        s.index('if ($status -ne 0)'))
        # The original one-shot uploader remains untouched. Nothing prints
        # the potentially sensitive native CLI capture to the owner console.
        self.assertNotIn('Write-Host $result', s)
        self.assertNotIn('Write-Output $result', s)
        self.assertIn('Remove-Item -LiteralPath $tmp -Force', s)
        self.assertIn('if ($entered) { Pop-Location }', s)

if __name__ == '__main__':
    unittest.main()
