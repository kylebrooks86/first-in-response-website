#!/usr/bin/env python3
"""Offline pairing preflight for complete FIRE photo ZIP + full records backup.

This is NOT a restore executor. No Wrangler, R2, D1, network, secret inspection,
database changes, archive extraction or real destination access. Never print
private identities, object paths, record values, SQL or archive contents.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
MAX_RECORDS_BYTES = 5_000_000
FIELDS = {
    "id": "id", "customerId": "customer_id", "category": "category",
    "caption": "caption", "filename": "filename", "contentType": "content_type",
    "sizeBytes": "size_bytes", "objectKey": "object_key", "createdAt": "created_at",
}


class UnsafePair(ValueError):
    pass


def fail_if(condition, reason):
    if condition:
        raise UnsafePair(reason)


def validated_complete_archive(zip_path):
    spec = importlib.util.spec_from_file_location(
        "fire_complete_archive_validator",
        ROOT / "validate-photo-storage-archive.py",
    )
    if spec is None or spec.loader is None:
        raise UnsafePair("Complete archive validator unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    outcome = module.validate(zip_path)
    fail_if(outcome.get("version") != 2 or outcome.get("validated") is not True
            or outcome.get("declaredNamespaceCoverageValidated") is not True
            or outcome.get("cryptographicChecksumsVerified") is not True,
            "Complete checksum-validated archive required")
    with zipfile.ZipFile(zip_path) as z:
        manifest = json.loads(z.read("manifest.json"))
    return manifest


def validated_records_backup(path):
    fail_if(not path.is_file() or path.stat().st_size > MAX_RECORDS_BYTES,
            "Records backup missing or over the 5 MB limit")
    # Reuse the real existing app records/refund/property validator. It operates
    # exclusively on a LOCAL JSON file and does not connect to a database.
    process = subprocess.run(
        ["node", str(ROOT / "validate-records-backup.mjs"), str(path)],
        cwd=ROOT.parent, capture_output=True, timeout=40, check=False,
    )
    fail_if(process.returncode != 0, "Records backup integrity validation failed")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("format") == "fire-app-records-backup" and payload.get("version") == 1:
        tables = payload.get("tables")
    elif (payload.get("backup_format") == "FIRE App live database snapshot"
          and payload.get("format_version") == 1
          and payload.get("verification", {}).get("all_tables_complete") is True
          and payload.get("verification", {}).get("truncated") is False):
        tables = {key: item["rows"] for key, item in payload["tables"].items()}
    else:
        raise UnsafePair("Unsupported records backup format")
    fail_if(not isinstance(tables, dict)
            or not isinstance(tables.get("customers"), list)
            or not isinstance(tables.get("customer_photos"), list),
            "Records backup lacks complete customer/photo inventory")
    return tables


def reconcile(manifest, tables):
    """Never return sensitive source IDs or object names."""
    customers = tables["customers"]
    photos = tables["customer_photos"]
    fail_if(any(not isinstance(row, dict) for row in customers + photos),
            "Malformed records table")
    source_customers = [row.get("id") for row in customers]
    fail_if(any(not isinstance(cid, str) or not cid for cid in source_customers)
            or len(set(source_customers)) != len(source_customers),
            "Invalid or duplicate customer identities")
    fail_if(set(source_customers) != set(manifest["customerIds"]),
            "Records and ZIP contain different customer sets")

    records_by_id = {}
    seen_keys = set()
    for row in photos:
        pid, key = row.get("id"), row.get("object_key")
        fail_if(not isinstance(pid, str) or not pid
                or not isinstance(key, str) or not key
                or pid in records_by_id or key in seen_keys,
                "Invalid or duplicate records photo identity")
        records_by_id[pid] = row
        seen_keys.add(key)
    archive_by_id = {item["id"]: item for item in manifest["photos"]}
    fail_if(set(archive_by_id) != set(records_by_id),
            "ZIP and records backup reference different photo IDs")
    for pid, archived in archive_by_id.items():
        row = records_by_id[pid]
        for manifest_field, records_field in FIELDS.items():
            actual = row.get(records_field)
            expected = archived[manifest_field]
            if manifest_field == "sizeBytes":
                fail_if(type(actual) is not int, "Records photo size is not an integer")
            fail_if(actual != expected, "ZIP/records photo metadata conflict")
    # Orphans are retained as bytes, NEVER assigned a fabricated photo record.
    orphan_count = sum(o["association"] == "unreferenced" for o in manifest["objects"])
    return {
        "result": "OFFLINE_PAIR_CONSISTENT_PLAN_ONLY",
        "completeArchiveVersion": 2,
        "customerCount": len(customers),
        "referencedPhotoCount": len(photos),
        "unreferencedObjectCount": orphan_count,
        "objectsWhoseArchiveChecksumsPassed": len(manifest["objects"]),
        "sourceFilesModified": False,
        "targetDatabaseInspected": False,
        "targetBucketInspected": False,
        "destinationUnoccupiedVerified": False,
        "pairedBackupSameInstantVerified": False,
        "providerProvenanceVerified": False,
        "nativeAtomicRestoreTested": False,
        "restoreExecutionAuthorized": False,
        "releaseGate7Accepted": False,
        "releaseGate10Accepted": False,
        "officialReleaseReadinessPercent": 30,
    }


def plan(archive_path, records_path):
    manifest = validated_complete_archive(Path(archive_path))
    tables = validated_records_backup(Path(records_path))
    return reconcile(manifest, tables)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--records", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(plan(args.archive, args.records), indent=2))
        return 0
    except (UnsafePair, ValueError, KeyError, TypeError, OSError,
            subprocess.TimeoutExpired, zipfile.BadZipFile,
            json.JSONDecodeError, UnicodeError) as error:
        # Deliberately do NOT print raw errors: ZIP errors and Node validators
        # may include private filenames/records or customer identifiers.
        print(json.dumps({"result": "BLOCKED", "reason": (
            str(error) if isinstance(error, UnsafePair)
            else "Archive/records verification failed; inspect files privately"
        ), "restoreExecutionAuthorized": False,
            "officialReleaseReadinessPercent": 30}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
