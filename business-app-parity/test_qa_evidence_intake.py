"""Synthetic metadata only: never read, restore or copy an owner's SQL export."""
import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime,timedelta,timezone
from pathlib import Path
from unittest.mock import patch
import qa_guarded_update as guard
import qa_evidence_intake as intake
from test_review_existing_qa_capture_offline import capture_packet


def identity():
    return {'inventory':[{'name':guard.qa.NAME,'uuid':guard.qa.UUID},{'name':guard.qa.PROTECTED_NAME,'uuid':guard.qa.PROTECTED_UUID}],
        'deployment':{'versions':[{'version_id':guard.qa.ACTIVE_VERSION,'percentage':100}]},
        'version':{'id':guard.qa.ACTIVE_VERSION,'resources':{'bindings':[
            {'name':'DB','type':'d1','id':guard.qa.UUID},
            {'name':'FIRE_QA_PASSWORD_HASH','type':'secret_text'},
            {'name':'FIRE_QA_SESSION_SECRET','type':'secret_text'}]}}}


class EvidenceFixture(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.folder=Path(self.temp.name);self.paths={}
        packet=capture_packet();self.now=datetime.now(timezone.utc)+timedelta(seconds=1)
        self.save('capture_file',packet)
        self.restore={'format':'fire-private-qa-restore-v1','qaWorker':guard.qa.WORKER,'qaDatabase':guard.qa.NAME,
            'assertedQaUuid':guard.qa.UUID,'expectedActiveVersion':guard.qa.ACTIVE_VERSION,'ownerExportSha256':'a'*64,
            'checks':dict.fromkeys(guard.RESTORE_CHECKS,True),'offlineRestoreAndAdditiveRehearsalPassed':True,
            'hostedMigrationAuthorized':False,'publicationAuthorized':False}
        self.save('restore_receipt',self.restore)
        self.evidence={'accountId':'b'*32,'backupSha256':'a'*64,'backupUtc':(self.now-timedelta(days=3)).isoformat(),
            'restoreReceiptSha256':guard.file_hash(self.paths['restore_receipt']),
            'captureSha256':guard.file_hash(self.paths['capture_file']),'secondCopySha256':'a'*64,
            'encryptedAccessControlled':True,'independentSecondCopyRetained':True,'authenticatedCaptureAttested':True,
            'noQaWritesSinceBackup':True,'windowEndsUtc':(self.now+timedelta(minutes=30)).isoformat(),'ciRunId':123}
        self.save('evidence',self.evidence)
        self.custody={'format':intake.CUSTODY_FORMAT,'backupSha256':'a'*64,
            'restoreReceiptSha256':self.evidence['restoreReceiptSha256'],
            'restoreReceiptRecordedUtc':(self.now-timedelta(days=2)).isoformat(),'confirmedUtc':self.now.isoformat(),
            'copies':[{'copyId':label,'failureDomain':domain,'sha256':'a'*64,
                      'encryptedAccessControlled':True,'ownerRecoveryAccessConfirmed':True}
                      for label,domain in [('primary','device_A'),('secondary','vault_B')]]}
        self.save('custody_file',self.custody)
        self.provider={'format':intake.PROVIDER_FORMAT,'accountId':'b'*32,'capturedAt':self.now.isoformat(),
            'qaWorker':guard.qa.WORKER,'qaDatabase':guard.qa.NAME,'qaUuid':guard.qa.UUID,
            'captureSha256':self.evidence['captureSha256'],**identity()}
        self.save('provider_file',self.provider)

    def save(self,name,value):
        self.paths[name]=self.folder/(name+'.json');self.paths[name].write_text(json.dumps(value),encoding='utf-8')
        return self.paths[name]

    def evaluate(self,**overrides):
        inputs={**self.paths,'candidate':self.folder,**overrides}
        with patch.object(guard,'source_identity',return_value='c'*40),patch.object(guard,'build_identity',return_value='d'*64), \
             patch.object(guard,'Provider',side_effect=AssertionError('NO PROVIDER CALLS')), \
             patch.object(guard,'urlopen',side_effect=AssertionError('NO NETWORK')):
            return intake.evaluate(**inputs,now=self.now)

    def check(self,result,name):return next(x for x in result['checks'] if x['id']==name)


class TestEvidenceIntake(EvidenceFixture):
    def test_complete_metadata_is_only_ready_for_read_only_preflight(self):
        before={k:p.read_bytes() for k,p in self.paths.items()}
        result=self.evaluate()
        self.assertTrue(result['readyForReadOnlyPreflight'],result['blockers'])
        for key in ('readyForMigrationApproval','readyForPublicationApproval','providerProvenanceIndependentlyVerified',
                    'backupCustodyIndependentlyVerified','originalBackupOpened','backupRestorationRepeated',
                    'migrationRehearsalRepeated','hostedMigrationAuthorized','publicationAuthorized','physicalIphoneAccepted'):
            self.assertFalse(result[key],key)
        self.assertEqual(self.check(result,'PROVIDER_METADATA')['status'],'CONSISTENT_NOT_AUTHENTICATED')
        self.assertEqual(self.check(result,'TWO_SECURE_RECOVERY_COPIES')['authority'],'OWNER_ATTESTATION_ONLY')
        self.assertEqual(len(result['migrations']),2)
        self.assertEqual(before,{k:p.read_bytes() for k,p in self.paths.items()})
        output=json.dumps(result)
        for private in ('b'*32,'a'*64,str(self.folder),'CREATE TABLE'):self.assertNotIn(private,output)

    def test_partial_inputs_report_all_missing_files_without_repeating_work(self):
        result=intake.evaluate(now=self.now)
        ids={x['id'] for x in result['blockers']}
        self.assertTrue({'EVIDENCE','RESTORE_RECEIPT','SCHEMA_CAPTURE','BACKUP_CUSTODY','PROVIDER_SNAPSHOT','SOURCE_AND_BUILD'}<=ids)
        self.assertFalse(result['backupRestorationRepeated'])

    def test_all_restore_checks_are_mandatory(self):
        for name in guard.RESTORE_CHECKS:
            with self.subTest(name=name):
                bad=copy.deepcopy(self.restore);bad['checks'][name]=False;self.save('restore_receipt',bad)
                self.assertEqual(self.check(self.evaluate(),'EXISTING_RESTORE_CHECKS')['status'],'STOP')

    def test_receipt_hash_and_sql_hash_are_separate(self):
        self.paths['restore_receipt'].write_text(json.dumps(self.restore)+'\n',encoding='utf-8')
        result=self.evaluate()
        self.assertEqual(self.check(result,'RESTORE_RECEIPT_HASH')['code'],'RESTORE_RECEIPT_HASH_DIFFERS')
        self.assertEqual(self.check(result,'EXISTING_RESTORE_CHECKS')['status'],'PASS')
        self.restore['ownerExportSha256']='e'*64;self.save('restore_receipt',self.restore)
        self.assertEqual(self.check(self.evaluate(),'EXISTING_RESTORE_CHECKS')['status'],'STOP')

    def test_utf16_receipt_preserves_raw_checksum(self):
        self.paths['restore_receipt'].write_bytes(json.dumps(self.restore).encode('utf-16'))
        self.evidence['restoreReceiptSha256']=guard.file_hash(self.paths['restore_receipt'])
        self.custody['restoreReceiptSha256']=self.evidence['restoreReceiptSha256']
        self.save('evidence',self.evidence);self.save('custody_file',self.custody)
        self.assertTrue(self.evaluate()['readyForReadOnlyPreflight'])

    def test_custody_rejects_same_domain_hash_security_and_timestamp_errors(self):
        mutations=[lambda c:c['copies'][1].update(failureDomain='DEVICE_A'),
            lambda c:c['copies'][1].update(sha256='e'*64),
            lambda c:c['copies'][0].update(encryptedAccessControlled='true'),
            lambda c:c['copies'][1].update(ownerRecoveryAccessConfirmed=False),
            lambda c:c.update(confirmedUtc=(self.now+timedelta(seconds=1)).isoformat()),
            lambda c:c['copies'].append(copy.deepcopy(c['copies'][0])),
            lambda c:c.update(restoreReceiptRecordedUtc=None)]
        for mutation in mutations:
            bad=copy.deepcopy(self.custody);mutation(bad);self.save('custody_file',bad)
            self.assertEqual(self.check(self.evaluate(),'TWO_SECURE_RECOVERY_COPIES')['status'],'STOP')

    def test_provider_rejects_wrong_binding_versions_traffic_account_and_time(self):
        mutations=[lambda p:p['version']['resources']['bindings'][0].update(id=guard.qa.PROTECTED_UUID),
            lambda p:p['deployment']['versions'][0].update(percentage=True),
            lambda p:p['deployment']['versions'].append({'version_id':'other','percentage':0}),
            lambda p:p['version'].update(id='5e44f843-94f0-4ea4-b80f-a889bd0830ef'),
            lambda p:p.update(accountId='e'*32),lambda p:p.update(captureSha256='e'*64),
            lambda p:p.update(capturedAt=(self.now-timedelta(hours=25)).isoformat()),
            lambda p:p.update(capturedAt=(self.now+timedelta(seconds=1)).isoformat()),
            lambda p:p.update(independentlyVerified=True),lambda p:p['version'].update(resources=None),
            lambda p:p['version']['resources']['bindings'].append({'name':'BUCKET','type':'r2_bucket'})]
        for mutation in mutations:
            bad=copy.deepcopy(self.provider);mutation(bad);self.save('provider_file',bad)
            self.assertEqual(self.check(self.evaluate(),'PROVIDER_METADATA')['status'],'STOP')

    def test_stale_schema_requires_metadata_refresh_not_another_restore(self):
        packet=capture_packet();packet['capture']['capturedAt']=(self.now-timedelta(hours=25)).isoformat()
        packet['review']=guard.qa.compare_capture(packet['capture']);self.save('capture_file',packet)
        self.evidence['captureSha256']=guard.file_hash(self.paths['capture_file']);self.save('evidence',self.evidence)
        result=self.evaluate()
        self.assertEqual(self.check(result,'CAPTURE_FRESHNESS')['code'],'CAPTURE_EXPIRED_OR_FUTURE')
        self.assertEqual(self.check(result,'EXISTING_RESTORE_CHECKS')['status'],'PASS')
        self.assertFalse(result['backupRestorationRepeated'])

    def test_recovery_point_and_quiet_window_cannot_be_assumed(self):
        self.evidence.update(noQaWritesSinceBackup=False,windowEndsUtc=self.now.isoformat());self.save('evidence',self.evidence)
        result=self.evaluate()
        self.assertEqual(self.check(result,'BACKUP_RECOVERY_POINT')['status'],'STOP')
        self.assertEqual(self.check(result,'EXECUTION_WINDOW')['status'],'STOP')

    def test_strict_metadata_parser_and_no_private_diagnostic_leaks(self):
        for raw in ('null','[]','{"accountId":1,"accountId":2}','{"nested":{"x":1,"x":2}}','{"x":NaN}','{"x":Infinity}','{"x":1e999}','secret_private_marker'):
            self.paths['evidence'].write_text(raw,encoding='utf-8')
            result=self.evaluate()
            self.assertEqual(self.check(result,'EVIDENCE')['status'],'STOP')
            self.assertNotIn('secret_private_marker',json.dumps(result))
        self.assertEqual(self.check(result,'EVIDENCE')['code'],'EVIDENCE_INPUT_REFUSED')

    def test_sql_extension_refused_before_file_read(self):
        sql=self.folder/'never_open.sql';sql.write_text('DO NOT READ',encoding='utf-8')
        with patch.object(guard,'read_json',side_effect=AssertionError('SQL OPENED')):
            result=intake.evaluate(evidence=sql,now=self.now)
        self.assertEqual(self.check(result,'EVIDENCE')['code'],'METADATA_JSON_FILE_REQUIRED')

    def test_linked_metadata_refused(self):
        link=self.folder/'linked.json'
        try:link.symlink_to(self.paths['evidence'])
        except OSError:self.skipTest('OS does not allow creating symlinks')
        self.assertEqual(self.check(self.evaluate(evidence=link),'EVIDENCE')['status'],'STOP')

    def test_source_build_failure_and_forged_authorization_never_unlock_actions(self):
        with patch.object(guard,'source_identity',side_effect=guard.Stop('WRONG_SOURCE_BRANCH')):
            result=intake.evaluate(**self.paths,candidate=self.folder,now=self.now)
        self.assertEqual(self.check(result,'SOURCE_AND_BUILD')['code'],'WRONG_SOURCE_BRANCH')
        self.restore['hostedMigrationAuthorized']=True;self.save('restore_receipt',self.restore)
        result=self.evaluate()
        self.assertEqual(self.check(result,'EXISTING_RESTORE_CHECKS')['status'],'STOP')
        self.assertFalse(result['readyForMigrationApproval'])

    def test_no_args_has_no_side_effects(self):
        with patch.object(intake,'evaluate',side_effect=AssertionError('EVALUATED')),redirect_stdout(io.StringIO()):
            self.assertEqual(intake.main([]),0)

if __name__=='__main__':unittest.main()
