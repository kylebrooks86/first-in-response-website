"""Private QA SQL export: offline restore, exact 23 schema/journal and 25 rehearsal.
No network or hosted writes. Output contains checks and hashes only, never rows.
Only process trusted owner exports. A pass is not deployment authorization.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import re
import capture_existing_qa_schema_read_only as qa
from review_qa_update_schema import HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned
from verify_doomsday_d1_export import (MAX_EXPORT_BYTES, sql_authorizer,
    schema_inventory, read_only_ledger_counts)
from verify_hosted_schema_capture import matches_documented_d1_reserved_table


def expected(files, names):
    with sqlite3.connect(':memory:') as db:
        for name in names: db.executescript(files[name].decode('utf-8'))
        return schema_inventory(db)


def schema_matches(actual, wanted):
    def records(rows):
        return [dict(zip(('type','name','tbl_name','sql'),r)) for r in rows]
    return actual==wanted or matches_documented_d1_reserved_table(records(actual),records(wanted))


def data_digest(db, tables):
    # Include every value, including blobs, without logging rows or identifiers.
    def encode(value):
        return {'blob':value.hex()} if isinstance(value,bytes) else value
    digest=hashlib.sha256()
    for name in sorted(tables):
        quoted='"'+name.replace('"','""')+'"'
        rows=[json.dumps([encode(x) for x in row],ensure_ascii=True,separators=(',',':'))
              for row in db.execute('SELECT * FROM '+quoted)]
        digest.update(json.dumps([name,sorted(rows)],separators=(',',':')).encode())
    return digest.hexdigest()


class QAExportStop(ValueError):
    """Only a fixed diagnostic receipt crosses the private-data boundary."""
    def __init__(self, code, state, failure=None):
        super().__init__(code)
        engine=getattr(failure,'sqlite_errorname',None)
        self.receipt={
            'format':'fire-private-qa-restore-diagnostic-v1',
            'result':'PRIVATE_QA_RESTORE_STOP','diagnosticCode':code,
            'stage':state['stage'],'checks':dict(state['checks']),
            'failedChecks':[k for k,v in state['checks'].items() if v is False],
            'sqliteRuntimeVersion':sqlite3.sqlite_version,
            'sqliteErrorName':engine if isinstance(engine,str) and re.fullmatch(r'SQLITE_[A-Z_]+',engine) else None,
            'blockedOperation':state.get('blockedOperation'),
            'restoreStatementsObserved':state.get('restoreStatementsObserved',0),
            'offlineRestoreAndAdditiveRehearsalPassed':False,
            'hostedMigrationAuthorized':False,'publicationAuthorized':False,
            'releaseGatesPassed':3,'releaseGatesTotal':10,
        }


def review_export(path, *, expected_sha256):
    state={'stage':'INPUT','checks':{},'restoreStatementsObserved':0}
    checks=state['checks'];db=None;rollback=None
    def stop(code):raise QAExportStop(code,state)
    def stage(name):state['stage']=name
    def check_all(code):
        if not all(checks.values()):stop(code)
    def authorize(action,arg1,arg2,database,trigger):
        verdict=sql_authorizer(action,arg1,arg2,database,trigger)
        if verdict==sqlite3.SQLITE_DENY:
            state['blockedOperation']='ATTACH_OR_DETACH' if action in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH) else 'EXTENSION_LOAD' if action==sqlite3.SQLITE_FUNCTION else 'UNREVIEWED_PRAGMA'
        return verdict
    def count_statement(_sql):state['restoreStatementsObserved']+=1
    try:
        path=Path(path)
        if path.is_symlink() or not path.is_file() or path.suffix.lower()!='.sql':stop('INPUT_NOT_REGULAR_SQL')
        if not 0<path.stat().st_size<=MAX_EXPORT_BYTES:stop('INPUT_SIZE_REFUSED')
        if not isinstance(expected_sha256,str) or not re.fullmatch('[0-9a-f]{64}',expected_sha256):stop('EXPECTED_HASH_FORMAT_INVALID')
        payload=path.read_bytes();checksum=hashlib.sha256(payload).hexdigest()
        checks['expectedExportHashMatches']=checksum==expected_sha256
        check_all('EXPORT_HASH_MISMATCH')
        stage('PINNED_SOURCE')
        files=_read_sql_dir(qa.BASE,'QA source');_verify_pinned(files,{**HISTORICAL_GIT_BLOBS,**NEW_GIT_BLOBS},'QA source')
        original=sorted(HISTORICAL_GIT_BLOBS);additions=sorted(NEW_GIT_BLOBS)
        # Validate the local SQLite runtime against source before blaming an export.
        stage('EXPECTED_BASELINE_SCHEMA');baseline_schema=expected(files,original)
        stage('EXPECTED_CANDIDATE_SCHEMA');candidate_schema=expected(files,original+additions)
        db=sqlite3.connect(':memory:');rollback=sqlite3.connect(':memory:')
        stage('SQL_RESTORE');db.enable_load_extension(False);db.set_authorizer(authorize)
        db.set_trace_callback(count_statement)
        db.executescript(payload.decode('utf-8-sig'))
        db.set_trace_callback(None);checks['sqlRestoreCompleted']=True
        stage('BASELINE_INTEGRITY');db.execute('PRAGMA query_only=ON')
        checks['integrityClean']=db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        checks['foreignKeysClean']=not db.execute('PRAGMA foreign_key_check').fetchall()
        stage('BASELINE_JOURNAL')
        journal=[r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]
        checks['journalExactlyOriginal23']=journal==original
        checks['journalHasNoExecutableTriggers']=db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND tbl_name='d1_migrations'").fetchone()[0]==0
        stage('BASELINE_SCHEMA');schema=schema_inventory(db)
        checks['schemaExactlyOriginal23']=schema_matches(schema,baseline_schema)
        # Distinguish schema drift from integrity failure without emitting SQL/names.
        if not checks['schemaExactlyOriginal23']:
            actual={(r[0],r[1],r[2]):r[3] for r in schema}
            wanted={(r[0],r[1],r[2]):r[3] for r in baseline_schema}
            checks['expectedSchemaObjectsPresent']=set(wanted)<=set(actual)
            checks['noUnexpectedApplicationObjects']=not (set(actual)-set(wanted)-{('table','_cf_KV','_cf_KV')})
            checks['expectedObjectDefinitionsMatch']=all(actual.get(k)==v for k,v in wanted.items())
        stage('BASELINE_FINANCIAL_LEDGER');checks['financialLedgerClean']=read_only_ledger_counts(db)==[0,0,0,0]
        stage('BASELINE_REVIEW');check_all('BASELINE_CHECKS_FAILED')
        tables=[r[1] for r in schema if r[0]=='table']+['d1_migrations']
        stage('PRESERVATION_SNAPSHOT');before=data_digest(db,tables)
        original_journal_rows=db.execute('SELECT * FROM d1_migrations ORDER BY id').fetchall()
        app_tables=[t for t in tables if t!='d1_migrations'];app_before=data_digest(db,app_tables)
        db.backup(rollback)
        stage('LOCAL_ADDITIVE_REHEARSAL')
        db.execute('PRAGMA query_only=OFF');db.execute('PRAGMA foreign_keys=ON')
        for name in additions:db.executescript(files[name].decode('utf-8'))
        checks['allOriginalRowsPreserved']=data_digest(db,tables)==before
        checks['full25SchemaMatches']=schema_matches(schema_inventory(db),candidate_schema)
        checks['newTablesEmpty']=all(db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0]==0 for t in ('deposit_policy_events','deposit_agreement_snapshots'))
        checks['postMigrationForeignKeysClean']=not db.execute('PRAGMA foreign_key_check').fetchall()
        checks['postMigrationIntegrityClean']=db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        stage('LOCAL_JOURNAL_REHEARSAL')
        for name in additions:db.execute('INSERT INTO d1_migrations(name) VALUES(?)',(name,))
        db.commit()
        checks['local25JournalComplete']=[r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]==original+additions
        checks['allOriginalAppRowsPreservedAfterJournal']=data_digest(db,app_tables)==app_before
        checks['originalJournalRowsPreserved']=db.execute('SELECT * FROM d1_migrations ORDER BY id LIMIT 23').fetchall()==original_journal_rows
        checks['originalRollbackCopyUnchanged']=data_digest(rollback,tables)==before and schema_inventory(rollback)==schema
        checks['privateInputUnchanged']=hashlib.sha256(path.read_bytes()).hexdigest()==checksum
        stage('FINAL_REVIEW');check_all('LOCAL_REHEARSAL_CHECKS_FAILED')
        return {'format':'fire-private-qa-restore-v1','qaWorker':qa.WORKER,'qaDatabase':qa.NAME,
            'assertedQaUuid':qa.UUID,'expectedActiveVersion':qa.ACTIVE_VERSION,
            'ownerExportSha256':checksum,'ownerExportBytes':len(payload),'checks':checks,
            'offlineRestoreAndAdditiveRehearsalPassed':True,
            'exportOriginIndependentlyVerified':False,'liveCompletenessVerified':False,
            'remoteRollbackTested':False,'hostedMigrationAuthorized':False,'publicationAuthorized':False,
            'releaseGatesPassed':3,'releaseGatesTotal':10}
    except QAExportStop:raise
    except sqlite3.Error as failure:
        code='SQLITE_AUTHORIZER_REFUSED' if state.get('blockedOperation') else 'SQLITE_STAGE_FAILED'
        raise QAExportStop(code,state,failure) from None
    except UnicodeError:raise QAExportStop('EXPORT_ENCODING_INVALID',state) from None
    except OSError:raise QAExportStop('LOCAL_FILE_IO_FAILED',state) from None
    except AttributeError:raise QAExportStop('SQLITE_RUNTIME_CAPABILITY_MISSING',state) from None
    except ValueError:raise QAExportStop('PINNED_SOURCE_OR_INPUT_REFUSED',state) from None
    finally:
        if db is not None:db.close()
        if rollback is not None:rollback.close()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('private_sql',type=Path)
    p.add_argument('--expected-sha256',required=True);a=p.parse_args()
    try:
        result=review_export(a.private_sql,expected_sha256=a.expected_sha256)
        print(json.dumps(result,indent=2));return 0 if result['offlineRestoreAndAdditiveRehearsalPassed'] else 1
    except QAExportStop as failure:
        # Never emit exception text, paths, SQL, trace text, rows or column values.
        print(json.dumps(failure.receipt,indent=2));return 2

if __name__=='__main__':sys.exit(main())
