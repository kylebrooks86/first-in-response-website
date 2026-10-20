"""Real SQLite + fake Cloudflare adversarial workflow tests; never network/hosted."""
import copy
from datetime import datetime,timedelta,timezone
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import qa_guarded_update as q
from test_qa_d1_export import fixture
import verify_qa_d1_export as backup
REAL_CI=q.verify_ci

def plan():
    return {'format':q.FORMAT,'qaWorker':q.qa.WORKER,'qaDatabase':q.qa.NAME,'qaUuid':q.qa.UUID,
        'expectedActiveVersion':q.qa.ACTIVE_VERSION,'candidateCommit':'a'*40,'buildSha256':'b'*64,
        'evidence':{'ciRunId':123,'accountId':'c'*32,'windowEndsUtc':(datetime.now(timezone.utc)+timedelta(minutes=30)).isoformat()},
        'migrations':{n:hashlib.sha256(q.pinned()[n]).hexdigest() for n in sorted(q.NEW_GIT_BLOBS)},
        'ownerAttestationOnly':True,'hostedMigrationAuthorized':False,'publicationAuthorized':False}

class FakeProvider(q.Provider):
    def __init__(self,folder):
        self.folder=Path(folder);self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
        self.db.executescript(fixture(folder).read_text());self.calls=[];self.writes=[];self.publications=0
        self.version=q.qa.ACTIVE_VERSION;self.db_id=q.qa.UUID;self.split=False;self.fail=None;self.mutate_after=None;self.extra=False
    def call(self,args,*,json_output=True):
        self.calls.append(list(args))
        if args[:2]==['d1','list']:return [{'name':q.qa.NAME,'uuid':q.qa.UUID},{'name':q.qa.PROTECTED_NAME,'uuid':q.qa.PROTECTED_UUID}]
        if args[:2]==['deployments','status']:
            items=[{'version_id':self.version,'percentage':100}];return {'versions':items+items if self.split else items}
        if args[:2]==['versions','view']:
            return {'id':self.version,'resources':{'bindings':[{'name':'DB','type':'d1','id':self.db_id},{'name':'FIRE_QA_PASSWORD_HASH','type':'secret_text'},{'name':'FIRE_QA_SESSION_SECRET','type':'secret_text'}]+([{'name':'LIVE','type':'service'}] if self.extra else [])}}
        if args[:2]==['d1','execute']:
            if '--file' in args:
                path=Path(args[args.index('--file')+1]);self.writes.append(path.name)
                if self.fail==path.name:raise q.Stop('SYNTHETIC_TIMEOUT_STOP_NO_RETRY')
                self.db.executescript(path.read_text())
                if self.mutate_after:self.mutate_after(self.db)
                return [{'success':True,'results':[]}]
            before=self.db.total_changes;rows=[dict(r) for r in self.db.execute(args[args.index('--command')+1])]
            assert self.db.total_changes==before
            return [{'success':True,'results':rows}]
        raise AssertionError('Unexpected fake command')
    def publish(self,candidate,*,before_deploy=lambda:None):before_deploy();self.publications+=1;return '12345678-1234-4234-8234-123456789abc'
    def close(self):self.db.close()

class GuardedQaTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.provider=FakeProvider(self.tmp.name);self.plan=plan()
        self.ci=patch.object(q,'verify_ci');self.ci.start();self.addCleanup(self.ci.stop);self.addCleanup(self.tmp.cleanup);self.addCleanup(self.provider.close)
    def action(self,action='PREFLIGHT',**kw):return q.run_workflow(self.plan,self.provider,action=action,**kw)
    def migrate(self):return self.action('MIGRATE',typed=q.approval(self.plan,'MIGRATE'))
    def test_default_cli_offline(self):
        r=subprocess.run([sys.executable,str(q.ROOT/'qa_guarded_update.py')],capture_output=True,text=True,check=True);self.assertIn('OFFLINE DRY RUN',r.stdout)
    def test_preflight_never_initializes_or_writes_journal(self):
        before=self.provider.db.total_changes;r=self.action();self.assertEqual(r['result'],'QA_23_PREFLIGHT_PASSED_NO_WRITES')
        self.assertEqual(before,self.provider.db.total_changes);self.assertFalse(self.provider.writes)
        for args in self.provider.calls:
            self.assertNotIn('migrations',args);self.assertNotIn('--file',args);self.assertNotIn('apply',args)
    def test_exact_two_real_migrations_preserve_every_row_without_publication(self):
        before=q.row_fingerprints(self.provider,q.pinned());r=self.migrate()
        self.assertEqual(self.provider.writes,sorted(q.NEW_GIT_BLOBS));self.assertEqual(r['originalRowFingerprints'],before)
        self.assertEqual(r['result'],'QA_25_VERIFIED_NOT_PUBLISHED');self.assertEqual(self.provider.publications,0)
        self.assertEqual(self.provider.db.execute('SELECT COUNT(*) FROM d1_migrations').fetchone()[0],25)
        self.assertNotIn('PRIVATE QA NAME',json.dumps(r));self.assertNotIn('cs_private_value',json.dumps(r))
        with self.assertRaises(sqlite3.IntegrityError):self.provider.db.execute("INSERT INTO deposit_policy_events(id) VALUES('invalid')")
    def test_exact_action_approval_bound_to_entire_plan(self):
        exact=q.approval(self.plan,'MIGRATE')
        for typed in (None,'yes',exact.lower(),exact+' ',exact.replace('MIGRATE','PUBLISH'),exact.replace(q.qa.UUID,q.qa.PROTECTED_UUID)):
            with self.subTest(typed=typed),self.assertRaises(q.Stop):self.action('MIGRATE',typed=typed)
        self.assertFalse(self.provider.calls)
        changed=copy.deepcopy(self.plan);changed['buildSha256']='f'*64
        with self.assertRaises(q.Stop):q.run_workflow(changed,self.provider,action='MIGRATE',typed=exact)
    def test_wrong_targets_or_hashes_never_reach_provider(self):
        for k,v in [('qaWorker','fire-app'),('qaDatabase',q.qa.PROTECTED_NAME),('qaUuid',q.qa.PROTECTED_UUID),('expectedActiveVersion','5e44f843-94f0-4ea4-b80f-a889bd0830ef'),('migrations',{})]:
            bad=copy.deepcopy(self.plan);bad[k]=v
            with self.subTest(k=k),self.assertRaises(q.Stop):q.run_workflow(bad,self.provider)
        self.assertFalse(self.provider.calls)
    def test_wrong_active_binding_split_traffic_and_foreign_resources_stop(self):
        for k,v in [('version','5e44f843-94f0-4ea4-b80f-a889bd0830ef'),('split',True),('db_id',q.qa.PROTECTED_UUID),('extra',True)]:
            old=getattr(self.provider,k);setattr(self.provider,k,v)
            with self.subTest(k=k),self.assertRaises((q.Stop,ValueError)):self.migrate()
            setattr(self.provider,k,old)
        self.assertFalse(self.provider.writes)
    def test_schema_journal_and_financial_drift_block(self):
        for sql in ['DROP INDEX idx_payments_stripe_provider_unique','CREATE TABLE foreign_data(secret TEXT)','CREATE VIEW unexpected_view AS SELECT id FROM customers',"UPDATE d1_migrations SET name='0022_changed.sql' WHERE id=23","UPDATE payments SET estimate_id='missing'"]:
            with tempfile.TemporaryDirectory() as folder:
                provider=FakeProvider(folder)
                try:
                    provider.db.executescript(sql)
                    with self.subTest(sql=sql),self.assertRaises((q.Stop,ValueError)):q.run_workflow(self.plan,provider,action='MIGRATE',typed=q.approval(self.plan,'MIGRATE'))
                    self.assertFalse(provider.writes)
                finally:provider.close()
    def test_journal_triggers_and_missing_new_immutability_trigger_stop(self):
        self.provider.db.executescript("CREATE TRIGGER forged AFTER INSERT ON d1_migrations BEGIN DELETE FROM payments; END;")
        with self.assertRaisesRegex(q.Stop,'JOURNAL_EXECUTABLE_TRIGGER_REFUSED'):self.migrate()
        self.assertFalse(self.provider.writes)
        self.provider.db.execute('DROP TRIGGER forged')
        self.provider.mutate_after=lambda db:db.execute('DROP TRIGGER deposit_policy_events_no_delete')
        with self.assertRaisesRegex(q.Stop,'HOSTED_TRIGGER_OR_SCHEMA_DRIFT'):self.migrate()
        self.assertEqual(len(self.provider.writes),1)
    def test_truncated_record_response_refuses_before_any_write(self):
        original=self.provider.select
        self.provider.select=lambda sql:[] if sql.startswith('SELECT json_array') else original(sql)
        with self.assertRaisesRegex(q.Stop,'ROW_FINGERPRINT_TRUNCATED'):self.migrate()
        self.assertFalse(self.provider.writes)
    def test_second_failure_stops_at_24_and_never_resumes(self):
        self.provider.fail=sorted(q.NEW_GIT_BLOBS)[1]
        with self.assertRaises(q.Stop):self.migrate()
        self.assertEqual(len(self.provider.writes),2);self.assertEqual(self.provider.publications,0)
        self.assertEqual(self.provider.db.execute('SELECT COUNT(*) FROM d1_migrations').fetchone()[0],24)
        self.provider.fail=None
        with self.assertRaises(q.Stop):self.migrate()
        self.assertEqual(len(self.provider.writes),2)
    def test_first_timeout_never_retries_or_publishes(self):
        self.provider.fail=sorted(q.NEW_GIT_BLOBS)[0]
        with self.assertRaises(q.Stop):self.migrate()
        self.assertEqual(len(self.provider.writes),1);self.assertEqual(self.provider.publications,0)
    def test_same_count_record_tampering_stops_before_next_write(self):
        self.provider.mutate_after=lambda db:db.execute("UPDATE customers SET name='changed same count'")
        with self.assertRaisesRegex(q.Stop,'ORIGINAL_QA_ROWS_CHANGED'):self.migrate()
        self.assertEqual(len(self.provider.writes),1)
    def test_source_recheck_or_ci_failure_stop_before_write(self):
        calls=[]
        def recheck():
            calls.append(1)
            if len(calls)>1:raise q.Stop('RELEASE_INPUT_CHANGED')
        with self.assertRaises(q.Stop):q.run_workflow(self.plan,self.provider,action='MIGRATE',typed=q.approval(self.plan,'MIGRATE'),recheck=recheck)
        self.assertFalse(self.provider.writes)
        self.provider.calls=[]
        with patch.object(q,'verify_ci',side_effect=q.Stop('CI_FAILED')),self.assertRaises(q.Stop):self.migrate()
        self.assertFalse(self.provider.calls)
    def test_publish_requires_separate_exact_approval_and_matching_25_receipt(self):
        receipt=self.migrate();typed=q.approval(self.plan,'PUBLISH',q.digest(receipt))
        for wrong in (None,q.approval(self.plan,'MIGRATE'),typed+' '):
            with self.assertRaises(q.Stop):self.action('PUBLISH',typed=wrong,migration_receipt=receipt)
        r=self.action('PUBLISH',typed=typed,migration_receipt=receipt,candidate='synthetic')
        self.assertEqual(self.provider.publications,1);self.assertFalse(r['physicalIphoneAccepted'])
    def test_changed_records_and_forged_receipt_block_publish(self):
        receipt=self.migrate();self.provider.db.execute("UPDATE customers SET name='later edit'")
        with self.assertRaises(q.Stop):self.action('PUBLISH',typed=q.approval(self.plan,'PUBLISH',q.digest(receipt)),migration_receipt=receipt)
        receipt['planSha256']='0'*64
        with self.assertRaises(q.Stop):self.action('PUBLISH',typed=q.approval(self.plan,'PUBLISH',q.digest(receipt)),migration_receipt=receipt)
        self.assertEqual(self.provider.publications,0)
    def test_unreviewed_files_or_source_cannot_be_written(self):
        n=sorted(q.NEW_GIT_BLOBS)[0]
        for name,content in [(n,b'UPDATE customers SET name="bad";'),(n,q.pinned()[n]+b'\n'),('0025_unapproved.sql',b'SELECT 1;')]:
            with self.assertRaises(q.Stop):self.provider.migrate_one(name,content)
        self.assertFalse(self.provider.writes)
    def test_blobs_and_full_original_journal_rows_included(self):
        before=q.row_fingerprints(self.provider,q.pinned());self.provider.db.execute("UPDATE customers SET name=CAST(x'00ff' AS BLOB)")
        after=q.row_fingerprints(self.provider,q.pinned());self.assertNotEqual(before['customers'],after['customers'])
        self.provider.db.execute('UPDATE d1_migrations SET id=id+1000')
        self.assertNotEqual(after['d1_migrations'],q.row_fingerprints(self.provider,q.pinned())['d1_migrations'])
    def test_raw_provider_errors_never_disclosed_and_config_pins_account_and_qa_only(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(q.shutil,'which',return_value='mock'):
            root=Path(folder);(root/'node_modules/wrangler/bin').mkdir(parents=True);(root/'node_modules/wrangler/bin/wrangler.js').write_text('// synthetic');(root/'node_modules/wrangler/package.json').write_text('{"version":"4.92.0"}');provider=q.Provider('a'*32,folder,root);proc=subprocess.CompletedProcess([],1,stdout=b'PRIVATE SQL',stderr=b'PRIVATE TOKEN')
            with patch.object(q.subprocess,'run',return_value=proc),self.assertRaises(q.Stop) as caught:provider.call(['d1','list','--json'])
            self.assertNotIn('PRIVATE',str(caught.exception));cfg=json.loads(provider.path.read_text())
            self.assertEqual(cfg['account_id'],'a'*32);self.assertEqual(cfg['d1_databases'][0]['database_id'],q.qa.UUID)
            self.assertEqual(set(cfg),{'name','account_id','compatibility_date','d1_databases'})
    def test_evidence_retention_restore_and_provenance_refuse_missing_or_expired(self):
        now=datetime.now(timezone.utc);p=Path(self.tmp.name)/'private.sql';r=backup.review_export(p,expected_sha256=hashlib.sha256(p.read_bytes()).hexdigest())
        capture={'original23SchemaMetadataMatches':True,'captureUtc':now.isoformat(),'captureSha256':'b'*64}
        e={'accountId':'a'*32,'backupSha256':r['ownerExportSha256'],'backupUtc':now.isoformat(),'restoreReceiptSha256':'c'*64,'captureSha256':'b'*64,'secondCopySha256':r['ownerExportSha256'],'encryptedAccessControlled':True,'independentSecondCopyRetained':True,'authenticatedCaptureAttested':True,'noQaWritesSinceBackup':True,'windowEndsUtc':(now+timedelta(minutes=30)).isoformat(),'ciRunId':123}
        q.evidence_review(e,r,capture,now)
        for k,v in [('accountId',''),('secondCopySha256','0'*64),('encryptedAccessControlled',False),('independentSecondCopyRetained',False),('authenticatedCaptureAttested',False),('noQaWritesSinceBackup',False),('windowEndsUtc',(now-timedelta(minutes=1)).isoformat()),('ciRunId',True)]:
            bad=copy.deepcopy(e);bad[k]=v
            with self.subTest(k=k),self.assertRaises(q.Stop):q.evidence_review(bad,r,capture,now)
        bad=copy.deepcopy(r);del bad['checks']['privateInputUnchanged']
        with self.assertRaises(q.Stop):q.evidence_review(e,bad,capture,now)
        bad=copy.deepcopy(capture);bad['captureUtc']=(now-timedelta(hours=25)).isoformat()
        with self.assertRaises(q.Stop):q.evidence_review(e,r,bad,now)
    def test_publication_dry_run_account_pin_artifact_recheck_and_cleanup(self):
        candidate=Path(self.tmp.name)/'candidate';server=candidate/'dist/server';server.mkdir(parents=True)
        manifest={'name':q.qa.WORKER,'legacy_env':True,'workers_dev':True,
            'd1_databases':[{'binding':'DB','database_name':q.qa.NAME,'database_id':q.qa.UUID}],
            'secrets':{'required':['FIRE_QA_PASSWORD_HASH','FIRE_QA_SESSION_SECRET']},
            'vars':{'FIRE_ENV':'synthetic-qa','FIRE_QA_SYNTHETIC_ONLY':'enabled','SITE_ORIGIN':q.qa.ORIGIN}}
        (server/'wrangler.json').write_text(json.dumps(manifest));original=(server/'wrangler.json').read_bytes()
        self.provider.account='c'*32;self.provider.path=Path(self.tmp.name)/'isolated.json'
        calls=[]
        def invoke(args,**kw):
            if args[:2] == ['deployments','status']:return {'versions':[{'version_id':'12345678-1234-4234-8234-123456789abc','percentage':100}]}
            calls.append(list(args));cfg=json.loads(self.provider.path.read_text())
            self.assertEqual(cfg['account_id'],'c'*32);self.assertEqual(cfg['d1_databases'],manifest['d1_databases'])
            self.assertNotIn('legacy_env',cfg)
        self.provider.call=invoke
        with patch.object(q,'build_identity',return_value='sealed'),patch.object(self.provider,'identity'):
            q.Provider.publish(self.provider,candidate)
        self.assertEqual(calls,[['deploy','--name',q.qa.WORKER,'--dry-run'],['deploy','--name',q.qa.WORKER]])
        self.assertEqual((server/'wrangler.json').read_bytes(),original)
        self.assertEqual(list(server.glob('wrangler.fire-qa-*')),[])
        calls.clear()
        with patch.object(q,'build_identity',side_effect=['sealed','changed']),patch.object(self.provider,'identity'),self.assertRaises(q.Stop):
            q.Provider.publish(self.provider,candidate)
        self.assertEqual(len(calls),1,'Changed bundle stops after dry-run before publication')
        self.assertEqual(list(server.glob('wrangler.fire-qa-*')),[])
        calls.clear()
        def expired():raise q.Stop('WRITE_WINDOW_EXPIRED')
        with patch.object(q,'build_identity',return_value='sealed'),patch.object(self.provider,'identity'),self.assertRaisesRegex(q.Stop,'WRITE_WINDOW_EXPIRED'):
            q.Provider.publish(self.provider,candidate,before_deploy=expired)
        self.assertEqual(len(calls),1,'Expired approval after dry-run must prevent real publication')
        self.assertEqual(list(server.glob('wrangler.fire-qa-*')),[])
    def test_windows_tee_receipt_encoding_and_raw_hash_are_preserved(self):
        path=Path(self.tmp.name)/'tee-receipt.json';raw=json.dumps({'passed':True}).encode('utf-16');path.write_bytes(raw)
        self.assertEqual(q.read_json(path),{'passed':True});self.assertEqual(q.file_hash(path),hashlib.sha256(raw).hexdigest())
        self.assertEqual(path.read_bytes(),raw)
    def test_expired_window_after_slow_reads_blocks_first_write(self):
        state={'now':datetime.now(timezone.utc)}
        class Clock(datetime):
            @classmethod
            def now(cls,tz=None):return state['now']
        calls=[]
        def recheck():
            calls.append(1)
            if len(calls)==3:state['now']+=timedelta(hours=2)
        with patch.object(q,'datetime',Clock),self.assertRaisesRegex(q.Stop,'WRITE_WINDOW_EXPIRED'):
            q.run_workflow(self.plan,self.provider,action='MIGRATE',typed=q.approval(self.plan,'MIGRATE'),recheck=recheck)
        self.assertFalse(self.provider.writes)
    def test_publication_window_is_checked_at_final_callback(self):
        receipt=self.migrate();calls=[]
        def recheck():
            calls.append(1)
            if len(calls)==3:raise q.Stop('WRITE_WINDOW_EXPIRED')
        with self.assertRaisesRegex(q.Stop,'WRITE_WINDOW_EXPIRED'):
            self.action('PUBLISH',typed=q.approval(self.plan,'PUBLISH',q.digest(receipt)),migration_receipt=receipt,candidate='synthetic',recheck=recheck)
        self.assertEqual(self.provider.publications,0)
    def test_complete_offline_plan_reuses_passed_receipts_and_binds_all_evidence(self):
        from test_capture_existing_qa_schema_read_only import sample
        now=datetime.now(timezone.utc);folder=Path(self.tmp.name)
        sql=folder/'private.sql';restore=backup.review_export(sql,expected_sha256=hashlib.sha256(sql.read_bytes()).hexdigest())
        restore_path=folder/'passed.json';restore_path.write_text(json.dumps(restore))
        capture=sample();capture['capturedAt']=now.isoformat();capture_path=folder/'capture.json'
        capture_path.write_text(json.dumps({'capture':capture,'review':q.qa.compare_capture(capture)}))
        evidence={'accountId':'a'*32,'backupSha256':restore['ownerExportSha256'],'backupUtc':now.isoformat(),
            'restoreReceiptSha256':q.file_hash(restore_path),'captureSha256':q.file_hash(capture_path),
            'secondCopySha256':restore['ownerExportSha256'],'encryptedAccessControlled':True,
            'independentSecondCopyRetained':True,'authenticatedCaptureAttested':True,'noQaWritesSinceBackup':True,
            'windowEndsUtc':(now+timedelta(minutes=30)).isoformat(),'ciRunId':123}
        path=folder/'evidence.json';path.write_text(json.dumps(evidence));original=sql.read_bytes()
        with patch.object(q,'source_identity',return_value='a'*40),patch.object(q,'build_identity',return_value='b'*64):
            sealed=q.make_plan(path,restore_path,capture_path,folder,now=now)
            self.assertEqual(sealed['evidence'],evidence);self.assertEqual(sealed['qaUuid'],q.qa.UUID)
            self.assertFalse(sealed['hostedMigrationAuthorized']);self.assertFalse(sealed['publicationAuthorized'])
            restore_path.write_bytes(restore_path.read_bytes()+b' ')
            with self.assertRaisesRegex(q.Stop,'RESTORE_RECEIPT_HASH_DIFFERS'):q.make_plan(path,restore_path,capture_path,folder,now=now)
        self.assertEqual(sql.read_bytes(),original)
        self.assertFalse(self.provider.calls,'Offline plan never contacts provider or replays backup SQL')
    def test_ci_exact_commit_workflow_and_all_eight_successes_required(self):
        good={'head_sha':self.plan['candidateCommit'],'head_branch':q.BRANCH,'path':'.github/workflows/fire-business-app-isolated-checks.yml','status':'completed','conclusion':'success'}
        jobs={'total_count':8,'jobs':[{'status':'completed','conclusion':'success'} for _ in range(8)]}
        for k,v in [('head_sha','f'*40),('path','other.yml'),('conclusion','failure')]:
            bad=copy.deepcopy(good);bad[k]=v
            with patch.object(q,'urlopen',return_value=io.BytesIO(json.dumps(bad).encode())),self.assertRaises(q.Stop):REAL_CI(self.plan)
        jobs['jobs'][0]['conclusion']='skipped'
        with patch.object(q,'urlopen',side_effect=[io.BytesIO(json.dumps(good).encode()),io.BytesIO(json.dumps(jobs).encode())]),self.assertRaises(q.Stop):REAL_CI(self.plan)

if __name__=='__main__':unittest.main(verbosity=2)
