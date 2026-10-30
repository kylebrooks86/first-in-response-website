"""Offline, fail-closed FIRE staging D1 22->25 migration rehearsal.

Uses only a disposable in-memory SQLite database. If --sql-export is supplied,
reads the owner-held private export locally; no export contents are printed.
Never connects to a provider, deploys a Worker, or advances release gates.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

SOURCE = Path(__file__).resolve().parent / "adapters" / "doomsday" / "drizzle"
TAIL = (
    "0022_stripe_provider_uniqueness.sql",
    "0023_deposit_policy_events.sql",
    "0024_deposit_agreement_snapshots.sql",
)
EXPECTED_OBJECTS = (
    "idx_payments_stripe_provider_unique",
    "deposit_policy_events", "idx_deposit_policy_events_estimate_time",
    "deposit_policy_events_no_update", "deposit_policy_events_no_delete",
    "deposit_agreement_snapshots", "idx_deposit_agreement_snapshots_estimate",
    "deposit_agreement_snapshots_no_update", "deposit_agreement_snapshots_no_delete",
)

class Blocked(ValueError):
    pass


def require(ok, reason):
    if not ok:
        raise Blocked(reason)


def migration_files(folder):
    require(folder.is_dir() and not folder.is_symlink(), "Unexpected source directory")
    files = sorted(p for p in folder.iterdir() if re.fullmatch(r"\d{4}_[a-z0-9_]+\.sql", p.name))
    require(len(files) == 25 and tuple(p.name for p in files[-3:]) == TAIL,
            "Reviewed 25-file Doomsday migration family changed")
    require([int(p.name[:4]) for p in files] == list(range(25)), "Migration numbers not contiguous")
    require(not any(p.is_symlink() or not p.is_file() or p.stat().st_size > 2_000_000 for p in files),
            "Unreviewed migration source type or size")
    require(not any(p.suffix == '.sql' and p not in files for p in folder.iterdir()),
            "Unexpected executable SQL source")
    return files


def ordered_journal(db):
    cols = {r[1] for r in db.execute('PRAGMA table_info(d1_migrations)')}
    require({'id', 'name'} <= cols, "No compatible D1 migration journal")
    return [r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]


def schema_objects(db):
    return {name: (kind, table, sql) for kind, name, table, sql in db.execute(
        "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name")}


def fingerprints(db):
    """Per-table complete row hashes stay in memory; only pass/fail is returned."""
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    result = {}
    for name in tables:
        quoted = '"' + name.replace('"', '""') + '"'
        columns = [r[1] for r in db.execute('PRAGMA table_info(' + quoted + ')')]
        require(bool(columns), "Unreadable table definition")
        digest = hashlib.sha256()
        entries = []
        for row in db.execute('SELECT * FROM ' + quoted):
            entries.append(json.dumps([
                {'blob': value.hex()} if isinstance(value, bytes) else value for value in row
            ], ensure_ascii=True, separators=(',', ':')))
        for item in sorted(entries):
            digest.update(item.encode('utf-8'))
            digest.update(b'\n')
        result[name] = (len(entries), digest.hexdigest(), tuple(columns))
    return result


def execute_source(db, file):
    try:
        db.executescript(file.read_text(encoding='utf-8-sig'))
    except sqlite3.Error as error:
        raise Blocked(f"Migration {file.name} failed: {type(error).__name__}") from None


def rehearse(folder=SOURCE, sql_export=None):
    files = migration_files(Path(folder))
    db = sqlite3.connect(':memory:')
    try:
        # A malicious/corrupt dump must not open a second local database.
        def authorization(operation, arg1, arg2, database, source):
            if operation in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
                return sqlite3.SQLITE_DENY
            return sqlite3.SQLITE_OK
        db.set_authorizer(authorization)
        if sql_export is not None:
            path = Path(sql_export)
            require(path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= 100_000_000,
                    "Unsafe or oversized private SQL export")
            try:
                db.executescript(path.read_text(encoding='utf-8-sig'))
            except (sqlite3.Error, UnicodeError):
                raise Blocked("Private SQL export could not be restored in memory") from None
            mode = 'owner-private-export'
        else:
            for file in files[:22]:
                execute_source(db, file)
            db.execute('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
            db.executemany('INSERT INTO d1_migrations(name) VALUES (?)', [(f.name,) for f in files[:22]])
            db.commit()
            mode = 'source-synthetic-baseline'
        require(ordered_journal(db) == [f.name for f in files[:22]],
                'Staging journal is not the exact 22-migration Doomsday prefix')
        before = fingerprints(db)
        objects_before = schema_objects(db)
        require(all(name not in objects_before for name in EXPECTED_OBJECTS),
                'Pending migration objects already exist')
        needed = ('payments', 'payment_refunds', 'payment_checkout_sessions', 'estimates')
        require(all(name in before for name in needed), 'Baseline business schema is incomplete')
        require(db.execute("SELECT COUNT(*) FROM (SELECT provider_id FROM payments "
                           "WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*' "
                           "GROUP BY provider_id HAVING COUNT(*)>1)").fetchone()[0] == 0,
                'Provider-ID collision would block unique index')
        for file in files[22:]:
            execute_source(db, file)
        db.execute('PRAGMA foreign_keys=ON')
        require(db.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'SQLite integrity failed')
        require(not db.execute('PRAGMA foreign_key_check').fetchall(), 'Foreign-key integrity failed')
        after = fingerprints(db)
        objects_after = schema_objects(db)
        require(all(objects_after.get(name) == value for name, value in objects_before.items()),
                'Preexisting schema definitions were modified')
        require(set(objects_after) - set(objects_before) == set(EXPECTED_OBJECTS),
                'Unreviewed post-upgrade schema objects appeared')
        require(all(after.get(name) == value for name, value in before.items()),
                'Existing table data/columns changed during rehearsal')
        require(ordered_journal(db) == [f.name for f in files[:22]],
                'Migration source unexpectedly modified journal in rehearsal')
        objects = {r[0] for r in db.execute('SELECT name FROM sqlite_master')}
        require(all(name in objects for name in EXPECTED_OBJECTS),
                'Post-upgrade expected index/tables/triggers missing')
        require(after['deposit_policy_events'][0] == 0 and after['deposit_agreement_snapshots'][0] == 0,
                'New audit tables unexpectedly contain rows')
        return {'rehearsalPassed': True, 'baseline': mode, 'appliedInMemory': list(TAIL),
                'preservedExistingTables': len(before), 'schemaIntegrity': True,
                'actualCloudflareD1Migrated': False, 'hostedWorkerUpdated': False,
                'privateExportReplayedInMemory': sql_export is not None, 'productionReady': False}
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql-export', help='Owner-private staging SQL backup; never uploaded')
    arguments = parser.parse_args()
    try:
        print(json.dumps(rehearse(sql_export=arguments.sql_export), indent=2))
    except (Blocked, OSError) as e:
        print('STAGING REHEARSAL BLOCKED: ' + str(e), file=sys.stderr)
        sys.exit(1)
