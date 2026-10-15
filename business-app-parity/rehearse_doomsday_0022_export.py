"""Locally rehearse Doomsday migration 0022 on an owner-held D1 SQL export.

NEVER contacts Cloudflare, never runs Wrangler, never writes customer/financial
records to disk or prints them. Fails closed unless the existing private-export
validator confirms the complete pre-0022 schema and ledger. Even success is NOT
permission to apply a hosted migration or acceptance of release Gate 5.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

from verify_doomsday_d1_export import (
    ROOT, NEXT_INDEX, NEXT_MIGRATION, D1_DATABASE_UUID, TARGET,
    review_export, schema_inventory, sql_authorizer, read_only_ledger_counts
)

CANDIDATE = ROOT / "adapters" / "doomsday" / "drizzle" / NEXT_MIGRATION
REVIEWED_DDL = (
    "CREATE UNIQUE INDEX \`idx_payments_stripe_provider_unique\` "
    "ON \`payments\` (\`provider_id\`) "
    "WHERE \`provider_id\` GLOB 'cs_*' OR \`provider_id\` GLOB 'refund:*'"
)

def reviewed_migration_sql():
    source = CANDIDATE.read_text(encoding="utf-8")
    # Explicitly lock the one additive DDL; reject extra statements, altered
    # uniqueness predicate, IF NOT EXISTS, deletes or hidden mutations.
    body = re.sub(r"(?m)^\s*--[^\n]*(?:\n|$)", "", source).strip()
    body = body.removesuffix(";").strip()
    normalize = lambda text: re.sub(r"\s+", " ", text).strip()
    if normalize(body) != normalize(REVIEWED_DDL):
        raise ValueError("Candidate migration content no longer matches reviewed additive DDL: STOP.")
    return body, hashlib.sha256(source.encode("utf-8")).hexdigest()

def rehearse_export(local_sql_file, *, expected_sha256=None):
    review = review_export(local_sql_file, expected_sha256=expected_sha256)
    result = {
        "target": TARGET,
        "assertedD1DatabaseUuid": D1_DATABASE_UUID,
        "ownerExportSha256": review["ownerExportSha256"],
        "pre0022ExportRestorationValidated": bool(review["offlineRestorationValidated"]),
        "localMigration0022RehearsalPassed": False,
        "localRollbackPreservedPre0022State": False,
        "hostedDatabaseChanged": False,
        "liveMigrationAuthorized": False,
        "releaseGateAccepted": False,
        "officialReleaseReadinessPercent": 30,
    }
    # Do not even attempt the additive DDL against an abnormal snapshot.
    if not review["offlineRestorationValidated"]:
        result["stoppedBeforeRehearsal"] = True
        return result

    migration, migration_sha = reviewed_migration_sql()
    result["candidateMigration0022Sha256"] = migration_sha
    # This is a disposable, RAM-only restored copy. We cannot infer that
    # production was quiescent or that any export captured its most recent row.
    database = sqlite3.connect(":memory:")
    try:
        database.enable_load_extension(False)
        database.set_authorizer(sql_authorizer)
        payload = Path(local_sql_file).read_bytes().decode("utf-8-sig")
        database.executescript(payload)
        # No user-supplied SQL is executed after this point. The reviewed
        # migration and our fixed local metadata queries are all that remain.
        database.set_authorizer(None)
        original_schema = schema_inventory(database)
        original_journal = database.execute(
            "SELECT name FROM d1_migrations ORDER BY id").fetchall()
        original_changes = database.total_changes
        original_ledger = read_only_ledger_counts(database)
        if original_ledger != [0, 0, 0, 0]:
            result["stoppedBeforeRehearsal"] = True
            return result

        database.execute("SAVEPOINT fire_doomsday_local_0022")
        try:
            database.execute(migration)
            definition = database.execute(
                "SELECT sql FROM sqlite_master WHERE type='index' AND "
                "name=? AND tbl_name='payments'", (NEXT_INDEX,)).fetchall()
            index_list = [row for row in database.execute(
                "PRAGMA index_list('payments')") if row[1] == NEXT_INDEX]
            columns = [row[2] for row in database.execute(
                "PRAGMA index_info('idx_payments_stripe_provider_unique')")]
            normalize = lambda value: re.sub(r"\s+", " ", value).strip()
            index_correct = (len(definition) == 1
                and normalize(definition[0][0]) == normalize(migration)
                and len(index_list) == 1 and index_list[0][2] == 1
                and index_list[0][4] == 1 and columns == ["provider_id"])
            unchanged = (database.total_changes == original_changes
                and database.execute("SELECT name FROM d1_migrations ORDER BY id").fetchall() == original_journal
                and read_only_ledger_counts(database) == original_ledger)
            integrity_ok = database.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            foreign_keys_ok = not database.execute("PRAGMA foreign_key_check").fetchone()
            result["localMigration0022RehearsalPassed"] = bool(
                index_correct and unchanged and integrity_ok and foreign_keys_ok)
        finally:
            # SQL is executed ONLY in memory. Prove the intended rollback and
            # no-op pre-change state even if the index check fails.
            database.execute("ROLLBACK TO SAVEPOINT fire_doomsday_local_0022")
            database.execute("RELEASE SAVEPOINT fire_doomsday_local_0022")

        result["localRollbackPreservedPre0022State"] = bool(
            schema_inventory(database) == original_schema
            and database.total_changes == original_changes
            and database.execute("SELECT name FROM d1_migrations ORDER BY id").fetchall() == original_journal
            and database.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?",
                (NEXT_INDEX,)).fetchone()[0] == 0
            and read_only_ledger_counts(database) == original_ledger
        )
        result["offline0022EvidenceOnly"] = True
        result["explanation"] = (
            "Disposable RAM restore, reviewed additive index and reversible "
            "savepoint only. No source provenance, hosted writer quiescence, "
            "remote rollback, deployment, migration journal update or authorization."
        )
        return result
    finally:
        database.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("local_d1_sql_export", type=Path)
    parser.add_argument("--expected-sha256", help="Optional trusted 64-character export SHA-256")
    args = parser.parse_args()
    try:
        result = rehearse_export(args.local_d1_sql_export, expected_sha256=args.expected_sha256)
        print(json.dumps(result, indent=2))
        if not (result["localMigration0022RehearsalPassed"]
                and result["localRollbackPreservedPre0022State"]):
            sys.exit(1)
    except (ValueError, OSError, sqlite3.Error, UnicodeError) as error:
        # Never print exception strings; SQLite exceptions may contain private
        # SQL, contacts, provider IDs or customer data.
        print(json.dumps({"target": TARGET,
            "blockedReason": type(error).__name__, "localMigration0022RehearsalPassed": False,
            "hostedDatabaseChanged": False, "liveMigrationAuthorized": False,
            "releaseGateAccepted": False, "officialReleaseReadinessPercent": 30}, indent=2))
        sys.exit(2)
