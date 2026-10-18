"""QA second-release review must be read-only, scoped and never overwrite records."""
import re
import unittest
from pathlib import Path

S = (Path(__file__).parent / "owner_windows_qa_update_review.ps1").read_text(encoding="utf-8")

class ExistingQAUpdateSafety(unittest.TestCase):
    def test_no_publish_capability_and_no_sensitive_actions(self):
        self.assertIn("param()", S)
        self.assertNotIn("param([switch]$Publish)", S)
        for disallowed in ("--secrets-file", "Import-Clixml", "Export-Clixml",
                           "d1 execute", "d1 migrations", "secret put",
                           "wrangler rollback", "versions deploy", "git reset",
                           "git checkout", "git clean", "git push", "git pull",
                           "Remove-Item -LiteralPath $candidate", "Invoke-WebRequest",
                           "Invoke-RestMethod", "-Force -Recurse", "d1 export"):
            with self.subTest(disallowed=disallowed):
                self.assertNotIn(disallowed, S)
        self.assertEqual(len(re.findall(r"&\s*\$wrangler\.Source\s+deploy\b", S)), 1)
        self.assertIn("& $wrangler.Source deploy --dry-run --config $temporaryManifest", S)
        self.assertNotRegex(S, r"&\s*\$wrangler\.Source\s+deploy\s+--config\b")
        self.assertIn("NO PUBLISH. Existing QA Worker", S)

    def test_exact_latest_source_and_no_overwrite_local_build(self):
        for expected in ("work/fire-business-app-parity-2026-10-08",
                         "rev-parse HEAD", "refs/remotes/origin/",
                         "$head -ceq $originHead", "status --porcelain --untracked-files=no",
                         "FIRE-QA-Builds", "qa-' + $head",
                         "verify_materialized_candidate.py",
                         "qa $candidate --built", "check_qa_runtime_config.mjs",
                         "Missing latest isolated QA build", "ReparsePoint"):
            with self.subTest(expected=expected):
                self.assertIn(expected, S)

    def test_bound_to_existing_synthetic_worker_and_database(self):
        for expected in ("fire-fullapp-qa-20261016",
                         "fire-fullapp-qa-db-20261016",
                         "8ccfb1f8-1657-4074-b1b2-47de78f95003",
                         "d3c33191-469f-4c08-8399-",
                         "deployments status --name $workerName --json",
                         "d1 list --json", "databaseInfo.qaUuid -ceq $qaId",
                         "$activeVersions.Count -eq 1",
                         "[double]$activeVersions[0].percentage -eq 100",
                         "$activeVersions[0].version_id",
                         "[regex]::Escape($expectedActiveVersionPrefix)"):
            self.assertIn(expected, S)
        self.assertLess(S.index("qa $candidate --built"), S.index("d1 list --json"))
        self.assertLess(S.index("d1 list --json"), S.index("deployments status"))
        self.assertLess(S.index("deployments status"), S.index("deploy --dry-run"))
        self.assertNotIn("fire-app-staging-db", S)
        self.assertNotRegex(S, r"&\\s*\\$wrangler\\.Source\\s+d1\\s+info\\b")
        self.assertIn("qa_d1_identity_from_list.ps1", S)
        self.assertIn("& $identityHelper -Json ($databaseRaw -join [Environment]::NewLine)", S)
        self.assertIn("Strict read-only D1 identity validator is missing", S)
        self.assertNotIn("$deploymentText -match", S)
        self.assertNotIn("82fba39a-5736-41d7-a944-d55776ccc670", S)
        self.assertIn("f650d25b18d23bc9f71a4d55c9322bfd5870ef75", S)
        self.assertIn("$previousSQL.Count -eq 23", S)
        self.assertIn("Get-FileHash -Algorithm SHA256", S)
        self.assertIn("$baseline.ContainsKey($file.Name)", S)
        self.assertIn("QA migration bytes differ from original published app", S)
        self.assertLess(S.index("Get-FileHash -Algorithm SHA256"), S.index("deployments status"))

    def test_temp_config_only_and_cleanup_guarantee(self):
        self.assertIn("prepare_qa_deploy_config.mjs", S)
        self.assertIn("Join-Path (Split-Path -Parent $manifest)", S)
        self.assertIn("[Guid]::NewGuid().ToString('D')", S)
        self.assertIn("& $node.Source $prepare $manifest $temporaryManifest", S)
        self.assertIn("Remove-Item -LiteralPath $temporaryManifest -Force", S)
        self.assertIn("} finally {", S)
        self.assertNotIn("FIRE-QA-Private", S)

if __name__ == "__main__":
    unittest.main(verbosity=2)
