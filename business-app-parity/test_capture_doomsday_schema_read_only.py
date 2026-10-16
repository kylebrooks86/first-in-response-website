"""Synthetic non-network Windows Doomsday metadata capture regression tests."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import capture_doomsday_schema_read_only as m


def fixture_rows(index):
    if index == 5:
        return [{"name": "0000_wise_namora.sql" if i == 0 else
                 "0021_manual_processing_fees.sql" if i == 21 else
                 f"{i:04d}_fixture.sql"} for i in range(22)]
    if index >= 6:
        return [{next(iter(m.COLUMNS[index - 1])): 0}]
    return [{k: None if k in ("sql", "dflt_value") else "x" for k in sorted(m.COLUMNS[index - 1])}]


class CaptureTest(unittest.TestCase):
    def test_verified_sql_digest_rejects_changes_and_non_reviewed_queries(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'queries.sql'
            p.write_text('SELECT 1;\n' * 10)
            with self.assertRaisesRegex(ValueError, 'checksum changed'):
                m.reviewed_statements(p)
            content=p.read_bytes()
            blob=hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
            with patch.object(m,'APPROVED_SQL_BLOB',blob):
                self.assertEqual(len(m.reviewed_statements(p)),10)
                p.write_text('DELETE FROM payments;\n' + 'SELECT 1;\n'*9)
                changed=p.read_bytes()
                changed_blob=hashlib.sha1(b'blob '+str(len(changed)).encode()+b'\0'+changed).hexdigest()
                with patch.object(m,'APPROVED_SQL_BLOB',changed_blob):
                    with self.assertRaisesRegex(ValueError, 'ten SELECT-only'):
                        m.reviewed_statements(p)

    def test_inventory_wrong_uuid_and_duplicate_are_blocked(self):
        for inventory in ([], [{"name":m.TARGET,"uuid":"wrong"}],
                          [{"name":m.TARGET,"uuid":m.UUID}]*2, {"results": []}):
            with self.subTest(inventory=inventory):
                with self.assertRaises(ValueError):m.checked_inventory(inventory)
        m.checked_inventory([{"name":m.TARGET,"uuid":m.UUID}])

    def test_rows_rejects_failure_truncation_unexpected_private_columns_and_bad_count(self):
        for obj in ({"success":False,"results":[]},
                    {"success":True,"results":[{"customer_email":"private"}]},
                    {"success":True,"results":[]},):
            with self.subTest(obj=obj),self.assertRaises(ValueError):
                m.checked_rows([obj],1)
        for rows in ([{"foreign_key_violation_count":"0"}],
                     [{"foreign_key_violation_count":-1}],
                     [{"foreign_key_violation_count":0}, {"foreign_key_violation_count":0}]):
            with self.subTest(rows=rows),self.assertRaises(ValueError):
                m.checked_rows([{"success":True,"results":rows}],6)
        with self.assertRaises(ValueError):
            m.checked_rows([{"success":True,"results":[{"name":"x"}]}],5)

    def test_end_to_end_mocked_capture_creates_incomplete_provider_packet_no_real_network(self):
        recorded=[]
        def fake_run(_wrangler,args):
            recorded.append(args)
            if args[:2] == ["d1","list"]:
                return [{"name":m.TARGET,"uuid":m.UUID}]
            assert args[:3] == ["d1", "execute",m.TARGET]
            assert "--remote" in args and "--json" in args and "--command" in args
            assert "--file" not in args and "migrations" not in args
            n=len([x for x in recorded if x[:2]==["d1","execute"]])
            return [{"success":True,"results":fixture_rows(n)}]
        with tempfile.TemporaryDirectory() as d, patch.object(m,'run_wrangler',side_effect=fake_run):
            p, counts=m.capture('fake-wrangler',[f'SELECT {i}' for i in range(10)],Path(d))
            doc=json.loads(p.read_text())
            self.assertEqual(counts,[1,1,1,1,22,1,1,1,1,1])
            self.assertEqual(len(recorded),12)
            self.assertEqual(doc['captures'][0]['providerMetadata']['activeVersion'],'')
            self.assertEqual(doc['captures'][0]['providerMetadata']['sourceCommit'],'')
            self.assertEqual(doc['captures'][0]['providerMetadata']['providerRecordId'],'')
            self.assertFalse(doc['captures'][0]['truncated'])
            self.assertEqual(doc['captures'][0]['target'],'doomsday')
            self.assertEqual(len(doc['captures'][0]['queries']),10)
            self.assertNotIn('remoteIdentityIndependentlyVerified',doc)

    def test_fail_closed_writes_no_partial_metadata_when_one_query_fails(self):
        count=[0]
        def failed(_wrangler,args):
            if args[1]=='list':return [{"name":m.TARGET,"uuid":m.UUID}]
            count[0]+=1
            if count[0]==3:raise RuntimeError('D1 error')
            return [{"success":True,"results":fixture_rows(count[0])}]
        with tempfile.TemporaryDirectory() as d, patch.object(m,'run_wrangler',side_effect=failed):
            with self.assertRaisesRegex(RuntimeError,'D1 error'):
                m.capture('fake-wrangler',['SELECT 1']*10,Path(d))
            self.assertEqual(list(Path(d).iterdir()),[])

    def test_shell_failure_does_not_echo_api_response(self):
        import subprocess
        with patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],1,'SECRET','CREDENTIALS')):
            with self.assertRaises(RuntimeError) as error:
                m.run_wrangler('fake',['d1','list','--json'])
            self.assertNotIn('SECRET',str(error.exception))
            self.assertNotIn('CREDENTIALS',str(error.exception))

if __name__=='__main__':unittest.main(verbosity=2)
