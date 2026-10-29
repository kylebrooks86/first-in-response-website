"""Verify a trusted owner-held current QA25 SQL export offline, without replaying migrations.

No network, provider access, export acquisition, input overwrite or hosted restore.
The existing QA23 backup/rehearsal tool and deployment pins remain unchanged.
A pass covers local SQL/schema/journal/ledger checks, not origin, completeness,
private signature-document digests, device photo bytes or release authorization.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
from verify_qa_d1_export import (QAExportStop, data_digest, expected, schema_matches,
    qa, HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned,
    MAX_EXPORT_BYTES, sql_authorizer, schema_inventory, read_only_ledger_counts)


def review_export(path, *, expected_sha256):
    state={'stage':'INPUT','checks':{},'restoreStatementsObserved':0}
    checks=state['checks'];db=None
    def stop(code):raise QAExportStop(code,state)
    def authorize(action,arg1,arg2,database,trigger):
        verdict=sql_authorizer(action,arg1,arg2,database,trigger)
        if database not in (None,'main'):
            state['blockedOperation']='NON_MAIN_DATABASE';return sqlite3.SQLITE_DENY
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
        if not checks['expectedExportHashMatches']:stop('EXPORT_HASH_MISMATCH')
        state['stage']='PINNED_25_SOURCE'
        pins={**HISTORICAL_GIT_BLOBS,**NEW_GIT_BLOBS}
        files=_verify_pinned(_read_sql_dir(qa.BASE,'QA source'),pins,'QA source')
        names=sorted(pins)
        if len(names)!=25:stop('PINNED_25_SOURCE_REQUIRED')
        checks['pinnedMigrationSourceVerified']=True
        wanted=expected(files,names)  # Expected schema in a separate, synthetic memory DB.
        state['stage']='CURRENT_25_MEMORY_RESTORE'
        db=sqlite3.connect(':memory:');db.enable_load_extension(False);db.set_authorizer(authorize)
        db.set_trace_callback(count_statement);db.executescript(payload.decode('utf-8-sig'));db.set_trace_callback(None)
        checks['sqlRestoreCompleted']=True
        db.execute('PRAGMA query_only=ON')
        state['stage']='CURRENT_25_READ_ONLY_REVIEW'
        changes=db.total_changes
        checks['integrityClean']=db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        checks['foreignKeysClean']=not db.execute('PRAGMA foreign_key_check').fetchall()
        checks['journalExactlyCurrent25']=[r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]==names
        checks['journalHasNoExecutableTriggers']=db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND tbl_name='d1_migrations'").fetchone()[0]==0
        actual=schema_inventory(db)
        checks['schemaExactlyCurrent25']=schema_matches(actual,wanted)
        if not all(checks.values()):stop('CURRENT_25_CHECKS_FAILED')
        tables=[r[1] for r in actual if r[0]=='table']+['d1_migrations']
        before=data_digest(db,tables)
        checks['financialLedgerClean']=read_only_ledger_counts(db)==[0,0,0,0]
        checks['allRestoredValuesUnchanged']=data_digest(db,tables)==before and db.total_changes==changes
        checks['privateInputUnchanged']=hashlib.sha256(path.read_bytes()).hexdigest()==checksum
        if not all(checks.values()):stop('CURRENT_25_CHECKS_FAILED')
        return {'format':'fire-private-current-qa25-review-v1','current25OfflineReviewPassed':True,
            'expectedQaDatabase':qa.NAME,'assertedQaUuid':qa.UUID,'ownerExportSha256':checksum,
            'ownerExportBytes':len(payload),'checks':checks,'restoreDestination':'memory-only',
            'migrationRehearsalPerformed':False,'exportOriginIndependentlyVerified':False,
            'liveCompletenessVerified':False,'signatureDocumentDigestsVerified':False,
            'photoBytesVerified':False,'remoteRollbackTested':False,
            'hostedMigrationAuthorized':False,'publicationAuthorized':False,
            'releaseGatesPassed':3,'releaseGatesTotal':10}
    except QAExportStop:raise
    except sqlite3.Error as failure:
        raise QAExportStop('SQLITE_AUTHORIZER_REFUSED' if state.get('blockedOperation') else 'SQLITE_STAGE_FAILED',state,failure) from None
    except UnicodeError:raise QAExportStop('EXPORT_ENCODING_INVALID',state) from None
    except OSError:raise QAExportStop('LOCAL_FILE_IO_FAILED',state) from None
    except (ValueError,AttributeError):raise QAExportStop('PINNED_SOURCE_OR_INPUT_REFUSED',state) from None
    finally:
        if db is not None:db.close()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('private_sql',type=Path)
    p.add_argument('--expected-sha256',required=True);a=p.parse_args()
    try:result=review_export(a.private_sql,expected_sha256=a.expected_sha256)
    except QAExportStop as stopped:
        print(json.dumps(stopped.receipt,indent=2));return 2
    print(json.dumps(result,indent=2));return 0

if __name__=='__main__':sys.exit(main())
