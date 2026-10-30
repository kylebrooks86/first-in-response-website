"""Negative controls for read-only historical numbering on real FIRE table shapes."""
from pathlib import Path
import importlib.util
import json
import sqlite3
import unittest

path=Path(__file__).resolve().parent/'job-numbering'/'preflight_job_history.py'
spec=importlib.util.spec_from_file_location('fire_job_history_preflight',path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
analyze,Blocked=module.analyze,module.HistoryBlocked

class HistoryPreflightTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript("""CREATE TABLE estimates(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, status TEXT, created_at TEXT);
        CREATE TABLE message_templates(key TEXT PRIMARY KEY, body TEXT NOT NULL);""")
    def estimate(self,id,customer='a',status='draft',at='2026-10-29T12:00:00Z'):
        self.db.execute('INSERT INTO estimates VALUES (?,?,?,?)',(id,customer,status,at))
    def replacement(self,original,new):
        obj={'version':1,'originalId':original,'replacementId':new}
        self.db.execute('INSERT INTO message_templates VALUES (?,?)',('fire:quote-revision:v1:'+original,json.dumps(obj)))
    def report(self):
        return analyze(self.db)
    def test_no_estimates(self):
        result=self.report()
        self.assertEqual((result['distinctJobs'],result['completedJobs'],result['estimateCount']),(0,0,0))
        self.assertTrue(result['historicalNumberAssignmentProposedOnly'])
        self.assertFalse(result['remoteD1Changed'])
    def test_repeat_customer_new_number_and_distinct_complete_count(self):
        self.estimate('b',status='completed')
        self.estimate('a',status='draft')
        self.estimate('c',status='declined')
        result=self.report()
        self.assertEqual(result['mapping'],{'a':1,'b':2,'c':3})
        self.assertEqual((result['completedJobs'],result['distinctJobs'],result['canceledOrDeclinedEstimates']),(1,3,1))
    def test_revisions_share_job_number_without_double_counting(self):
        self.estimate('original',status='superseded',at='2026-10-27T12:00:00Z')
        self.estimate('replacement',status='superseded',at='2026-10-28T12:00:00Z')
        self.estimate('third',status='completed')
        self.replacement('original','replacement')
        self.replacement('replacement','third')
        result=self.report()
        self.assertEqual(result['mapping'],{'original':1,'replacement':1,'third':1})
        self.assertEqual(result['completedJobs'],1)
        self.assertEqual(result['revisionLinks'],2)
    def test_in_memory_backfill_rehearses_revisions_and_completed_count(self):
        self.estimate('original',status='superseded',at='2026-10-27T12:00:00Z')
        self.estimate('revision',status='completed',at='2026-10-28T12:00:00Z')
        self.estimate('another',status='declined',at='2026-10-29T12:00:00Z')
        self.replacement('original','revision')
        original_rows=self.db.execute('SELECT * FROM estimates ORDER BY id').fetchall()
        audits=self.db.execute('SELECT * FROM message_templates ORDER BY key').fetchall()
        plan=self.report()
        self.assertEqual(plan['rootEstimates'],{1:'original',2:'another'})
        proof=module.rehearse_in_memory(self.db,plan)
        self.assertTrue(proof['inMemoryBackfillRehearsalPassed'])
        self.assertFalse(proof['hostedMigrationApplied'])
        self.assertEqual(self.db.execute('SELECT job_number,root_estimate_id FROM fire_job_numbers ORDER BY job_number').fetchall(),
                         [(1,'original'),(2,'another')])
        self.assertEqual(self.db.execute('SELECT estimate_id,job_number FROM fire_job_estimate_links ORDER BY estimate_id').fetchall(),
                         [('another',2),('original',1),('revision',1)])
        self.assertEqual(self.db.execute('SELECT * FROM estimates ORDER BY id').fetchall(),original_rows)
        self.assertEqual(self.db.execute('SELECT * FROM message_templates ORDER BY key').fetchall(),audits)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE fire_job_estimate_links SET job_number=2 WHERE estimate_id='revision'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM fire_job_numbers WHERE job_number=1")

    def test_rehearsal_fails_closed_before_inserting_unresolved_root(self):
        self.estimate('only',status='completed')
        plan=self.report()
        plan['rootEstimates'][1]='not-a-saved-estimate'
        with self.assertRaisesRegex(Blocked,'root estimate missing'):
            module.rehearse_in_memory(self.db,plan)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0],0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM estimates').fetchone()[0],1)

    def test_empty_private_rehearsal_keeps_zero_counts(self):
        plan=self.report()
        proof=module.rehearse_in_memory(self.db,plan)
        self.assertTrue(proof['inMemoryBackfillRehearsalPassed'])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM fire_job_numbers').fetchone()[0],0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM fire_job_estimate_links').fetchone()[0],0)

    def test_cross_customer_replacement_fails_closed(self):
        self.estimate('original',customer='a',status='superseded')
        self.estimate('replacement',customer='b')
        self.replacement('original','replacement')
        with self.assertRaisesRegex(Blocked,'two customers'):self.report()
    def test_missing_audit_for_superseded_blocks(self):
        self.estimate('original',status='superseded')
        with self.assertRaisesRegex(Blocked,'auditable replacement'):self.report()
    def test_missing_replacement_estimate_blocks(self):
        self.estimate('original',status='superseded')
        self.replacement('original','missing')
        with self.assertRaisesRegex(Blocked,'missing estimate'):self.report()
    def test_conflicting_replacements_block(self):
        self.estimate('first',status='superseded')
        self.estimate('second',status='superseded')
        self.estimate('new')
        self.replacement('first','new')
        self.replacement('second','new')
        with self.assertRaisesRegex(Blocked,'Forked, duplicate or convergent'):self.report()
    def test_cycle_blocks_even_same_timestamps(self):
        self.estimate('a',status='superseded')
        self.estimate('b',status='superseded')
        self.replacement('a','b')
        self.replacement('b','a')
        with self.assertRaisesRegex(Blocked,'Cyclic'):self.report()
    def test_malformed_audit_blocks(self):
        self.estimate('original',status='superseded')
        self.db.execute('INSERT INTO message_templates VALUES (?,?)',('fire:quote-revision:v1:original','not-json'))
        with self.assertRaisesRegex(Blocked,'Malformed'):self.report()
    def test_date_order_fails_closed(self):
        self.estimate('original',status='superseded',at='2026-10-29T12:00:00Z')
        self.estimate('replacement',at='2026-10-28T12:00:00Z')
        self.replacement('original','replacement')
        with self.assertRaisesRegex(Blocked,'predates'):self.report()
    def test_unsafe_or_missing_dates_fail_closed(self):
        self.estimate('a',at='2026-10-29')
        with self.assertRaisesRegex(Blocked,'timezone'):self.report()
    def test_existing_legacy_mapping_cannot_be_overwritten(self):
        self.estimate('a')
        self.db.execute('CREATE TABLE fire_job_numbers(job_number INTEGER)')
        with self.assertRaisesRegex(Blocked,'already present'):self.report()
    def test_unrelated_quote_revisions_are_ignored(self):
        self.estimate('a')
        self.db.execute('INSERT INTO message_templates VALUES (?,?)',('unrelated:key','not-json'))
        self.assertEqual(self.report()['distinctJobs'],1)

if __name__=='__main__':unittest.main()
