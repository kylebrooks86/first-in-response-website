"""Offline owner-only Gate 5 comparison: Doomsday against its pre-0022 baseline.

This comparison performs NO Cloudflare requests and NO persistent database writes.
It NEVER prints schema SQL, account/customer/payment rows, token values, or any
contents of the owner-held private metadata receipt.

A clean match validates local *historical pre-0022* metadata only. It does NOT
prove deployed Worker identity, cross-target isolation, current candidate parity,
rollback safety, or Gate 5 acceptance.
"""
import argparse
from contextlib import closing
import json
import re
from pathlib import Path
import sqlite3
import sys

import capture_doomsday_schema_read_only as collector
import verify_hosted_schema_capture as verifier

EXPECTED_LAST = "0021_manual_processing_fees.sql"


def expected_baseline():
    files = verifier.migration_files("doomsday")
    if len(files) != 24 or files[-2].name != "0022_stripe_provider_uniqueness.sql" or files[-1].name != "0023_deposit_policy_events.sql":
        raise ValueError("Unreviewed candidate migration set. Stop before comparing.")
    baseline = files[:-2]  # retain exact historical pre-0022 sequence; exclude both later migrations
    if len(baseline) != 22 or baseline[-1].name != EXPECTED_LAST:
        raise ValueError("Historical Doomsday migration sequence changed.")
    with closing(sqlite3.connect(":memory:")) as db:
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


def documented_cf_kv_only(actual_rows, expected_rows):
    """Allow precisely the D1-reserved storage table as an infrastructure exception.

    Cloudflare's D1 import/export docs identify _cf_KV as an internal table:
    https://developers.cloudflare.com/d1/best-practices/import-export-data/
    Do not ignore arbitrary _cf_* names, missing app objects, changed CREATE
    statements, other unexpected objects, or malformed _cf_KV declarations.
    This is NOT an exception to Gate 5 provider/deployment requirements.
    """
    detail = schema_object_differences(actual_rows, expected_rows)
    internal = ("table", "_cf_KV", "_cf_KV")
    if (detail["missing"] or detail["changed"]
            or detail["unexpected"] != [internal]):
        return False
    # Preserve pinned order and exact application CREATE SQL definitions.
    retained = [r for r in actual_rows
                if (r["type"], r["name"], r["tbl_name"]) != internal]
    if retained != expected_rows:
        return False
    reserved = next(r for r in actual_rows
                    if (r["type"], r["name"], r["tbl_name"]) == internal)
    ddl = reserved["sql"]
    if not isinstance(ddl, str):
        return False
    # Only the documented 2-column key/value WITHOUT ROWID reserved table.
    table = r'(?:_cf_KV|"_cf_KV"|\x60_cf_KV\x60|\[_cf_KV\])'
    key = r'(?:key|"key"|\x60key\x60|\[key\])'
    value = r'(?:value|"value"|\x60value\x60|\[value\])'
    pattern = (r'CREATE\s+TABLE\s+' + table + r'\s*\(\s*'
               + key + r'\s+TEXT\s+PRIMARY\s+KEY\s*,\s*'
               + value + r'\s+BLOB\s*\)\s+WITHOUT\s+ROWID\s*;?')
    return re.fullmatch(pattern, ddl.strip(), flags=re.IGNORECASE) is not None


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
    documented_system_exception = (differences == [1]
                                   and documented_cf_kv_only(rows[0], expected[0]))
    app_differences = [] if documented_system_exception else differences
    anomaly_counts = {next(iter(rows[i][0])): next(iter(rows[i][0].values()))
                      for i in range(5, 10)}
    safe = all(value == 0 for value in anomaly_counts.values())
    return {
        "result": ("MATCH_D1_RESERVED_TABLE" if documented_system_exception and safe
                   else "MATCH" if not differences and safe else "REVIEW_REQUIRED"),
        "baselineMigrationCount": 22,
        "currentCandidateMigrationCount": 24,
        "pre0022StructuralMatch": not app_differences,
        "differenceQueryNumbers": differences,
        "applicationSchemaDifferenceQueryNumbers": app_differences,
        "documentedD1ReservedTableOnly": documented_system_exception,
        "readOnlyFinancialChecksAllZero": safe,
        "aggregateAnomalyCounts": anomaly_counts,
        "providerAttestedActiveWorker": False,
        "deployedCandidateVerified": False,
        "physicalDatabaseIsolationVerified": False,
        "gate5Accepted": False,
        "officialReadinessPercent": 30,
    }


def schema_object_differences(actual_rows, expected_rows):
    """Safe, shape-checked Query 1 diagnostic; never emits CREATE SQL or data rows.

    This is a DIAGNOSTIC only. Even a whitespace-only difference is NOT
    automatically equivalent to the reviewed schema or an accepted release.
    """
    columns = {"type", "name", "tbl_name", "sql"}

    def keyed(rows):
        found = {}
        if not isinstance(rows, list):
            raise ValueError("Schema diagnostic requires a row list.")
        for row in rows:
            if (not isinstance(row, dict) or set(row) != columns
                    or not all(isinstance(row.get(k), str) for k in ("type", "name", "tbl_name"))
                    or row["type"] not in {"table", "index"}
                    or not isinstance(row["sql"], (str, type(None)))):
                raise ValueError("Schema diagnostic received unexpected fields; stop.")
            key = (row["type"], row["name"], row["tbl_name"])
            if key in found:
                raise ValueError("Duplicate schema object in capture; stop.")
            found[key] = row
        return found

    actual = keyed(actual_rows)
    expected = keyed(expected_rows)
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    changed = []
    for key in sorted(set(actual) & set(expected)):
        original = expected[key]["sql"]
        observed = actual[key]["sql"]
        if observed != original:
            # Heuristic only. This does not establish SQL semantic equivalence.
            same_tokens = (isinstance(observed, str) and isinstance(original, str)
                           and observed.split() == original.split())
            changed.append((key, "WHITESPACE_TOKEN_CANDIDATE" if same_tokens
                            else "DEFINITION_REVIEW_REQUIRED"))
    return {
        "expectedObjectCount": len(expected_rows),
        "capturedObjectCount": len(actual_rows),
        "missing": missing,
        "unexpected": unexpected,
        "changed": changed,
        "rowOrderOnly": not missing and not unexpected and not changed
                        and actual_rows != expected_rows,
    }


def print_schema_diagnostic(detail):
    """Print schema object identifiers only: no SQL text or customer records."""
    print("Query 1 database object diagnostic (metadata identifiers only):")
    print("  Expected objects: " + str(detail["expectedObjectCount"]) +
          "; captured objects: " + str(detail["capturedObjectCount"]))
    for label in ("missing", "unexpected"):
        entries = detail[label]
        print("  " + label + " object count: " + str(len(entries)))
        for obj_type, name, table in entries[:12]:
            print("    " + label + ": " + obj_type + " / " + name + " / " + table)
        if len(entries) > 12:
            print("    ... additional objects withheld")
    print("  Changed CREATE definitions: " + str(len(detail["changed"])))
    for (obj_type, name, table), classification in detail["changed"][:12]:
        print("    " + obj_type + " / " + name + " / " + table + ": " + classification)
    if len(detail["changed"]) > 12:
        print("    ... additional definitions withheld")
    if detail["rowOrderOnly"]:
        print("  Diagnostic: same objects and definitions; returned row order differs.")
    print("No SQL definitions printed; all differences require review.")


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
        diagnostic = None
        if 1 in report["differenceQueryNumbers"]:
            diagnostic = schema_object_differences(
                doc["captures"][0]["queries"][0]["rows"], expected_baseline()[0])
        print("FIRE Doomsday — OFFLINE pre-0022 comparison; no remote operations.")
        print("Receipt: " + path.name)
        print("Schema/index/journal comparisons: " +
              ("10/10 agree" if not report["differenceQueryNumbers"]
               else "Differences in queries: " + ", ".join(map(str, report["differenceQueryNumbers"]))))
        print("Five foreign-key/payment anomaly counts (aggregate only): " +
              str(report["aggregateAnomalyCounts"]))
        if diagnostic is not None:
            print_schema_diagnostic(diagnostic)
        if report["documentedD1ReservedTableOnly"]:
            print("Query 1 exception: ONLY documented Cloudflare _cf_KV reserved storage table.")
            print("Application schema definitions match pre-0022: YES (51/51).")
            print("The original raw Query 1 difference remains recorded.")
        print("Pre-0022 application baseline result: " + report["result"])
        print("Current candidate has migration 0022; this is NOT an acceptance or approval.")
        print("Deployed Worker provenance/physical isolation unverified. Gate 5 OPEN. Official readiness 30%.")
        return 0 if report["result"] in {"MATCH", "MATCH_D1_RESERVED_TABLE"} else 1
    except (ValueError, KeyError, IndexError, TypeError, OSError, sqlite3.Error,
            json.JSONDecodeError, UnicodeError) as error:
        # Errors here are curated only, never a dump of SQL or source-file contents.
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
