#!/usr/bin/env python3
"""Disposable synthetic three-part FIRE v2 recovery verification regression.

No private records, cloud connection, iPhone, D1/R2 writes or backups shared.
"""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parent

def load(alias, name):
    spec = importlib.util.spec_from_file_location(alias, ROOT / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

legacy = load("fire_three_part_existing_legacy", "test-plan-complete-photo-recovery.py")
numbered = load("fire_three_part_existing_numbered", "test-numbered-v2-photo-pair.py")
triple = load("fire_three_part_new_validator", "plan-three-part-numbered-v2-recovery.py")

DEVICE_ID = "local-device-photo-001"
DEVICE_PAYLOAD = b"Synthetic local iPhone photo bytes; no actual device photo."

def write_device_zip(filename, customer=legacy.CID, **overrides):
    photo = dict(
        id=DEVICE_ID, customerId=customer, category="after",
        caption="Synthetic iPhone-only photo", filename="device.png",
        contentType="image/png", sizeBytes=len(DEVICE_PAYLOAD),
        createdAt="2026-11-04T16:00:00Z",
        sha256=hashlib.sha256(DEVICE_PAYLOAD).hexdigest()
    )
    photo.update(overrides.pop("photo", {}))
    photos = overrides.pop("photos", [photo])
    manifest = dict(
        format="fire-offline-photo-vault", version=1,
        exportedAt="2026-11-04T16:00:00Z",
        requiresMatchingCustomerRecords=True, photos=photos
    )
    manifest.update(overrides)
    with zipfile.ZipFile(filename, "w", compression=zipfile.ZIP_STORED) as z:
        z.writestr("manifest.json", json.dumps(manifest))
        for p in photos:
            z.writestr("photos/" + p["id"], DEVICE_PAYLOAD)
    return manifest

class ThreePartRecovery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.cloud_manifest, self.numbered_records = numbered.numbered_pair()
        self.device = self.folder / "device.zip"

    def files(self):
        cloud, records = legacy.files(
            self.folder, self.cloud_manifest, self.numbered_records
        )
        return cloud, records

    def verify(self):
        cloud, records = self.files()
        return triple.plan_three_part(records, cloud, self.device)

    def reject(self):
        with self.assertRaises(Exception):
            self.verify()

    def test_all_three_complete_files_pair_and_report_unproven_hosted_custody(self):
        write_device_zip(self.device)
        cloud, records = self.files()
        originals = tuple(p.read_bytes() for p in (records, cloud, self.device))
        report = triple.plan_three_part(records, cloud, self.device)
        self.assertEqual(report["result"], "OFFLINE_THREE_PART_RECOVERY_PLAN_ONLY")
        self.assertTrue(report["allThreeInputFilesIndividuallyValidated"])
        self.assertTrue(report["numberedCoreAndCloudPairConsistent"])
        self.assertTrue(report["numberedCustomerIdentitiesMatchDeclaredDevicePhotos"])
        self.assertEqual(report["numberedCustomerCount"], 1)
        self.assertEqual(report["cloudReferencedPhotoCount"], 1)
        self.assertEqual(report["cloudRetainedUnreferencedObjectCount"], 1)
        self.assertEqual(report["declaredDevicePhotos"], 1)
        self.assertEqual(report["devicePhotoBytesValidated"], len(DEVICE_PAYLOAD))
        self.assertFalse(report["onDeviceCurrentInventoryVerified"])
        self.assertFalse(report["ownerHeldOriginalCustodyVerified"])
        self.assertFalse(report["allThreeCapturedAtSameInstantVerified"])
        self.assertFalse(report["completeAppRecoveryProven"])
        self.assertFalse(report["gate7Accepted"])
        self.assertEqual(tuple(p.read_bytes() for p in (records, cloud, self.device)), originals)
        expected = {
            "format": "fire-private-three-part-photo-recovery-fingerprint-v1",
            "recordsSha256": hashlib.sha256(records.read_bytes()).hexdigest(),
            "completeCloudPhotoZipSha256": hashlib.sha256(cloud.read_bytes()).hexdigest(),
            "devicePhotoZipSha256": hashlib.sha256(self.device.read_bytes()).hexdigest(),
        }
        canonical = json.dumps(expected, sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(
            report["threePartFingerprintSha256"], hashlib.sha256(canonical).hexdigest()
        )
        self.assertFalse(report["threePartFingerprintCryptographicallySigned"])

    def test_changed_device_bytes_change_exact_three_part_fingerprint(self):
        write_device_zip(self.device)
        first = self.verify()
        payload = DEVICE_PAYLOAD + b" additional"
        with zipfile.ZipFile(self.device, "w", compression=zipfile.ZIP_STORED) as z:
            p = dict(id=DEVICE_ID, customerId=legacy.CID, category="after",
                     caption="Synthetic", filename="new.png", contentType="image/png",
                     sizeBytes=len(payload), createdAt="2026-11-04T16:00:00Z",
                     sha256=hashlib.sha256(payload).hexdigest())
            z.writestr("manifest.json", json.dumps(dict(
                format="fire-offline-photo-vault", version=1,
                exportedAt="2026-11-04T16:00:00Z",
                requiresMatchingCustomerRecords=True, photos=[p]
            )))
            z.writestr("photos/" + DEVICE_ID, payload)
        second = self.verify()
        self.assertNotEqual(
            first["threePartFingerprintSha256"], second["threePartFingerprintSha256"]
        )
        self.assertEqual(second["devicePhotoBytesValidated"], len(payload))

    def test_unknown_local_customer_must_not_be_silently_mapped(self):
        write_device_zip(self.device, customer="unknown-device-only-customer")
        self.reject()

    def test_bad_checksum_fails_without_evidence_receipt(self):
        write_device_zip(self.device, photo={"sha256": "0" * 64})
        self.reject()

    def test_missing_device_photo_zip_entry_is_rejected(self):
        manifest = write_device_zip(self.device)
        with zipfile.ZipFile(self.device, "w") as z:
            z.writestr("manifest.json", json.dumps(manifest))
        self.reject()

    def test_unlisted_hidden_or_path_traversal_entry_is_rejected(self):
        write_device_zip(self.device)
        with zipfile.ZipFile(self.device, "a") as z:
            z.writestr("../hidden.jpg", b"bad")
        self.reject()

    def test_duplicate_photo_ids_are_rejected(self):
        original = dict(id=DEVICE_ID, customerId=legacy.CID, category="after",
            caption="Synthetic", filename="device.png", contentType="image/png",
            sizeBytes=len(DEVICE_PAYLOAD), createdAt="2026-11-04T16:00:00Z",
            sha256=hashlib.sha256(DEVICE_PAYLOAD).hexdigest())
        write_device_zip(self.device, photos=[original, original])
        self.reject()

    def test_invalid_device_mime_type_cannot_be_archived(self):
        write_device_zip(self.device, photo={"contentType": "image/svg+xml"})
        self.reject()

    def test_declared_photo_size_must_match_actual_zip_bytes(self):
        write_device_zip(self.device, photo={"sizeBytes": len(DEVICE_PAYLOAD) + 1})
        self.reject()

    def test_source_numbered_serial_loss_is_rejected(self):
        write_device_zip(self.device)
        self.numbered_records["highWater"]["job"] = 0
        self.reject()

    def test_missing_refund_financial_record_is_rejected(self):
        write_device_zip(self.device)
        self.numbered_records["tables"]["payment_refunds"].clear()
        self.numbered_records["rowCounts"]["payment_refunds"] = 0
        self.reject()

    def test_missing_cloud_archive_object_blocks_three_part_receipt(self):
        write_device_zip(self.device)
        self.cloud_manifest["objects"].pop()
        self.reject()

    def test_legacy_unnumbered_records_cannot_claim_permanent_identity_custody(self):
        write_device_zip(self.device)
        self.cloud_manifest, self.numbered_records = legacy.fixtures()
        self.reject()

    def test_original_sources_changed_after_private_copy_do_not_change_receipt(self):
        write_device_zip(self.device)
        cloud, records = self.files()
        original = triple.pair.plan
        touched = []
        def changed_original(private_cloud, private_records):
            touched.append(True)
            cloud.write_bytes(b"replaced")
            records.write_bytes(b"replaced")
            self.device.write_bytes(b"replaced")
            return original(private_cloud, private_records)
        with patch.object(triple.pair, "plan", changed_original):
            report = triple.plan_three_part(records, cloud, self.device)
        self.assertTrue(touched)
        self.assertTrue(report["allThreeInputFilesIndividuallyValidated"])
        self.assertFalse(report["allThreeCapturedAtSameInstantVerified"])

    def test_mutated_private_device_snapshot_is_rejected(self):
        write_device_zip(self.device)
        original = triple.validate_device_photo_zip
        def altered(private_device, customers):
            result = original(private_device, customers)
            private_device.write_bytes(b"post-validation mutation")
            return result
        with patch.object(triple, "validate_device_photo_zip", altered):
            self.reject()

    def test_private_temporary_directory_removed_after_validation(self):
        write_device_zip(self.device)
        originals = []
        prior = triple.pair.private_snapshot
        def observe(source, dest, limit):
            originals.append(dest.parent)
            return prior(source, dest, limit)
        with patch.object(triple.pair, "private_snapshot", observe):
            self.verify()
        self.assertGreaterEqual(len(originals), 3)
        self.assertFalse(originals[0].exists(), "Private temporary files must be removed")

    def test_cli_outputs_no_customer_or_photo_identifiers(self):
        import subprocess
        import sys
        write_device_zip(self.device)
        cloud, records = self.files()
        p = subprocess.run([sys.executable, str(ROOT / "plan-three-part-numbered-v2-recovery.py"),
            "--records", str(records), "--cloud-photo-zip", str(cloud),
            "--device-photo-zip", str(self.device)],
            text=True, capture_output=True, timeout=45)
        self.assertEqual(p.returncode, 0, p.stderr)
        output = p.stdout + p.stderr
        for sensitive in (legacy.CID, legacy.PID, legacy.KEY,
                          DEVICE_ID, str(self.device), str(records), str(cloud)):
            self.assertNotIn(sensitive, output)
        self.assertFalse(json.loads(p.stdout)["hostedWritesPerformed"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
