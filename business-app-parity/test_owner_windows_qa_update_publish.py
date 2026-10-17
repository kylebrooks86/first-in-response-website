"""No remote execution: guard code-only upgrades of the existing synthetic QA Worker."""
import re
import unittest
from pathlib import Path

S=(Path(__file__).parent/"owner_windows_qa_update_publish.ps1").read_text(encoding="utf-8")

class OnlyApprovedQAUpdate(unittest.TestCase):
    def test_defaults_to_read_only(self):
        self.assertIn("param([switch]$Publish)",S)
        self.assertIn("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review",S)
        self.assertIn("if (-not $Publish)",S)
        self.assertIn("REVIEW ONLY PASS. No Worker update or secret upload",S)
        self.assertIn("return",S)
        self.assertLess(S.index("if (-not $Publish)"),S.index("$approval = 'UPDATE QA '"))
        self.assertLess(S.index("$typed = Read-Host"),S.index("& $wrangler.Source deploy --config"))
        self.assertIn("Require ($typed -ceq $approval)",S)

    def test_exact_existing_worker_and_same_database(self):
        for text in ("fire-fullapp-qa-20261016",
                     "fire-fullapp-qa-db-20261016",
                     "8ccfb1f8-1657-4074-b1b2-47de78f95003",
                     "82fba39a-5736-41d7-a944-d55776ccc670",
                     "owner_windows_qa_update_review.ps1",
                     "$statusText -match [regex]::Escape($expectedOldVersion)",
                     "d1 info $dbName --json",
                     "$d1.name -ceq $dbName -and $d1.uuid -ceq $dbId",
                     "QA Worker was updated by another operation"):
            self.assertIn(text,S)
        self.assertNotIn("fire-app-staging-db",S)
        self.assertLess(S.index("$typed = Read-Host"),S.index("deployments status --name $workerName --json"))
        self.assertLess(S.index("deployments status --name"),S.index("d1 info $dbName"))
        self.assertLess(S.index("d1 info $dbName"),S.index("deploy --config $temporaryManifest --name"))

    def test_code_only_not_migrations_secrets_or_remote_rollbacks(self):
        prohibited=("Import-Clixml","Export-Clixml","--secrets-file","secret put",
                    "d1 execute","d1 migrations","d1 export","d1 delete",
                    "git reset","git checkout","git clean",
                    "wrangler rollback","versions deploy","versions upload",
                    "FIRE-QA-Private","FIRE_QA_SESSION_SECRET","FIRE_QA_PASSWORD_HASH",
                    "Invoke-WebRequest","Invoke-RestMethod")
        for word in prohibited:
            with self.subTest(word=word): self.assertNotIn(word,S)
        self.assertEqual(len(re.findall(r"&\s*\$wrangler\.Source deploy --config",S)),1)
        self.assertIn("& $wrangler.Source deploy --dry-run --config $temporaryManifest",S)
        self.assertIn("prepare_qa_deploy_config.mjs",S)
        self.assertIn("Remove-Item -LiteralPath $temporaryManifest -Force",S)
        self.assertLess(S.index("deploy --dry-run"), S.index("deploy --config $temporaryManifest --name"))
        self.assertIn("} finally {",S)

if __name__=="__main__":unittest.main(verbosity=2)
