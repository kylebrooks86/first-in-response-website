"""Refuse untrusted QA metadata, secrets, drift and fake release authorizations."""
import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout,redirect_stderr
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import patch
import capture_existing_qa_schema_read_only as qa
import review_existing_qa_capture_offline as offline

def capture_packet():
    capture={"format":qa.FORMAT,"qaWorker":qa.WORKER,"qaDatabase":qa.NAME,"qaUuid":qa.UUID,
        "activeVersion":qa.ACTIVE_VERSION,"capturedAt":datetime.now(timezone.utc).isoformat(),
        "providerSourceAttested":False,"truncated":False,
        "queries":[{"rows":r} for r in qa.local_baseline()]}
    return {"capture":capture,"review":qa.compare_capture(capture)}

class TestOfflineQaEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base=capture_packet()

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/"capture.json"

    def save(self,value=None):
        self.path.write_text(json.dumps(self.base if value is None else value),encoding="utf-8")
        return self.path

    def test_verified_23_schema_still_refuses_hosted_update(self):
        r=offline.evaluate(self.save())
        self.assertTrue(r["original23SchemaMetadataMatches"])
        self.assertEqual(len(r["additiveSqlMigrations"]),2)
        self.assertEqual(len(r["captureSha256"]),64)
        self.assertIn("OWNER_REVIEW_REQUIRED",r["result"])
        for k in ("cloudflareCaptureProvenanceIndependentlyAttested",
                  "hostedBackupAndRestoreVerified","migrationApproved",
                  "workerPublishApproved","physicalIphoneAccepted","productionReady"):
            self.assertFalse(r[k],k)
        self.assertNotIn("CREATE TABLE",json.dumps(r))

    def test_metadata_drift_is_explicit_stop(self):
        p=copy.deepcopy(self.base)
        p["capture"]["queries"][4]["rows"][-1]["name"]="0022_unreviewed.sql"
        p["review"]=qa.compare_capture(p["capture"])
        r=offline.evaluate(self.save(p))
        self.assertEqual(r["result"],"QA_SCHEMA_DRIFT_STOP")
        self.assertIn("QUERY_05_DIFFERS_FROM_ORIGINAL_23",r["schemaDriftIndicators"])
        self.assertFalse(r["migrationApproved"])

    def test_mismatched_saved_review_rejected(self):
        p=copy.deepcopy(self.base)
        p["review"]["metadataMatchesOriginal23"]=False
        with self.assertRaisesRegex(offline.OfflineReviewStop,"Stored review"):
            offline.evaluate(self.save(p))

    def test_secret_and_extra_fields_rejected(self):
        p=copy.deepcopy(self.base)
        p["capture"]["queries"][0]["rows"][0]["email"]="private@example.invalid"
        with self.assertRaisesRegex(offline.OfflineReviewStop,"unreviewed fields"):
            offline.evaluate(self.save(p))
        p=copy.deepcopy(self.base)
        p["privateCustomerRows"]=[]
        with self.assertRaisesRegex(offline.OfflineReviewStop,"unexpected fields"):
            offline.evaluate(self.save(p))

    def test_wrong_owner_worker_or_QA_UUID_refused(self):
        for key,value in (("qaUuid","different"),("activeVersion","different"),
                          ("truncated",True),("providerSourceAttested",True)):
            p=copy.deepcopy(self.base);p["capture"][key]=value
            with self.subTest(key=key),self.assertRaises(offline.OfflineReviewStop):
                offline.evaluate(self.save(p))

    def test_symlinks_invalid_files_dates_and_sizes_refused(self):
        self.save()
        symlink=Path(self.temp.name)/"symlink.json"
        try:symlink.symlink_to(self.path)
        except OSError:pass
        else:
            with self.assertRaisesRegex(offline.OfflineReviewStop,"symbolic link"):
                offline.evaluate(symlink)
        self.path.write_bytes(b"x"*(offline.MAX_BYTES+1))
        with self.assertRaisesRegex(offline.OfflineReviewStop,"safe metadata"):
            offline.evaluate(self.path)
        self.path.write_bytes(b"{")
        with self.assertRaisesRegex(offline.OfflineReviewStop,"valid reviewed UTF-8"):
            offline.evaluate(self.path)
        for date in ("2026-10-18T12:00:00","2126-10-18T12:00:00+00:00"):
            p=copy.deepcopy(self.base);p["capture"]["capturedAt"]=date
            with self.subTest(date=date),self.assertRaises(offline.OfflineReviewStop):
                offline.evaluate(self.save(p))

    def test_CLI_default_and_positive_never_publish(self):
        with patch("sys.argv",["offline"]),redirect_stdout(io.StringIO()) as out:
            self.assertEqual(offline.main(),0)
        self.assertIn("No Cloudflare access",out.getvalue())
        with patch("sys.argv",["offline","--capture-file",str(self.save())]),redirect_stdout(io.StringIO()) as out:
            self.assertEqual(offline.main(),0)
        r=json.loads(out.getvalue())
        self.assertFalse(r["workerPublishApproved"])
        p=copy.deepcopy(self.base);p["review"]["metadataMatchesOriginal23"]=False
        with patch("sys.argv",["offline","--capture-file",str(self.save(p))]),redirect_stderr(io.StringIO()) as err:
            self.assertEqual(offline.main(),2)
        self.assertIn("STOP",err.getvalue())

if __name__=="__main__":
    unittest.main(verbosity=2)
