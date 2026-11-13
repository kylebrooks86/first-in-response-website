#!/usr/bin/env python3
"""Local-only FIRE DR/NEW LIVE D1 SQL -> encrypted complete .firerecords bridge.

Input: an ALREADY OWNER-SAVED full Wrangler D1 SQL export from the correct,
independently reviewed 26-migration DR/NEW LIVE database. This module NEVER
runs Wrangler, authenticates, exports remotely, migrates, restores remotely,
provisions resources or changes payments.

On the owner-controlled private local drive only: replay the SQL in an
in-memory SQLite connection with dangerous operations blocked, require the
exact 26 source-pinned applied migration IDs/names and core/refund tables,
make a brief owner-only temporary SQLite file, and call the pre-existing
AES-256-GCM .firerecords sealing code using a NON-ECHOING stdin passphrase.
The temporary local plaintext SQLite is unlinked in finally. Deletion does
NOT prove SSD secure erase. The pre-existing owner SQL dump is untouched.

No .firephotos or off-device custody is supplied by this bridge. Passing
here does not close Gate 7 or prove Cloudflare provenance/completeness.
"""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.resolve()
MAX_SQL = 128 * 1024 * 1024
REQUIRED_TABLES = frozenset({
    "customers", "estimates", "payments", "payment_refunds",
    "fire_customer_numbers", "fire_job_numbers", "fire_job_estimate_links",
    "d1_migrations",
})


class LocalBridgeStop(ValueError):
    pass


def stop(reason):
    raise LocalBridgeStop(reason)


def reviewed_migrations():
    """Read the one shared JS source-pinned NEW LIVE sequence, not a guessed list."""
    manifest = (BASE / "shared/lib/new-live-migration-journal.mjs").read_text("utf-8")
    match = re.search(r"EXPECTED_NEW_LIVE_D1_MIGRATIONS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)", manifest)
    if not match:
        stop("source-pinned independent migration list unavailable")
    names = re.findall(r'"(\d{4}_[a-z0-9_]+\.sql)"', match.group(1))
    actual = sorted(p.name for p in (BASE / "adapters/doomsday/drizzle").glob("[0-9][0-9][0-9][0-9]_*.sql"))
    if (len(names) != 26 or len(set(names)) != 26 or len(actual) != 25
        or names[:-1] != actual or names[-1] != "0025_independent_permanent_numbers.sql"
        or names[0] != "0000_wise_namora.sql"):
        stop("the reviewed independent 26-migration lineage is incomplete or modified")
    return names


def expected_application_objects(migrations):
    """Real reviewed SQL, independently replayed; a filtered export is NOT full."""
    baseline = sqlite3.connect(":memory:")
    try:
        baseline.execute(
            "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "name TEXT NOT NULL UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"
        )
        for i, name in enumerate(migrations, 1):
            path = (BASE / "adapters/doomsday/drizzle" / name if i <= 25 else
                    BASE / "adapters/independent-live/drizzle" / name)
            # #0025 explicitly aborts if the provider's 25 older migration
            # journal entries are absent. Rehearse them in reviewed order,
            # exactly as the existing independent-DR integration fixture does.
            baseline.executescript(path.read_text("utf-8"))
            baseline.execute(
                "INSERT INTO d1_migrations(id,name) VALUES (?,?)", (i, name)
            )
        # Object names alone are insufficient: a forged dump can preserve
        # six permanent-number trigger NAMES while replacing their SQL with
        # a no-op. Compare original CREATE SQL for every reviewed object.
        return {(kind, name, table): ddl for kind, name, table, ddl in baseline.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE type IN ('table','index','trigger','view') "
            "AND lower(substr(name,1,7)) <> 'sqlite_'"
        )}
    finally:
        baseline.close()


def sql_authorizer(action, arg1, arg2, database, trigger):
    if database not in (None, "main"):
        return sqlite3.SQLITE_DENY
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
        return sqlite3.SQLITE_DENY
    if action in (sqlite3.SQLITE_CREATE_VTABLE, sqlite3.SQLITE_DROP_VTABLE):
        return sqlite3.SQLITE_DENY  # the reviewed 26-table lineage uses no virtual tables
    if action == sqlite3.SQLITE_FUNCTION and str(arg2 or arg1).lower() in (
        "load_extension", "readfile", "writefile"
    ):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA and str(arg1 or "").lower() not in (
        "foreign_keys", "defer_foreign_keys", "recursive_triggers",
        "integrity_check", "foreign_key_check"
    ):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def private_paths(sql_path, output_path):
    source = Path(sql_path)
    dest = Path(output_path)
    if (source.suffix.lower() != ".sql" or not source.is_file()
        or source.is_symlink() or not stat.S_ISREG(source.stat().st_mode)
        or source.stat().st_nlink != 1):
        stop("source must be one existing regular, nonlinked private SQL file")
    if not 0 < source.stat().st_size <= MAX_SQL:
        stop("full owner SQL export is missing or exceeds the bounded local limit")
    if dest.suffix.lower() != ".firerecords" or dest.exists() or dest.is_symlink():
        stop("encrypted output must be a new, absent .firerecords file")
    folder = dest.parent
    if not folder.is_dir() or folder.is_symlink():
        stop("encrypted output folder must already exist without a link")
    if dest.resolve() == source.resolve() or folder.resolve() == REPO or REPO in folder.resolve().parents:
        stop("input/output overlap or private backup would be saved inside Git")
    if source.resolve() == REPO or REPO in source.resolve().parents:
        stop("private SQL must never be kept inside Git")
    return source, dest, folder


def verified_memory_sqlite(source, expected_hash, migrations):
    if not re.fullmatch(r"[a-f0-9]{64}", expected_hash or ""):
        stop("owner-reviewed SQL SHA-256 is mandatory (64 lowercase hex)")
    data = source.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected_hash:
        stop("saved SQL checksum differs from the owner-reviewed input")
    try:
        sql = data.decode("utf-8-sig")
    except UnicodeError:
        stop("D1 export is not valid UTF-8 SQL")
    db = sqlite3.connect(":memory:")
    try:
        db.enable_load_extension(False)
        db.set_authorizer(sql_authorizer)
        db.executescript(sql)
        if db.in_transaction:
            stop("source SQL left an open transaction")
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            stop("imported full SQL has failed SQLite integrity")
        if db.execute("PRAGMA foreign_key_check").fetchall():
            stop("imported full SQL has broken customer/financial foreign keys")
        tables = {row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        if not REQUIRED_TABLES.issubset(tables):
            stop("full independent Customer/Job/refund records schema is missing")
        # A D1 --table/--no-schema-filtered SQL export can still contain
        # d1_migrations and our key tables. Demand every reviewed table,
        # index and trigger, not just the journal and selected rows.
        actual_objects = {(kind, name, table): ddl for kind, name, table, ddl in db.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE type IN ('table','index','trigger','view') "
            "AND lower(substr(name,1,7)) <> 'sqlite_'"
        )}
        if actual_objects != expected_application_objects(migrations):
            stop("D1 SQL export omits or alters reviewed table/index/trigger definitions")
        journal = db.execute(
            'SELECT id,name FROM "d1_migrations" ORDER BY id'
        ).fetchall()
        if journal != list(enumerate(migrations, 1)):
            stop("export lacks the exact ordered 26 independently applied migrations")
        serial = db.execute(
            "SELECT seq FROM sqlite_sequence WHERE name='d1_migrations'"
        ).fetchone()
        if serial is None or serial[0] != 26:
            stop("independent applied migration AUTOINCREMENT high-water differs")
        # Accept a valid empty NEW LIVE before business launch, but NEVER
        # present this local count as provider-completeness attestation.
        customer_count = db.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        return db, digest, customer_count
    except Exception:
        db.close()
        raise


def seal_saved_full_sql_export(sql_path, output_path, expected_hash, phrase,
                               *, acknowledged_private_folder=False, node="node"):
    if not acknowledged_private_folder:
        stop("an owner-controlled private local storage folder must be acknowledged")
    if not isinstance(phrase, str) or not 16 <= len(phrase) <= 1024 or len(phrase.encode("utf-8")) > 4096:
        stop("private recovery phrase must be 16–1024 characters")
    source, output, private_folder = private_paths(sql_path, output_path)
    migrations = reviewed_migrations()
    db = None
    temporary = None
    try:
        db, input_hash, customers = verified_memory_sqlite(source, expected_hash, migrations)
        fd, temporary = tempfile.mkstemp(
            prefix=".fire-transient-owner-records-", suffix=".sqlite", dir=private_folder
        )
        try:
            # Python <3.13 on Windows has no os.fchmod. Windows file
            # access follows the explicitly private folder's inherited ACL;
            # Unix additionally enforces 0600. Neither proves encryption.
            if os.name != "nt":
                os.fchmod(fd, 0o600)
        finally:
            os.close(fd)
        # This file is unencrypted only INSIDE the acknowledged private folder.
        # No SQL or records are ever printed, uploaded, or put under Git.
        local = sqlite3.connect(temporary)
        try:
            db.backup(local)
            local.commit()
        finally:
            local.close()
        db.close()
        db = None
        node_script = BASE / "protected_complete_isolated_sqlite_recovery.mjs"
        result = subprocess.run(
            [node, "--experimental-sqlite", str(node_script), "seal", temporary, str(output)],
            input=phrase + "\n", text=True, capture_output=True, timeout=120,
            check=False,
        )
        if result.returncode != 0:
            stop("local encrypted-record sealing failed; no accepted backup")
        try:
            receipt = json.loads(result.stdout)
        except (ValueError, TypeError):
            stop("encrypted record receipt was malformed")
        if (receipt.get("encryptedRecordsArchiveCreated") is not True
            or receipt.get("savedEncryptedFileReadBack") is not True
            or receipt.get("plaintextJsonFilesWritten") is not False
            or receipt.get("remoteWritesPerformed") is not False
            or receipt.get("gate7Accepted") is not False
            or not output.is_file()):
            stop("existing encrypted-record sealing contract failed")
        verified_digest = hashlib.sha256(output.read_bytes()).hexdigest()
        if verified_digest != receipt.get("protectedFileSha256"):
            stop("saved ciphertext differs from existing sealed receipt")
        return {
            "format": "fire-local-26-d1-sql-to-encrypted-records-v1",
            "protectedRecordsCreatedAndReadBack": True,
            "sourceSqlSha256": input_hash,
            "protectedRecordsSha256": verified_digest,
            "reviewedMigrationCount": len(migrations),
            "localCustomerRowsObserved": customers,
            "originalSqlUnmodified": hashlib.sha256(source.read_bytes()).hexdigest() == input_hash,
            "transientLocalSqliteDeleted": True,  # by finally before caller returns
            "ssdSecureEraseProven": False,
            "plaintextJsonIntermediatesWritten": False,
            "sourceCloudflareOriginVerified": False,
            "sourceProviderCompletenessVerified": False,
            "encryptedOffDeviceCustodyVerified": False,
            "remoteWritesPerformed": False,
            "gate7Accepted": False,
        }
    finally:
        if db is not None:
            db.close()
        if temporary is not None:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("private_full_d1_sql")
    ap.add_argument("new_encrypted_firerecords")
    ap.add_argument("--expected-sha256", required=True)
    ap.add_argument("--acknowledge-private-folder", action="store_true")
    args = ap.parse_args()
    try:
        if sys.stdin.isatty():
            phrase = getpass.getpass("Private FIRE records recovery phrase (not echoed): ")
        else:
            phrase = sys.stdin.readline(4097).rstrip("\r\n")
        result = seal_saved_full_sql_export(
            args.private_full_d1_sql, args.new_encrypted_firerecords,
            args.expected_sha256, phrase,
            acknowledged_private_folder=args.acknowledge_private_folder,
        )
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        # No owner filenames, contact information, SQL, secret or temp path.
        print("FIRE private 26-migration D1 SQL sealing BLOCKED; no cloud operation.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
