"""Existing QA 23-SQL read-only capture: strict identity, no hosted writes, real pinned local schema."""
from __future__ import annotations
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import capture_existing_qa_schema_read_only as qa

ROOT=Path(__file__).parent

def sample():
    return {
        "format":qa.FORMAT,"qaWorker":qa.WORKER,"qaDatabase":qa.NAME,"qaUuid":qa.UUID,
        "activeVersion":qa.ACTIVE_VERSION,"capturedAt":"2026-10-19T18:00:00+00:00",
        "providerSourceAttested":False,"truncated":False,
        "queries":[{"rows":x} for x in qa.local_baseline()]
    }

class ExistingQaEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before=qa.local_baseline()

    def test_exact_23_legacy_schema_reads_without_writer_access(self):
        review=qa.compare_capture(sample())
        self.assertTrue(review["metadataMatchesOriginal23"])
        self.assertEqual(review["original23MigrationCount"],23)
        self.assertEqual(review["observedMigrationNames"],sorted(qa.HISTORICAL_GIT_BLOBS))
        for k in ("remoteSourceAttested","hostedMigrationAuthorized","codeUpdateAuthorized","ownerApprovalCaptured","customerRowsOrPaymentDetailsCollected"):
            self.assertFalse(review[k])

    def test_migration_journal_drift_is_reported_not_approved(self):
        doc=sample()
        doc["queries"][4]["rows"][-1]["name"]="0022_unknown_name.sql"
        review=qa.compare_capture(doc)
        self.assertFalse(review["metadataMatchesOriginal23"])
        self.assertIn("QUERY_05_DIFFERS_FROM_ORIGINAL_23",review["blockers"])
        self.assertFalse(review["codeUpdateAuthorized"])
        doc=sample()
        doc["queries"][4]["rows"].append({"name":"0023_deposit_policy_events.sql"})
        self.assertIn("QUERY_05_DIFFERS_FROM_ORIGINAL_23",qa.compare_capture(doc)["blockers"])

    def test_sql_schema_definition_tampering_and_private_fields_blocked(self):
        doc=sample()
        doc["queries"][0]["rows"][0]["sql"]="DROP TABLE customers"
        self.assertIn("QUERY_01_DIFFERS_FROM_ORIGINAL_23",qa.compare_capture(doc)["blockers"])
        doc=sample()
        doc["queries"][0]["rows"][0]["customer_email"]="private@example.invalid"
        with self.assertRaisesRegex(ValueError,"unreviewed fields"):
            qa.compare_capture(doc)
        doc=sample();doc["secret"]="stolen"
        with self.assertRaisesRegex(ValueError,"unreviewed fields"):
            qa.compare_capture(doc)
        doc=sample();doc["providerSourceAttested"]=True
        with self.assertRaisesRegex(ValueError,"identity or completeness"):
            qa.compare_capture(doc)

    def test_qa_and_staging_identity_and_split_worker_refuse(self):
        good=[{"name":qa.NAME,"uuid":qa.UUID},{"name":qa.PROTECTED_NAME,"uuid":qa.PROTECTED_UUID}]
        qa.inventory(good)
        for wrong in (good[:1],good+good[:1],
                      [{"name":qa.NAME,"uuid":qa.PROTECTED_UUID},good[1]],
                      [{"name":qa.NAME,"uuid":qa.UUID},{"name":qa.PROTECTED_NAME,"uuid":qa.UUID}],
                      {"results":good}):
            with self.subTest(wrong=wrong),self.assertRaises(ValueError):
                qa.inventory(wrong)
        self.assertEqual(qa.deployment({"versions":[{"version_id":qa.ACTIVE_VERSION,"percentage":100}]}),qa.ACTIVE_VERSION)
        self.assertEqual(qa.ACTIVE_VERSION,"58a467fa-9dbc-45a3-971e-b5a4e478f54d")
        for bad in ({"versions":[{"version_id":"5e44f843-94f0-4ea4-b80f-a889bd0830ef","percentage":100}]},{"versions":[]},{"versions":[{"version_id":"new","percentage":100}]},
                    {"versions":[{"version_id":qa.ACTIVE_VERSION,"percentage":99}]},
                    {"versions":[{"version_id":qa.ACTIVE_VERSION,"percentage":100}]*2}):
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                qa.deployment(bad)

    def test_qa_capture_only_metadata_d1_selects_and_pinned_worker_status(self):
        recorded=[]
        original=qa.local_baseline()
        good_inventory=[{"name":qa.NAME,"uuid":qa.UUID},{"name":qa.PROTECTED_NAME,"uuid":qa.PROTECTED_UUID}]
        def fake(_cli,args,stage):
            recorded.append((list(args),stage))
            if args[:2]==["d1","list"]:return good_inventory
            if args[:2]==["deployments","status"]:
                return {"versions":[{"version_id":qa.ACTIVE_VERSION,"percentage":100}]}
            self.assertEqual(args[:3],["d1","execute",qa.NAME])
            self.assertIn("--remote",args)
            self.assertIn("--command",args)
            command=args[args.index("--command")+1]
            self.assertTrue(command.startswith("SELECT "))
            self.assertNotIn("\n",command)
            self.assertNotIn("--file",args)
            self.assertNotIn("--execute",args)
            self.assertNotIn("deploy",args)
            i=sum(x[0][:2]==["d1","execute"] for x in recorded)
            return [{"success":True,"results":original[i-1]}]
        with tempfile.TemporaryDirectory() as folder,patch.object(qa.safe,"checked_cli_stage",side_effect=fake):
            path,report=qa.capture("mock-wrangler",["SELECT synthetic query"]*10,Path(folder))
            saved=json.loads(path.read_text(encoding="utf-8"))
            self.assertTrue(report["metadataMatchesOriginal23"])
            self.assertFalse(report["codeUpdateAuthorized"])
            self.assertEqual(saved["capture"]["activeVersion"],qa.ACTIVE_VERSION)
            self.assertEqual(len(saved["capture"]["queries"]),10)
            self.assertEqual(len(recorded),14) # 2 identity/version before and after + ten SELECTs
            self.assertFalse(saved["capture"]["providerSourceAttested"])
            self.assertEqual(len(list(Path(folder).iterdir())),1)

    def test_failed_mid_capture_or_worker_change_cannot_leave_partial_file(self):
        original=qa.local_baseline()
        good_inventory=[{"name":qa.NAME,"uuid":qa.UUID},{"name":qa.PROTECTED_NAME,"uuid":qa.PROTECTED_UUID}]
        calls=[]
        def fail(_cli,args,stage):
            calls.append(stage)
            if args[:2]==["d1","list"]:return good_inventory
            if args[:2]==["deployments","status"]:
                return {"versions":[{"version_id":qa.ACTIVE_VERSION if len(calls)<14 else "changed","percentage":100}]}
            i=sum(s.startswith("QA metadata SELECT") for s in calls)
            if i==6:raise RuntimeError("Cloudflare SELECT failed")
            return [{"success":True,"results":original[i-1]}]
        with tempfile.TemporaryDirectory() as folder,patch.object(qa.safe,"checked_cli_stage",side_effect=fail):
            with self.assertRaisesRegex(RuntimeError,"SELECT failed"):
                qa.capture("mock",["SELECT synthetic query"]*10,Path(folder))
            self.assertEqual(list(Path(folder).iterdir()),[])

    def test_modified_local_migration_rejected_before_any_capture(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"drizzle";path.mkdir()
            for filename in qa.HISTORICAL_GIT_BLOBS:
                content=(qa.BASE/filename).read_bytes()
                (path/filename).write_bytes(content+b"\n-- accidental change" if filename.startswith("0022_") else content)
            with patch.object(qa,"BASE",path),self.assertRaisesRegex(ValueError,"pinned history"):
                qa.local_baseline()

    def test_default_cli_dry_run_never_opens_cloudflare_or_creates_output(self):
        with tempfile.TemporaryDirectory() as folder:
            result=subprocess.run([sys.executable,str(ROOT/"capture_existing_qa_schema_read_only.py"),
                   "--folder",folder],capture_output=True,text=True,timeout=20,check=True)
            self.assertIn("DRY RUN",result.stdout)
            self.assertIn("no Cloudflare access",result.stdout)
            self.assertEqual(list(Path(folder).iterdir()),[])
        src=(ROOT/"capture_existing_qa_schema_read_only.py").read_text()
        self.assertNotIn("d1 migrations apply",src)
        self.assertNotIn("wrangler deploy",src)
        self.assertNotIn("secret put",src)
        self.assertNotIn("d1 export",src)
        self.assertNotIn("INSERT INTO payments",src)
        self.assertIn('if approval!="CAPTURE "+UUID',src)

if __name__=="__main__":
    unittest.main(verbosity=2)
