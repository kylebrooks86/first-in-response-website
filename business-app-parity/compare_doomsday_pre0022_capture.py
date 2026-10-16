"""Offline owner-only Gate 5 comparison: Doomsday against its pre-0022 baseline.

This comparison performs NO Cloudflare requests and NO persistent database writes.
It NEVER prints schema SQL, account/customer/payment rows, token values, or any
contents of the owner-held private metadata receipt.

A clean match validates local *historical pre-0022* metadata only. It does NOT
prove deployed Worker identity, cross-target isolation, current candidate parity,
rollback safety, or Gate 5 acceptance.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import sys

import capture_doomsday_schema_read_only as collector
import verify_hosted_schema_capture as verifier

EXPECTED_LAST = "0021_manual_processing_fees.sql"


def expected_baseline():
    files = verifier.migration_files("doomsday")
    if len(files) != 23 or files[-1].name != "0022_stripe_provider_uniqueness.sql":
        raise ValueError("Unreviewed candidate migration set. Stop before comparing.")
    baseline = files[:-1]
    if len(baseline) != 22 or baseline[-1].name != EXPECTED_LAST:
        raise ValueError("Historical Doomsday migration sequence changed.")
    with sqlite3.connect(":memory:") as db:
        db.row_factory = sqlite3.Row
        for file in baseline:
            db.executescript(file.read_text(encoding="utf-8"))
        db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
        db.executemany("INSERT INTO d1_migrations(name) VALUES (?)",
                       [(path.name,) for path in baseline])
        db.commit()
        before = db.total_changes
        db.execute("PRAGMA query_only=ON")
        result = [[dict(row) for row in db.execute(sql)] for sql in verifier.statements()]
        if db.total_changes != before:
            raise ValueError("Unexpected local write while reading baseline metadata.")
    return result


def compare_capture(document):
    if not isinstance(document, dict) or set(document) != {"format", "captures"}:
        raise ValueError("Unrecognized metadata document; stop.")
    if document["format"] != verifier.REQUIRED_CAPTURE_FORMAT:
        raise ValueError("Unrecognized metadata format; stop.")
    captures = document["captures"]
    if not isinstance(captures, list) or len(captures) != 1:
        raise ValueError("Expected exactly one Doomsday capture.")
    entry = captures[0]
    if not isinstance(entry, dict) or set(entry) != {
            "target", "url", "capturedAt", "providerMetadata", "truncated", "queries"}:
        raise ValueError("Unrecognized capture fields; stop.")
    if entry["target"] != "doomsday" or entry["url"] != verifier.URLS["doomsday"]:
        raise ValueError("Capture does not identify the reviewed Doomsday target.")
    if not verifier.valid_time(entry["capturedAt"]):
        raise ValueError("Invalid or future-dated capture time.")
    if entry["truncated"] is not False:
        raise ValueError("Incomplete metadata capture; stop.")
    meta = entry["providerMetadata"]
    if not isinstance(meta, dict) or set(meta) != {
            "binding", "databaseUuid", "activeVersion", "sourceCommit", "providerRecordId"}:
        raise ValueError("Unrecognized provider metadata fields; stop.")
    if meta["binding"] != "DB" or meta["databaseUuid"] != collector.UUID:
        raise ValueError("Do not compare this receipt: exact D1 UUID mismatch.")
    # These missing values are EXPECTED; the private capture does not attest
    # to the active deployed Worker or to a provider's signed resource mapping.
    if any(meta[key] for key in ("activeVersion", "sourceCommit", "providerRecordId")):
        raise ValueError("Unexpected provider attestation in owner-only receipt; review separately.")
    queries = entry["queries"]
    if not isinstance(queries, list) or len(queries) != 10:
        raise ValueError("Expected all ten read-only query results.")
    rows = []
    for i, query in enumerate(queries, 1):
        if not isinstance(query, dict) or set(query) != {"rows"}:
            raise ValueError(f"Metadata query {i} missing or unrecognized.")
        rows.append(collector.checked_rows([{"success": True, "results": query["rows"]}], i))
    expected = expected_baseline()
    differences = [i for i, (received, wanted) in enumerate(zip(rows, expected), 1)
                   if received != wanted]
    anomaly_counts = {next(iter(rows[i][0])): next(iter(rows[i][0].values()))
                      for i in range(5, 10)}
    safe = all(value == 0 for value in anomaly_counts.values())
    return {
        "result": "MATCH" if not differences and safe else "REVIEW_REQUIRED",
        "baselineMigrationCount": 22,
        "currentCandidateMigrationCount": 23,
        "pre0022StructuralMatch": not differences,
        "differenceQueryNumbers": differences,
        "readOnlyFinancialChecksAllZero": safe,
        "aggregateAnomalyCounts": anomaly_counts,
        "providerAttestedActiveWorker": False,
        "deployedCandidateVerified": False,
        "physicalDatabaseIsolationVerified": False,
        "gate5Accepted": False,
        "officialReadinessPercent": 30,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path, nargs="?", help="Private owner metadata JSON receipt")
    args = parser.parse_args()
    try:
        path = args.receipt
        if path is None:
            root = Path.home() / "FIRE-Private-Backups"
            candidates = sorted(root.glob("FIRE-DOOMSDAY-METADATA-ONLY-*.json"))
            if not candidates:
                raise ValueError("No owner metadata receipt found in FIRE-Private-Backups.")
            path = candidates[-1]
        if not path.is_file() or path.stat().st_size > verifier.MAX_JSON_BYTES:
            raise ValueError("Missing or oversized metadata receipt; stop.")
        doc = json.loads(path.read_text(encoding="utf-8"))
        report = compare_capture(doc)
        print("FIRE Doomsday — OFFLINE pre-0022 comparison; no remote operations.")
        print("Receipt: " + path.name)
        print("Schema/index/journal comparisons: " +
              ("10/10 agree" if not report["differenceQueryNumbers"]
               else "Differences in queries: " + ", ".join(map(str, report["differenceQueryNumbers"]))))
        print("Five foreign-key/payment anomaly counts (aggregate only): " +
              str(report["aggregateAnomalyCounts"]))
        print("Pre-0022 baseline result: " + report["result"])
        print("Current candidate has migration 0022; this is NOT an acceptance or approval.")
        print("Deployed Worker provenance/physical isolation unverified. Gate 5 OPEN. Official readiness 30%.")
        return 0 if report["result"] == "MATCH" else 1
    except (ValueError, KeyError, IndexError, TypeError, OSError, sqlite3.Error,
            json.JSONDecodeError, UnicodeError) as error:
        # Errors here are curated only, never a dump of SQL or source-file contents.
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
