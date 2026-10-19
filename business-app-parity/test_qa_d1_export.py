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
            lambda db:db.execute("UPDATE estimates SET customer_id='missing'"),
            lambda db:db.execute("UPDATE payments SET estimate_id='missing'"),
            lambda db:db.executescript((verify.qa.BASE/'0023_deposit_policy_events.sql').read_text()),
        ):
            with self.subTest(mutation=mutation),tempfile.TemporaryDirectory() as folder:
                with self.assertRaises((ValueError,sqlite3.Error)):review(fixture(folder,mutation))

    def test_attach_and_sql_errors_do_not_expose_private_rows(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder);p.write_text(p.read_text()+"\nATTACH DATABASE '/tmp/FIRE-UNAUTHORIZED' AS bad;\n")
            with self.assertRaises(sqlite3.Error):review(p)
            p.write_text('PRIVATE QA NAME invalid SQL')
            result=subprocess.run([sys.executable,str(Path(verify.__file__)),str(p),'--expected-sha256',hashlib.sha256(p.read_bytes()).hexdigest()],capture_output=True,text=True)
            self.assertEqual(result.returncode,2);self.assertNotIn('PRIVATE QA NAME',result.stdout+result.stderr)

    def test_backup_script_is_export_only_dry_by_default_and_exact_identity(self):
        s=(Path(__file__).parent/'owner_windows_qa_backup.ps1').read_text()
        for x in ('if (-not $Export)','qa_d1_identity_from_list.ps1',verify.qa.UUID,verify.qa.ACTIVE_VERSION,'Confirm-QAVersion','--expected-sha256','verify_qa_d1_export.py','ReparsePoint'):
            self.assertIn(x,s)
        self.assertLess(s.index('if (-not $Export)'),s.index('d1 list --json'))
        self.assertEqual(s.count('Confirm-QAVersion\n'),2)
        self.assertNotIn('d1 execute',s);self.assertNotIn('migrations apply',s);self.assertNotIn('deploy --',s)
        self.assertIn('Split-Path -Parent $repoDir',s)

if __name__=='__main__':unittest.main(verbosity=2)
