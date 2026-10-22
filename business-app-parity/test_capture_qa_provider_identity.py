"""Only fake provider metadata. Enforce no SQL, publication or secret-value output."""
import copy
import io
import json
import os
import unittest
from contextlib import redirect_stdout,redirect_stderr
from pathlib import Path
from unittest.mock import patch
import capture_qa_provider_identity as collector
import qa_guarded_update as guard
from test_qa_evidence_intake import EvidenceFixture,identity


class TestReadOnlyIdentityCapture(EvidenceFixture):
    def capture(self,snapshots=None,builds=None):
        packets=snapshots or [identity(),identity()]
        class FakeProvider:
            def __init__(self,account,folder,candidate):
                if account!='b'*32:raise AssertionError('wrong account')
            def identity_snapshot(inner):
                self.calls+=1;return packets.pop(0)
        self.calls=0
        with patch.object(guard,'build_identity',side_effect=builds or ['d'*64,'d'*64]):
            return collector.capture(self.paths['evidence'],self.paths['capture_file'],self.folder,
                self.folder/'provider-new.json',provider_factory=FakeProvider,now=self.now)

    def test_stable_identity_capture_is_private_and_sanitized(self):
        before={k:p.read_bytes() for k,p in self.paths.items()};packet=identity()
        packet['inventory'].append({'name':'private-unrelated-database','uuid':'unrelated','records':7})
        packet['version']['resources']['bindings'].append({'name':'SITE_ORIGIN','type':'plain_text','text':'private-setting-value'})
        packet['version']['resources']['bindings'][1]['text']='private-secret-value'
        packet['deployment']['versions'][0]['extra']='private-provider-extra'
        result=self.capture([copy.deepcopy(packet),copy.deepcopy(packet)])
        target=self.folder/'provider-new.json';raw=target.read_text(encoding='utf-8');saved=json.loads(raw)
        self.assertEqual(self.calls,2)
        self.assertEqual(saved['version']['resources']['bindings'][0]['id'],guard.qa.UUID)
        for value in ('private-unrelated-database','private-setting-value','private-secret-value','private-provider-extra'):
            self.assertNotIn(value,raw)
        self.assertFalse(result['providerProvenanceIndependentlyVerified'])
        self.assertEqual(before,{k:p.read_bytes() for k,p in self.paths.items()})
        if os.name!='nt':self.assertEqual(target.stat().st_mode & 0o777,0o600)
        self.assertNotIn('b'*32,json.dumps(result))

    def test_identity_drift_stops_without_retry_and_leaves_incomplete_receipt(self):
        second=identity();second['version']['resources']['bindings'].append({'name':'SITE_ORIGIN','type':'plain_text'})
        with self.assertRaisesRegex(guard.Stop,'IDENTITY_CHANGED_DURING_CAPTURE'):
            self.capture([identity(),second])
        self.assertEqual(self.calls,2)
        self.assertEqual(json.loads((self.folder/'provider-new.json').read_text())['result'],'STOP_IDENTITY_READ_INCOMPLETE_NO_WRITES_AUTHORIZED')

    def test_wrong_actual_binding_never_becomes_capture(self):
        bad=identity();bad['version']['resources']['bindings'][0]['id']=guard.qa.PROTECTED_UUID
        with self.assertRaisesRegex(guard.Stop,'DEPLOYED_DB_BINDING_REFUSED'):self.capture([bad])
        self.assertEqual(self.calls,1)

    def test_build_changes_stop_without_success_receipt(self):
        with self.assertRaisesRegex(guard.Stop,'BUILD_CHANGED_DURING_IDENTITY_CAPTURE'):
            self.capture(builds=['d'*64,'e'*64])
        self.assertIn('STOP_IDENTITY_READ_INCOMPLETE',(self.folder/'provider-new.json').read_text())

    def test_existing_output_never_overwritten(self):
        target=self.folder/'provider-new.json';target.write_text('ORIGINAL PRIVATE FILE')
        with self.assertRaisesRegex(guard.Stop,'RECEIPT_COLLISION_OR_LINK'):self.capture()
        self.assertEqual(self.calls,0);self.assertEqual(target.read_text(),'ORIGINAL PRIVATE FILE')

    def test_output_inside_repo_refused_before_provider(self):
        with patch.object(guard,'REPO',self.folder):
            with self.assertRaisesRegex(guard.Stop,'RECEIPT_MUST_BE_PRIVATE_OUTSIDE_REPO'):self.capture()
        self.assertEqual(self.calls,0)

    def test_linked_output_refused(self):
        target=self.folder/'provider-new.json'
        try:target.symlink_to(self.folder/'missing.json')
        except OSError:self.skipTest('OS does not allow creating symlinks')
        with self.assertRaisesRegex(guard.Stop,'RECEIPT_COLLISION_OR_LINK'):self.capture()
        self.assertEqual(self.calls,0)

    def test_input_changed_during_metadata_read_refused(self):
        original=collector.sanitized
        def change(snapshot):
            self.paths['evidence'].write_text('{}');return original(snapshot)
        with patch.object(collector,'sanitized',side_effect=change):
            with self.assertRaisesRegex(guard.Stop,'CAPTURE_INPUT_CHANGED'):self.capture()

    def test_pure_policy_still_requires_d1_inventory(self):
        packet=identity();packet['inventory']=[]
        with self.assertRaises(ValueError):collector.sanitized(packet)

    def test_only_three_pinned_read_only_commands_can_reach_parent(self):
        provider=object.__new__(collector.IdentityOnlyProvider)
        commands=[['d1','list','--json'],['deployments','status','--name',guard.qa.WORKER,'--json'],
            ['versions','view',guard.qa.ACTIVE_VERSION,'--name',guard.qa.WORKER,'--json']]
        with patch.object(guard.Provider,'call',return_value={}) as parent:
            for args in commands:provider.call(args)
            self.assertEqual(parent.call_count,3);parent.reset_mock()
            forbidden=[['d1','execute',guard.qa.NAME,'--remote','--command','SELECT 1'],
                ['d1','migrations','apply',guard.qa.NAME,'--remote'],['deploy'],['deploy','--dry-run'],
                ['versions','view','other','--name',guard.qa.WORKER,'--json'],
                ['deployments','status','--name','protected-staging','--json']]
            for args in forbidden:
                with self.subTest(args=args),self.assertRaisesRegex(guard.Stop,'IDENTITY_ONLY_COMMAND_REFUSED'):provider.call(args)
            with self.assertRaises(guard.Stop):provider.call(commands[0],json_output=False)
            parent.assert_not_called()

    def test_defaults_and_partial_arguments_never_call_provider(self):
        with patch.object(collector,'capture',side_effect=AssertionError('PROVIDER CALLED')), \
             redirect_stdout(io.StringIO()),redirect_stderr(io.StringIO()):
            self.assertEqual(collector.main([]),0)
            self.assertEqual(collector.main(['--evidence','private.json']),2)
            self.assertEqual(collector.main(['--capture']),2)

    def test_cli_diagnostic_redacts_private_errors(self):
        errors=io.StringIO()
        with patch.object(collector,'capture',side_effect=ValueError('private-path private-customer')),redirect_stderr(errors):
            status=collector.main(['--capture','--evidence','e.json','--capture-file','c.json','--candidate','build','--output','o.json'])
        self.assertEqual(status,2);self.assertNotIn('private-',errors.getvalue())

if __name__=='__main__':unittest.main()
