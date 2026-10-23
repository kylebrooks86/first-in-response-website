"""Source-only contract: no-cost existing synthetic QA update cannot spill into other Cloudflare resources."""
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).parent
REVIEW=(ROOT/"owner_windows_qa_no_r2_update_review.ps1").read_text(encoding="utf-8")
PUBLISH=(ROOT/"owner_windows_qa_no_r2_update_publish.ps1").read_text(encoding="utf-8")
PHOTO_POST=(ROOT/"shared/app/api/customer-photos/route.ts").read_text(encoding="utf-8")
PHOTO_ID=(ROOT/"shared/app/api/customer-photos/[id]/route.ts").read_text(encoding="utf-8")

class NoR2ExistingQAUpdate(unittest.TestCase):
    def test_owner_verified_old_version_remains_pinned_for_both(self):
        for content in (REVIEW,PUBLISH):
            self.assertIn("58a467fa-9dbc-45a3-971e-b5a4e478f54d",content)
            self.assertIn("fire-fullapp-qa-20261016",content)
            self.assertIn("8ccfb1f8-1657-4074-b1b2-47de78f95003",content)
            self.assertIn("fire-fullapp-qa-db-20261016",content)
            self.assertIn("deployments status --name $workerName --json",content)
            self.assertIn("percentage -eq 100",content)
            self.assertIn("prepare_qa_no_r2_deploy_config.mjs",content)
            self.assertIn("wrangler.fire-qa-no-r2-",content)
            self.assertNotIn("qaPhotoBucket",content)
            self.assertNotIn("$wrangler.Source r2",content)
            self.assertNotIn("r2 bucket create",content)
            self.assertNotIn("stripe secret",content.lower())
            for forbidden in ("secret put","d1 migrations apply","d1 migrations list",
                  "d1 execute $dbName --remote --command",
                  "d1 execute $qaDatabase --remote --command",
                  "wrangler rollback","git reset","git checkout","git push",
                  "Invoke-WebRequest","Invoke-RestMethod","--secrets-file"):
                with self.subTest(forbidden=forbidden):
                    self.assertNotIn(forbidden,content)

    def test_review_is_read_only_and_requires_full_25_schema(self):
        self.assertIn("$previousSQL.Count -eq 23 -and $nextSQL.Count -eq 25",REVIEW)
        self.assertIn("review_qa_update_schema.py",REVIEW)
        self.assertIn("required_tables -eq 8",REVIEW)
        self.assertIn("signed_agreement_triggers -eq 2",REVIEW)
        self.assertIn("provider_index -eq 1",REVIEW)
        self.assertIn("journal_names -ceq ($orderedSQL -join '|')",REVIEW)
        self.assertIn("d1 list --json",REVIEW)
        self.assertIn("qa_d1_identity_from_list.ps1",REVIEW)
        self.assertIn("deploy --dry-run",REVIEW)
        self.assertEqual(len(re.findall(r"&\s*\$wrangler\.Source\s+deploy\b",REVIEW)),1)
        self.assertNotIn("deploy --config $temporaryManifest",REVIEW)
        self.assertNotIn("[switch]$Publish",REVIEW)
        self.assertIn("NO PUBLISH.",REVIEW)
        self.assertNotIn("Remove-Item -LiteralPath $candidate",REVIEW)

    def test_publish_only_after_review_full_approval_and_fresh_recheck(self):
        self.assertIn("[switch]$Publish",PUBLISH)
        self.assertIn("if (-not $Publish)",PUBLISH)
        self.assertIn("owner_windows_qa_no_r2_update_review.ps1",PUBLISH)
        self.assertIn("UPDATE QA NO-R2 ",PUBLISH)
        self.assertIn("Require ($typed -ceq $approval)",PUBLISH)
        self.assertEqual(PUBLISH.count("& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review"),2)
        self.assertLess(PUBLISH.index("if (-not $Publish)"),
                        PUBLISH.index("$approval ="))
        self.assertLess(PUBLISH.index("Require ($typed -ceq $approval)"),
                        PUBLISH.index("Fresh post-approval read-only 25-schema"))
        self.assertLess(PUBLISH.index("Fresh post-approval read-only 25-schema"),
                        PUBLISH.index("& $wrangler.Source deploy --config $temporaryManifest"))
        self.assertLess(PUBLISH.index("Fresh, read-only active QA deployment identity"),
                        PUBLISH.index("& $wrangler.Source deploy --config $temporaryManifest"))
        self.assertIn("No-upload",REVIEW)
        self.assertEqual(len(re.findall(r"&\s*\$wrangler\.Source\s+deploy\b",PUBLISH)),2)
        self.assertIn("deploy --dry-run",PUBLISH)
        self.assertIn("deploy --config $temporaryManifest --name $workerName",PUBLISH)
        self.assertIn("d1 list --json",PUBLISH)
        self.assertIn("$expectedOldVersion",PUBLISH)

    def test_unbound_cloud_photo_api_preserves_d1_metadata_and_fails_closed(self):
        self.assertIn("if (!env.BUCKET)",PHOTO_POST)
        self.assertIn("status: 503",PHOTO_POST)
        self.assertIn("if (!env.BUCKET)",PHOTO_ID)
        self.assertIn("Existing photo records have been preserved.",PHOTO_ID)
        self.assertLess(PHOTO_ID.index("if (!env.BUCKET)"),
                        PHOTO_ID.index('DELETE FROM customer_photos'))
        self.assertLess(PHOTO_POST.index("if (!env.BUCKET)"),
                        PHOTO_POST.index("INSERT INTO customer_photos"))
        # Both routes authenticate the owner before inspecting storage or DB.
        self.assertLess(PHOTO_ID.index("if (!await authorized())"),
                        PHOTO_ID.index("if (!env.BUCKET)"))
        self.assertLess(PHOTO_POST.index("if (!await authorized())"),
                        PHOTO_POST.index("if (!env.BUCKET)"))

if __name__=="__main__":
    unittest.main()
