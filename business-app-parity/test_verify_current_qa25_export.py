"""Real in-memory SQLite, synthetic records only; no provider or existing backups."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import verify_current_qa25_export as verify
from test_qa_d1_export import fixture as original23


def fixture(folder,mutation=None):
    p=original23(folder)
    with sqlite3.connect(':memory:') as db:
        db.executescript(p.read_text())
        for name in sorted(verify.NEW_GIT_BLOBS):
            db.executescript((verify.qa.BASE/name).read_text());db.execute('INSERT INTO d1_migrations(name) VALUES(?)',(name,))
        event='00000000-0000-4000-8000-000000000001'
        db.execute("INSERT INTO deposit_policy_events(id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,previous_deposit_cents,new_deposit_cents,paid_principal_cents,created_at) VALUES(?,'private-estimate','synthetic-confirmation','synthetic@example.invalid','standard',10000,5000,5000,10000,'2026-10-29')",(event,))
        # Valid SQL history is deliberately not a certified cryptographic signature.
        db.execute("INSERT INTO deposit_agreement_snapshots VALUES(?,? ,?,?,10000,5000,'standard','[]',?,'PRIVATE SIGNER','no','2026-10-29','2026-10-29')",(event,'private-estimate','deposit-exception-v1:'+event,'0'*64,'SYNTHETIC AGREEMENT TEXT ONLY. '*4))
        if mutation:mutation(db)
        p.write_text('\n'.join(db.iterdump())+'\n')
    return p


def review(p):return verify.review_export(p,expected_sha256=hashlib.sha256(p.read_bytes()).hexdigest())


class CurrentQA25Tests(unittest.TestCase):
    def test_current25_nonempty_history_preserved_without_any_migration_replay(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder);before=p.read_bytes();r=review(p)
            self.assertTrue(r['current25OfflineReviewPassed']);self.assertTrue(all(r['checks'].values()));self.assertEqual(before,p.read_bytes())
            for k in ('migrationRehearsalPerformed','exportOriginIndependentlyVerified','liveCompletenessVerified','signatureDocumentDigestsVerified','photoBytesVerified','hostedMigrationAuthorized','publicationAuthorized','remoteRollbackTested'):self.assertFalse(r[k])
            self.assertEqual((r['releaseGatesPassed'],r['releaseGatesTotal']),(3,10))
            for private in ('PRIVATE QA NAME','PRIVATE SIGNER','cs_private_value','private-estimate','SYNTHETIC AGREEMENT TEXT'):self.assertNotIn(private,json.dumps(r))
            self.assertNotIn('expectedActiveVersion',r)

    def test_23_export_refused_instead_of_replayed_or_forged(self):
        with tempfile.TemporaryDirectory() as folder:
            p=original23(folder);before=p.read_bytes()
            with self.assertRaises(verify.QAExportStop) as stopped:review(p)
            self.assertFalse(stopped.exception.receipt['checks']['journalExactlyCurrent25']);self.assertEqual(before,p.read_bytes())

    def test_current25_drift_and_orphans_refuse_without_leaking_rows(self):
        mutations=[
            lambda db:db.execute("UPDATE d1_migrations SET name='private-forged-journal' WHERE id=25"),
            lambda db:db.execute('DROP INDEX idx_payments_stripe_provider_unique'),
            lambda db:db.execute('DROP TRIGGER deposit_agreement_snapshots_no_delete'),
            lambda db:db.execute('CREATE TABLE unexpected_private_table(secret TEXT)'),
            lambda db:db.execute('CREATE VIEW unexpected_view AS SELECT name FROM customers'),
            lambda db:db.executescript('CREATE TRIGGER forged_journal AFTER INSERT ON d1_migrations BEGIN DELETE FROM payments; END;'),
            lambda db:db.execute("UPDATE estimates SET customer_id='private-missing-customer'"),
            lambda db:db.execute("UPDATE payments SET estimate_id='private-missing-estimate'"),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation),tempfile.TemporaryDirectory() as folder:
                p=fixture(folder,mutation);before=p.read_bytes()
                with self.assertRaises(verify.QAExportStop) as stopped:review(p)
                self.assertEqual(before,p.read_bytes())
                for private in ('PRIVATE QA NAME','PRIVATE SIGNER','private-forged-journal','private-missing','cs_private_value'):self.assertNotIn(private,json.dumps(stopped.exception.receipt))

    def test_reserved_provider_blob_table_preserved_only_in_documented_shape(self):
        with tempfile.TemporaryDirectory() as folder:
            def mutate(db):
                db.execute('CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID');db.execute('INSERT INTO _cf_KV VALUES(?,?)',('synthetic',bytes([0,255,7])))
            self.assertTrue(review(fixture(folder,mutate))['checks']['allRestoredValuesUnchanged'])
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder,lambda db:db.execute('CREATE TABLE _cf_KV(secret TEXT)'))
            with self.assertRaises(verify.QAExportStop):review(p)

    def test_hash_symlink_empty_encoding_and_unsafe_sql_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder)
            with self.assertRaises(verify.QAExportStop):verify.review_export(p,expected_sha256='0'*64)
            link=Path(folder)/'link.sql';link.symlink_to(p)
            with self.assertRaises(verify.QAExportStop):review(link)
            original=p.read_text()
            for extra in ("ATTACH DATABASE 'PRIVATE-FORBIDDEN' AS secret;",'CREATE TEMP TABLE private_temp(secret TEXT);','PRAGMA writable_schema=ON;'):
                p.write_text(original+'\n'+extra)
                with self.assertRaises(verify.QAExportStop) as stopped:review(p)
                self.assertEqual(stopped.exception.receipt['diagnosticCode'],'SQLITE_AUTHORIZER_REFUSED')
                self.assertNotIn('PRIVATE-FORBIDDEN',json.dumps(stopped.exception.receipt))
            for payload in (b'',b'\xff\xfe','PRIVATE SQL ERROR'.encode()):
                p.write_bytes(payload)
                with self.assertRaises(verify.QAExportStop):review(p)

    def test_unclean_financial_diagnostic_stops(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder)
            with patch.object(verify,'read_only_ledger_counts',return_value=[0,1,0,0]):
                with self.assertRaises(verify.QAExportStop) as stopped:review(p)
                self.assertFalse(stopped.exception.receipt['checks']['financialLedgerClean'])

    def test_cli_outputs_only_receipt_and_preserves_input(self):
        with tempfile.TemporaryDirectory() as folder:
            p=fixture(folder);before=p.read_bytes();cmd=[sys.executable,str(Path(verify.__file__)),str(p),'--expected-sha256',hashlib.sha256(before).hexdigest()]
            run=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(run.returncode,0);self.assertTrue(json.loads(run.stdout)['current25OfflineReviewPassed']);self.assertEqual(before,p.read_bytes())
            self.assertNotIn('PRIVATE SIGNER',run.stdout+run.stderr)
            p.write_text('PRIVATE SQL ERROR');cmd[-1]=hashlib.sha256(p.read_bytes()).hexdigest();run=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(run.returncode,2);self.assertNotIn('PRIVATE SQL ERROR',run.stdout+run.stderr)

if __name__=='__main__':unittest.main()
