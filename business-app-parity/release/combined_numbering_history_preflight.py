"""FIRE combined Customer # + Job # source-only PRIVATE rehearsal.

Default invocation reads NO file and contacts NO provider. The opt-in
--inspect --sql-export path restores an owner-held private SQL export only into
an in-memory SQLite instance. Its normalized output is COUNTS ONLY; neither
IDs, names, payment information, SQL, receipt paths nor identifiers leave
the owner's computer.

This is NOT a numbered v2 backup/restore, hosted migration, deployment,
approval, or production release gate acceptance.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys

BASE=Path(__file__).resolve().parents[1]
NUMBER_TABLES=frozenset(('fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'))
MAX_SQL_BYTES=100_000_000

def _import_source(label,relative_path):
    spec=importlib.util.spec_from_file_location(label, BASE/relative_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Numbering preflight source is unavailable")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

CUSTOMER=_import_source('fire_customer_numbering_private_rehearsal','customer-numbering/preflight_customer_history.py')
JOB=_import_source('fire_job_numbering_private_rehearsal','job-numbering/preflight_job_history.py')

class CombinedHistoryBlocked(ValueError):
    pass

def require(condition,message):
    if not condition:
        raise CombinedHistoryBlocked(message)

def original_table_fingerprint(db):
    """Hash original table rows in memory; never return, store or log row values."""
    names=[r[0] for r in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ) if r[0] not in NUMBER_TABLES]
    digest=hashlib.sha256()
    counts={}
    for name in names:
        require('\\x00' not in name,'Invalid original schema name')
        escaped=name.replace('"','""')
        # Rowid order avoids requiring all historical tables to share one PK.
        # WITHOUT ROWID tables are ordered by SQLite's PRIMARY KEY.
        query='SELECT * FROM "'+escaped+'"'
        rows=db.execute(query)
        digest.update(repr((name,tuple(x[0] for x in rows.description))).encode('utf-8'))
        count=0
        for row in rows:
            # repr of SQLite's native immutable values is deterministic here,
            # with no PII ever emitted or persisted outside process memory.
            encoded=repr(tuple(row)).encode('utf-8','surrogatepass')
            digest.update(len(encoded).to_bytes(8,'big'))
            digest.update(encoded)
            count+=1
        counts[name]=count
    return names,counts,digest.digest()

def combined_rehearsal(db):
    """Verify BOTH identity systems on ONE disposable SQLite clone."""
    databases=db.execute('PRAGMA database_list').fetchall()
    require(len(databases)==1 and databases[0][2]=='',
            'Combined rehearsal requires an unattached in-memory database')
    require(not any(db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",(name,)
    ).fetchone() for name in NUMBER_TABLES),
            'Existing permanent number schema needs a separate recovery review')
    require(db.execute('PRAGMA integrity_check').fetchone()==('ok',),
            'Original SQL integrity failed')
    before=original_table_fingerprint(db)
    customer_plan=CUSTOMER.analyze(db)
    job_plan=JOB.analyze(db)
    # Fail all PRE-planning conditions before adding the first test-only table.
    require(customer_plan['historicalNumberAssignmentProposedOnly'] and
            job_plan['historicalNumberAssignmentProposedOnly'],
            'Historical identities are not ready to rehearse')
    CUSTOMER.rehearse_in_memory(db,customer_plan)
    JOB.rehearse_in_memory(db,job_plan)
    require(original_table_fingerprint(db)==before,
            'A historical non-numbered record changed during combined rehearsal')
    require(db.execute('PRAGMA foreign_key_check').fetchall()==[],
            'Combined numbering foreign-key integrity failed')
    require(db.execute('PRAGMA integrity_check').fetchone()==('ok',),
            'Combined numbering SQLite integrity failed')
    customer_count=db.execute('SELECT COUNT(*) FROM fire_customer_numbers').fetchone()[0]
    job_count=db.execute('SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0]
    link_count=db.execute('SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0]
    require(customer_count==customer_plan['historicalCustomers'] and
            job_count==job_plan['distinctJobs'] and
            link_count==job_plan['estimateCount'],
            'Combined identity coverage no longer equals original history')
    cross_customer=db.execute("""
        SELECT COUNT(*) FROM fire_job_estimate_links l
        JOIN estimates e ON e.id=l.estimate_id
        JOIN fire_job_numbers n ON n.job_number=l.job_number
        JOIN estimates root ON root.id=n.root_estimate_id
        WHERE e.customer_id<>root.customer_id
    """).fetchone()[0]
    require(cross_customer==0,'A Job # maps to more than one customer')
    root_mismatch=db.execute("""
        SELECT COUNT(*) FROM fire_job_numbers n
        LEFT JOIN fire_job_estimate_links l
          ON l.estimate_id=n.root_estimate_id AND l.job_number=n.job_number
        WHERE l.estimate_id IS NULL
    """).fetchone()[0]
    require(root_mismatch==0,'Permanent job root lost its identity link')
    seq=lambda table: next((r[0] for r in db.execute(
        "SELECT seq FROM sqlite_sequence WHERE name=?",(table,))),0)
    require(seq('fire_customer_numbers')==customer_count and
            seq('fire_job_numbers')==job_count,
            'Historical number high-water marks diverged from deterministic backfill')
    return {
        'historicalCustomers':customer_count,
        'distinctJobs':job_count,
        'estimateJobLinks':link_count,
        'quoteRevisionLinks':job_plan['revisionLinks'],
        'completedJobs':job_plan['completedJobs'],
        'originalTablesVerifiedUnchanged':len(before[0]),
        'historicalContentPreserved':True,
        'numberingInMemoryRehearsalPassed':True,
        'numberedRestoreV2Ready':False,
        'remoteD1Changed':False,
        'hostedMigrationApplied':False,
        'productionGatesClosed':0
    }

def inspect_private_export(filename):
    file=Path(filename)
    require(file.suffix.lower()=='.sql' and file.is_file() and
            not file.is_symlink() and 0<file.stat().st_size<=MAX_SQL_BYTES,
            'Private SQL export is absent, unsafe or too large')
    db=sqlite3.connect(':memory:')
    try:
        db.enable_load_extension(False)
        db.set_authorizer(lambda op,a,b,c,d:
                          sqlite3.SQLITE_DENY if op in
                          (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH)
                          else sqlite3.SQLITE_OK)
        try:
            db.executescript(file.read_text(encoding='utf-8-sig'))
        except (sqlite3.Error,UnicodeError):
            raise CombinedHistoryBlocked('Private SQL export could not be opened in memory') from None
        return combined_rehearsal(db)
    finally:
        db.close()

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inspect',action='store_true',help='Owner explicitly permits PRIVATE local-only SQL read')
    parser.add_argument('--sql-export',help='Existing owner-held .sql archive (never upload)')
    args=parser.parse_args(argv)
    if not args.inspect:
        if args.sql_export:
            parser.error('--sql-export requires explicit --inspect')
        print(json.dumps({'privateFileRead':False,'remoteD1Changed':False,
                          'hostedMigrationApplied':False,
                          'numberingEnabled':False,
                          'nextStep':'Owner-private inspection requires separate deliberate opt-in'},sort_keys=True))
        return 0
    if not args.sql_export:
        parser.error('--inspect requires --sql-export')
    try:
        result=inspect_private_export(args.sql_export)
    except (CombinedHistoryBlocked,CUSTOMER.CustomerHistoryBlocked,JOB.HistoryBlocked,
            sqlite3.Error,OSError,ValueError):
        # NEVER leak the backup path, IDs, email, customer names, SQL or exception.
        print('BLOCKED: combined private numbering preflight requires owner review',
              file=sys.stderr)
        return 1
    print(json.dumps(result,sort_keys=True))
    return 0

if __name__=='__main__':
    sys.exit(main())
