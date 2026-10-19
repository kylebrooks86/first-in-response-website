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


def review_export(path, *, expected_sha256):
    path=Path(path)
    if path.is_symlink() or not path.is_file() or path.suffix.lower()!='.sql':
        raise ValueError('Regular private SQL file required')
    if not 0<path.stat().st_size<=MAX_EXPORT_BYTES: raise ValueError('Export size refused')
    if not re.fullmatch('[0-9a-f]{64}',expected_sha256): raise ValueError('Expected SHA-256 required')
    payload=path.read_bytes();checksum=hashlib.sha256(payload).hexdigest()
    if checksum!=expected_sha256: raise ValueError('Export hash mismatch')
    files=_read_sql_dir(qa.BASE,'QA source');_verify_pinned(files,{**HISTORICAL_GIT_BLOBS,**NEW_GIT_BLOBS},'QA source')
    original=sorted(HISTORICAL_GIT_BLOBS);additions=sorted(NEW_GIT_BLOBS)
    db=sqlite3.connect(':memory:');rollback=sqlite3.connect(':memory:')
    try:
        db.enable_load_extension(False);db.set_authorizer(sql_authorizer)
        db.executescript(payload.decode('utf-8-sig'));db.execute('PRAGMA query_only=ON')
        schema=schema_inventory(db)
        journal=[r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]
        checks={
            'integrityClean':db.execute('PRAGMA integrity_check').fetchone()[0]=='ok',
            'foreignKeysClean':not db.execute('PRAGMA foreign_key_check').fetchall(),
            'journalExactlyOriginal23':journal==original,
            'schemaExactlyOriginal23':schema_matches(schema,expected(files,original)),
            'financialLedgerClean':read_only_ledger_counts(db)==[0,0,0,0],
            'journalHasNoExecutableTriggers':db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND tbl_name='d1_migrations'").fetchone()[0]==0,
        }
        if not all(checks.values()): raise ValueError('Private backup baseline validation failed')
        tables=[r[1] for r in schema if r[0]=='table']+['d1_migrations']
        before=data_digest(db,tables)
        original_journal_rows=db.execute('SELECT * FROM d1_migrations ORDER BY id').fetchall()
        app_tables=[t for t in tables if t!='d1_migrations']
        app_before=data_digest(db,app_tables)
        db.backup(rollback)
        db.execute('PRAGMA query_only=OFF');db.execute('PRAGMA foreign_keys=ON')
        for name in additions: db.executescript(files[name].decode('utf-8'))
        checks['allOriginalRowsPreserved']=data_digest(db,tables)==before
        checks['full25SchemaMatches']=schema_matches(schema_inventory(db),expected(files,original+additions))
        checks['newTablesEmpty']=all(db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0]==0 for t in ('deposit_policy_events','deposit_agreement_snapshots'))
        checks['postMigrationForeignKeysClean']=not db.execute('PRAGMA foreign_key_check').fetchall()
        checks['postMigrationIntegrityClean']=db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        # Disposable journal exercise only; no hosted D1 command is generated.
        for name in additions: db.execute('INSERT INTO d1_migrations(name) VALUES(?)',(name,))
        db.commit()
        checks['local25JournalComplete']=[r[0] for r in db.execute('SELECT name FROM d1_migrations ORDER BY id')]==original+additions
        checks['allOriginalAppRowsPreservedAfterJournal']=data_digest(db,app_tables)==app_before
        checks['originalJournalRowsPreserved']=db.execute('SELECT * FROM d1_migrations ORDER BY id LIMIT 23').fetchall()==original_journal_rows
        checks['originalRollbackCopyUnchanged']=data_digest(rollback,tables)==before and schema_inventory(rollback)==schema
        checks['privateInputUnchanged']=hashlib.sha256(path.read_bytes()).hexdigest()==checksum
        return {'format':'fire-private-qa-restore-v1','qaWorker':qa.WORKER,'qaDatabase':qa.NAME,
            'assertedQaUuid':qa.UUID,'expectedActiveVersion':qa.ACTIVE_VERSION,
            'ownerExportSha256':checksum,'ownerExportBytes':len(payload),'checks':checks,
            'offlineRestoreAndAdditiveRehearsalPassed':all(checks.values()),
            'exportOriginIndependentlyVerified':False,'liveCompletenessVerified':False,
            'remoteRollbackTested':False,'hostedMigrationAuthorized':False,'publicationAuthorized':False,
            'releaseGatesPassed':3,'releaseGatesTotal':10}
    finally: db.close();rollback.close()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('private_sql',type=Path)
    p.add_argument('--expected-sha256',required=True);a=p.parse_args()
    try:
        result=review_export(a.private_sql,expected_sha256=a.expected_sha256)
        print(json.dumps(result,indent=2));return 0 if result['offlineRestoreAndAdditiveRehearsalPassed'] else 1
    except (ValueError,OSError,sqlite3.Error,UnicodeError):
        # SQL error messages may contain private values; never echo exceptions.
        print(json.dumps({'result':'PRIVATE_QA_RESTORE_STOP','hostedMigrationAuthorized':False,'publicationAuthorized':False}));return 2

if __name__=='__main__':sys.exit(main())
