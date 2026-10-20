"""Exact existing QA 23->25 update. Offline by default; never auto-publishes.

--preflight is authenticated READ ONLY. --migrate and --publish are separate,
exact-plan approvals. No migrations list/apply, journal initialization, reset,
secret upload, rollback or arbitrary SQL/Worker/DB option exists.
Private evidence is owner attestation, not independently authenticated proof.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid
from urllib.request import Request, urlopen

import capture_existing_qa_schema_read_only as qa
import review_existing_qa_capture_offline as capture_review
from review_qa_update_schema import HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned
from verify_hosted_schema_capture import statements, matches_documented_d1_reserved_table

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
BRANCH = 'work/fire-business-app-parity-2026-10-08'
FORMAT = 'fire-exact-qa-23-to-25-plan-v1'
SHA = r'[0-9a-f]{64}'
MAX_BYTES = 2_000_000
FULL_SCHEMA_SQL = "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' AND tbl_name <> 'd1_migrations' ORDER BY type,tbl_name,name"

class Stop(ValueError):
    pass

def require(ok, code):
    if not ok: raise Stop(code)

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()

def linked(path):
    return path.is_symlink() or getattr(path,'is_junction',lambda:False)()

def regular(path):
    path = Path(path).absolute()
    require(not any(linked(p) for p in (path, *path.parents)), 'LINKED_PATH_REFUSED')
    require(path.is_file(), 'FILE_MISSING')
    return path

def read_json(path):
    path = regular(path)
    require(0 < path.stat().st_size <= MAX_BYTES, 'EVIDENCE_SIZE_REFUSED')
    raw = path.read_bytes()
    # Windows PowerShell 5 Tee-Object writes UTF-16 BOM receipts. Hash raw
    # bytes first; accept only the JSON encoding, never normalize private SQL.
    return json.loads(raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig'))

def file_hash(path):
    return hashlib.sha256(regular(path).read_bytes()).hexdigest()

def utc(value):
    try:
        dt = datetime.fromisoformat(value)
        require(dt.tzinfo is not None, 'TIMESTAMP_TIMEZONE_MISSING')
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError): raise Stop('TIMESTAMP_INVALID') from None

def pinned():
    return _verify_pinned(_read_sql_dir(qa.BASE, 'exact QA update'),
                          {**HISTORICAL_GIT_BLOBS, **NEW_GIT_BLOBS}, 'exact QA update')

def git(*args):
    result = subprocess.run(['git', '-C', str(REPO), *args], capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, 'GIT_CHECK_FAILED')
    return result.stdout.strip()

def source_identity():
    require(git('branch', '--show-current') == BRANCH, 'WRONG_SOURCE_BRANCH')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'TRACKED_SOURCE_DIRTY')
    head = git('rev-parse', 'HEAD')
    require(re.fullmatch(r'[0-9a-f]{40}', head), 'SOURCE_COMMIT_INVALID')
    require(git('rev-parse', 'refs/remotes/origin/' + BRANCH) == head, 'FETCHED_ORIGIN_DIFFERS')
    # Untracked executable source in the project is not accepted by the candidate verifier.
    return head

def build_identity(candidate):
    candidate = Path(candidate).absolute()
    require(not any(linked(p) for p in (candidate, *candidate.parents)), 'LINKED_BUILD_REFUSED')
    # Use the existing source and runtime guards, unchanged. The source guard
    # compares the exact shared+QA+independent-D1 assembly, not an artifact label.
    for command in ([sys.executable, str(ROOT/'verify_materialized_candidate.py'), 'qa', str(candidate), '--built'],
                    ['node', str(ROOT/'check_qa_runtime_config.mjs'), str(candidate/'dist/server/wrangler.json')]):
        run = subprocess.run(command, capture_output=True, timeout=90)
        require(run.returncode == 0, 'QA_BUILD_SOURCE_OR_RUNTIME_REFUSED')
    dist = candidate/'dist'
    require(dist.is_dir(), 'QA_BUILD_MISSING')
    files = {}
    for path in sorted(dist.rglob('*')):
        require(not linked(path), 'LINKED_BUILD_REFUSED')
        if path.is_file(): files[path.relative_to(dist).as_posix()] = file_hash(path)
    require('server/wrangler.json' in files and len(files) > 1, 'QA_BUILD_INCOMPLETE')
    return digest(files)

def evidence_review(evidence, restore, capture, now):
    keys = {'accountId','backupSha256','backupUtc','restoreReceiptSha256','captureSha256',
            'secondCopySha256','encryptedAccessControlled','independentSecondCopyRetained',
            'authenticatedCaptureAttested','noQaWritesSinceBackup','windowEndsUtc','ciRunId'}
    require(type(evidence) is dict and set(evidence) == keys, 'EVIDENCE_FIELDS_REFUSED')
    require(re.fullmatch(r'[0-9a-f]{32}', evidence['accountId'] or ''), 'ACCOUNT_PIN_REQUIRED')
    for key in ('backupSha256','restoreReceiptSha256','captureSha256','secondCopySha256'):
        require(isinstance(evidence[key], str) and re.fullmatch(SHA, evidence[key]), 'HASH_INVALID')
    for key in ('encryptedAccessControlled','independentSecondCopyRetained','authenticatedCaptureAttested','noQaWritesSinceBackup'):
        require(evidence[key] is True, 'OWNER_ATTESTATION_MISSING_' + key)
    require(evidence['backupSha256'] == evidence['secondCopySha256'], 'SECOND_COPY_HASH_DIFFERS')
    require(utc(evidence['backupUtc']) <= now, 'BACKUP_TIME_FUTURE')
    end = utc(evidence['windowEndsUtc'])
    require(now < end <= now + timedelta(hours=1), 'QUIET_WINDOW_EXPIRED_OR_TOO_LONG')
    require(type(evidence['ciRunId']) is int and evidence['ciRunId'] > 0, 'CI_RUN_REQUIRED')
    require(restore.get('format') == 'fire-private-qa-restore-v1' and
            restore.get('qaWorker') == qa.WORKER and restore.get('qaDatabase') == qa.NAME and
            restore.get('assertedQaUuid') == qa.UUID and restore.get('expectedActiveVersion') == qa.ACTIVE_VERSION and
            restore.get('ownerExportSha256') == evidence['backupSha256'] and
            restore.get('offlineRestoreAndAdditiveRehearsalPassed') is True and
            restore.get('hostedMigrationAuthorized') is False and restore.get('publicationAuthorized') is False,
            'PASSED_RESTORE_RECEIPT_REQUIRED')
    required = {'expectedExportHashMatches','pinnedMigrationSourceVerified','sqlRestoreCompleted','integrityClean',
        'foreignKeysClean','journalExactlyOriginal23','journalHasNoExecutableTriggers','schemaExactlyOriginal23',
        'financialLedgerClean','allOriginalRowsPreserved','full25SchemaMatches','newTablesEmpty',
        'postMigrationForeignKeysClean','postMigrationIntegrityClean','local25JournalComplete',
        'allOriginalAppRowsPreservedAfterJournal','originalJournalRowsPreserved','originalRollbackCopyUnchanged','privateInputUnchanged'}
    require(type(restore.get('checks')) is dict and set(restore['checks']) == required and
            all(v is True for v in restore['checks'].values()), 'RESTORE_CHECKS_INCOMPLETE')
    require(capture['original23SchemaMetadataMatches'] is True, 'ORIGINAL_SCHEMA_DRIFT')
    require(timedelta(0) <= now - utc(capture['captureUtc']) <= timedelta(hours=24), 'CAPTURE_EXPIRED')
    require(capture['captureSha256'] == evidence['captureSha256'], 'CAPTURE_HASH_DIFFERS')

def make_plan(evidence_path, restore_path, capture_path, candidate, *, now=None):
    now = now or datetime.now(timezone.utc)
    evidence = read_json(evidence_path); restore = read_json(restore_path)
    capture = capture_review.evaluate(capture_path)
    require(file_hash(restore_path) == evidence.get('restoreReceiptSha256'), 'RESTORE_RECEIPT_HASH_DIFFERS')
    evidence_review(evidence, restore, capture, now)
    files = pinned()
    return {'format': FORMAT, 'qaWorker': qa.WORKER, 'qaDatabase': qa.NAME, 'qaUuid': qa.UUID,
        'expectedActiveVersion': qa.ACTIVE_VERSION, 'candidateCommit': source_identity(),
        'buildSha256': build_identity(candidate), 'evidence': evidence,
        'migrations': {n: hashlib.sha256(files[n]).hexdigest() for n in sorted(NEW_GIT_BLOBS)},
        'ownerAttestationOnly': True, 'hostedMigrationAuthorized': False, 'publicationAuthorized': False}

def approval(plan, action, receipt_hash=None):
    require(action in ('MIGRATE','PUBLISH'), 'UNKNOWN_ACTION')
    text = f'{action} QA {qa.WORKER} {qa.UUID} {plan["candidateCommit"]} PLAN {digest(plan)} FROM {qa.ACTIVE_VERSION}'
    if action == 'PUBLISH':
        require(isinstance(receipt_hash, str) and re.fullmatch(SHA, receipt_hash), 'MIGRATION_RECEIPT_HASH_REQUIRED')
        text += ' RECEIPT ' + receipt_hash
    return text

def verify_ci(plan):
    # Provider evidence is fetched read-only immediately before hosted actions;
    # local plan/receipt assertions never substitute for GitHub run identity.
    base = 'https://api.github.com/repos/kylebrooks86/first-in-response-website/actions/runs/' + str(plan['evidence']['ciRunId'])
    def get(url):
        with urlopen(Request(url,headers={'Accept':'application/vnd.github+json','User-Agent':'FIRE-QA-readonly-review'}),timeout=30) as response:
            raw = response.read(MAX_BYTES+1)
        require(len(raw) <= MAX_BYTES, 'CI_RESPONSE_LIMIT')
        return json.loads(raw)
    run = get(base)
    require(run.get('head_sha') == plan['candidateCommit'] and run.get('head_branch') == BRANCH and
            run.get('path') == '.github/workflows/fire-business-app-isolated-checks.yml' and
            run.get('status') == 'completed' and run.get('conclusion') == 'success', 'EXACT_CI_RUN_NOT_PASSED')
    jobs = get(base+'/jobs?per_page=100')
    require(jobs.get('total_count') == 8 and len(jobs.get('jobs',[])) == 8 and
            all(j.get('status') == 'completed' and j.get('conclusion') == 'success' for j in jobs['jobs']), 'EIGHT_CI_JOBS_NOT_PASSED')


def config(account):
    require(isinstance(account, str) and re.fullmatch(r'[0-9a-f]{32}', account), 'ACCOUNT_PIN_REQUIRED')
    return {'name': qa.WORKER, 'account_id': account, 'compatibility_date': '2026-10-16',
        'd1_databases': [{'binding':'DB','database_name':qa.NAME,'database_id':qa.UUID}]}

class Provider:
    """All commands use an isolated config and explicit account; never shell=True."""
    def __init__(self, account, folder, candidate):
        self.account = account; self.folder = Path(folder)
        self.path = self.folder/'wrangler.qa-only.json'
        self.path.write_text(json.dumps(config(account)), encoding='utf-8')
        node = shutil.which('node')
        cli = Path(candidate)/'node_modules/wrangler/bin/wrangler.js'
        package = read_json((Path(candidate)/'node_modules/wrangler/package.json').resolve())
        require(node is not None and cli.is_file() and package.get('version') == '4.92.0', 'TESTED_WRANGLER_492_REQUIRED')
        # Direct node/JS invocation avoids Windows .cmd shell quoting of SQL.
        # Wrangler reuses the original owner's authenticated profile normally.
        self.command = [node,str(cli.absolute())]
    def call(self, args, *, json_output=True):
        env = dict(os.environ, CLOUDFLARE_ACCOUNT_ID=self.account, WRANGLER_SEND_METRICS='false', WRANGLER_WRITE_LOGS='false')
        # Do not allow inherited custom API endpoints or named environment selection.
        for key in list(env):
            if key.startswith(('CLOUDFLARE_API_BASE','CF_API_BASE','WRANGLER_API','CLOUDFLARE_ENV')): del env[key]
        try:
            env.pop('CF_ACCOUNT_ID',None)
            out = subprocess.run([*self.command, *args, '--config', str(self.path)], cwd=self.folder,
                env=env, capture_output=True, timeout=180)
        except (OSError, subprocess.TimeoutExpired): raise Stop('PROVIDER_TIMEOUT_OR_FAILURE_STOP_NO_RETRY') from None
        require(out.returncode == 0, 'PROVIDER_FAILURE_STOP_NO_RETRY')
        require(len(out.stdout) <= MAX_BYTES, 'PROVIDER_OUTPUT_LIMIT')
        if not json_output: return None
        try: return json.loads(out.stdout)
        except ValueError: raise Stop('PROVIDER_JSON_REFUSED') from None
    def identity(self, *, version=qa.ACTIVE_VERSION):
        qa.inventory(self.call(['d1','list','--json']))
        status = self.call(['deployments','status','--name',qa.WORKER,'--json'])
        require(type(status) is dict and type(status.get('versions')) is list and len(status['versions']) == 1,
                'ACTIVE_VERSION_AMBIGUOUS')
        item = status['versions'][0]
        require(type(item) is dict and item.get('version_id') == version and type(item.get('percentage')) in (int,float)
                and item['percentage'] == 100, 'ACTIVE_VERSION_CHANGED')
        view = self.call(['versions','view',version,'--name',qa.WORKER,'--json'])
        require(type(view) is dict and view.get('id') == version, 'VERSION_DETAILS_MISMATCH')
        bindings = view.get('resources',{}).get('bindings')
        require(type(bindings) is list and all(type(b) is dict for b in bindings), 'BINDINGS_MISSING')
        dbs = [b for b in bindings if b.get('type') == 'd1' or b.get('name') == 'DB']
        require(len(dbs) == 1 and dbs[0].get('type') == 'd1' and dbs[0].get('name') == 'DB'
                and dbs[0].get('id') == qa.UUID, 'DEPLOYED_DB_BINDING_REFUSED')
        secrets = {b.get('name') for b in bindings if b.get('type') == 'secret_text'}
        require(secrets == {'FIRE_QA_PASSWORD_HASH','FIRE_QA_SESSION_SECRET'}, 'QA_AUTH_SECRET_NAMES_REFUSED')
        require(all(b.get('type') in ('d1','secret_text','plain_text','json','assets') for b in bindings), 'UNAPPROVED_DEPLOYED_RESOURCE')
        require(not any(re.search(r'stripe|token|password|secret|r2', b.get('name',''), re.I)
                for b in bindings if b.get('type') != 'secret_text'), 'PRIVILEGED_DEPLOYED_VAR_REFUSED')
        return version
    def select(self, sql):
        require(sql.startswith('SELECT '), 'NON_SELECT_REFUSED')
        result = self.call(['d1','execute',qa.NAME,'--remote','--json','--command',qa.safe.cli_safe_statement(sql)])
        require(type(result) is list and len(result) == 1 and result[0].get('success') is True
                and type(result[0].get('results')) is list and len(result[0]['results']) <= qa.MAX_ROWS, 'SELECT_RESULT_REFUSED')
        return result[0]['results']
    def migrate_one(self, name, content):
        require(name in NEW_GIT_BLOBS and content == pinned()[name], 'WRITE_SOURCE_REFUSED')
        path = self.folder/name
        # Exact reviewed source followed by the same journal append Wrangler uses.
        with path.open('xb') as stream:
            stream.write(content + ("\nINSERT INTO d1_migrations(name) VALUES ('" + name + "');\n").encode())
        self.call(['d1','execute',qa.NAME,'--remote','--file',str(path),'--yes','--json'])
    def publish(self, candidate, *, before_deploy=lambda:None):
        require(candidate is not None, 'CANDIDATE_REQUIRED')
        sealed = build_identity(candidate)
        manifest = Path(candidate)/'dist/server/wrangler.json'
        temporary = manifest.parent/('wrangler.fire-qa-firstpublish-' + str(uuid.uuid4()) + '.json')
        try:
            run = subprocess.run(['node',str(ROOT/'prepare_qa_deploy_config.mjs'),str(manifest),str(temporary)], capture_output=True, timeout=30)
            require(run.returncode == 0, 'DEPLOY_MANIFEST_REFUSED')
            # Existing guard allows no account_id in the original build. Add ONLY
            # the reviewed account to the temporary deployment copy, never source.
            clean = read_json(temporary); clean['account_id'] = self.account
            temporary.write_text(json.dumps(clean), encoding='utf-8')
            previous = self.path; self.path = temporary
            try:
                self.call(['deploy','--name',qa.WORKER,'--dry-run'], json_output=False)
                self.identity()
                # Rehash the sealed bundle after dry-run; exclude only this
                # already validated temporary manifest, which is not an asset.
                saved = temporary.read_bytes(); temporary.unlink()
                require(build_identity(candidate) == sealed, 'BUILD_CHANGED_DURING_DRY_RUN')
                before_deploy()
                with temporary.open('xb') as stream: stream.write(saved)
                self.call(['deploy','--name',qa.WORKER], json_output=False)
                status = self.call(['deployments','status','--name',qa.WORKER,'--json'])
                versions = status.get('versions') if type(status) is dict else None
                require(type(versions) is list and len(versions) == 1 and type(versions[0]) is dict, 'POST_PUBLISH_VERSION_AMBIGUOUS')
                version = versions[0].get('version_id')
                require(isinstance(version,str) and re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',version) and version != qa.ACTIVE_VERSION, 'POST_PUBLISH_NEW_VERSION_MISSING')
                self.identity(version=version)
                return version
            finally: self.path = previous
        finally:
            temporary.unlink(missing_ok=True)


def expected_queries(files, count):
    with sqlite3.connect(':memory:') as db:
        db.row_factory = sqlite3.Row
        for name in sorted(files)[:count]: db.executescript(files[name].decode())
        db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)')
        db.executemany('INSERT INTO d1_migrations(name) VALUES(?)', [(n,) for n in sorted(files)[:count]])
        return [[dict(r) for r in db.execute(sql)] for sql in [*statements(),FULL_SCHEMA_SQL]]

def schema_check(provider, files, count):
    wanted = expected_queries(files, count)
    for i, sql in enumerate(statements()):
        actual = qa.rows([{'success':True,'results':provider.select(sql)}], i+1)
        require(actual == wanted[i] or (i == 0 and matches_documented_d1_reserved_table(actual,wanted[i])), 'HOSTED_SCHEMA_OR_LEDGER_DRIFT')
    actual = provider.select(FULL_SCHEMA_SQL)
    require(actual == wanted[10] or matches_documented_d1_reserved_table(actual,wanted[10]), 'HOSTED_TRIGGER_OR_SCHEMA_DRIFT')
    require(provider.select("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND tbl_name='d1_migrations'") == [{'count':0}], 'JOURNAL_EXECUTABLE_TRIGGER_REFUSED')
    for table in (['deposit_policy_events'] if count == 24 else ['deposit_policy_events','deposit_agreement_snapshots'] if count == 25 else []):
        require(provider.select('SELECT COUNT(*) AS count FROM '+table) == [{'count':0}], 'NEW_QA_AUDIT_ROWS_REQUIRE_REVIEW')
    require(provider.select('SELECT quick_check FROM pragma_quick_check') == [{'quick_check':'ok'}], 'HOSTED_QUICK_CHECK_FAILED')

def row_fingerprints(provider, files):
    """Only in-memory synthetic QA rows; return digests, never data or SQL logs.

    Read all original application values (BLOB-safe) plus the full original
    journal rows. New journal rows are excluded by pinned names, not IDs.
    No SELECT text comes from the owner evidence or captured schema.
    """
    fingerprints = {}
    with sqlite3.connect(':memory:') as db:
        for name in sorted(HISTORICAL_GIT_BLOBS): db.executescript(files[name].decode())
        db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)')
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        for table in tables:
            columns = [r[1] for r in db.execute('PRAGMA table_info("'+table+'")')]
            # Journal schema can vary with Wrangler; read full rows separately
            # below, without assuming timestamps or changing historical columns.
            if table == 'd1_migrations': continue
            expressions = [f'CASE WHEN typeof("{c}")=\'blob\' THEN json_object(\'blob\',hex("{c}")) ELSE "{c}" END' for c in columns]
            rows = provider.select('SELECT json_array('+','.join(expressions)+') AS record FROM "'+table+'"')
            require(all(type(r) is dict and set(r) == {'record'} and type(r['record']) is str for r in rows), 'ROW_FINGERPRINT_RESPONSE_REFUSED')
            require(provider.select('SELECT COUNT(*) AS row_count FROM "'+table+'"') == [{'row_count':len(rows)}], 'ROW_FINGERPRINT_TRUNCATED')
            fingerprints[table] = digest(sorted(r['record'] for r in rows))
    names = ','.join("'"+name+"'" for name in sorted(HISTORICAL_GIT_BLOBS))
    journal = provider.select('SELECT * FROM d1_migrations WHERE name IN ('+names+') ORDER BY id')
    require(len(journal) == 23, 'ORIGINAL_JOURNAL_ROWS_MISSING')
    fingerprints['d1_migrations'] = digest(journal)
    return fingerprints


def run_workflow(plan, provider, *, action='PREFLIGHT', typed=None, migration_receipt=None, candidate=None, recheck=lambda:None):
    files = pinned()
    require(action in ('PREFLIGHT','MIGRATE','PUBLISH'), 'UNKNOWN_ACTION')
    receipt_hash = digest(migration_receipt) if migration_receipt is not None else None
    if action != 'PREFLIGHT':
        require(typed == approval(plan,action,receipt_hash), 'EXACT_ACTION_APPROVAL_MISSING')
    if action == 'PUBLISH':
        require(type(migration_receipt) is dict and migration_receipt.get('result') == 'QA_25_VERIFIED_NOT_PUBLISHED'
                and migration_receipt.get('planSha256') == digest(plan), 'MIGRATION_RECEIPT_REFUSED')
    require(plan.get('qaWorker') == qa.WORKER and plan.get('qaDatabase') == qa.NAME and
            plan.get('qaUuid') == qa.UUID and plan.get('expectedActiveVersion') == qa.ACTIVE_VERSION, 'PLAN_TARGET_REFUSED')
    require(plan.get('migrations') == {n:hashlib.sha256(files[n]).hexdigest() for n in sorted(NEW_GIT_BLOBS)}, 'PLAN_MIGRATIONS_REFUSED')
    recheck(); verify_ci(plan); provider.identity()
    count = 25 if action == 'PUBLISH' else 23
    schema_check(provider,files,count)
    before = row_fingerprints(provider,files)
    if action == 'PREFLIGHT':
        provider.identity()
        return {'result':'QA_23_PREFLIGHT_PASSED_NO_WRITES','planSha256':digest(plan), 'hostedMigrationAuthorized':False,'publicationAuthorized':False}
    if action == 'MIGRATE':
        for index, name in enumerate(sorted(NEW_GIT_BLOBS)):
            recheck(); provider.identity(); schema_check(provider,files,23+index)
            require(row_fingerprints(provider,files) == before, 'QA_ROWS_CHANGED_BEFORE_WRITE')
            recheck()
            require(datetime.now(timezone.utc) < utc(plan['evidence']['windowEndsUtc']), 'WRITE_WINDOW_EXPIRED')
            provider.migrate_one(name,files[name])
            # Any timeout/partial failure propagates STOP; never retries or deploys.
            schema_check(provider,files,24+index)
            require(row_fingerprints(provider,files) == before, 'ORIGINAL_QA_ROWS_CHANGED')
        provider.identity()
        return {'format':'fire-qa-migration-receipt-v1','result':'QA_25_VERIFIED_NOT_PUBLISHED',
            'planSha256':digest(plan),'originalRowFingerprints':before,'qaUuid':qa.UUID,
            'previousWorkerVersion':qa.ACTIVE_VERSION,'publicationAuthorized':False}
    require(before == migration_receipt.get('originalRowFingerprints'), 'QA_ROWS_CHANGED_SINCE_MIGRATION')
    recheck(); provider.identity()
    def before_deploy():
        recheck()
        require(datetime.now(timezone.utc) < utc(plan['evidence']['windowEndsUtc']), 'WRITE_WINDOW_EXPIRED')
    version = provider.publish(candidate,before_deploy=before_deploy)
    schema_check(provider,files,25)
    require(row_fingerprints(provider,files) == before, 'QA_ROWS_CHANGED_DURING_PUBLICATION')
    # Provider version/binding are re-read; owner login/iPhone remain pending.
    return {'result':'QA_PUBLICATION_COMMAND_COMPLETED_ACCEPTANCE_PENDING','planSha256':digest(plan),
        'rollbackVersion':qa.ACTIVE_VERSION,'observedNewWorkerVersion':version,'physicalIphoneAccepted':False,'productionReady':False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--evidence',type=Path); p.add_argument('--restore-receipt',type=Path)
    p.add_argument('--capture-file',type=Path); p.add_argument('--candidate',type=Path)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument('--preflight',action='store_true'); mode.add_argument('--migrate',action='store_true'); mode.add_argument('--publish',action='store_true')
    p.add_argument('--approval-text'); p.add_argument('--migration-receipt',type=Path); p.add_argument('--output',type=Path)
    args = p.parse_args(argv)
    try:
        if not any((args.evidence,args.restore_receipt,args.capture_file,args.candidate)):
            require(not any((args.preflight,args.migrate,args.publish,args.approval_text,args.migration_receipt)), 'INPUTS_REQUIRED')
            print('OFFLINE DRY RUN. Exact QA 23->25 only. No Cloudflare access, files written, migration or publication.'); return 0
        require(all((args.evidence,args.restore_receipt,args.capture_file,args.candidate)), 'ALL_EVIDENCE_INPUTS_REQUIRED')
        require(not args.output or any((args.preflight,args.migrate,args.publish)), 'OFFLINE_OUTPUT_NOT_SUPPORTED')
        plan = make_plan(args.evidence,args.restore_receipt,args.capture_file,args.candidate)
        if not any((args.preflight,args.migrate,args.publish)):
            result = {'plan':plan,'planSha256':digest(plan),'migrationApprovalText':approval(plan,'MIGRATE'),
                      'result':'OFFLINE_PLAN_ONLY_OWNER_APPROVAL_STILL_REQUIRED'}
            if args.migration_receipt:
                receipt = read_json(args.migration_receipt)
                require(receipt.get('result') == 'QA_25_VERIFIED_NOT_PUBLISHED' and receipt.get('planSha256') == digest(plan), 'MIGRATION_RECEIPT_REFUSED')
                result['migrationReceiptCanonicalSha256'] = digest(receipt)
                result['publicationApprovalText'] = approval(plan,'PUBLISH',digest(receipt))
        else:
            require(args.output is not None, 'PRIVATE_RECEIPT_OUTPUT_REQUIRED')
            destination = args.output.absolute()
            require(not destination.exists() and not any(linked(x) for x in (destination,*destination.parents)), 'RECEIPT_COLLISION_OR_LINK')
            require(REPO not in destination.parents and destination.parent.is_dir(), 'RECEIPT_MUST_BE_PRIVATE_OUTSIDE_REPO')
            # Reserve receipt BEFORE any hosted operation. Failed/partial runs
            # preserve STOP evidence and cannot silently overwrite it on retry.
            with destination.open('x',encoding='utf-8') as receipt:
                receipt.write('{"result":"STARTED_NOT_COMPLETED_DO_NOT_RETRY"}\n');receipt.flush()
                try:
                    with tempfile.TemporaryDirectory(prefix='fire-exact-qa-update-') as folder:
                        provider = Provider(plan['evidence']['accountId'],folder,args.candidate)
                        previous = digest(plan)
                        def recheck():
                            require(digest(make_plan(args.evidence,args.restore_receipt,args.capture_file,args.candidate)) == previous, 'RELEASE_INPUT_CHANGED')
                        migration = read_json(args.migration_receipt) if args.migration_receipt else None
                        result = run_workflow(plan,provider,action='PUBLISH' if args.publish else 'MIGRATE' if args.migrate else 'PREFLIGHT',
                            typed=args.approval_text,migration_receipt=migration,candidate=args.candidate,recheck=recheck)
                except Exception:
                    receipt.seek(0);receipt.truncate();receipt.write('{"result":"STOP_INCOMPLETE_DO_NOT_RETRY_OR_PUBLISH"}\n');raise
                receipt.seek(0);receipt.truncate();json.dump(result,receipt,indent=2)
        print(json.dumps(result,indent=2));return 0
    except (ValueError,TypeError,KeyError,OSError,RuntimeError,subprocess.SubprocessError) as error:
        # Fixed code only. Never echo records, SQL, CLI stderr or private paths.
        code = str(error) if isinstance(error,Stop) and re.fullmatch('[A-Z0-9_]+',str(error)) else 'INPUT_OR_PROVIDER_CHECK_FAILED'
        print('FIRE_QA_GUARDED_UPDATE_STOP: '+code+'. Preserve private receipt; do not retry hosted writes.',file=sys.stderr)
        return 2

if __name__ == '__main__': sys.exit(main())
