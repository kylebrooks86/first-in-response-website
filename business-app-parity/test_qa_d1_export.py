"""Synthetic private QA dump: real SQLite restore, schema drift and data preservation."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import verify_qa_d1_export as verify
from review_qa_update_schema import HISTORICAL_GIT_BLOBS


def fixture(folder, mutation=None):
    with sqlite3.connect(':memory:') as db:
        for name in sorted(HISTORICAL_GIT_BLOBS):db.executescript((verify.qa.BASE/name).read_text())
        db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)')
        db.executemany('INSERT INTO d1_migrations(name) VALUES(?)',[(x,) for x in sorted(HISTORICAL_GIT_BLOBS)])
        db.execute("INSERT INTO customers(id,name,created_at) VALUES('private-customer','PRIVATE QA NAME','2026-10-19')")
        db.execute("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('private-estimate','private-customer','completed',10000,10000,5000,'2026-10-19')")
        db.execute("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES('private-payment','private-estimate','Card',10000,'paid','cs_private_value','2026-10-19')")
        if mutation:mutation(db)
        path=Path(folder)/'private.sql';path.write_text('\n'.join(db.iterdump())+'\n');return path


def review(path):return verify.review_export(path,expected_sha256=hashlib.sha256(path.read_bytes()).hexdigest())


class QAExportTests(unittest.TestCase):
    def test_real_restore_rehearsal_preserves_every_row_and_private_input(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder);before=p.read_bytes();result=review(p)
            self.assertTrue(result['offlineRestoreAndAdditiveRehearsalPassed']);self.assertTrue(all(result['checks'].values()))
            self.assertEqual(before,p.read_bytes());self.assertEqual(result['assertedQaUuid'],verify.qa.UUID)
            for key in ('hostedMigrationAuthorized','publicationAuthorized','exportOriginIndependentlyVerified','liveCompletenessVerified','remoteRollbackTested'):self.assertFalse(result[key])
            for private in ('PRIVATE QA NAME','cs_private_value','private-customer','private-estimate','private-payment'):self.assertNotIn(private,json.dumps(result))

    def test_documented_provider_internal_blob_table_is_preserved(self):
        def internal(db):
            db.execute('CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID')
            db.execute('INSERT INTO _cf_KV VALUES(?,?)',('internal',bytes([0,255,1])))
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(review(fixture(folder,internal))['offlineRestoreAndAdditiveRehearsalPassed'])

    def test_hash_mismatch_and_symlink_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder)
            with self.assertRaises(ValueError):verify.review_export(p,expected_sha256='0'*64)
            link=Path(folder)/'linked.sql';link.symlink_to(p)
            with self.assertRaises(ValueError):review(link)

    def test_wrong_journal_schema_foreign_key_or_ledger_refuses(self):
        for mutation in (
            lambda db:db.execute("DELETE FROM d1_migrations WHERE id=23"),
            lambda db:db.execute("UPDATE d1_migrations SET name='0022_wrong.sql' WHERE id=23"),
            lambda db:db.execute('CREATE TABLE unexpected_private_table(secret TEXT)'),
            lambda db:db.executescript("CREATE TRIGGER forged_journal AFTER INSERT ON d1_migrations BEGIN DELETE FROM payments; END;"),
            lambda db:db.execute("UPDATE estimates SET customer_id='missing'"),
            lambda db:db.execute("UPDATE payments SET estimate_id='missing'"),
            lambda db:db.executescript((verify.qa.BASE/'0023_deposit_policy_events.sql').read_text()),
        ):
            with self.subTest(mutation=mutation),tempfile.TemporaryDirectory() as folder:
                with self.assertRaises((ValueError,sqlite3.Error)):review(fixture(folder,mutation))

    def test_attach_and_sql_errors_do_not_expose_private_rows(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder);p.write_text(p.read_text()+"\nATTACH DATABASE '/tmp/FIRE-UNAUTHORIZED' AS bad;\n")
            with self.assertRaises(verify.QAExportStop) as stopped:review(p)
            self.assertEqual(stopped.exception.receipt['diagnosticCode'],'SQLITE_AUTHORIZER_REFUSED')
            self.assertEqual(stopped.exception.receipt['blockedOperation'],'ATTACH_OR_DETACH')
            p.write_text('PRIVATE QA NAME invalid SQL')
            result=subprocess.run([sys.executable,str(Path(verify.__file__)),str(p),'--expected-sha256',hashlib.sha256(p.read_bytes()).hexdigest()],capture_output=True,text=True)
            self.assertEqual(result.returncode,2);self.assertNotIn('PRIVATE QA NAME',result.stdout+result.stderr)

    def test_individual_failed_checks_survive_baseline_refusal(self):
        cases=[
            (lambda db:db.execute("UPDATE d1_migrations SET name='0022_unknown.sql' WHERE id=23"),'journalExactlyOriginal23'),
            (lambda db:db.execute('DROP INDEX idx_payments_stripe_provider_unique'),'schemaExactlyOriginal23'),
            (lambda db:db.execute("UPDATE estimates SET customer_id='missing'"),'foreignKeysClean'),
        ]
        for mutate,key in cases:
            with self.subTest(key=key),tempfile.TemporaryDirectory() as folder:
                p=fixture(folder,mutate);before=p.read_bytes()
                with self.assertRaises(verify.QAExportStop) as stopped:review(p)
                receipt=stopped.exception.receipt
                self.assertEqual(receipt['diagnosticCode'],'BASELINE_CHECKS_FAILED')
                self.assertFalse(receipt['checks'][key]);self.assertIn(key,receipt['failedChecks'])
                self.assertNotIn('local25JournalComplete',receipt['checks'])
                self.assertEqual(before,p.read_bytes())
                for private in ('PRIVATE QA NAME','cs_private_value','0022_unknown.sql','private-customer'):
                    self.assertNotIn(private,json.dumps(receipt))

    def test_encoding_hash_runtime_and_restore_errors_have_separate_codes(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder)
            with self.assertRaises(verify.QAExportStop) as stopped:verify.review_export(p,expected_sha256='0'*64)
            self.assertEqual(stopped.exception.receipt['diagnosticCode'],'EXPORT_HASH_MISMATCH')
            for contents,code in [(b'\xff\xfeinvalid','EXPORT_ENCODING_INVALID'),(b'NOT VALID PRIVATE SQL','SQLITE_STAGE_FAILED')]:
                p.write_bytes(contents)
                with self.assertRaises(verify.QAExportStop) as stopped:review(p)
                self.assertEqual(stopped.exception.receipt['diagnosticCode'],code)
                self.assertEqual(stopped.exception.receipt['stage'],'SQL_RESTORE')
                self.assertNotIn('PRIVATE',json.dumps(stopped.exception.receipt).replace('PRIVATE_QA_RESTORE_STOP',''))

    def test_backup_script_is_export_only_dry_by_default_and_exact_identity(self):
        s=(Path(__file__).parent/'owner_windows_qa_backup.ps1').read_text()
        for x in ('if (-not $Export)','qa_d1_identity_from_list.ps1',verify.qa.UUID,verify.qa.ACTIVE_VERSION,'Confirm-QAVersion','--expected-sha256','verify_qa_d1_export.py','ReparsePoint'):
            self.assertIn(x,s)
        self.assertLess(s.index('if (-not $Export)'),s.index('d1 list --json'))
        self.assertEqual(s.count('Confirm-QAVersion\n'),2)
        self.assertNotIn('d1 execute',s);self.assertNotIn('migrations apply',s);self.assertNotIn('deploy --',s)
        self.assertIn('Split-Path -Parent $repoDir',s)

if __name__=='__main__':unittest.main(verbosity=2)
