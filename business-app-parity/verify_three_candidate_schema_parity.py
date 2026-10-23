"""FIRE build-only DB compatibility gate for fresh LIVE, Doomsday and staging.

Replay each target's distinct, historically required migrations in separate
DISPOSABLE in-memory SQLite databases. Compare their FINAL schema, not filenames
or migration counts; this is necessary because Doomsday has a different journal.
This never accesses, upgrades, queries or writes remote D1 or customer records.
Passing proves source-level *fresh-install schema* equivalence, NOT hosted parity.
"""
from __future__ import annotations
import json
import re
import sqlite3
import sys
from pathlib import Path

TARGETS = ("live", "doomsday", "staging")
NAME = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")
SCHEMA_QUERY = """SELECT type,name,tbl_name,sql FROM sqlite_master
 WHERE name NOT LIKE 'sqlite_%' AND name <> 'd1_migrations'
 ORDER BY type,name,tbl_name"""
ALLOWED_ROOTS = ("drizzle",)
class SchemaParityError(ValueError):
    pass

def require(ok: bool, message: str) -> None:
    if not ok:
        raise SchemaParityError(message)

def migration_paths(candidate: Path) -> list[Path]:
    root = candidate / "drizzle"
    require(not candidate.is_symlink() and not root.is_symlink()
            and root.is_dir(), "Missing or linked target migration directory")
    files = []
    for item in root.iterdir():
        require(not item.is_symlink() and item.is_file(),
                "Unexpected directory or symlink in target migration source")
        if item.suffix == ".sql":
            require(NAME.fullmatch(item.name) is not None,
                    "Unexpected SQL migration filename: " + item.name)
            files.append(item)
    files.sort(key=lambda p: p.name)
    indexes = [int(file.name[:4]) for file in files]
    require(indexes and indexes == list(range(len(indexes))),
            "Target migration sequence must be complete and contiguous")
    return files

def normalize_sql(value: str | None) -> str | None:
    # Full SQL comparison protects constraints, CHECK expressions, partial
    # index predicates, and triggers that PRAGMA column checks would miss.
    # Keep quoted contents unchanged; collapse only plain insignificant spacing.
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip().rstrip(";")

def schema(candidate: Path) -> tuple[dict, dict]:
    files = migration_paths(candidate)
    with sqlite3.connect(":memory:") as db:
        for item in files:
            content = item.read_bytes()
            require(len(content) <= 2_000_000, "Unreviewed oversized migration")
            require(b"\0" not in content, "Null byte in migration source")
            try:
                db.executescript(content.decode("utf-8-sig"))
            except (sqlite3.Error, UnicodeError) as err:
                raise SchemaParityError(
                    f"Fresh schema migration {item.name} failed: {type(err).__name__}"
                ) from err
        db.execute("PRAGMA foreign_keys=ON")
        require(db.execute("PRAGMA integrity_check").fetchone() == ("ok",),
                "Fresh target schema integrity check failed")
        require(not db.execute("PRAGMA foreign_key_check").fetchall(),
                "Fresh target schema foreign-key check failed")
        records = db.execute(SCHEMA_QUERY).fetchall()
        require(records, "Target migrations produced no schema")
        entries = {}
        for kind, name, table, sql in records:
            require(name not in entries, "Duplicate object in target schema")
            entries[name] = {"type": kind, "table": table,
                             "sql": normalize_sql(sql)}
        tables = sorted(name for name, info in entries.items()
                        if info["type"] == "table")
        require(all(t in tables for t in ("customers", "customer_photos",
                 "estimates", "invoices", "payments", "payment_refunds",
                 "deposit_policy_events", "deposit_agreement_snapshots")),
                "Required full-app release table missing")
        # A new app has no customer records. Migration files are never allowed
        # to silently insert demo or real customer rows on a clean launch.
        seeded = [name for name in tables
                  if db.execute('SELECT COUNT(*) FROM "' + name.replace('"','""') + '"').fetchone()[0]]
        require(not seeded, "Fresh installation unexpectedly seeds business data: "
                + ",".join(seeded))
        metadata = {"migrationCount": len(files), "objectCount": len(entries),
                    "tableCount": len(tables), "initialBusinessRows": 0}
        return entries, metadata

def compare(roots: dict[str, Path]) -> dict:
    require(set(roots) == set(TARGETS), "Exactly LIVE, Doomsday and staging required")
    inventories, metadata = {}, {}
    for target in TARGETS:
        inventory, details = schema(Path(roots[target]))
        inventories[target], metadata[target] = inventory, details
    baseline = inventories["live"]
    mismatches = []
    for target in TARGETS[1:]:
        other = inventories[target]
        for key in sorted(set(baseline) | set(other)):
            if baseline.get(key) != other.get(key):
                mismatches.append({"target": target, "object": key,
                                   "reason": "missing" if key not in other
                                   else "extra" if key not in baseline
                                   else "definition-different"})
    return {"schemaEquivalent": not mismatches,
            "targets": list(TARGETS), "targetMetadata": metadata,
            "mismatches": mismatches[:40],
            "allMismatchesCount": len(mismatches),
            "migrationHistoryMustMatch": False,
            "hostedDatabasesRead": False, "remoteChangesPerformed": False,
            "productionReady": False}

def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: verify_three_candidate_schema_parity.py LIVE_CANDIDATE DOOMSDAY_CANDIDATE STAGING_CANDIDATE", file=sys.stderr)
        return 2
    try:
        result = compare(dict(zip(TARGETS, (Path(p) for p in sys.argv[1:]))))
    except (SchemaParityError, OSError) as err:
        print("FIRE FRESH INSTALL SCHEMA STOP: " + str(err), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result["schemaEquivalent"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
