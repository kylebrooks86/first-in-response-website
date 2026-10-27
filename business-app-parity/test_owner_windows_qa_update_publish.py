"""No remote execution: guard code-only upgrades of the existing synthetic QA Worker."""
import re
import unittest
from pathlib import Path

S=(Path(__file__).parent/"owner_windows_qa_update_publish.ps1").read_text(encoding="utf-8")

class OnlyApprovedQAUpdate(unittest.TestCase):
    def test_defaults_to_read_only(self):
        self.assertIn("[switch]$Publish",S)
        self.assertIn("[switch]$OwnerConfirmedPhotoZipBackup",S)
        self.assertIn("Require ($OwnerConfirmedPhotoZipBackup.IsPresent -xor $OwnerConfirmedNoLocalPhotos.IsPresent)",S)
        self.assertIn("[switch]$OwnerConfirmedNoLocalPhotos",S)
        self.assertIn("no QA photos exist on any device",S)
        self.assertNotIn("Require ($OwnerConfirmedPhotoZipBackup.IsPresent)",S)
        self.assertIn("SAVE to Files/iCloud, VERIFY saved ZIP",S)
        self.assertLess(S.index("Require ($OwnerConfirmedPhotoZipBackup.IsPresent -xor $OwnerConfirmedNoLocalPhotos.IsPresent)"),S.index("$beforeRaw ="))
        self.assertLess(S.index("if (-not $Publish)"),S.index("Require ($OwnerConfirmedPhotoZipBackup.IsPresent -xor $OwnerConfirmedNoLocalPhotos.IsPresent)"))
        self.assertIn("[string]$ApprovalText",S)
        self.assertIn("[string]$CandidateBranch",S)
        self.assertIn("[string]$ExpectedCommit",S)
        self.assertIn("if ($PSBoundParameters.ContainsKey('ApprovalText'))",S)
        self.assertIn("$typed = $ApprovalText",S)
        self.assertIn("} else {\n    $typed = Read-Host",S)
        self.assertIn("Require ($typed -ceq $approval)",S)
        self.assertLess(S.index("if ($PSBoundParameters.ContainsKey('ApprovalText'))"),S.index("Require ($typed -ceq $approval)"))
        self.assertIn("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review -CandidateBranch $CandidateBranch -ExpectedCommit $ExpectedCommit",S)
        self.assertEqual(S.count("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review"),2)
        self.assertLess(S.index("Require ($typed -ceq $approval)"), S.rindex("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review"))
        self.assertLess(S.rindex("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review"), S.index("deploy --config $temporaryManifest --name"))
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
                     "11576b67-50b3-4ea3-b377-436fd39d6016",
                     "owner_windows_qa_update_review.ps1",
                     "$beforeVersions.Count -eq 1",
                     "[double]$beforeVersions[0].percentage -eq 100",
                     "$expectedOldVersion = [string]$beforeVersions[0].version_id",
                     "$expectedOldVersion -ceq $expectedActiveVersion",
                     "FROM ' + $expectedOldVersion",
                     "$afterVersions.Count -eq 1",
                     "[string]$afterVersions[0].version_id -ceq $expectedOldVersion",
                     "d1 list --json",
                     "$d1.qaName -ceq $dbName -and $d1.qaUuid -ceq $dbId",
                     "QA Worker was updated by another operation",
                     "$photoMode = 'ON-DEVICE-PHOTOS-NO-R2'",
                     "$photoMode + ' ' + $head + ' FROM '",
                     "$head -ceq $ExpectedCommit",
                     "Fresh post-approval read-only 25-schema, D1 and source revalidation"):
            self.assertIn(text,S)
        self.assertNotIn("fire-app-staging-db",S)
        self.assertIn("No R2 bucket is bound or billed",S)
        self.assertNotIn("r2 bucket info",S)
        self.assertNotRegex(S, r"&\\s*\\$wrangler\\.Source\\s+d1\\s+info\\b")
        self.assertIn("qa_d1_identity_from_list.ps1", S)
        self.assertIn("& $identityHelper -Json ($rawD1 -join [Environment]::NewLine)", S)
        self.assertLess(S.index("Require ($typed -ceq $approval)"), S.index("d1 list --json"))
        self.assertLess(S.index("deployments status --name $workerName --json"),S.index("$typed = Read-Host"))
        self.assertLess(S.index("$typed = Read-Host"),S.rindex("deployments status --name $workerName --json"))
        self.assertNotIn("$statusText -match", S)
        self.assertLess(S.index("deployments status --name"),S.index("d1 list --json"))
        self.assertLess(S.index("d1 list --json"),S.index("deploy --config $temporaryManifest --name"))

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
