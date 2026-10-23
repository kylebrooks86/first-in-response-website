"""Regression contract for the local-only Acer full-app QA builder.
No PowerShell execution, dependency installation, Cloudflare call or file writes.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
SOURCE = (ROOT / "owner_windows_build_qa_candidate.ps1").read_text(encoding="utf-8")

class LocalFullAppQABuildContract(unittest.TestCase):
    def test_default_dry_run_and_build_switch(self):
        self.assertIn("[switch]$Build,", SOURCE)
        self.assertIn("if (-not $Build)", SOURCE)
        self.assertIn("DRY RUN PASS", SOURCE)
        self.assertLess(SOURCE.index("if (-not $Build)"), SOURCE.index("New-Item -ItemType Directory"))
        self.assertLess(SOURCE.index("if (-not $Build)"), SOURCE.index("$python.Source $builder qa $destination"))

    def test_exact_git_source_and_nonoverwrite(self):
        for requirement in ("work/fire-business-app-parity-2026-10-08",
                            "branch --show-current", "rev-parse HEAD",
                            "refs/remotes/origin/$branch", "$head -ceq $originHead",
                            "status --porcelain --untracked-files=no",
                            "Existing QA candidate directory must be preserved; refusing overwrite."):
            self.assertIn(requirement, SOURCE)
        self.assertIn("Join-Path $env:LOCALAPPDATA 'FIRE-QA-Builds'", SOURCE)
        self.assertNotIn("FIRE-QA-Private\\qa-owner-secrets.xml", SOURCE)

    def test_explicit_current_candidate_pin_is_required_for_other_branches(self):
        for required in ("[string]$CandidateBranch", "[string]$ExpectedCommit",
                         "^work/fire-[a-z0-9][a-z0-9-]{1,110}$",
                         "A nonstandard candidate branch requires an explicitly reviewed exact commit",
                         "Checked out Git commit differs from the explicitly reviewed candidate",
                         "$head -ceq $ExpectedCommit"):
            self.assertIn(required, SOURCE)
        self.assertLess(SOURCE.index("A nonstandard candidate branch requires"),
                        SOURCE.index("$git = Get-Command"))
        self.assertLess(SOURCE.index("$head -ceq $ExpectedCommit"),
                        SOURCE.index("$buildRoot = Join-Path"))

    def test_local_only_build_and_source_integrity(self):
        for requirement in ("materialize.py", "verify_materialized_candidate.py",
                            "check_qa_runtime_config.mjs", "$python.Source $builder qa $destination",
                            "$python.Source $verifier qa $destination", "install --frozen-lockfile",
                            "exec tsc --noEmit", "run build", "$node.Source $runtimeGuard $manifest",
                            "CLOUDFLARE_CF_FETCH_ENABLED = 'false'",
                            "WRANGLER_SEND_METRICS = 'false'"):
            self.assertIn(requirement, SOURCE)
        self.assertIn("11.25.0", SOURCE)
        self.assertIn("corepack.cmd", SOURCE)
        self.assertIn("shared\\package.json", SOURCE)
        self.assertIn("pnpm@11.25.0", SOURCE)
        self.assertIn("$packageTool.Source @packageArgs install --frozen-lockfile", SOURCE)
        self.assertIn("$packageTool.Source @packageArgs exec tsc --noEmit", SOURCE)
        self.assertIn("$packageTool.Source @packageArgs run build", SOURCE)
        self.assertIn("if ($packageArgs.Count -gt 0)", SOURCE)
        self.assertIn("$resolvedVersion -ceq '11.25.0'", SOURCE)
        self.assertLess(SOURCE.index("if (-not $Build)"), SOURCE.index("$resolvedVersion = ("))
        self.assertIn("22.13.0", SOURCE)
        self.assertIn("Python 3 required", SOURCE)
        self.assertIn("No Worker was published", SOURCE)

    def test_never_calls_remote_deployment_or_modifies_customer_data(self):
        for forbidden in ("wrangler deploy", "wrangler.cmd deploy", "wrangler secret",
                          "versions upload", "d1 migrations apply", "d1 execute",
                          "wrangler d1", "stripe", "Invoke-WebRequest", "Invoke-RestMethod",
                          "Remove-Item", "Clear-Content", "Set-Clipboard", "Export-Clixml",
                          "Import-Clixml", "ConvertFrom-SecureString", "Start-Process",
                          "Invoke-Expression", "Out-File", "Set-Content", "git reset",
                          "git checkout", "git clean", "git pull", "git push"):
            with self.subTest(token=forbidden):
                # Commentary may mention Stripe; avoid accepting an executable.
                if forbidden == "stripe":
                    self.assertNotRegex(SOURCE, r"(?im)^\\s*.*(?:&|\\.)\\s*stripe\\b")
                else:
                    self.assertNotIn(forbidden, SOURCE)
        self.assertNotRegex(SOURCE, r"(?im)^\\s*&\\s*\\$[a-z]+\\.Source\\s+(?:deploy|secret|publish|d1|pages)")
        self.assertIn("No database migrations, remote commands", SOURCE)

if __name__ == "__main__":
    unittest.main(verbosity=2)
