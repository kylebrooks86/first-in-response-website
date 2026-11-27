#!/usr/bin/env python3
"""FIRE proposed numbered v2 records + checksum-verified complete photo ZIP.

Only disposable synthetic local artifacts. Never Cloudflare, owner records,
remote images, customer messages or a real backup/restore destination.
"""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
def load(name, filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
legacy=load("fire_legacy_synthetic_pair","test-plan-complete-photo-recovery.py")
planner=load("fire_numbered_v2_photo_pair","plan-complete-photo-recovery.py")

CORE=(
    "customers","estimates","customer_notes","invoices","invoice_items",
    "invoice_revisions","payment_checkout_sessions","payment_refunds",
    "deposit_policy_events","deposit_agreement_snapshots","estimate_items",
    "payments","customer_photos","customer_messages","notifications",
    "message_templates","estimate_change_requests","tasks","expenses","job_reports"
)
IDENTITY=("fire_customer_numbers","fire_job_numbers","fire_job_estimate_links")
CREATED="2026-10-15T00:00:00Z"
ROOT_EST="root-estimate-0001"
REVISED="revised-estimate-0001"

def numbered_pair():
    manifest, old=legacy.fixtures()
    t={name: [] for name in CORE+IDENTITY}
    t["customers"]=[{"id":legacy.CID,"created_at":CREATED,
                      "name":"Synthetic Owner Photo Customer"}]
    t["estimates"]=[
        {"id":ROOT_EST,"customer_id":legacy.CID,"created_at":CREATED,
         "status":"superseded"},
        {"id":REVISED,"customer_id":legacy.CID,
         "created_at":"2026-10-16T00:00:00Z","status":"completed"}
    ]
    t["fire_customer_numbers"]=[{"customer_id":legacy.CID,
        "customer_number":7,"created_at":CREATED}]
    t["fire_job_numbers"]=[{"root_estimate_id":ROOT_EST,
        "job_number":11,"created_at":CREATED}]
    t["fire_job_estimate_links"]=[{"estimate_id":ROOT_EST,"job_number":11},
                                  {"estimate_id":REVISED,"job_number":11}]
    t["customer_photos"]=old["tables"]["customer_photos"]
    t["payments"]=[
        {"id":"synthetic-payment","estimate_id":REVISED,
         "amount_cents":3000,"status":"paid","type":"Balance",
         "provider_id":"manual:synthetic"},
        {"id":"synthetic-refund-entry","estimate_id":REVISED,
         "amount_cents":-500,"status":"paid","type":"Refund",
         "provider_id":"refund:synthetic-payment:synthetic-refund"}
    ]
    t["payment_refunds"]=[{"id":"synthetic-refund","payment_id":"synthetic-payment",
                          "estimate_id":REVISED,"amount_cents":500,
                          "mode":"manual","status":"succeeded",
                          "provider_refund_id":None}]
    records={
        "format":"fire-numbered-core-records-snapshot",
        "version":2,"allTablesComplete":True,"truncated":False,
        "tables":t,
        "rowCounts":{name:len(rows) for name,rows in t.items()},
        "highWater":{"customer":13,"job":17}
    }
    return manifest,records

class NumberedV2PhotoPair(unittest.TestCase):
    def setUp(self):
        self.dir=tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.manifest,self.records=numbered_pair()

    def validate(self,successful=True,tamper_zip=False):
        folder=Path(self.dir.name)
        archive,records=legacy.files(folder,self.manifest,self.records,tamper=tamper_zip)
        before=archive.read_bytes(),records.read_bytes()
        cmd=subprocess.run([sys.executable,str(ROOT/"plan-complete-photo-recovery.py"),
                            "--archive",str(archive),"--records",str(records)],
                           capture_output=True,text=True,timeout=40)
        self.assertEqual(cmd.returncode,0 if successful else 1,cmd.stdout+cmd.stderr)
        result=json.loads(cmd.stdout)
        self.assertEqual(result["restoreExecutionAuthorized"],False)
        self.assertEqual(result["officialReleaseReadinessPercent"],30)
        self.assertFalse(result.get("onDeviceIndexedDbPhotoZipVerified",False))
        self.assertFalse(result.get("combinedRecordsAndPhotoBytesRestored",False))
        self.assertEqual((archive.read_bytes(),records.read_bytes()),before)
        for secret in (legacy.CID,legacy.PID,legacy.KEY,ROOT_EST,REVISED,
                       "synthetic-payment",str(records),str(archive)):
            self.assertNotIn(secret,cmd.stdout+cmd.stderr)
        return result

    def test_verified_versioned_pair_preserves_real_numbers_and_photo_checksum(self):
        result=self.validate()
        self.assertEqual(result["recordsBackupKind"],"numbered-v2-core")
        self.assertTrue(result["permanentNumberMappingsVerified"])
        self.assertTrue(result["numberedCoreArchiveSourceOnly"])
        self.assertEqual(result["referencedPhotoCount"],1)
        self.assertEqual(result["unreferencedObjectCount"],1)
        self.assertEqual(result["objectsWhoseArchiveChecksumsPassed"],2)
        self.assertFalse(result["pairedBackupSameInstantVerified"])
        self.assertFalse(result["destinationUnoccupiedVerified"])
        self.assertFalse(result["nativeAtomicRestoreTested"])
        self.assertFalse(result["allOptionalFeatureTablesVerified"])

    def test_pair_receipt_binds_both_files_to_exact_private_snapshots(self):
        archive,records=legacy.files(Path(self.dir.name),self.manifest,self.records)
        result=planner.plan(archive,records)
        self.assertEqual(result["validatedInputBytes"]["recordsBackup"]["sha256"],
                         hashlib.sha256(records.read_bytes()).hexdigest())
        self.assertEqual(result["validatedInputBytes"]["photoArchive"]["sha256"],
                         hashlib.sha256(archive.read_bytes()).hexdigest())
        fingerprint_payload={
            "format":"fire-private-records-photo-pair-fingerprint-v1",
            "recordsSha256":hashlib.sha256(records.read_bytes()).hexdigest(),
            "photoZipSha256":hashlib.sha256(archive.read_bytes()).hexdigest(),
        }
        expected=hashlib.sha256(json.dumps(
            fingerprint_payload,sort_keys=True,separators=(",", ":")
        ).encode("utf-8")).hexdigest()
        self.assertEqual(result["pairedFileFingerprintSha256"],expected)
        self.assertFalse(result["pairFingerprintCryptographicallySigned"])
        self.assertTrue(result["privateSnapshotsRemovedOnReturn"])

    def test_new_valid_record_bytes_cause_a_new_pair_fingerprint(self):
        archive,records=legacy.files(Path(self.dir.name),self.manifest,self.records)
        before=planner.plan(archive,records)
        self.records["tables"]["customer_notes"].append({
            "id":"synthetic-note-002","customer_id":legacy.CID,
            "body":"Independent note for same record owner"
        })
        self.records["rowCounts"]["customer_notes"]=1
        archive,records=legacy.files(Path(self.dir.name),self.manifest,self.records)
        after=planner.plan(archive,records)
        self.assertNotEqual(before["pairedFileFingerprintSha256"],
                            after["pairedFileFingerprintSha256"])
        self.assertEqual(before["validatedInputBytes"]["photoArchive"],
                         after["validatedInputBytes"]["photoArchive"])
        self.assertFalse(after["pairedBackupSameInstantVerified"])
        self.assertFalse(after["pairFingerprintCryptographicallySigned"])

    def test_permanent_customer_number_missing_or_reassigned_blocks(self):
        for label in ("missing","duplicate","wrong-customer","serial-reuse","changed-created-at"):
            with self.subTest(label=label):
                self.manifest,self.records=numbered_pair()
                row=self.records["tables"]["fire_customer_numbers"][0]
                if label=="missing":
                    self.records["tables"]["fire_customer_numbers"]=[]
                elif label=="duplicate":
                    self.records["tables"]["fire_customer_numbers"].append(row.copy())
                elif label=="wrong-customer":
                    row["customer_id"]="someone-else"
                elif label=="serial-reuse":
                    self.records["highWater"]["customer"]=6
                else:
                    row["created_at"]="2025-01-01T00:00:00Z"
                self.records["rowCounts"]={k:len(v) for k,v in self.records["tables"].items()}
                self.validate(successful=False)

    def test_job_roots_revisions_and_high_water_fail_closed(self):
        for label in ("missing-link","revision-crosses-job","unknown-root","job-sequence","duplicate-link"):
            with self.subTest(label=label):
                self.manifest,self.records=numbered_pair()
                t=self.records["tables"]
                if label=="missing-link":
                    t["fire_job_estimate_links"].pop()
                elif label=="revision-crosses-job":
                    t["fire_job_estimate_links"][1]["job_number"]=12
                elif label=="unknown-root":
                    t["fire_job_numbers"][0]["root_estimate_id"]="missing-estimate"
                elif label=="job-sequence":
                    self.records["highWater"]["job"]=9
                else:
                    t["fire_job_estimate_links"].append(t["fire_job_estimate_links"][0].copy())
                self.records["rowCounts"]={k:len(v) for k,v in t.items()}
                self.validate(successful=False)

    def test_financial_integrity_rejects_wrong_refund_or_missing_payment(self):
        for label in ("over-refund","missing-payment","orphan-negative-ledger"):
            with self.subTest(label=label):
                self.manifest,self.records=numbered_pair()
                t=self.records["tables"]
                if label=="over-refund":
                    t["payment_refunds"][0]["amount_cents"]=3500
                elif label=="missing-payment":
                    t["payments"].pop(0)
                else:
                    t["payment_refunds"].clear()
                self.records["rowCounts"]={k:len(v) for k,v in t.items()}
                self.validate(successful=False)

    def test_corrupt_photo_checksum_or_missing_object_blocks(self):
        self.validate(successful=False,tamper_zip=True)
        self.manifest,self.records=numbered_pair()
        self.manifest["objects"].pop()
        self.validate(successful=False)

    def test_mismatched_customer_or_photo_metadata_blocks(self):
        self.records["tables"]["customer_photos"][0]["caption"]="Tampered caption"
        self.validate(successful=False)
        self.manifest,self.records=numbered_pair()
        self.manifest["customerIds"]=["unrelated-customer"]
        self.validate(successful=False)

    def test_missing_required_schema_or_independent_counts_blocks(self):
        for label in ("payments","fire_job_numbers","rowCounts","deposit_agreement_snapshots"):
            with self.subTest(label=label):
                self.manifest,self.records=numbered_pair()
                if label=="rowCounts":
                    self.records["rowCounts"]["customer_photos"]=0
                else:
                    del self.records["tables"][label]
                    del self.records["rowCounts"][label]
                self.validate(successful=False)

    def test_unknown_feature_data_blocks_instead_of_fake_full_coverage(self):
        self.records["tables"]["unknown_customer_property_table"]=[]
        self.records["rowCounts"]["unknown_customer_property_table"]=0
        self.validate(successful=False)

    def test_legacy_v1_still_supported_without_fabricating_numbered_coverage(self):
        self.manifest,self.records=legacy.fixtures()
        result=self.validate()
        self.assertEqual(result["recordsBackupKind"],"legacy-app-v1")
        self.assertFalse(result["permanentNumberMappingsVerified"])

if __name__=="__main__":
    unittest.main(verbosity=2)
