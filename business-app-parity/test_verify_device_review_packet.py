"""Negative and positive controls for the downloaded full-app review ZIP verifier."""
import importlib.util
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path


def module(name):
    path = Path(__file__).with_name(name + ".py")
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


prepare = module("prepare_device_review")
verify = module("verify_device_review_packet")
TARGET = "staging"
CHECKPOINT = "synthetic-ci-sha-for-negative-tests"


class DeviceReviewVerification(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.source = base / "source"
        for name in [
            "app/page.tsx", "app/dashboard.tsx", "app/globals.css",
            "lib/photo-storage-archive.ts",
            "app/api/backup/photos/storage/route.ts",
            "dist/server/index.js", "dist/server/BUILD_ID",
        ]:
            p = self.source / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("synthetic-only:" + name)
        self.packet = base / "review"
        self.receipt = prepare.prepare({TARGET: self.source}, self.packet, CHECKPOINT)

    def receipt_file(self):
        return self.packet / "DEVICE_REVIEW_RECEIPT.json"

    def edit_receipt(self, action):
        current = json.loads(self.receipt_file().read_text())
        action(current)
        self.receipt_file().write_text(json.dumps(current))

    def zip_path(self):
        return self.packet / self.receipt["targets"][TARGET]["archive"]

    def rewrite_archive(self, action):
        zpath = self.zip_path()
        with zipfile.ZipFile(zpath) as original:
            files = [(info.filename, original.read(info)) for info in original.infolist()]
        action(files)
        with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_DEFLATED) as rewritten:
            for name, body in files:
                rewritten.writestr(name, body)

    def reseal_only_zip_digest(self):
        digest = verify.hash_file(self.zip_path())
        self.edit_receipt(lambda data: data["targets"][TARGET].update(sha256=digest))

    def reject(self):
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            verify.verify(self.packet, TARGET, CHECKPOINT)

    def test_exact_packet_passes_without_extraction(self):
        result = verify.verify(self.packet, TARGET, CHECKPOINT)
        self.assertTrue(result["readOnly"])
        self.assertFalse(result["publicationAuthorized"])
        self.assertIsNone(result["installableURL"])
        self.assertEqual(result["target"], TARGET)
        self.assertEqual(result["fileCount"], 7)
        self.assertEqual(result["checkpoint"], CHECKPOINT)

    def test_wrong_target_and_wrong_checkpoint_refused(self):
        for args in [(self.packet, "live", CHECKPOINT),
                     (self.packet, TARGET, "different-commit")]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                verify.verify(*args)

    def test_archive_byte_change_rejected(self):
        self.rewrite_archive(lambda items: items.__setitem__(
            0, (items[0][0], b"changed-synthetic-bytes")))
        self.reject()

    def test_forged_receipt_file_digest_rejected_after_reseal(self):
        self.rewrite_archive(lambda items: items.__setitem__(
            0, (items[0][0], b"changed-synthetic-bytes")))
        self.reseal_only_zip_digest()
        self.reject()

    def test_duplicate_member_rejected_even_if_sha_updated(self):
        self.rewrite_archive(lambda items: items.append(items[0]))
        self.reseal_only_zip_digest()
        self.reject()

    def test_traversal_member_rejected_even_if_sha_updated(self):
        self.rewrite_archive(lambda items: items.__setitem__(
            0, ("source/../secret.txt", items[0][1])))
        self.reseal_only_zip_digest()
        self.reject()

    def test_hidden_environment_file_rejected(self):
        self.rewrite_archive(lambda items: items.__setitem__(
            0, ("source/app/.env.production", items[0][1])))
        self.reseal_only_zip_digest()
        self.reject()

    def test_missing_or_changed_build_id_rejected(self):
        self.rewrite_archive(lambda items: [
            items.__setitem__(i, (name, b"forged-build-id"))
            for i, (name, _) in enumerate(items)
            if name == "build/server/BUILD_ID"
        ])
        self.reseal_only_zip_digest()
        self.reject()

    def test_unexpected_sidecar_file_or_link_rejected(self):
        (self.packet / "extra.txt").write_text("unexpected")
        self.reject()
        (self.packet / "extra.txt").unlink()
        (self.packet / "unrelated").symlink_to(self.receipt_file())
        self.reject()

    def test_unsafe_receipt_release_claims_refused(self):
        for key, bad in [("publicationAuthorized", True),
                         ("physicalDeviceAcceptance", True),
                         ("installableURL", "https://production.example.invalid/"),
                         ("officialReadinessPercent", 100)]:
            with self.subTest(key=key):
                current = json.loads(self.receipt_file().read_text())
                current[key] = bad
                self.receipt_file().write_text(json.dumps(current))
                self.reject()
                self.receipt_file().write_text(json.dumps(self.receipt))

    def test_absent_or_mismatched_file_inventory_refused(self):
        self.edit_receipt(lambda d: d["targets"][TARGET]["fileSha256"].pop(
            "source/app/page.tsx"))
        self.reject()

    def test_no_output_side_effects_from_repeated_verification(self):
        original = {p.name: verify.hash_file(p) for p in self.packet.iterdir()}
        verify.verify(self.packet, TARGET, CHECKPOINT)
        verify.verify(self.packet, TARGET, CHECKPOINT)
        self.assertEqual(original, {
            p.name: verify.hash_file(p) for p in self.packet.iterdir()})


if __name__ == "__main__":
    unittest.main(verbosity=2)
