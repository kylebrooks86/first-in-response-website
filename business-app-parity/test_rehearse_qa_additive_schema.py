"""QA 23→25 historical schema rehearsal is synthetic-only and fails closed."""
from __future__ import annotations
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from review_qa_update_schema import HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, QAReviewStop
from rehearse_qa_additive_schema import rehearse

ROOT=Path(__file__).parent
SOURCE=ROOT/"adapters"/"doomsday"/"drizzle"
SHA="59e291622a03d25e5e8b9f849c0192b5fadeca0d"

class QaShadowAddendumTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="fire-qa-shadow-")
        self.addCleanup(self.temp.cleanup)
        root=Path(self.temp.name)
        self.baseline,self.candidate=root/"baseline",root/"candidate"
        self.baseline.mkdir()
        self.candidate.mkdir()
        for name in [*HISTORICAL_GIT_BLOBS,*NEW_GIT_BLOBS]:
            shutil.copyfile(SOURCE/name,self.candidate/name)
            if name in HISTORICAL_GIT_BLOBS:
                shutil.copyfile(SOURCE/name,self.baseline/name)

    def test_real_synthetic_23_to_25_rehearsal_preserves_history(self):
        output=rehearse(self.baseline,self.candidate,SHA)
        self.assertEqual((output["originalSqlCount"],output["candidateSqlCount"]),(23,25))
        self.assertEqual(output["appendOnlyMutationRefusals"],4)
        self.assertEqual(len(output["additionalSqlObjects"]),8)
        self.assertGreaterEqual(output["historicalTablesWithUnchangedRows"],10)
        self.assertTrue(output["syntheticCustomerAndEstimatePreserved"])
        self.assertTrue(output["syntheticSignedDocumentSHA256Verified"])
        for key in ("remoteSchemaVerified","codeOnlyUpdateEligible","publicationAuthorized","migrationPermissionGranted"):
            self.assertFalse(output[key])

    def test_modified_historical_sql_is_refused_before_rehearsal(self):
        p=self.baseline/"0012_invoice_revisions.sql"
        p.write_bytes(p.read_bytes()+b"\n-- tampered baseline")
        with self.assertRaisesRegex(QAReviewStop,"pinned history"):
            rehearse(self.baseline,self.candidate,SHA)

    def test_modified_new_appendix_is_refused_before_rehearsal(self):
        p=self.candidate/"0024_deposit_agreement_snapshots.sql"
        p.write_bytes(p.read_bytes()+b"\nDROP TABLE estimates;")
        with self.assertRaisesRegex(QAReviewStop,"pinned history"):
            rehearse(self.baseline,self.candidate,SHA)

    def test_missing_new_additive_sql_is_refused_before_rehearsal(self):
        (self.candidate/"0023_deposit_policy_events.sql").unlink()
        with self.assertRaisesRegex(QAReviewStop,"missing/new migration"):
            rehearse(self.baseline,self.candidate,SHA)

    def test_no_remote_or_deployment_entrypoint(self):
        s=(ROOT/"rehearse_qa_additive_schema.py").read_text()
        for token in ("import requests","urllib.request","boto3","cloudflare:workers",
                      "subprocess","os.system","wrangler deploy","d1 execute",
                      "openai", "secret put", ".write_text(", ".write_bytes("):
            with self.subTest(token=token):self.assertNotIn(token,s)
        self.assertIn('sqlite3.connect(":memory:")',s)
        self.assertIn('"publicationAuthorized": False',s)
        self.assertIn('"remoteSchemaVerified": False',s)

    def test_cli_emits_review_packet_without_files(self):
        result=subprocess.run([sys.executable,str(ROOT/"rehearse_qa_additive_schema.py"),
           "--baseline",str(self.baseline),"--candidate",str(self.candidate),
           "--checkpoint",SHA],check=True,capture_output=True,text=True,timeout=25)
        self.assertIn("LOCAL_SYNTHETIC_ADDENDUM_REHEARSAL_PASSED",result.stdout)
        self.assertEqual(result.stderr,"")
        self.assertEqual(list(Path(self.temp.name).rglob("*.db")),[])

if __name__=="__main__":
    unittest.main(verbosity=2)
