"""Read-only metadata capture of the EXISTING FIRE full-app QA D1, never a migration.

Default dry-run requires no Cloudflare access. --capture asks the owner for
the exact QA database UUID before issuing 10 pinned SELECTs. Results contain
schema/journal metadata and aggregate counts ONLY; no customer/payment rows.
The hosted Worker version is checked before and after capture. Schema drift is
reported, not masked, and does not authorize any deployment or release gate.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import shutil
import sqlite3
import sys
import tempfile

import capture_doomsday_schema_read_only as safe
from review_qa_update_schema import HISTORICAL_GIT_BLOBS, _read_sql_dir, _verify_pinned
from verify_hosted_schema_capture import statements, matches_documented_d1_reserved_table

ROOT=Path(__file__).parent
NAME="fire-fullapp-qa-db-20261016"
UUID="8ccfb1f8-1657-4074-b1b2-47de78f95003"
PROTECTED_NAME="fire-app-staging-db"
PROTECTED_UUID="afb2c05a-d794-4a9a-b580-924ce01c26ad"
WORKER="fire-fullapp-qa-20261016"
ACTIVE_VERSION="58a467fa-9dbc-45a3-971e-b5a4e478f54d"
ORIGIN="https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev"
FORMAT="fire-existing-qa-d1-readonly-v1"
MAX_BYTES=2_000_000
MAX_ROWS=4_000
BASE=ROOT/"adapters"/"doomsday"/"drizzle"

def inventory(payload):
    if not isinstance(payload,list):raise ValueError("D1 list was not an array.")
    if any(not isinstance(x,dict) or not isinstance(x.get("name"),str) or
           not isinstance(x.get("uuid"),str) for x in payload):
        raise ValueError("D1 list contains malformed identity records.")
    qa=[x for x in payload if x["name"]==NAME or x["uuid"]==UUID]
    protected=[x for x in payload if x["name"]==PROTECTED_NAME or x["uuid"]==PROTECTED_UUID]
    if (len(qa)!=1 or qa[0]["name"]!=NAME or qa[0]["uuid"]!=UUID or
        len(protected)!=1 or protected[0]["name"]!=PROTECTED_NAME or protected[0]["uuid"]!=PROTECTED_UUID or
        UUID==PROTECTED_UUID):
        raise ValueError("QA or protected staging D1 identity is absent, duplicated or changed.")

def deployment(payload):
    if not isinstance(payload,dict) or not isinstance(payload.get("versions"),list):
        raise ValueError("QA Worker deployment metadata missing.")
    versions=payload["versions"]
    if len(versions)!=1 or not isinstance(versions[0],dict):
        raise ValueError("QA Worker has split or unknown serving versions.")
    current=versions[0]
    if current.get("version_id")!=ACTIVE_VERSION or type(current.get("percentage")) not in (int,float) or current["percentage"]!=100:
        raise ValueError("QA Worker serving version differs from pinned, sole 100% version.")
    return current["version_id"]

def rows(payload,index):
    if not isinstance(payload,list) or len(payload)!=1 or not isinstance(payload[0],dict):
        raise ValueError(f"Remote SELECT {index}/10 returned unexpected envelope.")
    entry=payload[0]
    if entry.get("success") is not True or not isinstance(entry.get("results"),list):
        raise ValueError(f"Remote SELECT {index}/10 did not succeed.")
    result=entry["results"]
    if len(result)>MAX_ROWS or any(not isinstance(x,dict) or set(x)!=safe.COLUMNS[index-1] for x in result):
        raise ValueError(f"Remote SELECT {index}/10 returned unreviewed fields or too many rows.")
    if index<=4 and not result:
        raise ValueError(f"Remote SELECT {index}/10 omitted expected schema metadata.")
    if index==5:
        names=[x["name"] for x in result]
        if len(names)>100 or len(names)!=len(set(names)) or any(not isinstance(n,str) or not re.fullmatch(r"\d{4}_[a-z0-9_]+\.sql",n) for n in names):
            raise ValueError("QA migration journal malformed; no evidence accepted.")
    if index>=6 and (len(result)!=1 or type(next(iter(result[0].values()))) is not int or next(iter(result[0].values()))<0):
        raise ValueError(f"Remote SELECT {index}/10 expected one nonnegative aggregate count.")
    return result

def local_baseline():
    files=_read_sql_dir(BASE,"pinned QA baseline")
    first={k:v for k,v in files.items() if k in HISTORICAL_GIT_BLOBS}
    _verify_pinned(first,HISTORICAL_GIT_BLOBS,"pinned QA baseline")
    with sqlite3.connect(":memory:") as db:
        db.row_factory=sqlite3.Row
        for filename in sorted(HISTORICAL_GIT_BLOBS):
            db.executescript(first[filename].decode("utf-8"))
        db.execute("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
        db.executemany("INSERT INTO d1_migrations(name) VALUES(?)",((n,) for n in sorted(HISTORICAL_GIT_BLOBS)))
        db.commit()
        db.execute("PRAGMA query_only=ON")
        return [[dict(x) for x in db.execute(sql)] for sql in statements()]

def compare_capture(captured):
    if not isinstance(captured,dict) or set(captured)!={"format","qaWorker","qaDatabase","qaUuid","activeVersion","capturedAt","providerSourceAttested","truncated","queries"}:
        raise ValueError("Capture contains unreviewed fields or is incomplete.")
    if (captured["format"]!=FORMAT or captured["qaWorker"]!=WORKER or
        captured["qaDatabase"]!=NAME or captured["qaUuid"]!=UUID or
        captured["activeVersion"]!=ACTIVE_VERSION or captured["providerSourceAttested"] is not False or
        captured["truncated"] is not False):
        raise ValueError("QA identity or completeness mismatch.")
    queries=captured["queries"]
    if not isinstance(queries,list) or len(queries)!=10:
        raise ValueError("Missing expected ten metadata-only queries.")
    expected=local_baseline()
    issues=[]
    for i,query in enumerate(queries,1):
        if not isinstance(query,dict) or set(query)!={"rows"}:
            raise ValueError("Unreviewed query field or customer data.")
        actual=rows([{"success":True,"results":query["rows"]}],i)
        if actual!=expected[i-1] and not (
            i==1 and matches_documented_d1_reserved_table(actual,expected[i-1])
        ):
            issues.append(f"QUERY_{i:02}_DIFFERS_FROM_ORIGINAL_23")
    return {
        "result":"ORIGINAL_QA_23_SCHEMA_MATCHES_LOCAL_PINNED_BASELINE" if not issues else "QA_SCHEMA_DRIFT_REQUIRES_REVIEW",
        "observedMigrationNames":[x["name"] for x in queries[4]["rows"]],
        "original23MigrationCount":len(HISTORICAL_GIT_BLOBS),
        "metadataMatchesOriginal23":not issues,
        "blockers":issues,
        "remoteSourceAttested":False,
        "hostedMigrationAuthorized":False,
        "codeUpdateAuthorized":False,
        "ownerApprovalCaptured":False,
        "customerRowsOrPaymentDetailsCollected":False,
    }

def capture(wrangler,query_set,folder):
    if not folder.is_dir() or folder.is_symlink():
        raise ValueError("Existing private, non-linked capture folder is required.")
    inventory(safe.checked_cli_stage(wrangler,["d1","list","--json"],"Preflight QA D1 list"))
    deployed=deployment(safe.checked_cli_stage(wrangler,["deployments","status","--name",WORKER,"--json"],"Preflight QA Worker"))
    with tempfile.TemporaryDirectory(prefix="fire-qa-meta-") as tmp:
        config=Path(tmp)/"wrangler.json"
        config.write_text(json.dumps({"name":"fire-qa-readonly-capture",
            "compatibility_date":"2026-10-16",
            "d1_databases":[{"binding":"DB","database_name":NAME,"database_id":UUID}]}),encoding="utf-8")
        results=[]
        for i,sql in enumerate(query_set,1):
            reply=safe.checked_cli_stage(wrangler,["d1","execute",NAME,"--remote","--json",
                "--config",str(config),"--command",safe.cli_safe_statement(sql)],f"QA metadata SELECT {i}/10")
            results.append({"rows":rows(reply,i)})
    inventory(safe.checked_cli_stage(wrangler,["d1","list","--json"],"Final QA D1 list"))
    if deployment(safe.checked_cli_stage(wrangler,["deployments","status","--name",WORKER,"--json"],"Final QA Worker"))!=deployed:
        raise ValueError("QA Worker changed while metadata was being captured.")
    receipt={
        "format":FORMAT,"qaWorker":WORKER,"qaDatabase":NAME,"qaUuid":UUID,
        "activeVersion":deployed,"capturedAt":datetime.now(timezone.utc).isoformat(),
        "providerSourceAttested":False,"truncated":False,"queries":results,
    }
    review=compare_capture(receipt)
    serialized=json.dumps({"capture":receipt,"review":review},indent=2,ensure_ascii=True)
    if len(serialized.encode("utf-8"))>MAX_BYTES:
        raise ValueError("Metadata packet too large: refusing possible sensitive information.")
    dest=folder/("FIRE-EXISTING-QA-SCHEMA-ONLY-"+datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")+".json")
    with dest.open("x",encoding="utf-8") as stream:
        stream.write(serialized+"\n")
    return dest,review

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture",action="store_true",help="Explicit read-only remote schema query on original owner Windows")
    parser.add_argument("--folder",type=Path,default=Path.home()/"FIRE-Private-Backups")
    opts=parser.parse_args()
    try:
        queries=safe.reviewed_statements(ROOT/"RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql")
        if queries!=statements():raise ValueError("Reviewed SQL differs from expected local query list.")
        local_baseline()
        print("FIRE QA existing-schema review: exact Worker "+WORKER+" and D1 "+NAME)
        print("10 pinned SELECT-only queries. No migration, deployment or customer-row reads.")
        if not opts.capture:
            print("DRY RUN: no Cloudflare access or file write. Explicit --capture required.")
            return 0
        wrangler=shutil.which("wrangler.cmd")
        if not wrangler:raise ValueError("Original Windows Wrangler authentication required.")
        approval=input("To READ QA metadata only, type CAPTURE "+UUID+": ")
        if approval!="CAPTURE "+UUID:raise ValueError("Exact read-only capture consent not provided.")
        path,report=capture(wrangler,queries,opts.folder)
        print("QA metadata packet saved privately: "+str(path))
        print("Original 23 migration schema matches:",report["metadataMatchesOriginal23"])
        print("Blockers:",report["blockers"])
        print("No migration approval, Worker update, device acceptance or release gate advanced.")
        return 0
    except (ValueError,RuntimeError,OSError,UnicodeError) as error:
        print("FIRE QA CAPTURE BLOCKED: "+str(error),file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
