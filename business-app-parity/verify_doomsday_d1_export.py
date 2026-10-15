"""Offline-only FIRE Doomsday D1 SQL-export restoration and integrity verifier.

Reads an owner-held local export into a disposable *in-memory* SQLite database.
NEVER contacts Cloudflare, executes remote migration/deployment or writes to
the input. Prints metadata and aggregate pass/fail statuses ONLY. No rows,
payment IDs, customer data, or raw SQL are emitted.

IMPORTANT: This check cannot independently prove where a SQL export came
from or that every live row was captured. Owner controls source and custody.
Only pass trusted D1 exports, never SQL from an unknown origin.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

ROOT = Path(__file__).resolve().parent
MIGRATIONS = ROOT / "adapters" / "doomsday" / "drizzle"
LEDGER = ROOT / "shared" / "scripts" / "stripe-ledger-preflight.sql"
MAX_EXPORT_BYTES = 128 * 1024 * 1024
D1_DATABASE_UUID = "afb2c05a-d794-4a9a-b580-924ce01c26ad"
TARGET = "doomsday"
NEXT_MIGRATION = "0022_stripe_provider_uniqueness.sql"
NEXT_INDEX = "idx_payments_stripe_provider_unique"


def migration_baseline():
    files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    if len(files) != 23 or files[-1].name != NEXT_MIGRATION:
        raise ValueError("Candidate Doomsday source migrations have drifted: STOP.")
    if [int(f.name[:4]) for f in files] != list(range(23)):
        raise ValueError("Non-contiguous candidate migration sequence: STOP.")
    digest = hashlib.sha256()
    for file in files[:-1]:
        digest.update(file.name.encode() + b"\0" + hashlib.sha256(file.read_bytes()).digest())
    return files[:-1], digest.hexdigest()


def schema_inventory(db):
    # Provider's D1 journal CREATE statement is intentionally excluded; its
    # ordered names are checked independently. Include application triggers
    # and views, not just indexes, to reject unexpected executable schema.
    rows = db.execute("""
      SELECT type,name,tbl_name,sql FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%' AND tbl_name <> 'd1_migrations'
        AND type IN ('table','index','view','trigger')
      ORDER BY type,name
    """).fetchall()
    return [(typ, name, tbl, re.sub(r"\s+", " ", sql or "").strip())
            for typ, name, tbl, sql in rows]


def expected_schema(migrations):
    with sqlite3.connect(":memory:") as db:
        for file in migrations:
            db.executescript(file.read_text(encoding="utf-8"))
        return schema_inventory(db)


def read_only_ledger_counts(db):
    sql = re.sub(r"(?m)^\s*--[^\n]*$", "", LEDGER.read_text(encoding="utf-8"))
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    if len(statements) != 4 or any(not re.match(r"^SELECT\s", s, re.I) for s in statements):
        raise ValueError("Reviewed payment-ledger diagnostic has drifted: STOP.")
    result = []
    for statement in statements:
        # Do not fetch or print refund/customer identifiers, even if corrupt
        # rows are present in an owner's physical backup.
        row = db.execute("SELECT COUNT(*) FROM (" + statement + ")").fetchone()
        result.append(int(row[0]))
    return result


def sql_authorizer(action, arg1, arg2, _database, _trigger):
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_FUNCTION and str(arg2 or arg1).lower() == "load_extension":
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA and str(arg1 or "").lower() not in (
            "foreign_keys", "defer_foreign_keys", "recursive_triggers"):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def review_export(file, *, expected_sha256=None):
    filepath = Path(file)
    if filepath.is_symlink() or not filepath.is_file() or filepath.suffix.lower() != ".sql":
        raise ValueError("Use a regular local .sql export file (no symlinks).")
    stat = filepath.stat()
    if not 0 < stat.st_size <= MAX_EXPORT_BYTES:
        raise ValueError("SQL export is empty or exceeds the 128 MiB local verification limit.")
    payload = filepath.read_bytes()
    checksum = hashlib.sha256(payload).hexdigest()
    if expected_sha256 is not None:
        if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
            raise ValueError("Expected SHA-256 must be exactly 64 lowercase hexadecimal characters.")
        if checksum != expected_sha256:
            raise ValueError("Export checksum differs from the owner-provided expected SHA-256: STOP.")
    migrations, migration_sha = migration_baseline()
    canonical = expected_schema(migrations)
    db = sqlite3.connect(":memory:")
    try:
        db.enable_load_extension(False)
        db.set_authorizer(sql_authorizer)
        # No disk database is created. Any export that attempts to ATTACH,
        # access a non-approved PRAGMA, or load SQLite extensions is refused.
        db.executescript(payload.decode("utf-8-sig"))
        db.execute("PRAGMA query_only=ON")
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        fk_violations = db.execute("SELECT COUNT(*) FROM pragma_foreign_key_check").fetchone()[0]
        journal = [r[0] for r in db.execute(
            "SELECT name FROM d1_migrations ORDER BY id").fetchall()]
        expected_names = [f.name for f in migrations]
        identical_journal = journal == expected_names
        matching_schema = schema_inventory(db) == canonical
        next_index_count = db.execute("""
          SELECT COUNT(*) FROM sqlite_master WHERE type='index'
            AND name=? AND tbl_name='payments'
        """, (NEXT_INDEX,)).fetchone()[0]
        ledger = read_only_ledger_counts(db)
        checks = {
            "sqliteIntegrityClean": integrity == "ok",
            "foreignKeysClean": fk_violations == 0,
            "baselineJournalExactly0000Through0021": identical_journal,
            "applicationSchemaMatchesCandidatePre0022": matching_schema,
            "nextMigrationIndexAbsent": next_index_count == 0,
            "fourFinancialLedgerAnomalyCountsZero": ledger == [0,0,0,0],
        }
        return {
            "target": TARGET,
            "assertedD1DatabaseUuid": D1_DATABASE_UUID,
            "offlineRestorationValidated": all(checks.values()),
            "checks": checks,
            "expectedBaselineMigrationCount": len(migrations),
            "candidateMigrationSourceDigestSha256": migration_sha,
            "ownerExportSha256": checksum,
            "ownerExportBytes": len(payload),
            "suppliedExpectedExportHashMatched": expected_sha256 is not None,
            "ownerExportSourceIndependentlyAuthenticated": False,
            "exportCompletenessAgainstLiveDatabaseVerified": False,
            "remoteDataModified": False,
            "migrationAuthorized": False,
            "releaseGateAccepted": False,
            "officialReleaseReadinessPercent": 30,
            "explanation": ("Offline disposable logical restore only. Even a clean export "
                            "cannot independently establish source provenance, current "
                            "physical backup completeness, or safe hosted migration."),
        }
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("local_d1_sql_export", type=Path,
                        help="Owner-held private .sql export; never upload to GitHub")
    parser.add_argument("--expected-sha256",
                        help="Optional independently recorded owner export hash")
    args = parser.parse_args()
    try:
        result = review_export(args.local_d1_sql_export,
                               expected_sha256=args.expected_sha256)
        print(json.dumps(result, indent=2))
        if not result["offlineRestorationValidated"]:
            sys.exit(1)
    except (ValueError, OSError, sqlite3.Error, UnicodeError) as error:
        # SQL errors can contain sensitive source text on some runtimes: NEVER
        # print raw exception content or SQL/customer data to CI or stdout.
        print(json.dumps({
            "target": TARGET, "offlineRestorationValidated": False,
            "blockedReason": type(error).__name__, "releaseGateAccepted": False,
            "officialReleaseReadinessPercent": 30
        }, indent=2))
        sys.exit(2)
