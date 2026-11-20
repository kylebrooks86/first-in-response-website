"""No QA release may be inferred from a local schema or untrusted capture."""
from __future__ import annotations
import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timedelta, timezone
from pathlib import Path

import capture_existing_qa_schema_read_only as qa
import qa_iphone_release_readiness as gate

class TestQaIphoneReadiness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="fire-qa-gate-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.clock = datetime(2026, 10, 19, 19, tzinfo=timezone.utc)

    def fixture(self, hours_old=1):
        captured = {
            "format": qa.FORMAT, "qaWorker": qa.WORKER,
            "qaDatabase": qa.NAME, "qaUuid": qa.UUID,
            "activeVersion": qa.ACTIVE_VERSION,
            "capturedAt": (self.clock - timedelta(hours=hours_old)).isoformat(),
            "providerSourceAttested": False, "truncated": False,
            "queries": [{"rows": r} for r in qa.local_baseline()],
        }
        return {"capture": captured, "review": qa.compare_capture(captured)}

    def save(self, packet):
        dest = self.root / "private.json"
        dest.write_text(json.dumps(packet), encoding="utf-8")
        return dest

    def blocked(self, report):
        self.assertEqual(report["result"], "STOP_HOSTED_QA_UPDATE_PENDING_OWNER_EVIDENCE_AND_APPROVAL")
        self.assertEqual((report["originalMigrationCount"],report["candidateMigrationCount"]), (23,25))
        self.assertEqual(len(report["additionalMigrations"]), 2)
        self.assertEqual((report["productionReleaseGatesPassed"],report["productionReleaseGatesTotal"]), (3,10))
        self.assertEqual(len(report["iphoneReviewScreens"]), 4)
        for flag in ("productionReady", "codeOnlyQaUpdateEligible", "hostedMigrationApproved",
                     "workerUpdateApproved", "physicalIphoneAccepted", "sourceChangesDeployedForIphone",
                     "captureOriginIndependentlyAttested"):
            self.assertIs(report[flag],False,flag)

    def test_without_hosted_evidence_no_publication(self):
        result = gate.decision(at=self.clock)
        self.blocked(result)
        self.assertFalse(result["ownerQaMetadataCaptureProvided"])
        self.assertIsNone(result["captureMatchesOriginal23Schema"])
        self.assertIn("CURRENT_QA_SCHEMA_AND_WORKER_D1_BINDING_NOT_INDEPENDENTLY_VERIFIED", result["blockers"])
        self.assertEqual(result["ownerProvidedQaDatabaseUuid"], "8ccfb1f8-1657-4074-b1b2-47de78f95003")
        self.assertIs(result["ownerProvidedUuidMatchesConfig"], True)
        self.assertIs(result["qaWorkerRuntimeBindingIndependentlyAttested"], False)
        self.assertIn("do not ask for it again", result["nextSafeAction"])
        self.assertEqual(result["ownerObservedServingVersion"], "ab408776-bf5d-4fab-825e-73082eabbce6")
        self.assertEqual(result["ownerObservedMigrationCount"], 25)
        self.assertEqual(result["ownerObservedLastMigrations"], [
            "0023_deposit_policy_events.sql","0024_deposit_agreement_snapshots.sql"])
        self.assertIs(result["ownerObservedEvidenceIndependentlyAttested"], False)
        self.assertIs(result["repeatOwnerObservedMigrationsRequired"], False)
        self.assertIs(result["pinnedServingVersionIsHistorical"], True)
        self.assertNotIn("HOSTED_23_TO_25_QA_MIGRATION_NOT_APPROVED", result["blockers"])
        self.assertIn("never reapply them", result["nextSafeAction"])

    def test_mismatched_owner_uuid_stops_before_qa_publication(self):
        old = gate.OWNER_PROVIDED_QA_D1_UUID
        try:
            gate.OWNER_PROVIDED_QA_D1_UUID = "00000000-0000-0000-0000-000000000000"
            with self.assertRaisesRegex(gate.QAReadinessStop,"differs"):
                gate.decision(at=self.clock)
        finally:
            gate.OWNER_PROVIDED_QA_D1_UUID = old

    def test_matching_metadata_remains_blocked_and_unattested(self):
        result = gate.decision(self.save(self.fixture()),at=self.clock)
        self.blocked(result)
        self.assertTrue(result["captureMatchesOriginal23Schema"])
        self.assertTrue(result["ownerQaMetadataCaptureProvided"])
        self.assertEqual(len(result["captureSha256"]),64)
        self.assertIn("CLOUDFLARE_CAPTURE_PROVENANCE_NOT_INDEPENDENTLY_ATTESTED",result["blockers"])
        self.assertIn("HISTORICAL_23_MIGRATION_CAPTURE_NOT_CURRENT_25_SCHEMA",result["blockers"])
        self.assertIn("CURRENT_QA_SERVED_VERSION_NOT_LINKED_TO_CANDIDATE_SOURCE",result["blockers"])
        self.assertNotIn("QA_METADATA_CAPTURE_EXPIRED_OR_FUTURE",result["blockers"])

    def test_remote_schema_drift_explicit(self):
        packet=self.fixture()
        packet["capture"]["queries"][4]["rows"][-1]["name"]="0022_unreviewed.sql"
        packet["review"]=qa.compare_capture(packet["capture"])
        result=gate.decision(self.save(packet),at=self.clock)
        self.blocked(result)
        self.assertFalse(result["captureMatchesOriginal23Schema"])
        self.assertIn("HISTORICAL_23_MIGRATION_CAPTURE_DRIFT_REQUIRES_INVESTIGATION",result["blockers"])

    def test_stale_or_future_capture_denied(self):
        result=gate.decision(self.save(self.fixture(25)),at=self.clock)
        self.blocked(result)
        self.assertIn("QA_METADATA_CAPTURE_EXPIRED_OR_FUTURE",result["blockers"])
        # The independent input validator rejects future timestamps before
        # classification. Treat its hard stop as correct, not a test failure.
        packet=self.fixture()
        packet["capture"]["capturedAt"]=(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()
        packet["review"]=qa.compare_capture(packet["capture"])
        with self.assertRaises(gate.QAReadinessStop):
            gate.decision(self.save(packet),at=self.clock)

    def test_capture_with_private_email_or_forged_review_fails_closed(self):
        packet=self.fixture()
        packet["capture"]["queries"][0]["rows"][0]["email"]="private@example.invalid"
        with self.assertRaises(gate.QAReadinessStop):
            gate.decision(self.save(packet),at=self.clock)
        packet=self.fixture()
        packet["review"]["metadataMatchesOriginal23"]=False
        with self.assertRaises(gate.QAReadinessStop):
            gate.decision(self.save(packet),at=self.clock)

    def test_exact_migration_pin_required(self):
        local=self.root/"candidate"
        local.mkdir()
        for file in qa.BASE.glob("*.sql"):
            shutil.copyfile(file,local/file.name)
        self.blocked(gate.decision(schema_root=local,at=self.clock))
        with (local/"0024_deposit_agreement_snapshots.sql").open("a") as out:
            out.write("\nDROP TABLE estimates;")
        with self.assertRaisesRegex(gate.QAReadinessStop,"Pinned"):
            gate.decision(schema_root=local,at=self.clock)
        (local/"0024_deposit_agreement_snapshots.sql").unlink()
        with self.assertRaises(gate.QAReadinessStop):
            gate.decision(schema_root=local,at=self.clock)

    def test_cli_prints_stop_and_refuses_missing_capture(self):
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(gate.main([]),0)
        self.blocked(json.loads(out.getvalue()))
        with redirect_stderr(io.StringIO()) as err:
            self.assertEqual(gate.main(["--capture-file",str(self.root/"absent.json")]),2)
        self.assertIn("STOP",err.getvalue())

    def test_program_never_reads_remote_or_writes_hosted_data(self):
        source=(Path(__file__).parent/"qa_iphone_release_readiness.py").read_text()
        for forbidden in ("subprocess", "requests.", "urllib.", "os.system(", "Import-Clixml",
                          "wrangler deploy", "secret put", "Apply-Migration"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden,source)

if __name__=="__main__":
    unittest.main(verbosity=2)
