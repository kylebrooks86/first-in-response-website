"""QA second-release review must be read-only, scoped and never overwrite records."""
import re
import unittest
from pathlib import Path

S = (Path(__file__).parent / "owner_windows_qa_update_review.ps1").read_text(encoding="utf-8")

class ExistingQAUpdateSafety(unittest.TestCase):
    def test_no_publish_capability_and_no_sensitive_actions(self):
        self.assertIn("[string]$CandidateBranch", S)
        self.assertIn("[string]$ExpectedCommit", S)
        self.assertNotIn("param([switch]$Publish)", S)
        for disallowed in ("--secrets-file", "Import-Clixml", "Export-Clixml",
                           "d1 migrations", "secret put",
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
                         "$head -ceq $originHead", "$head -ceq $ExpectedCommit",
                         "An alternate FIRE development branch MUST provide a reviewed exact commit",
                         "status --porcelain --untracked-files=no",
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
                         "58a467fa-9dbc-45a3-971e-b5a4e478f54d",
                         "deployments status --name $workerName --json",
                         "d1 list --json", "databaseInfo.qaUuid -ceq $qaId",
                         "$activeVersions.Count -eq 1",
                         "[double]$activeVersions[0].percentage -eq 100",
                         "$activeVersions[0].version_id",
                         "$activeVersion -ceq $expectedActiveVersion"):
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
        self.assertIn("$previousSQL.Count -eq 23 -and $nextSQL.Count -eq 25", S)
        self.assertIn("review_qa_update_schema.py", S)
        self.assertIn("--baseline (Join-Path $original 'drizzle')", S)
        self.assertIn("--candidate (Join-Path $candidate 'drizzle')", S)
        self.assertIn("--checkpoint $head", S)
        self.assertIn("Get-FileHash -Algorithm SHA256", S)
        self.assertIn("$baseline.ContainsKey($file.Name)", S)
        self.assertIn("QA migration bytes differ from original published app", S)
        self.assertLess(S.index("Get-FileHash -Algorithm SHA256"), S.index("deployments status"))
        self.assertLess(S.index("review_qa_update_schema.py"), S.index("d1 list --json"))

    def test_exact_hosted_25_schema_and_separate_photo_r2_are_read_only_gates(self):
        for expected in (
            "SELECT (SELECT GROUP_CONCAT(name,'|')",
            "FROM d1_migrations ORDER BY id",
            "d1 execute $qaDatabase --remote",
            '"--command=$sql"',
            "$row.journal_names -ceq ($orderedSQL -join '|')",
            "$row.required_tables -eq 8", "$row.provider_index -eq 1",
            "$row.signed_agreement_triggers -eq 2",
            "deposit_policy_events", "deposit_agreement_snapshots",
            "payment_refunds", "customer_photos",
            "deposit_agreement_snapshots_no_update",
            "deposit_agreement_snapshots_no_delete",
            "$wrangler.Source r2 bucket info $qaPhotoBucket --json",
            "Dedicated new QA photo R2 bucket missing/mismatched",
        ):
            with self.subTest(expected=expected):self.assertIn(expected,S)
        self.assertEqual(S.count("d1 execute $qaDatabase --remote"),1)
        self.assertEqual(S.count("r2 bucket info $qaPhotoBucket --json"),1)
        self.assertLess(S.index("qa $candidate --built"),S.index("d1 execute $qaDatabase --remote"))
        self.assertLess(S.index("d1 execute $qaDatabase --remote"),S.index("r2 bucket info $qaPhotoBucket --json"))
        self.assertLess(S.index("r2 bucket info $qaPhotoBucket --json"),S.index("deployments status"))
        for forbidden in ("d1 migrations apply", "d1 execute $qaDatabase --remote --file",
                          "r2 bucket create", "r2 object put", "r2 object delete"):
            self.assertNotIn(forbidden,S)

    def test_review_and_publisher_share_one_full_observed_version(self):
        publisher = (Path(__file__).parent / "owner_windows_qa_update_publish.ps1").read_text(encoding="utf-8")
        for script in (S, publisher):
            pins = re.findall(r"^\$expectedActiveVersion = '([^']+)'$", script, re.M)
            self.assertEqual(pins, ["58a467fa-9dbc-45a3-971e-b5a4e478f54d"])
            self.assertNotIn("expectedActiveVersionPrefix", script)
            self.assertNotIn("da71b08f", script)
        self.assertIn("Require ($activeVersion -ceq $expectedActiveVersion)", S)
        self.assertIn("Require ($expectedOldVersion -ceq $expectedActiveVersion)", publisher)
        self.assertIn("[string]$afterVersions[0].version_id -ceq $expectedOldVersion", publisher)
        self.assertLess(publisher.index("version_id -ceq $expectedOldVersion"), publisher.index("deploy --config $temporaryManifest"))

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
