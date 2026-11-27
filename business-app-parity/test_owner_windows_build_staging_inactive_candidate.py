"""Fail-closed source review of owner Acer STAGING build helper; no provider calls."""
from pathlib import Path
import unittest

SOURCE=(Path(__file__).parent/'owner_windows_build_staging_inactive_candidate.ps1').read_text()

class LocalStagingBuilderSafety(unittest.TestCase):
    def test_exact_integrated_source_and_clean_git(self):
        for expected in (
            "work/fire-private-notes-followup-search-20261119",
            "ExpectedCommit", "rev-parse HEAD", "refs/remotes/origin/$branch",
            "status --porcelain --untracked-files=no",
            "Run safe pull first if needed",
        ):
            self.assertIn(expected,SOURCE)
        self.assertIn("$head -ceq $ExpectedCommit",SOURCE)

    def test_no_cloudflare_write_and_separate_explicit_build(self):
        self.assertIn("if (-not $Build)", SOURCE)
        self.assertIn("DRY RUN PASS",SOURCE)
        self.assertNotIn("wrangler versions upload --",SOURCE)
        self.assertNotIn("npx @uploadArgs",SOURCE)
        self.assertNotIn("wrangler secret put",SOURCE)
        self.assertNotIn("wrangler login",SOURCE)
        self.assertIn("NOT UPLOADED",SOURCE)

    def test_exact_source_overlay_and_disabled_payment_mode(self):
        for expected in (
            "$builder independent-staging $destination",
            "$verifier independent-staging $destination",
            "$verifier independent-staging $destination --built",
            "check_independent_staging_runtime_config.mjs",
            "sourceJobNumberModeRequested -eq $false",
            "sourceQuickAuthModeRequested -eq $false",
            "FIRE_STAGING_JOB_NUMBERS_CANDIDATE",
            "FIRE_STAGING_QUICK_AUTH_MODE",
            "pnpm@11.25.0",
            "install --frozen-lockfile",
        ):
            self.assertIn(expected,SOURCE)
        self.assertLess(SOURCE.index("$verifier independent-staging $destination --built"),
                        SOURCE.index("$guardJson ="))

    def test_device_private_files_and_existing_workers_are_not_touched(self):
        self.assertIn("FIRE-STAGING-Candidates",SOURCE)
        self.assertIn("-not (Test-Path -LiteralPath $destination)",SOURCE)
        self.assertNotIn("Import-Clixml",SOURCE)
        self.assertNotIn("Remove-Item -LiteralPath $recordFile",SOURCE)
        self.assertNotIn("versions','deploy'",SOURCE)

if __name__=='__main__':
    unittest.main()
