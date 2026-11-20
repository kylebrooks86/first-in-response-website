#!/usr/bin/env python3
"""FIRE v2 PHOTO BYTES: isolated in-memory, synthetic/disposable restore only.

Source-only building block, NOT a Cloudflare D1/R2 restore, backup, deploy,
migration, customer export, or permission to run against a real destination.
The numbered core SQLite recovery is independently rehearsed elsewhere.
R2 and D1 cannot share an atomic database transaction; no hosted promotion
or rollback implementation is claimed here.

A complete v2 ZIP and matching numbered records are privately snapshotted,
validated and cryptographically verified before ALL in-memory bytes are
published to an initially EMPTY plain dict. Every referenced AND retained
unreferenced object remains distinct. No invented photo metadata records.
"""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "fire_private_photo_pair_planner",
    ROOT / "plan-complete-photo-recovery.py",
)
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


class DisposablePhotoRestoreBlocked(ValueError):
    """No destination mutation may occur when proof is incomplete."""


def blocked(reason):
    raise DisposablePhotoRestoreBlocked(
        "FIRE in-memory photo restore blocked: " + reason
    )


def restore_complete_v2_photos_to_disposable_memory(archive_path, records_path, target):
    """Restore exact source ZIP bytes into EMPTY in-memory fake-R2 dictionary.

    Do not use with a persistent store or map to any real bucket: `target`
    must be the exact built-in dict type, with no pre-existing keys.
    No real remote calls, filesystem extraction or persistent writes.
    """

    if type(target) is not dict or target:
        blocked("an empty plain in-memory dictionary is required")
    archive_path, records_path = Path(archive_path), Path(records_path)
    with tempfile.TemporaryDirectory(prefix="fire-disposable-photo-v2-") as private_dir:
        root = Path(private_dir)
        private_zip, private_records = root / "photos.zip", root / "records.json"
        photo_source = planner.private_snapshot(
            archive_path, private_zip, planner.MAX_ARCHIVE_BYTES
        )
        records_source = planner.private_snapshot(
            records_path, private_records, planner.MAX_RECORDS_BYTES
        )
        manifest = planner.validated_complete_archive(private_zip)
        tables, kind = planner.validated_records_backup(private_records)
        if kind != "numbered-v2-core":
            blocked("numbered version 2 source records are required")
        plan = planner.reconcile(manifest, tables)
        objects = manifest["objects"]
        # The original input is never revisited after its private copy. A
        # second checksum of each object detects modifications after the
        # archive validator and before the disposable restore.
        staged = {}
        total_bytes = 0
        with zipfile.ZipFile(private_zip) as z:
            for item in objects:
                object_key = item["objectKey"]
                if object_key in staged:
                    blocked("duplicate object identity")
                contents = z.read(item["archivePath"])
                total_bytes += len(contents)
                if (total_bytes > 250 * 1024 * 1024
                        or len(contents) != item["sizeBytes"]
                        or hashlib.sha256(contents).hexdigest() != item["sha256"]):
                    blocked("source bytes changed or exceed safe memory bounds")
                # Plain dict holds an exact copied immutable bytes object.
                staged[object_key] = {
                    "body": bytes(contents),
                    "contentType": item["contentType"],
                    "etag": item["etag"],
                    "version": item["version"],
                    "association": item["association"],
                    "photoId": item["photoId"],
                }
        if (len(staged) != manifest["objectCount"]
                or len(staged) != plan["objectsWhoseArchiveChecksumsPassed"]
                or sum(o["association"] == "unreferenced" for o in staged.values())
                != plan["unreferencedObjectCount"]):
            blocked("complete object coverage was not restored")
        # Guard TOCTOU on private copied inputs, not just individual payloads.
        if (hashlib.sha256(private_zip.read_bytes()).hexdigest()
                != photo_source["sha256"]
                or hashlib.sha256(private_records.read_bytes()).hexdigest()
                != records_source["sha256"]):
            blocked("validated private archives changed")
        if target:
            blocked("destination became occupied during validation")
        # No mutation until every byte, original serial, financial record,
        # photo relationship and input hash has passed.
        target.update(staged)
        if len(target) != len(staged):
            blocked("disposable destination did not retain every object")
        return {
            "result": "DISPOSABLE_IN_MEMORY_PHOTO_BYTES_ROUNDTRIP",
            "numberedV2CoreRecordsValidated": True,
            "privateInputHashesVerified": True,
            "restoredPhotoObjectCount": len(staged),
            "restoredReferencedPhotoCount": plan["referencedPhotoCount"],
            "restoredUnreferencedObjectCount": plan["unreferencedObjectCount"],
            "restoredTotalBytes": total_bytes,
            "destinationInitiallyEmpty": True,
            "persistentStorageTouched": False,
            "cloudflareD1OrR2Touched": False,
            "devicePhotoVaultRestored": False,
            "realD1R2AtomicRestoreProven": False,
            "productionRecoveryAuthorized": False,
            "gate7Accepted": False,
        }
