"""Read-only FIRE Job # legacy-history preflight.

Never writes a hosted database, uploads an export, prints customer/estimate IDs
or returns a migration script. A private owner-only .sql export is restored to a
temporary in-memory SQLite DB and validated; it is never modified on disk.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import sys

PREFIX='fire:quote-revision:v1:'

class HistoryBlocked(ValueError):
    pass

def require(ok,reason):
    if not ok: raise HistoryBlocked(reason)

def parse_date(value):
    require(isinstance(value,str) and value.strip(),'Missing creation date')
    try:
        date=datetime.fromisoformat(value.replace('Z','+00:00'))
        require(date.tzinfo is not None,'Creation date has no timezone')
        return date.timestamp()
    except ValueError:
        raise HistoryBlocked('Invalid creation timestamp') from None

def table_columns(db,table):
    return {row[1] for row in db.execute('PRAGMA table_info("'+table+'")')}

def analyze(db):
    require({'id','customer_id','created_at','status'} <= table_columns(db,'estimates'),'Missing required estimates schema')
    require({'key','body'} <= table_columns(db,'message_templates'),'Missing revision audit schema')
    require(not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('fire_job_numbers','fire_job_estimate_links') LIMIT 1").fetchone(),
            'Job # schema already present: backfill requires separate reconciliation')
    rows=db.execute('SELECT id,customer_id,created_at,status FROM estimates').fetchall()
    require(len(rows)<=200000,'Unexpected number of estimates')
    estimates={}
    for identity,customer,when,status in rows:
        require(isinstance(identity,str) and identity.strip() and identity not in estimates,'Duplicate or empty estimate ID')
        require(isinstance(customer,str) and customer.strip(),'Estimate without customer')
        require(isinstance(status,str) and status.strip(),'Estimate without status')
        estimates[identity]=(customer,parse_date(when),status)
    parents={};children={}
    for key,body in db.execute("SELECT key,body FROM message_templates WHERE substr(key,1,?)=?", (len(PREFIX),PREFIX)):
        require(isinstance(key,str) and isinstance(body,str) and len(body)<200000,
                'Invalid quote replacement audit')
        try:
            audit=json.loads(body)
        except (ValueError,TypeError):
            raise HistoryBlocked('Malformed quote replacement audit') from None
        require(type(audit) is dict and audit.get('version')==1,'Unrecognized quote replacement audit')
        original=audit.get('originalId');new=audit.get('replacementId')
        require(isinstance(original,str) and isinstance(new,str) and original!=new and key==PREFIX+original,
                'Conflicting replacement audit identifiers')
        require(original in estimates and new in estimates,'Quote replacement with missing estimate')
        require(estimates[original][0]==estimates[new][0], 'Quote replacement spans two customers')
        require(estimates[original][1]<=estimates[new][1], 'Quote replacement predates the original')
        require(original not in children and new not in parents,'Forked, duplicate or convergent replacement')
        parents[new]=original;children[original]=new
    require(all(status!='superseded' or ident in children for ident,(_,_,status) in estimates.items()),
            'Superseded estimate missing an auditable replacement')
    roots={}
    for identity in estimates:
        ancestors=set();node=identity
        while node in parents:
            require(node not in ancestors,'Cyclic quote replacement chain')
            ancestors.add(node);node=parents[node]
        require(node not in ancestors,'Cyclic quote replacement chain')
        roots[identity]=node
    original_ids=sorted(set(roots.values()),key=lambda id:(estimates[id][1],id))
    position={id:i+1 for i,id in enumerate(original_ids)}
    # The plan stays inside caller memory; never publish identifiers in logs.
    mapping={id:position[root] for id,root in roots.items()}
    complete={mapping[id] for id,(_,_,status) in estimates.items() if status=='completed'}
    return {
        'estimateCount':len(estimates),
        'distinctJobs':len(original_ids),
        'revisionLinks':len(parents),
        'completedJobs':len(complete),
        'canceledOrDeclinedEstimates':sum(status in ('declined','cancelled','canceled') for _,_,status in estimates.values()),
        'historicalNumberAssignmentProposedOnly':True,
        'remoteD1Changed':False,
        'deployedAppChanged':False,
        'mapping':mapping
    }

def read_export(path):
    file=Path(path)
    require(file.is_file() and not file.is_symlink() and 0<file.stat().st_size<=100000000,
            'Private export missing, unsafe or too large')
    db=sqlite3.connect(':memory:')
    try:
        db.set_authorizer(lambda op,a,b,c,d: sqlite3.SQLITE_DENY if op in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH) else sqlite3.SQLITE_OK)
        try:
            db.executescript(file.read_text(encoding='utf-8-sig'))
        except (sqlite3.Error,UnicodeError):
            raise HistoryBlocked('Private export could not be restored in memory') from None
        require(db.execute('PRAGMA integrity_check').fetchone()==('ok',),'Private export failed integrity check')
        return analyze(db)
    finally:
        db.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql-export',required=True,help='Owner-held private SQL file on current machine; never upload')
    args=parser.parse_args()
    try:
        result=read_export(args.sql_export)
        result.pop('mapping',None)
        print(json.dumps(result,indent=2))
    except (HistoryBlocked,sqlite3.Error,OSError) as e:
        # Never print SQLite SQL, DB values, archive paths, or any exception details
        print('BLOCKED: private Job # history needs review before any migration',file=sys.stderr)
        sys.exit(1)
