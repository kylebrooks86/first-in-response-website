"""Read-only source rehearsal of QA's pinned 23 -> 25 additive SQLite migration.

No Cloudflare API, Wrangler, secrets, network, hosted database, or file writes.
All application and migration operations are inside one disposable in-memory DB.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from review_qa_update_schema import (review, QAReviewStop, HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS)

SYNTHETIC_ESTIMATE = "synthetic-qa-existing-estimate"
SYNTHETIC_CUSTOMER = "synthetic-qa-existing-customer"
EVENT_ID = "00000000-0000-4000-8000-0000000000ba"

def _canonical(rows):
    return [dict(row) for row in rows]

def _archive_hash(event_id: str, total: int, deposit: int, scope: str, agreement: str) -> str:
    serialized = json.dumps({
        "format": "deposit-exception-v1", "eventId": event_id, "totalCents": total,
        "depositCents": deposit, "mode": "waive", "scope": scope, "terms": agreement
    }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()

def _apply(db: sqlite3.Connection, directory: Path, names: list[str]):
    for name in names:
        db.executescript((directory / name).read_text(encoding="utf-8"))

def rehearse(baseline: Path, candidate: Path, checkpoint: str) -> dict:
    packet = review(baseline, candidate, checkpoint)
    if packet["originalSqlCount"] != 23 or packet["candidateSqlCount"] != 25:
        raise QAReviewStop("Unreviewed QA migration counts")
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    try:
        db.execute("PRAGMA foreign_keys=ON")
        if db.execute("PRAGMA foreign_keys").fetchone()[0] != 1:
            raise QAReviewStop("SQLite foreign key enforcement unavailable")
        _apply(db, baseline, sorted(HISTORICAL_GIT_BLOBS))
        db.execute("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)",
                   (SYNTHETIC_CUSTOMER, "Existing synthetic QA customer", "2026-10-19"))
        db.execute("""INSERT INTO estimates(id,customer_id,status,subtotal_cents,
                   discount_cents,total_cents,deposit_cents,created_at)
                   VALUES(?,?,'sent',14000,0,14000,7000,?)""",
                   (SYNTHETIC_ESTIMATE, SYNTHETIC_CUSTOMER, "2026-10-19"))
        db.commit()
        # Every existing D1 table's contents, SQL definition, trigger and index
        # must remain unchanged by strictly additive new migrations.
        existing = _canonical(db.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"))
        old_tables = [row["name"] for row in existing if row["type"] == "table"]
        before = {name: _canonical(db.execute('SELECT * FROM "'+name+'" ORDER BY rowid'))
                  for name in old_tables}
        for name in sorted(NEW_GIT_BLOBS):
            db.executescript((candidate / name).read_text(encoding="utf-8"))
        actual_objects = _canonical(db.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"))
        original_after = [o for o in actual_objects if o["name"] in {x["name"] for x in existing}]
        if original_after != existing:
            raise QAReviewStop("Migration rewrote an existing SQL table, index or trigger")
        if any(_canonical(db.execute('SELECT * FROM "'+name+'" ORDER BY rowid')) != before[name]
               for name in old_tables):
            raise QAReviewStop("Migration changed existing customer, estimate or system rows")
        new_names = {o["name"] for o in actual_objects} - {o["name"] for o in existing}
        required_new = {
            "deposit_policy_events", "idx_deposit_policy_events_estimate_time",
            "deposit_policy_events_no_update", "deposit_policy_events_no_delete",
            "deposit_agreement_snapshots", "idx_deposit_agreement_snapshots_estimate",
            "deposit_agreement_snapshots_no_update", "deposit_agreement_snapshots_no_delete",
        }
        if new_names != required_new:
            raise QAReviewStop("Unexpected schema object additions: "+repr(sorted(new_names ^ required_new)))
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise QAReviewStop("Pre-existing foreign key relationships became invalid")
        db.execute("""INSERT INTO deposit_policy_events(
                   id,estimate_id,confirmation_id,actor_email,mode,
                   previous_total_cents,previous_deposit_cents,new_deposit_cents,
                   paid_principal_cents,created_at)
                   VALUES(?,?,?,'synthetic-owner','waive',14000,7000,0,0,?)""",
                   (EVENT_ID,SYNTHETIC_ESTIMATE,"synthetic-qa-confirmation","2026-10-19T12:00:00Z"))
        scope = json.dumps([["line-1","House wash","Synthetic existing customer",
                             1,"job",14000]],separators=(",",":"))
        agreement = "First In Response Exteriors synthetic signed agreement. Scope and amount remain unchanged."
        digest = _archive_hash(EVENT_ID,14000,0,scope,agreement)
        version = "deposit-exception-v1:"+EVENT_ID
        db.execute("""INSERT INTO deposit_agreement_snapshots(
                   event_id,estimate_id,document_version,document_digest,total_cents,
                   deposit_cents,mode,scope_json,agreement_text,signed_name,photo_release,
                   signed_at,accepted_at)
                   VALUES(?,?,?,?,14000,0,'waive',?,?,'Synthetic Customer','no',?,?)""",
                   (EVENT_ID,SYNTHETIC_ESTIMATE,version,digest,scope,agreement,
                    "2026-10-19T13:00:00Z","2026-10-19T13:00:00Z"))
        db.commit()
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise QAReviewStop("Signed document foreign key integrity failed")
        if len(digest) != 64 or len(db.execute(
            "SELECT document_digest FROM deposit_agreement_snapshots").fetchone()[0]) != 64:
            raise QAReviewStop("Signed document hash was not preserved")
        mutation_refusals=0
        for sql,params in [
            ("UPDATE deposit_policy_events SET actor_email='forged' WHERE id=?",(EVENT_ID,)),
            ("DELETE FROM deposit_policy_events WHERE id=?",(EVENT_ID,)),
            ("UPDATE deposit_agreement_snapshots SET signed_name='forged' WHERE event_id=?",(EVENT_ID,)),
            ("DELETE FROM deposit_agreement_snapshots WHERE event_id=?",(EVENT_ID,)),
        ]:
            try:
                db.execute(sql, params)
            except sqlite3.IntegrityError:
                mutation_refusals+=1
            else:
                raise QAReviewStop("An immutable financial/signed document row was writable")
        if mutation_refusals != 4:
            raise QAReviewStop("Append-only protections incomplete")
        if any(_canonical(db.execute('SELECT * FROM "'+name+'" ORDER BY rowid')) != before[name]
               for name in old_tables):
            raise QAReviewStop("Synthetic event writes changed earlier customer or estimate rows")
        if db.execute("SELECT COUNT(*) FROM deposit_policy_events").fetchone()[0] != 1 or (
           db.execute("SELECT COUNT(*) FROM deposit_agreement_snapshots").fetchone()[0] != 1):
            raise QAReviewStop("Unexpected newly signed rows or duplicates")
        return {
            **packet,
            "result": "LOCAL_SYNTHETIC_ADDENDUM_REHEARSAL_PASSED_REMOTE_STILL_BLOCKED",
            "historicalSchemaDefinitionsPreserved": len(existing),
            "historicalTablesWithUnchangedRows": len(old_tables),
            "additionalSqlObjects": sorted(new_names),
            "appendOnlyMutationRefusals": mutation_refusals,
            "syntheticCustomerAndEstimatePreserved": True,
            "syntheticSignedDocumentSHA256Verified": True,
            "syntheticOnly": True,
            "remoteSchemaVerified": False,
            "codeOnlyUpdateEligible": False,
            "migrationPermissionGranted": False,
            "publicationAuthorized": False,
        }
    except sqlite3.DatabaseError as failure:
        raise QAReviewStop("Disposable SQLite rehearsal failed: "+str(failure)) from failure
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--checkpoint", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(args.baseline,args.candidate,args.checkpoint),
                         sort_keys=True,indent=2))
    except QAReviewStop as error:
        parser.exit(2,"FIRE QA SHADOW MIGRATION STOP: "+str(error)+"\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
