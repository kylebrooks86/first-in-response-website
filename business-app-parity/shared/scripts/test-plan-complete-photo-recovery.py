#!/usr/bin/env python3
"""Synthetic end-to-end tests: complete photo ZIP + matching legacy records JSON.

All files are disposable, local and fabricated. No remote provider access.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import os
import zipfile

SCRIPTS = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("fire_offline_recovery_plan",
                                               SCRIPTS / "plan-complete-photo-recovery.py")
planner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(planner)

CID = "customer-0001"
PID = "photo-0001"
KEY = f"customers/{CID}/{PID}.jpg"
ORPHAN = f"customers/{CID}/orphan-0001.bin"
PHOTO = dict(id=PID, customerId=CID, category="before", caption=None,
             filename="image.jpg", contentType="image/jpeg", sizeBytes=3,
             objectKey=KEY, createdAt="2026-10-15T00:00:00Z")
REQUIRED = ("customers", "estimates", "customer_notes", "invoices", "estimate_items",
            "payments", "customer_messages", "notifications", "message_templates",
            "estimate_change_requests", "tasks", "expenses", "job_reports",
            "invoice_items", "invoice_revisions", "payment_checkout_sessions",
            "payment_refunds", "customer_photos")


def fixtures():
    photos = [PHOTO.copy()]
    records = {"format": "fire-app-records-backup", "version": 1,
               "tables": {table: [] for table in REQUIRED}}
    records["tables"]["customers"] = [{"id": CID}]
    records["tables"]["customer_photos"] = [{
        "id": PID, "customer_id": CID, "category": "before", "caption": None,
        "filename": "image.jpg", "content_type": "image/jpeg", "size_bytes": 3,
        "object_key": KEY, "created_at": "2026-10-15T00:00:00Z",
    }]
    objects = []
    for idx, (key, body, relation, photo_id) in enumerate((
            (KEY, b"abc", "referenced", PID),
            (ORPHAN, b"xyz", "unreferenced", None)), start=1):
        objects.append({
            "objectKey": key, "archivePath": f"objects/{idx:06}.bin",
            "sizeBytes": len(body), "contentType": "image/jpeg",
            "version": "fixture-version", "etag": "fixture-etag",
            "sha256": hashlib.sha256(body).hexdigest(), "association": relation,
            "photoId": photo_id,
        })
    manifest = {
        "format": "fire-app-photo-storage-archive", "version": 2,
        "scope": "customer-photo-namespace", "coverageVerified": True,
        "checksumAlgorithm": "SHA-256", "atomicSnapshot": False,
        "requiresSeparateRecordsBackup": True, "restoreExecutionAuthorized": False,
        "customerIds": [CID], "photos": photos, "objects": objects,
        "objectCount": 2, "photoCount": 1, "unreferencedObjectCount": 1,
    }
    return manifest, records


def files(folder, manifest, records, tamper=False):
    archive = Path(folder) / "photo.zip"
    record_path = Path(folder) / "records.json"
    record_path.write_text(json.dumps(records), encoding="utf-8")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as z:
        z.writestr("manifest.json", json.dumps(manifest))
        z.writestr("objects/000001.bin", b"BAD" if tamper else b"abc")
        z.writestr("objects/000002.bin", b"xyz")
    return archive, record_path


class OfflineRecoveryPlan(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manifest, self.records = fixtures()

    def validate(self, expected=True, tamper=False):
        archive, records = files(self.temp.name, self.manifest, self.records,
                                 tamper=tamper)
        before = archive.read_bytes(), records.read_bytes()
        cmd = subprocess.run([sys.executable,
                              str(SCRIPTS / "plan-complete-photo-recovery.py"),
                              "--archive", str(archive), "--records", str(records)],
                             capture_output=True, text=True, timeout=30)
        self.assertEqual(cmd.returncode, 0 if expected else 1, cmd.stdout + cmd.stderr)
        result = json.loads(cmd.stdout)
        self.assertEqual(result["restoreExecutionAuthorized"], False)
        self.assertEqual(result["officialReleaseReadinessPercent"], 30)
        self.assertEqual((archive.read_bytes(), records.read_bytes()), before)
        self.assertNotIn(CID, cmd.stdout + cmd.stderr)
        self.assertNotIn(PID, cmd.stdout + cmd.stderr)
        self.assertNotIn(KEY, cmd.stdout + cmd.stderr)
        return result

    def test_verified_full_pair_is_plan_only(self):
        result = self.validate()
        self.assertEqual(result["referencedPhotoCount"], 1)
        self.assertEqual(result["unreferencedObjectCount"], 1)
        self.assertEqual(result["objectsWhoseArchiveChecksumsPassed"], 2)
        self.assertFalse(result["destinationUnoccupiedVerified"])
        self.assertFalse(result["nativeAtomicRestoreTested"])
        self.assertFalse(result["pairedBackupSameInstantVerified"])
        self.assertFalse(result["releaseGate7Accepted"])

    def test_pair_receipt_binds_exact_validated_bytes(self):
        archive, records = files(self.temp.name, self.manifest, self.records)
        result = planner.plan(archive, records)
        for key, path in (("photoArchive", archive), ("recordsBackup", records)):
            self.assertEqual(result["validatedInputBytes"][key], {
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "sizeBytes": path.stat().st_size,
            })
        self.assertTrue(result["privateSnapshotsRemovedOnReturn"])

    def test_source_replacement_cannot_change_validated_pair(self):
        archive, records = files(self.temp.name, self.manifest, self.records)
        expected = hashlib.sha256(records.read_bytes()).hexdigest()
        original = planner.validated_complete_archive
        captured = []
        def replace_sources(private_path):
            captured.append(private_path.parent)
            self.assertNotEqual(private_path, archive)
            self.assertEqual(private_path.stat().st_mode & 0o777, 0o600)
            archive.write_bytes(b"replaced during validation")
            records.write_text('{"corrupt":true}')
            return original(private_path)
        with patch.object(planner, "validated_complete_archive", replace_sources):
            result = planner.plan(archive, records)
        self.assertEqual(result["referencedPhotoCount"], 1)
        self.assertEqual(result["validatedInputBytes"]["recordsBackup"]["sha256"], expected)
        self.assertFalse(captured[0].exists(), "Private backup snapshots must be removed")

    def test_snapshot_failure_removes_private_files(self):
        archive, records = files(self.temp.name, self.manifest, self.records)
        captured = []
        def reject(path):
            captured.append(path.parent)
            raise planner.UnsafePair("Synthetic validation failure")
        with patch.object(planner, "validated_complete_archive", reject):
            with self.assertRaises(planner.UnsafePair):
                planner.plan(archive, records)
        self.assertFalse(captured[0].exists())

    def test_snapshot_refuses_symlink_pipe_and_oversize(self):
        source = Path(self.temp.name) / "source"
        destination = Path(self.temp.name) / "snapshot"
        source.write_bytes(b"12345")
        with self.assertRaises(planner.UnsafePair):
            planner.private_snapshot(source, destination, 4)
        destination.unlink()
        symlink = Path(self.temp.name) / "link"
        symlink.symlink_to(source)
        with self.assertRaises(OSError):
            planner.private_snapshot(symlink, destination, 5)
        self.assertFalse(destination.exists())
        if hasattr(os, "mkfifo"):
            fifo = Path(self.temp.name) / "pipe"
            os.mkfifo(fifo)
            with self.assertRaises(planner.UnsafePair):
                planner.private_snapshot(fifo, destination, 5)
            self.assertFalse(destination.exists())

    def test_mismatched_photo_record_fields_block(self):
        for key, value in (
                ("customer_id", "someone-else"),
                ("category", "after"),
                ("caption", "unsynced edit"),
                ("filename", "different.jpg"),
                ("content_type", "image/png"),
                ("size_bytes", 4),
                ("object_key", "customers/customer-0001/other.jpg"),
                ("created_at", "2026-10-15T01:00:00Z")):
            with self.subTest(key=key):
                self.manifest, self.records = fixtures()
                self.records["tables"]["customer_photos"][0][key] = value
                self.validate(expected=False)

    def test_duplicate_and_missing_photo_identity_block(self):
        for changed in ("missing", "duplicate", "extra"):
            with self.subTest(changed=changed):
                self.manifest, self.records = fixtures()
                rows = self.records["tables"]["customer_photos"]
                if changed == "missing":
                    rows.clear()
                elif changed == "duplicate":
                    rows.append(rows[0].copy())
                else:
                    rows.append({**rows[0], "id": "photo-0002",
                                 "object_key": "customers/customer-0001/photo-0002.jpg"})
                self.validate(expected=False)

    def test_different_customer_inventory_blocks(self):
        self.records["tables"]["customers"].append({"id": "customer-0002"})
        self.validate(expected=False)

    def test_records_validation_rejects_missing_critical_tables(self):
        del self.records["tables"]["payments"]
        self.validate(expected=False)

    def test_records_validation_rejects_bad_refund_ledger(self):
        self.records["tables"]["payment_refunds"].append({
            "id": "refund-001", "payment_id": "missing",
            "estimate_id": "missing", "amount_cents": 100,
            "mode": "manual", "status": "succeeded",
        })
        self.validate(expected=False)

    def test_checksum_tampering_blocks(self):
        self.validate(expected=False, tamper=True)

    def test_archive_cannot_erase_orphan_declaration(self):
        self.manifest["objects"].pop()
        self.validate(expected=False)

    def test_old_archive_format_blocks(self):
        self.manifest["version"] = 1
        self.validate(expected=False)

    def test_missing_photos_table_blocks(self):
        del self.records["tables"]["customer_photos"]
        self.validate(expected=False)

    def test_manifest_photo_reassigned_to_orphan_blocks(self):
        self.manifest["objects"][1]["photoId"] = PID
        self.validate(expected=False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
