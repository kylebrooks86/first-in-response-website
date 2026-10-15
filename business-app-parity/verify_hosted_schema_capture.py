"""Fail-closed, read-only comparison of captured D1 metadata with candidate migrations.

Input contains ONLY schema/index/column/journal metadata and integer anomaly counts,
not row-level customer or financial data.  No network, database connection,
migration, approval or deployment command exists in this module.

A matching user-supplied JSON file is NOT independent evidence of remote access:
Gate 4 and Gate 5 remain pending until a provider attests the database mapping,
deployed runtime identity, provenance, and captured schema/journal.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
TARGETS = ("live", "staging", "doomsday")
URLS = {
    "live": "https://fire-app.kylebrooks8605.chatgpt.site",
    "staging": "https://fire-live-refund-staging.kylebrooks8605.chatgpt.site",
    "doomsday": "https://fire-app-independent-staging.kyle-bfc.workers.dev",
}
EXISTING_DOOMSDAY_D1 = "afb2c05a-d794-4a9a-b580-924ce01c26ad"
REQUIRED_CAPTURE_FORMAT = "fire-read-only-d1-schema-v1"
UUID = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
SHA = re.compile(r"^[a-f0-9]{40}$")
MAX_JSON_BYTES = 2_000_000
LIMIT_ROWS = 4_000


def statements():
    text = (ROOT / "RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql").read_text()
    sql = [part.strip() for part in re.sub(r"(?m)^\s*--[^\n]*$", "", text).split(";") if part.strip()]
    if len(sql) != 10 or any(not re.match(r"^SELECT\s", statement, re.I) for statement in sql):
        raise ValueError("Unreviewed release capture query set. Refusing to evaluate.")
    return sql


def migration_files(target):
    files = sorted((ROOT / "adapters" / target / "drizzle").glob("[0-9][0-9][0-9][0-9]_*.sql"))
    if not files or [int(path.name[:4]) for path in files] != list(range(len(files))):
        raise ValueError("Candidate migration set is missing, duplicated or noncontiguous.")
    return files


def local_expected(target):
    files = migration_files(target)
    with sqlite3.connect(":memory:") as db:
        db.row_factory = sqlite3.Row
        for file in files:
            db.executescript(file.read_text())
        db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
        db.executemany("INSERT INTO d1_migrations(name) VALUES (?)", [(p.name,) for p in files])
        db.commit()
        before = db.total_changes
        db.execute("PRAGMA query_only=ON")
        results = [[dict(row) for row in db.execute(query)] for query in statements()]
        if db.total_changes != before:
            raise ValueError("Unexpected mutation in metadata-only candidate queries.")
    manifest = {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in files}
    return results, {
        "files": len(files),
        "sha256": hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest(),
    }


def valid_time(value):
    if not isinstance(value, str):
        return False
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return date.utcoffset() is not None and date <= datetime.now(timezone.utc)
    except ValueError:
        return False


def evaluate(document):
    if not isinstance(document, dict) or document.get("format") != REQUIRED_CAPTURE_FORMAT:
        raise ValueError("Unsupported read-only capture document format.")
    captures = document.get("captures")
    if not isinstance(captures, list) or not captures or len(captures) > 3:
        raise ValueError("Expected one, two or three capture objects.")
    if any(not isinstance(item, dict) for item in captures):
        raise ValueError("Invalid capture entry.")

    reports = {}
    physical_uuids = {}
    for capture in captures:
        target = capture.get("target")
        if target not in TARGETS or target in reports:
            raise ValueError("Unknown or duplicate target in capture.")
        errors = []
        if capture.get("url") != URLS[target]:
            errors.append("TARGET_URL_MISMATCH")
        if not valid_time(capture.get("capturedAt")):
            errors.append("INVALID_CAPTURE_TIME")
        metadata = capture.get("providerMetadata")
        if not isinstance(metadata, dict):
            metadata = {}
        if metadata.get("binding") != "DB":
            errors.append("REQUIRED_DB_BINDING_UNVERIFIED")
        uuid = metadata.get("databaseUuid")
        if not isinstance(uuid, str) or not UUID.fullmatch(uuid):
            errors.append("IMMUTABLE_DATABASE_UUID_UNAVAILABLE")
        else:
            physical_uuids[target] = uuid
            if target == "doomsday" and uuid != EXISTING_DOOMSDAY_D1:
                errors.append("DOOMSDAY_DATABASE_BINDING_DRIFT_REVIEW_REQUIRED")
        if not isinstance(metadata.get("activeVersion"), str) or not metadata["activeVersion"].strip():
            errors.append("ACTIVE_DEPLOYMENT_VERSION_UNAVAILABLE")
        if not isinstance(metadata.get("sourceCommit"), str) or not SHA.fullmatch(metadata["sourceCommit"]):
            errors.append("DEPLOYED_SOURCE_COMMIT_UNAVAILABLE")
        if not isinstance(metadata.get("providerRecordId"), str) or not metadata["providerRecordId"].strip():
            errors.append("IMMUTABLE_PROVIDER_ATTESTATION_REFERENCE_UNAVAILABLE")
        if capture.get("truncated") is not False:
            errors.append("CAPTURE_COMPLETENESS_UNVERIFIED")
        rows = capture.get("queries")
        expected, fingerprint = local_expected(target)
        if not isinstance(rows, list) or len(rows) != len(expected):
            errors.append("INCOMPLETE_CAPTURE_QUERY_SET")
        else:
            for i, (query, wanted) in enumerate(zip(rows, expected), start=1):
                if (not isinstance(query, dict) or set(query) != {"rows"}
                        or not isinstance(query["rows"], list)
                        or len(query["rows"]) > LIMIT_ROWS or
                        any(not isinstance(row, dict) for row in query["rows"])):
                    errors.append(f"QUERY_{i:02}_MALFORMED_OR_UNAVAILABLE")
                elif query["rows"] != wanted:
                    # Exact expected rows/column types, constraints, CREATE SQL,
                    # partial index predicates, ordered journal and anomaly counts.
                    # A different SQLite dialect representation must be reviewed,
                    # not automatically declared equivalent.
                    errors.append(f"QUERY_{i:02}_DIFFERS_FROM_CANDIDATE")
        reports[target] = {
            "technicalMatch": not errors,
            "blockers": errors,
            "candidateMigrationCount": fingerprint["files"],
            "candidateMigrationManifestSha256": fingerprint["sha256"],
            "remoteIdentityIndependentlyVerified": False,
            "candidateDeployed": False,
        }
    if len(physical_uuids) != len(set(physical_uuids.values())):
        for target in physical_uuids:
            reports[target]["technicalMatch"] = False
            reports[target]["blockers"].append("CROSS_TARGET_DATABASE_UUID_COLLISION")
    all_targets_present = set(reports) == set(TARGETS)
    technical_match = all_targets_present and all(item["technicalMatch"] for item in reports.values())
    return {
        "scope": "Read-only captured metadata compared to isolated candidate migrations",
        "targets": reports,
        "allThreeTargetsProvided": all_targets_present,
        "suppliedImmutableUuidStringsDistinct": (
            len(physical_uuids) == 3 and len(set(physical_uuids.values())) == 3
        ),
        "candidateSchemaComparisonPassed": technical_match,
        "providerAttestationVerified": False,
        "deployedRuntimeArtifactVerified": False,
        "physicalDatabaseIsolationVerified": False,
        "gate4Passed": False,
        "gate5Passed": False,
        "productionReady": False,
        "publicationAuthorized": False,
        "officialReadinessPercent": 30,
        "explanation": ("Matching owner-supplied JSON is a technical precheck only. Verify immutable resource mappings, "
                        "origin/provenance and active deployed runtime/artifact through provider-supported evidence "
                        "before accepting any hosted gate. No customer/payment rows should be captured."),
    }


def evaluate_path(filename):
    path = Path(filename)
    if path.stat().st_size > MAX_JSON_BYTES:
        raise ValueError("Refusing oversized metadata file, which could expose customer records.")
    return evaluate(json.loads(path.read_text()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture_json", type=Path, help="Three-target JSON of read-only schema query results")
    args = parser.parse_args()
    try:
        result = evaluate_path(args.capture_json)
        print(json.dumps(result, indent=2))
        if not result["candidateSchemaComparisonPassed"]:
            sys.exit(1)
    except (ValueError, OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        parser.exit(2, "Metadata comparison BLOCKED: " + str(error) + "\n")
