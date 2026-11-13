#!/usr/bin/env python3
"""Actual disposable three-archive Gate7 legacy Sites regression.

Fabricated D1 rows, cloud photo ZIP and iPhone vault only. No external API.
"""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent


def load(alias, file):
    spec = importlib.util.spec_from_file_location(alias, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cloud = load("fire_legacy_three_cloud_fixtures", "test-plan-complete-photo-recovery.py")
device = load("fire_legacy_three_device_fixtures", "test-three-part-numbered-v2-recovery.py")
planner = load("fire_legacy_three_planner", "plan-legacy-sites-three-part-recovery.py")


class LegacySitesThreePartRecovery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest, standard = cloud.fixtures()
        self.source = cloud.legacy_sites_review(standard)
        self.device = self.root / "device.zip"

    def inputs(self):
        archive, records = cloud.files(self.root, self.manifest, self.source)
        return records, archive, self.device

    def planned(self):
        return planner.plan_legacy_sites_three_part(*self.inputs())

    def denied(self):
        with self.assertRaises(Exception):
            self.planned()

    def test_all_three_original_archives_pair_without_claiming_live_recovery(self):
        device.write_device_zip(self.device)
        originals = tuple(p.read_bytes() for p in self.inputs())
        receipt = self.planned()
        self.assertEqual(receipt["result"], "OFFLINE_LEGACY_SITES_THREE_PART_PLAN_ONLY")
        self.assertEqual(receipt["legacyCustomerCount"], 1)
        self.assertEqual(receipt["cloudReferencedPhotoCount"], 1)
        self.assertEqual(receipt["cloudUnreferencedBytesRetained"], 1)
        self.assertEqual(receipt["deviceOnlyPhotoCount"], 1)
        self.assertTrue(receipt["allThreePrivateFilesValidated"])
        self.assertTrue(receipt["noCloudDevicePhotoIdentityCollision"])
        self.assertFalse(receipt["capturedAtSameInstantVerified"])
        self.assertFalse(receipt["sourceDatabaseUuidVerified"])
        self.assertFalse(receipt["sourceDeviceInventoryCompleteVerified"])
        self.assertFalse(receipt["ownerHeldOriginalCustodyProven"])
        self.assertFalse(receipt["permanentCustomerJobNumberHistoryVerified"])
        self.assertFalse(receipt["liveHostDataRestored"])
        self.assertFalse(receipt["gate7Accepted"])
        self.assertFalse(receipt["productionReleaseAuthorized"])
        self.assertEqual(tuple(p.read_bytes() for p in self.inputs()), originals)

    def test_real_local_device_byte_integrity_is_required(self):
        device.write_device_zip(self.device, photo={"sha256": "0" * 64})
        self.denied()

    def test_unknown_device_customer_is_never_silently_invented(self):
        device.write_device_zip(self.device, customer="missing-customer")
        self.denied()

    def test_cloud_device_photo_id_collisions_are_refused(self):
        device.write_device_zip(self.device, photo={"id": cloud.PID})
        self.denied()

    def test_altered_legacy_records_are_refused_despite_valid_zip(self):
        device.write_device_zip(self.device)
        self.source["tables"]["customer_photos"][0]["caption"] = "Altered by attacker"
        self.denied()

    def test_cloud_manifest_missing_object_prevents_three_part_success(self):
        device.write_device_zip(self.device)
        self.manifest["objects"].pop()
        self.denied()

    def test_unnumbered_app_export_cannot_pretend_to_be_original_sites_review(self):
        device.write_device_zip(self.device)
        self.manifest, self.source = cloud.fixtures()
        self.denied()

    def test_cli_redacts_identifiers_and_source_paths(self):
        device.write_device_zip(self.device)
        records, archive, local = self.inputs()
        process = subprocess.run([
            sys.executable, str(ROOT / "plan-legacy-sites-three-part-recovery.py"),
            "--records", str(records), "--cloud-photo-zip", str(archive),
            "--device-photo-zip", str(local),
        ], text=True, capture_output=True, timeout=45)
        self.assertEqual(process.returncode, 0, process.stderr)
        shown = process.stdout + process.stderr
        for private in (
            cloud.CID, cloud.PID, cloud.KEY, device.DEVICE_ID,
            str(records), str(archive), str(local),
        ):
            self.assertNotIn(private, shown)
        self.assertFalse(json.loads(process.stdout)["anyRemoteWrites"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
