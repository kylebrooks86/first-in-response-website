#!/usr/bin/env python3
"""FIRE private numbered-v2 + complete R2 + iPhone-local photo ZIP triage.

READ-ONLY, offline and fail closed. This NEVER restores, extracts photos, reads
a hosted D1/R2, accesses an iPhone, authenticates a LIVE deployment, or proves
that three files were captured at the same instant. The source files can be
sensitive: do NOT upload them to GitHub/chat or publish the returned fingerprints.

Files are privately snapshotted (0600) with independent size limits. The
existing v2 validator proves the full records/R2 pair; this tool additionally
checks every declared iPhone-only image byte against its own SHA-256 and
customer IDs in the SAME private numbered-record snapshot.

The validated artifacts remain distinct; no cloud photo is rewritten as an
on-device photo and no unknown local customer is silently invented.
"""
import argparse
from datetime import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "fire_existing_numbered_pair", ROOT / "plan-complete-photo-recovery.py"
)
pair = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pair)

MAX_DEVICE_ZIP = 161 * 1024 * 1024
MAX_DEVICE_PHOTOS = 500
MAX_DEVICE_IMAGE = 15 * 1024 * 1024
MAX_MANIFEST = 1024 * 1024
SAFE_PHOTO_ID = re.compile(r"[A-Za-z0-9_-]{1,90}\Z")
SAFE_CUSTOMER_ID = re.compile(r"[A-Za-z0-9_-]{1,120}\Z")
SAFE_SHA = re.compile(r"[0-9a-f]{64}\Z")
IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "image/avif", "image/heic", "image/heif", "image/bmp"
}
PHOTO_FIELDS = {
    "id", "customerId", "category", "caption", "filename",
    "contentType", "sizeBytes", "createdAt", "sha256"
}


class UnsafeThreePartRecovery(ValueError):
    pass


def ensure(condition, reason):
    if not condition:
        raise UnsafeThreePartRecovery(reason)


def valid_date(value):
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def validate_device_photo_zip(filename, known_customers):
    """Independently validate the user-held v1 FIRE IndexedDB photo ZIP.

    This verifies the ZIP's OWN claims and its relationship to the separately
    validated numbered customer inventory. It does NOT inspect the current
    iPhone IndexedDB store to prove that no unsaved photos remain.
    """
    ensure(type(known_customers) is set, "numbered customer inventory missing")
    with zipfile.ZipFile(filename, "r") as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        ensure(
            len(infos) >= 1 and len(infos) <= MAX_DEVICE_PHOTOS + 1
            and len(names) == len(set(names)) and "manifest.json" in names,
            "iPhone ZIP has duplicate, missing or excessive entries"
        )
        ensure(not archive.comment, "iPhone ZIP contains unexpected comment data")
        total = 0
        for info in infos:
            ensure(
                not info.is_dir() and not info.flag_bits & 1
                and info.compress_type == zipfile.ZIP_STORED
                and (info.external_attr >> 16) & 0o170000 != 0o120000
                and info.file_size >= 0,
                "unsupported iPhone ZIP entry"
            )
            total += info.file_size
        ensure(total <= MAX_DEVICE_ZIP, "iPhone ZIP exceeds bounded expanded size")
        meta = archive.getinfo("manifest.json")
        ensure(meta.file_size <= MAX_MANIFEST, "iPhone ZIP manifest is too large")
        manifest = json.loads(archive.read(meta))
        ensure(
            isinstance(manifest, dict)
            and manifest.get("format") == "fire-offline-photo-vault"
            and type(manifest.get("version")) is int and manifest["version"] == 1
            and manifest.get("requiresMatchingCustomerRecords") is True
            and valid_date(manifest.get("exportedAt"))
            and isinstance(manifest.get("photos"), list),
            "iPhone ZIP manifest format or customer-relationship claim invalid"
        )
        photos = manifest["photos"]
        ensure(
            len(photos) <= MAX_DEVICE_PHOTOS and len(photos) == len(infos) - 1,
            "iPhone ZIP photo count differs from manifest"
        )
        ids = set()
        customers = set()
        size = 0
        expected_names = {"manifest.json"}
        for photo in photos:
            ensure(
                isinstance(photo, dict) and set(photo) == PHOTO_FIELDS,
                "iPhone photo has missing or additional manifest fields"
            )
            photo_id, customer_id = photo["id"], photo["customerId"]
            ensure(
                isinstance(photo_id, str) and SAFE_PHOTO_ID.fullmatch(photo_id)
                and isinstance(customer_id, str)
                and SAFE_CUSTOMER_ID.fullmatch(customer_id)
                and customer_id in known_customers
                and photo_id not in ids,
                "iPhone photo has duplicate or unknown customer identity"
            )
            ids.add(photo_id)
            customers.add(customer_id)
            ensure(
                photo["category"] in ("before", "after", "property")
                and isinstance(photo["caption"], str)
                and len(photo["caption"]) <= 2000
                and isinstance(photo["filename"], str)
                and 0 < len(photo["filename"]) <= 240
                and isinstance(photo["contentType"], str)
                and photo["contentType"] in IMAGE_TYPES
                and type(photo["sizeBytes"]) is int
                and 0 < photo["sizeBytes"] <= MAX_DEVICE_IMAGE
                and valid_date(photo["createdAt"])
                and isinstance(photo["sha256"], str)
                and SAFE_SHA.fullmatch(photo["sha256"]),
                "iPhone photo metadata, type, timestamp or checksum is invalid"
            )
            name = "photos/" + photo_id
            ensure(name in names, "iPhone ZIP omits a declared photo")
            raw = archive.read(name)
            ensure(
                len(raw) == photo["sizeBytes"]
                and hashlib.sha256(raw).hexdigest() == photo["sha256"],
                "iPhone ZIP contains incomplete or altered photo bytes"
            )
            size += len(raw)
            ensure(size <= 160 * 1024 * 1024, "iPhone photo bytes exceed safe size")
            expected_names.add(name)
        ensure(set(names) == expected_names, "iPhone ZIP has undeclared image bytes")
        return {
            "declaredDevicePhotos": len(photos),
            "devicePhotoBytesValidated": size,
            "deviceCustomerCount": len(customers),
            "declaredManifestComplete": True,
            "deviceArchiveSHA256Verified": True,
            "currentDeviceInventoryIndependentlyVerified": False,
            "sourceFilesModified": False,
        }


def stage_validated_device_photos_in_disposable_memory(filename, known_customers, target):
    """Read back ALL validated device-only bytes into an empty ephemeral dict.

    A rehearsal only: no IndexedDB, filesystem extraction, D1/R2, backups,
    remote API, provider data, or persistent destination is ever mutated.
    The archive's exact SHA is fixed across the validation/staging sequence;
    fail before touching the caller's dictionary on any missing/corrupt photo.
    """
    ensure(type(target) is dict and not target, "empty plain in-memory photo store required")
    filename = Path(filename)
    def source_hash():
        with filename.open("rb") as source:
            return hashlib.file_digest(source, "sha256").hexdigest()

    before = source_hash()
    validated = validate_device_photo_zip(filename, known_customers)
    staged = {}
    total_bytes = 0
    with zipfile.ZipFile(filename, "r") as archive:
        manifest = json.loads(archive.read("manifest.json"))
        for photo in manifest["photos"]:
            photo_id = photo["id"]
            ensure(photo_id not in staged, "duplicate local photo in disposable restore")
            payload = archive.read("photos/" + photo_id)
            ensure(len(payload) == photo["sizeBytes"] and
                   hashlib.sha256(payload).hexdigest() == photo["sha256"],
                   "changed device photo byte stream after validation")
            total_bytes += len(payload)
            ensure(total_bytes <= 160 * 1024 * 1024,
                   "disposable device photo restore memory bound exceeded")
            staged[photo_id] = {
                "body": bytes(payload),
                "customerId": photo["customerId"],
                "contentType": photo["contentType"],
                "category": photo["category"],
            }
    ensure(len(staged) == validated["declaredDevicePhotos"] and
           total_bytes == validated["devicePhotoBytesValidated"],
           "disposable device photo restore differs from validated manifest")
    ensure(source_hash() == before, "device photo archive changed during validation")
    ensure(not target, "disposable destination became occupied")
    target.update(staged)
    return {
        **validated,
        "disposableDevicePhotosRestored": len(staged),
        "disposableDevicePhotoBytesRestored": total_bytes,
        "disposableDeviceStoreInitiallyEmpty": True,
        "restoredDevicePhotosIntoIndexedDb": False,
        "persistentDevicePhotoStoreTouched": False,
    }


def plan_three_part(records_path, cloud_photo_path, device_photo_path):
    """Validate exact private snapshots before returning only sanitized counts."""
    with tempfile.TemporaryDirectory(prefix="fire-private-three-part-") as folder:
        private = Path(folder)
        sources = (
            ("records", Path(records_path), private / "records.json",
             pair.MAX_RECORDS_BYTES),
            ("cloudPhotoZip", Path(cloud_photo_path), private / "cloud.zip",
             pair.MAX_ARCHIVE_BYTES),
            ("devicePhotoZip", Path(device_photo_path), private / "device.zip",
             MAX_DEVICE_ZIP),
        )
        hashes = {}
        for key, src, dst, maximum in sources:
            hashes[key] = pair.private_snapshot(src, dst, maximum)
        # The nested pair tool uses the exact captured copies and creates its
        # own protected snapshots for multi-open validators.
        existing = pair.plan(private / "cloud.zip", private / "records.json")
        ensure(
            existing.get("recordsBackupKind") == "numbered-v2-core",
            "permanent numbered v2 core records are required"
        )
        tables, kind = pair.validated_records_backup(private / "records.json")
        ensure(kind == "numbered-v2-core", "numbered records changed during triage")
        customers = tables["customers"]
        known = {row["id"] for row in customers}
        ensure(len(known) == len(customers), "duplicate numbered customer identity")
        disposable_device_store = {}
        local = stage_validated_device_photos_in_disposable_memory(
            private / "device.zip", known, disposable_device_store)
        ensure(len(disposable_device_store) == local["declaredDevicePhotos"],
               "disposable device photo byte coverage mismatch")
        for key, _, dst, _ in sources:
            current = dst.read_bytes()
            ensure(
                len(current) == hashes[key]["sizeBytes"]
                and hashlib.sha256(current).hexdigest() == hashes[key]["sha256"],
                "private validated input changed before receipt"
            )
        triple = {
            "format": "fire-private-three-part-photo-recovery-fingerprint-v1",
            "recordsSha256": hashes["records"]["sha256"],
            "completeCloudPhotoZipSha256": hashes["cloudPhotoZip"]["sha256"],
            "devicePhotoZipSha256": hashes["devicePhotoZip"]["sha256"],
        }
        fingerprint = hashlib.sha256(
            json.dumps(triple, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return {
            "result": "OFFLINE_THREE_PART_RECOVERY_PLAN_ONLY",
            "allThreeInputFilesIndividuallyValidated": True,
            "numberedCoreAndCloudPairConsistent": True,
            "numberedCustomerIdentitiesMatchDeclaredDevicePhotos": True,
            "numberedCustomerCount": existing["customerCount"],
            "cloudReferencedPhotoCount": existing["referencedPhotoCount"],
            "cloudRetainedUnreferencedObjectCount": existing["unreferencedObjectCount"],
            **local,
            "threePartFingerprintSha256": fingerprint,
            "threePartFingerprintCryptographicallySigned": False,
            "allThreeCapturedAtSameInstantVerified": False,
            "onDeviceCurrentInventoryVerified": False,
            "optionalFeatureTablesIncluded": False,
            "completeAppRecoveryProven": False,
            "ownerHeldOriginalCustodyVerified": False,
            "actualD1AndR2RestoreTested": False,
            "restoredDevicePhotosIntoIndexedDb": False,
            "gate7Accepted": False,
            "releaseGatesAccepted": 4,
            "hostedWritesPerformed": False,
            "remoteProviderAccessed": False,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--records", required=True, type=Path)
    parser.add_argument("--cloud-photo-zip", required=True, type=Path)
    parser.add_argument("--device-photo-zip", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(plan_three_part(
            args.records, args.cloud_photo_zip, args.device_photo_zip
        ), indent=2))
        return 0
    except Exception:
        # Never expose private filenames, serials, financial values, photo IDs,
        # metadata, parser stack traces, or exact source paths in CLI output.
        print(json.dumps({
            "result": "BLOCKED",
            "reason": "Three-part private archives could not be verified; inspect originals locally.",
            "gate7Accepted": False,
            "remoteProviderAccessed": False,
            "hostedWritesPerformed": False,
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
