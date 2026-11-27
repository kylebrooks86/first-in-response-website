#!/usr/bin/env python3
"""Exact existing v2 photo fixtures -> disposable in-memory byte restoration.
No R2, D1, network, real user records, hosted restore or source file edits.
"""
import copy
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parent

def load(alias, name):
    spec = importlib.util.spec_from_file_location(alias, SCRIPTS / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

legacy = load("fire_existing_synthetic_photo_fixture", "test-plan-complete-photo-recovery.py")
numbered = load("fire_existing_numbered_photo_fixture", "test-numbered-v2-photo-pair.py")
recovery = load("fire_disposable_photo_v2_recovery", "disposable-numbered-v2-photo-restore.py")


class DisposableVersionTwoPhotos(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manifest, self.records = numbered.numbered_pair()

    def files(self, corrupt=False):
        return legacy.files(Path(self.temp.name), self.manifest, self.records, tamper=corrupt)

    def call(self, destination, corrupt=False):
        photo_zip, records = self.files(corrupt=corrupt)
        before = (photo_zip.read_bytes(), records.read_bytes())
        answer = recovery.restore_complete_v2_photos_to_disposable_memory(
            photo_zip, records, destination
        )
        self.assertEqual((photo_zip.read_bytes(), records.read_bytes()), before)
        return answer

    def test_complete_referenced_and_unreferenced_bytes_restored_without_invented_rows(self):
        target = {}
        answer = self.call(target)
        self.assertEqual(answer["result"], "DISPOSABLE_IN_MEMORY_PHOTO_BYTES_ROUNDTRIP")
        self.assertEqual(answer["restoredPhotoObjectCount"], 2)
        self.assertEqual(answer["restoredReferencedPhotoCount"], 1)
        self.assertEqual(answer["restoredUnreferencedObjectCount"], 1)
        self.assertEqual(answer["restoredTotalBytes"], 6)
        self.assertEqual(target[legacy.KEY]["body"], b"abc")
        self.assertEqual(target[legacy.ORPHAN]["body"], b"xyz")
        self.assertEqual(target[legacy.KEY]["photoId"], legacy.PID)
        self.assertIsNone(target[legacy.ORPHAN]["photoId"])
        self.assertFalse(answer["realD1R2AtomicRestoreProven"])
        self.assertFalse(answer["devicePhotoVaultRestored"])
        self.assertFalse(answer["gate7Accepted"])
        self.assertFalse(answer["productionRecoveryAuthorized"])
        self.assertFalse(answer["persistentStorageTouched"])
        self.assertFalse(answer["cloudflareD1OrR2Touched"])

    def test_occupied_destination_fails_before_any_source_read_or_overwrite(self):
        existing = {"existing-object": {"body": b"untouched"}}
        original = copy.deepcopy(existing)
        with self.assertRaises(recovery.DisposablePhotoRestoreBlocked):
            self.call(existing)
        self.assertEqual(existing, original)

    def test_rejects_custom_mapping_that_could_write_to_external_storage(self):
        class PretendRemote(dict):
            def update(self, data):
                raise AssertionError("remote mutation must not be attempted")
        with self.assertRaises(recovery.DisposablePhotoRestoreBlocked):
            self.call(PretendRemote())

    def test_corrupted_object_sha_does_not_change_destination(self):
        destination = {}
        with self.assertRaises(Exception):
            self.call(destination, corrupt=True)
        self.assertEqual(destination, {})

    def test_changed_customer_photo_metadata_blocks_before_staging(self):
        self.records["tables"]["customer_photos"][0]["caption"] = "Tampered metadata"
        destination = {}
        with self.assertRaises(Exception):
            self.call(destination)
        self.assertEqual(destination, {})

    def test_numbering_revisions_and_refund_ledger_are_required(self):
        for bad_table in ("payment_refunds", "fire_job_numbers", "fire_job_estimate_links"):
            self.manifest, self.records = numbered.numbered_pair()
            self.records["tables"].pop(bad_table)
            self.records["rowCounts"].pop(bad_table)
            destination = {}
            with self.subTest(bad_table=bad_table):
                with self.assertRaises(Exception):
                    self.call(destination)
                self.assertEqual(destination, {})

    def test_missing_referenced_photo_object_blocks(self):
        self.manifest["objects"] = self.manifest["objects"][1:]
        self.manifest["objectCount"] = 1
        destination = {}
        with self.assertRaises(Exception):
            self.call(destination)
        self.assertEqual(destination, {})

    def test_consumed_serial_high_water_cannot_be_recomputed(self):
        self.records["highWater"]["customer"] = 0
        destination = {}
        with self.assertRaises(Exception):
            self.call(destination)
        self.assertEqual(destination, {})

    def test_legacy_backup_not_accepted_as_numbered_full_recovery(self):
        self.manifest, self.records = legacy.fixtures()
        destination = {}
        with self.assertRaises(recovery.DisposablePhotoRestoreBlocked):
            self.call(destination)
        self.assertEqual(destination, {})

    def test_private_captured_inputs_detect_modification_after_first_validation(self):
        photo_zip, records = self.files()
        destination = {}
        original = recovery.planner.validated_complete_archive

        def tamper_private_file(private_zip):
            result = original(private_zip)
            private_zip.write_bytes(b"invalidated private snapshot")
            return result

        with patch.object(recovery.planner, "validated_complete_archive", tamper_private_file):
            with self.assertRaises(Exception):
                recovery.restore_complete_v2_photos_to_disposable_memory(
                    photo_zip, records, destination
                )
        self.assertEqual(destination, {})

    def test_source_file_replaced_after_snapshot_does_not_change_restored_bytes(self):
        photo_zip, records = self.files()
        destination = {}
        original = recovery.planner.validated_complete_archive

        def replace_original(_private_zip):
            photo_zip.write_bytes(b"source replaced after private copy")
            records.write_bytes(b"also replaced")
            return original(_private_zip)

        with patch.object(recovery.planner, "validated_complete_archive", replace_original):
            answer = recovery.restore_complete_v2_photos_to_disposable_memory(
                photo_zip, records, destination
            )
        self.assertEqual(answer["restoredPhotoObjectCount"], 2)
        self.assertEqual(destination[legacy.KEY]["body"], b"abc")
        self.assertEqual(destination[legacy.ORPHAN]["body"], b"xyz")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(DisposableVersionTwoPhotos)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f"FIRE disposable numbered v2 photo byte recovery: {result.testsRun} tests; "
          "source-only, NO provider or hosted writes.")
    raise SystemExit(0 if result.wasSuccessful() else 1)
