"""Offline-only reconciliation of EXISTING QA evidence. Never opens SQL backups.

No network, provider commands, backup restore/rehearsal, hosted writes, approvals
or input-file modification. Missing evidence is reported per gate. Provider JSON
is a locally supplied snapshot, NOT independent authentication. The guarded
updater still rechecks live identities, CI, source/build, schema and approvals.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
import qa_guarded_update as guard

FORMAT = 'fire-qa-evidence-intake-v1'
CUSTODY_FORMAT = 'fire-qa-backup-custody-v1'
PROVIDER_FORMAT = 'fire-qa-provider-snapshot-v1'
CUSTODY_FIELDS = {'format','backupSha256','restoreReceiptSha256','restoreReceiptRecordedUtc','confirmedUtc','copies'}
COPY_FIELDS = {'copyId','failureDomain','sha256','encryptedAccessControlled','ownerRecoveryAccessConfirmed'}
PROVIDER_FIELDS = {'format','accountId','capturedAt','qaWorker','qaDatabase','qaUuid','captureSha256','inventory','deployment','version'}


def checksum(value):
    return isinstance(value,str) and re.fullmatch(guard.SHA,value) is not None


def fresh(value, now, code):
    stamp = guard.utc(value)
    guard.require(timedelta(0) <= now-stamp <= timedelta(hours=24), code)
    return stamp


def custody_review(custody, evidence, now):
    guard.require(type(custody) is dict and set(custody)==CUSTODY_FIELDS and custody['format']==CUSTODY_FORMAT, 'CUSTODY_FIELDS_REFUSED')
    guard.require(checksum(custody['backupSha256']) and custody['backupSha256']==evidence.get('backupSha256'), 'CUSTODY_BACKUP_HASH_DIFFERS')
    guard.require(checksum(custody['restoreReceiptSha256']) and custody['restoreReceiptSha256']==evidence.get('restoreReceiptSha256'), 'CUSTODY_RESTORE_RECEIPT_DIFFERS')
    recorded,confirmed=guard.utc(custody['restoreReceiptRecordedUtc']),guard.utc(custody['confirmedUtc'])
    guard.require(guard.utc(evidence.get('backupUtc')) <= recorded <= confirmed <= now, 'CUSTODY_TIME_ORDER_REFUSED')
    copies=custody['copies']
    guard.require(type(copies) is list and len(copies)==2 and all(type(c) is dict and set(c)==COPY_FIELDS for c in copies), 'TWO_CUSTODY_RECORDS_REQUIRED')
    guard.require({c['copyId'] for c in copies}=={'primary','secondary'}, 'COPY_IDENTITIES_REFUSED')
    domains=[]
    for copy in copies:
        domain=copy['failureDomain']
        guard.require(isinstance(domain,str) and re.fullmatch(r'[A-Za-z0-9_-]{1,48}',domain), 'FAILURE_DOMAIN_LABEL_REQUIRED')
        domains.append(domain.casefold())
        guard.require(checksum(copy['sha256']) and copy['sha256']==evidence.get('backupSha256'), 'COPY_HASH_DIFFERS')
        guard.require(copy['encryptedAccessControlled'] is True and copy['ownerRecoveryAccessConfirmed'] is True, 'COPY_SECURITY_OR_RECOVERY_ATTESTATION_MISSING')
    guard.require(len(set(domains))==2, 'INDEPENDENT_FAILURE_DOMAINS_REQUIRED')
    guard.require(evidence.get('encryptedAccessControlled') is True and evidence.get('independentSecondCopyRetained') is True, 'CUSTODY_ATTESTATION_MISSING')
    # Distinct labels are owner declarations, not proof of physical independence.


def provider_review(packet, evidence, capture, now):
    guard.require(type(packet) is dict and set(packet)==PROVIDER_FIELDS and packet['format']==PROVIDER_FORMAT, 'PROVIDER_SNAPSHOT_FIELDS_REFUSED')
    guard.require(isinstance(packet['accountId'],str) and re.fullmatch(r'[0-9a-f]{32}',packet['accountId']) and packet['accountId']==evidence.get('accountId'), 'PROVIDER_ACCOUNT_DIFFERS')
    guard.require(packet['qaWorker']==guard.qa.WORKER and packet['qaDatabase']==guard.qa.NAME and packet['qaUuid']==guard.qa.UUID, 'PROVIDER_TARGET_DIFFERS')
    stamp=fresh(packet['capturedAt'],now,'PROVIDER_SNAPSHOT_EXPIRED_OR_FUTURE')
    guard.require(capture is not None and packet['captureSha256']==capture['captureSha256']==evidence.get('captureSha256'), 'PROVIDER_CAPTURE_LINK_DIFFERS')
    guard.require(guard.utc(capture['captureUtc'])<=stamp, 'PROVIDER_SNAPSHOT_PRECEDES_CAPTURE')
    guard.validate_provider_identity(packet['inventory'],packet['deployment'],packet['version'])
    # Never interpret any locally supplied metadata as authenticated provider proof.


def evaluate(*, evidence=None, restore_receipt=None, capture_file=None, custody_file=None, provider_file=None, candidate=None, now=None):
    now=now or datetime.now(timezone.utc)
    checks=[]; loaded={}; capture=None
    def run(name, action, success='PASS', authority='OFFLINE_CONSISTENCY'):
        try:
            action()
            checks.append({'id':name,'status':success,'code':name+'_CONSISTENT','authority':authority})
        except (ValueError,TypeError,KeyError,OSError,RuntimeError,OverflowError,AttributeError,guard.subprocess.SubprocessError):
            error=sys.exc_info()[1]
            code=str(error) if isinstance(error,guard.Stop) and re.fullmatch(r'[A-Z0-9_]+',str(error)) else name+'_INPUT_REFUSED'
            checks.append({'id':name,'status':'STOP','code':code,'authority':authority})
    def read(name,path):
        if path is None:
            checks.append({'id':name,'status':'MISSING','code':name+'_FILE_REQUIRED','authority':'NOT_RECEIVED'})
            return None
        def parse():
            guard.require(Path(path).suffix.lower()=='.json','METADATA_JSON_FILE_REQUIRED')
            value=guard.read_json(path)
            guard.require(type(value) is dict,'METADATA_OBJECT_REQUIRED')
            loaded[name]=value
        run(name,parse)
        return loaded.get(name)
    data=read('EVIDENCE',evidence)
    if data is not None:
        run('EVIDENCE_FIELDS',lambda: guard.require(type(data) is dict and set(data)==guard.EVIDENCE_FIELDS,'EVIDENCE_FIELDS_REFUSED'))
    data=data if type(data) is dict and set(data)==guard.EVIDENCE_FIELDS else {}
    run('ORIGINAL_BACKUP_HASH',lambda: guard.require(checksum(data.get('backupSha256')),'ORIGINAL_BACKUP_HASH_REQUIRED'))
    run('ORIGINAL_BACKUP_TIME',lambda: guard.require(guard.utc(data.get('backupUtc'))<=now,'BACKUP_TIME_FUTURE'))
    run('SECOND_COPY_HASH',lambda: guard.require(checksum(data.get('secondCopySha256')) and data.get('secondCopySha256')==data.get('backupSha256'),'SECOND_COPY_HASH_DIFFERS'))
    run('BACKUP_RECOVERY_POINT',lambda: guard.require(data.get('noQaWritesSinceBackup') is True,'RECOVERY_POINT_OWNER_REVIEW_REQUIRED'), 'OWNER_ATTESTED','OWNER_ATTESTATION_ONLY')
    restore=read('RESTORE_RECEIPT',restore_receipt)
    if restore is not None:
        run('RESTORE_RECEIPT_HASH',lambda: guard.require(guard.file_hash(restore_receipt)==data.get('restoreReceiptSha256'),'RESTORE_RECEIPT_HASH_DIFFERS'))
        run('EXISTING_RESTORE_CHECKS',lambda: guard.validate_restore_receipt(restore,data.get('backupSha256')))
    packet=read('SCHEMA_CAPTURE',capture_file)
    if packet is not None:
        def schema():
            nonlocal capture
            capture=guard.capture_review.evaluate(capture_file)
            guard.require(capture['original23SchemaMetadataMatches'] is True,'ORIGINAL_SCHEMA_DRIFT')
            guard.require(capture['captureSha256']==data.get('captureSha256'),'CAPTURE_HASH_DIFFERS')
        run('ORIGINAL_23_SCHEMA',schema)
        if capture is not None: run('CAPTURE_FRESHNESS',lambda: fresh(capture['captureUtc'],now,'CAPTURE_EXPIRED_OR_FUTURE'))
    custody=read('BACKUP_CUSTODY',custody_file)
    if custody is not None: run('TWO_SECURE_RECOVERY_COPIES',lambda: custody_review(custody,data,now),'OWNER_ATTESTED','OWNER_ATTESTATION_ONLY')
    provider=read('PROVIDER_SNAPSHOT',provider_file)
    if provider is not None: run('PROVIDER_METADATA',lambda: provider_review(provider,data,capture,now),'CONSISTENT_NOT_AUTHENTICATED','LOCAL_PROVIDER_SNAPSHOT_ONLY')
    run('CAPTURE_ORIGIN',lambda: guard.require(data.get('authenticatedCaptureAttested') is True,'CAPTURE_ORIGIN_ATTESTATION_REQUIRED'),'OWNER_ATTESTED','OWNER_ATTESTATION_ONLY')
    run('ACCOUNT_PIN',lambda: guard.require(isinstance(data.get('accountId'),str) and re.fullmatch(r'[0-9a-f]{32}',data['accountId']),'ACCOUNT_PIN_REQUIRED'))
    run('CI_RUN_DECLARED',lambda: guard.require(type(data.get('ciRunId')) is int and data['ciRunId']>0,'EXACT_CI_RUN_REQUIRED'),'DECLARED_NOT_VERIFIED','LIVE_GITHUB_RECHECK_REQUIRED')
    def window():
        end=guard.utc(data.get('windowEndsUtc'))
        guard.require(now<end<=now+timedelta(hours=1),'QUIET_WINDOW_EXPIRED_OR_TOO_LONG')
    run('EXECUTION_WINDOW',window)
    if candidate is None:
        checks.append({'id':'SOURCE_AND_BUILD','status':'MISSING','code':'EXACT_CHECKOUT_AND_BUILT_CANDIDATE_REQUIRED','authority':'NOT_RECEIVED'})
    else:
        def source_build(): guard.source_identity(); guard.build_identity(candidate)
        run('SOURCE_AND_BUILD',source_build)
    migrations={}
    def migration_source():
        nonlocal migrations
        files=guard.pinned();migrations={name:guard.hashlib.sha256(files[name]).hexdigest() for name in sorted(guard.NEW_GIT_BLOBS)}
    run('PINNED_23_TO_25_SQL',migration_source)
    missing=[{'id':c['id'],'code':c['code']} for c in checks if c['status'] in ('STOP','MISSING')]
    return {'format':FORMAT,'result':'STOP_EVIDENCE_INCOMPLETE' if missing else 'OFFLINE_EVIDENCE_RECONCILED_LIVE_PREFLIGHT_REQUIRED',
        'qaWorker':guard.qa.WORKER,'qaDatabase':guard.qa.NAME,'qaUuid':guard.qa.UUID,'expectedActiveVersion':guard.qa.ACTIVE_VERSION,
        'checks':checks,'blockers':missing,'migrations':migrations,
        'readyForReadOnlyPreflight':not missing,'readyForMigrationApproval':False,'readyForPublicationApproval':False,
        'providerProvenanceIndependentlyVerified':False,'backupCustodyIndependentlyVerified':False,
        'originalBackupOpened':False,'backupRestorationRepeated':False,'migrationRehearsalRepeated':False,
        'hostedMigrationAuthorized':False,'publicationAuthorized':False,'physicalIphoneAccepted':False,
        'releaseGatesPassed':3,'releaseGatesTotal':10,
        'remainingExecutionGates':['AUTHENTICATED_LIVE_ACCOUNT_VERSION_TRAFFIC_AND_DB_BINDING','EXACT_LIVE_CI_AND_UNCHANGED_SOURCE_BUILD','FRESH_SCHEMA_AND_ORIGINAL_ROW_PREFLIGHT','SEPARATE_EXACT_MIGRATION_APPROVAL','MIGRATION_RECEIPT_AND_SEPARATE_EXACT_PUBLICATION_APPROVAL','AUTHORIZED_QA_DEPLOYMENT_THEN_PHYSICAL_IPHONE_ACCEPTANCE']}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('evidence','restore-receipt','capture-file','custody-file','provider-file','candidate'):
        parser.add_argument('--'+name,type=Path)
    args=parser.parse_args(argv)
    if not any(vars(args).values()):
        print('OFFLINE INTAKE: no provider access, SQL backup read, restore/rehearsal, file write or authorization. Supply existing metadata files to list per-gate blockers.');return 0
    result=evaluate(**vars(args))
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if result['readyForReadOnlyPreflight'] else 2

if __name__=='__main__':raise SystemExit(main())
