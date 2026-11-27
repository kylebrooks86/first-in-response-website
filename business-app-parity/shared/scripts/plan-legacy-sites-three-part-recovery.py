#!/usr/bin/env python3
"""FIRE Gate 7 — private legacy Sites records + complete cloud photos +
separate iPhone-local photo vault triage, entirely OFFLINE.

This does not access Sites, D1, R2, Cloudflare, customer accounts or any
device; it does not restore a destination. No statement of hosted LIVE
provenance, same-instant capture, photo completeness on the source device,
or acceptance of release Gate 7 is possible from these files alone.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent


def load(alias, filename):
    spec = importlib.util.spec_from_file_location(alias, ROOT / filename)
    if spec is None or spec.loader is None:
        raise ValueError("Private validator unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pair = load("fire_legacy_private_cloud_pair", "plan-complete-photo-recovery.py")
device = load("fire_legacy_private_device_photo", "plan-three-part-numbered-v2-recovery.py")


class UnsafeLegacyThreePart(ValueError):
    pass


def need(condition, message):
    if not condition:
        raise UnsafeLegacyThreePart(message)


def plan_legacy_sites_three_part(records, cloud_zip, iphone_zip):
    """Read three bounded, owner-held inputs into protected temporary copies."""
    with tempfile.TemporaryDirectory(prefix="fire-private-legacy-three-") as folder:
        root = Path(folder)
        sources = (
            ("records", Path(records), root / "records.json",
             pair.MAX_RECORDS_BYTES),
            ("cloud", Path(cloud_zip), root / "cloud.zip",
             pair.MAX_ARCHIVE_BYTES),
            ("device", Path(iphone_zip), root / "device.zip",
             device.MAX_DEVICE_ZIP),
        )
        original = {}
        for role, selected, copied, limit in sources:
            original[role] = pair.private_snapshot(selected, copied, limit)

        # The existing two-file verifier performs independent original-byte
        # SHA256, legacy schema/row self-check, actual disposable SQLite
        # round-trip and photo object validation. Only the exact Sites
        # legacy records-review format may pass this separate entrypoint.
        cloud = pair.plan(root / "cloud.zip", root / "records.json")
        need(cloud.get("recordsBackupKind") == "legacy-sites-review-v1"
             and cloud.get("releaseGate7Accepted") is False
             and cloud.get("providerProvenanceVerified") is False,
             "Verified legacy Sites records/cloud photo pair required")

        tables, kind = pair.validated_records_backup(root / "records.json")
        need(kind == "legacy-sites-review-v1",
             "Private legacy Sites review changed during validation")
        customers = tables["customers"]
        customer_ids = {row["id"] for row in customers}
        need(len(customer_ids) == len(customers)
             and all(isinstance(v, str) and v for v in customer_ids),
             "Invalid legacy customer identity coverage")
        cloud_ids = {row["id"] for row in tables["customer_photos"]}
        need(len(cloud_ids) == len(tables["customer_photos"]),
             "Duplicate cloud customer-photo record")

        # Stage actual verified device image bytes ONLY into a disposable
        # dictionary. No persistent memory store / indexedDB / R2 changes.
        disposable = {}
        local = device.stage_validated_device_photos_in_disposable_memory(
            root / "device.zip", customer_ids, disposable)
        need(not cloud_ids.intersection(disposable),
             "A cloud and local photo claim the same immutable photo ID")
        need(len(disposable) == local["declaredDevicePhotos"],
             "Device-only photo byte inventory did not reconcile")

        for role, _, copied, _ in sources:
            blob = copied.read_bytes()
            need(len(blob) == original[role]["sizeBytes"] and
                 hashlib.sha256(blob).hexdigest() == original[role]["sha256"],
                 "Private validated source changed before final receipt")

        identity = {
            "format": "fire-legacy-sites-three-private-file-fingerprint-v1",
            "recordsSha256": original["records"]["sha256"],
            "cloudPhotoZipSha256": original["cloud"]["sha256"],
            "devicePhotoZipSha256": original["device"]["sha256"],
        }
        digest = hashlib.sha256(json.dumps(
            identity, sort_keys=True, separators=(",", ":")
        ).encode("utf8")).hexdigest()
        return {
            "result": "OFFLINE_LEGACY_SITES_THREE_PART_PLAN_ONLY",
            "recordsReviewType": kind,
            "legacyCustomerCount": len(customers),
            "cloudReferencedPhotoCount": cloud["referencedPhotoCount"],
            "cloudUnreferencedBytesRetained": cloud["unreferencedObjectCount"],
            "deviceOnlyPhotoCount": local["declaredDevicePhotos"],
            "deviceOnlyPhotoBytesValidated": local["devicePhotoBytesValidated"],
            "allThreePrivateFilesValidated": True,
            "noCloudDevicePhotoIdentityCollision": True,
            "privateThreePartFingerprintSha256": digest,
            "fingerprintCryptographicallySigned": False,
            "allSourceFilesUnmodified": True,
            "sourceDatabaseUuidVerified": False,
            "sourceProviderPhotoNamespaceVerified": False,
            "sourceDeviceInventoryCompleteVerified": False,
            "capturedAtSameInstantVerified": False,
            "ownerHeldOriginalCustodyProven": False,
            "financialSchemaAndRefundMigrationHistoryVerified": False,
            "permanentCustomerJobNumberHistoryVerified": False,
            "liveHostDataRestored": False,
            "photoBytesWrittenToLiveStorage": False,
            "disposableDeviceStoreUsed": True,
            "anyProviderNetworkCalls": False,
            "anyRemoteWrites": False,
            "gate4Accepted": False,
            "gate5Accepted": False,
            "gate7Accepted": False,
            "gate10Accepted": False,
            "productionReleaseAuthorized": False,
        }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--records", required=True, type=Path)
    cli.add_argument("--cloud-photo-zip", required=True, type=Path)
    cli.add_argument("--device-photo-zip", required=True, type=Path)
    args = cli.parse_args()
    try:
        print(json.dumps(plan_legacy_sites_three_part(
            args.records, args.cloud_photo_zip, args.device_photo_zip
        ), indent=2))
        return 0
    except Exception:
        # Never print source file paths, customer names, photo object keys,
        # internal row values, original exception messages or credentials.
        print(json.dumps({
            "result": "BLOCKED",
            "reason": "Private three-file legacy review failed validation.",
            "gate7Accepted": False,
            "anyProviderNetworkCalls": False,
            "anyRemoteWrites": False,
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
