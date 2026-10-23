"""Fail-closed, metadata-only triage for the LIVE payment_refunds gap.

Never queries hosting; no Cloudflare, Wrangler, Stripe or network integration.
Reads only owner-collected metadata SELECT results, or saved Sites table names.
No migration, release authorization, customer/payment row access or writes.

The 3 diagnostic SELECTs are intentionally safe even if payment_refunds does
not exist. Full 10-query Gate 5 acceptance and independent provider-attested
D1/resource identity must happen separately, with explicit owner approval for
any later schema change.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3
import sys

import verify_hosted_schema_capture as schema

ROOT = Path(__file__).resolve().parent
FORMAT = "fire-live-refund-gap-triage-v1"
LIVE_URL = schema.URLS["live"]
LIVE_PROJECT = "appgprj_6aaf416f82c88191a292fa2e13a9ea61"
TABLE = "payment_refunds"
MIGRATION_NAME = "0019_unknown_jubilee.sql"
MAX_BYTES = 2_000_000
MAX_ROWS = 4_000


def strict_json(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Metadata input too large; do not paste backups or customer rows")
    def no_duplicates(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate metadata key")
            result[key] = value
        return result
    def no_nan(_):
        raise ValueError("Nonfinite JSON is not metadata evidence")
    return json.loads(path.read_text(encoding="utf-8"),
                      object_pairs_hook=no_duplicates, parse_constant=no_nan)


def select_queries():
    sql = (ROOT / "LIVE_REFUND_GAP_READ_ONLY.sql").read_text(encoding="utf-8")
    sql = re.sub(r"(?m)^\s*--[^\n]*$", "", sql)
    queries = [part.strip() for part in sql.split(";") if part.strip()]
    if len(queries) != 3 or any(not re.match(r"^SELECT\s", q, re.I) for q in queries):
        raise ValueError("Unreviewed LIVE triage SQL; refuse to collect")
    if any(re.search(r"\b(?:DROP|CREATE|ALTER|INSERT|UPDATE|DELETE|REPLACE|ATTACH|DETACH|PRAGMA)\b", q, re.I)
           for q in queries):
        raise ValueError("LIVE triage SQL contains unauthorized statement")
    return queries


def candidates():
    files = schema.migration_files("live")
    if len(files) != 23 or files[19].name != MIGRATION_NAME:
        raise ValueError("LIVE migration history changed; explicitly re-review 0019 source")
    source = files[19].read_text(encoding="utf-8")
    if (not re.search(r"CREATE\s+TABLE\s+[`\"\[]?payment_refunds", source, re.I)
            or source.count("CREATE INDEX") != 2 or "CREATE UNIQUE INDEX" not in source):
        raise ValueError("0019 refund table/index migration no longer matches reviewed source")
    return files


def fixture(count, *, collision=False):
    """Disposable local SQLite fixture only; NEVER attach a remote database."""
    migrations = candidates()
    with sqlite3.connect(":memory:") as db:
        db.row_factory = sqlite3.Row
        for path in migrations[:count]:
            db.executescript(path.read_text(encoding="utf-8"))
        db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
        db.executemany("INSERT INTO d1_migrations(name) VALUES (?)",
                       [(f.name,) for f in migrations[:count]])
        db.commit()
        db.execute("PRAGMA query_only=ON")
        return [[dict(row) for row in db.execute(sql)] for sql in select_queries()]


def validate_rows(queries):
    if not isinstance(queries, list) or len(queries) != 3:
        raise ValueError("Expected three actual query results; never replace errors with empty rows")
    output = []
    expected_columns = (
        {"type", "name", "tbl_name", "sql"},
        {"name"},
        {"provider_collision_groups"},
    )
    for i, (item, columns) in enumerate(zip(queries, expected_columns), start=1):
        if not isinstance(item, dict) or set(item) != {"rows"} or not isinstance(item["rows"], list) \
                or len(item["rows"]) > MAX_ROWS:
            raise ValueError(f"Query {i}: absent, errored, truncated or unrecognized")
        rows = item["rows"]
        if any(not isinstance(row, dict) or set(row) != columns for row in rows):
            raise ValueError(f"Query {i}: unexpected fields or missing columns")
        if i == 1:
            if any(not isinstance(row["type"], str) or row["type"] not in ("table", "index")
                   or not isinstance(row["name"], str) or not isinstance(row["tbl_name"], str)
                   or not isinstance(row["sql"], (str, type(None))) for row in rows):
                raise ValueError("Query 1: invalid schema object types")
        elif i == 2 and any(not isinstance(row["name"], str) or not row["name"] for row in rows):
            raise ValueError("Query 2: missing migration journal entries")
        elif i == 3 and (len(rows) != 1 or type(rows[0]["provider_collision_groups"]) is not int
                          or rows[0]["provider_collision_groups"] < 0):
            raise ValueError("Query 3: expected one nonnegative aggregate integer")
        output.append(rows)
    return output


def evaluate(document):
    if not isinstance(document, dict) or set(document) != {
            "format", "target", "url", "capturedAt", "queries"} \
            or document.get("format") != FORMAT or document.get("target") != "live" \
            or document.get("url") != LIVE_URL or not schema.valid_time(document.get("capturedAt")):
        raise ValueError("Unsupported or mismatched LIVE metadata envelope")
    rows, migrations, counts = validate_rows(document["queries"])
    files = candidates()
    journal = [r["name"] for r in migrations]
    prefix_matches = journal == [p.name for p in files[:len(journal)]]
    known_journal = prefix_matches and len(journal) <= len(files)
    table = [r for r in rows if r["type"] == "table" and r["name"] == TABLE]
    # D1's documented _cf_KV internal table may appear in observed schema.
    reserved = [r for r in rows if r["name"] == "_cf_KV"]
    if reserved:
        rows_for_compare = [r for r in rows if r["name"] != "_cf_KV"]
        from verify_hosted_schema_capture import matches_documented_d1_reserved_table
    else:
        rows_for_compare = rows
    structural_match = False
    if known_journal:
        expected = fixture(len(journal))[0]
        structural_match = rows_for_compare == expected
        if reserved:
            structural_match = (structural_match and
                                matches_documented_d1_reserved_table(rows, expected))
    collision_count = counts[0]["provider_collision_groups"]
    if not known_journal:
        disposition = "UNKNOWN_OR_NONPREFIX_MIGRATION_JOURNAL"
    elif not table and len(journal) >= 20:
        disposition = "REFUND_TABLE_MISSING_DESPITE_0019_JOURNAL"
    elif table and len(journal) <= 19:
        disposition = "REFUND_TABLE_PRESENT_WITHOUT_0019_JOURNAL"
    elif not structural_match:
        disposition = "SCHEMA_JOURNAL_DISAGREE_OR_UNREVIEWED_DDL"
    elif collision_count:
        disposition = "PAYMENT_PROVIDER_COLLISIONS_BLOCK_INDEX_0020"
    elif not table:
        disposition = "CONSISTENT_WITH_0019_NOT_YET_APPLIED"
    else:
        disposition = "REFUND_TABLE_PRESENT_IN_TECHNICALLY_MATCHING_LOCAL_PREFIX"
    return {
        "format": "fire-live-refund-gap-technical-decision-v1",
        "target": "live",
        "observedMigrationEntries": len(journal),
        "expectedCandidateMigrationEntries": len(files),
        "refundMigration": MIGRATION_NAME,
        "paymentRefundsPresent": bool(table),
        "journalExactCandidatePrefix": bool(known_journal),
        "wholeSchemaMatchesObservedLocalPrefix": bool(structural_match),
        "providerCollisionGroups": collision_count,
        "disposition": disposition,
        "remoteD1UuidAndProviderAttestationVerified": False,
        "fullThreeTargetSchemaAndJournalVerified": False,
        "gate4Passed": False,
        "gate5Passed": False,
        "authorizedToApplyMigration": False,
        "productionReady": False,
        "nextAction": "Independently obtain exact bound LIVE D1 UUID/current artifact, complete metadata and journal; review candidate migration compatibility and backup before any separately authorized change.",
        "interpretation": "Technical triage only. A matching pasted JSON, including synthetic fixtures, cannot prove a provider capture or authorize a hosted change.",
    }


def from_saved_sites_receipt(document):
    """Report EXACTLY what current Sites metadata establishes: names, not a journal."""
    if not isinstance(document, dict) or document.get("format") != "fire-hosted-read-only-observations-v1" \
            or not schema.valid_time(document.get("capturedAtUtc")):
        raise ValueError("Unsupported dated Sites receipt")
    if set(document) - {
        "format", "capturedAtUtc", "ownerLocalDate", "scope", "repository",
        "reviewedCandidateSha", "pullRequests", "sourceChecks", "targets",
        "doomsday", "limitations", "safety", "productionReadiness",
    }:
        raise ValueError("Unexpected fields in saved Sites receipt")
    targets = document.get("targets")
    if not isinstance(targets, list) or len(targets) != 2:
        raise ValueError("Expected exactly two read-only Sites targets")
    live = [x for x in targets if isinstance(x, dict) and x.get("target") == "live"]
    if len(live) != 1 or live[0].get("projectId") != LIVE_PROJECT or live[0].get("url") != LIVE_URL:
        raise ValueError("LIVE project/URL mismatch")
    overview = live[0].get("databaseOverview")
    if not isinstance(overview, dict) or overview.get("project_id") != LIVE_PROJECT \
            or overview.get("selected_binding_name") != "DB":
        raise ValueError("Missing observed Sites DB binding")
    projection = overview.get("model_projection", {})
    if not isinstance(projection, dict) or any(projection.get(k) is not False for k in (
            "truncated", "omitted_project_id", "omitted_selected_binding")) \
            or any(type(projection.get(k)) is not int or projection[k] != 0 for k in (
                "omitted_bindings", "omitted_tables")):
        raise ValueError("Incomplete Sites table inventory")
    tables = overview.get("tables")
    if not isinstance(tables, list) or any(not isinstance(t, str) for t in tables) \
            or len(tables) != len(set(tables)):
        raise ValueError("Malformed Sites table inventory")
    return {
        "source": "fresh read-only Sites table-name inventory; still not a full schema",
        "capturedAt": document["capturedAtUtc"],
        "liveObservedTableNames": len(tables),
        "paymentRefundsPresent": TABLE in tables,
        "candidateIntroducesPaymentRefundsAtMigration": MIGRATION_NAME,
        "migrationJournalObtained": False,
        "physicalD1UuidObtained": False,
        "fullDdlObtained": False,
        "classification": "JOURNAL_AND_DDL_REQUIRED_TO_DISTINGUISH_UNAPPLIED_0019_FROM_DRIFT",
        "safeToMigrate": False,
        "gate4Passed": False,
        "gate5Passed": False,
        "productionReady": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--sites-receipt", type=Path, help="Repository's saved sanitized Sites JSON")
    group.add_argument("--private-capture", type=Path, help="Three-SELECT provider receipt outside Git")
    args = parser.parse_args(argv)
    try:
        data = strict_json(args.sites_receipt or args.private_capture)
        result = (from_saved_sites_receipt(data) if args.sites_receipt else evaluate(data))
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0  # INSPECTOR succeeded; Gates 4 and 5 are still blocked.
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print("LIVE refund triage BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
