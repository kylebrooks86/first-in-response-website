"""Synthetic-only current 25-migration QA export acceptance and fail-closed tests."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from test_qa_d1_export import fixture
from review_qa_update_schema import NEW_GIT_BLOBS
from verify_qa_current25_d1_export import (
    verify_current25_export, CurrentQAExportStop,
    LAST_QA_WORKER_VERSION, FULL_NAMES
)
import capture_existing_qa_schema_read_only as qa


def make_current25(folder, alter=None):
    base=fixture(folder)
    with sqlite3.connect(":memory:") as db:
        db.executescript(base.read_text(encoding="utf-8"))
        for name in sorted(NEW_GIT_BLOBS):
            db.executescript((qa.BASE/name).read_text(encoding="utf-8"))
            db.execute("INSERT INTO d1_migrations(name) VALUES (?)",(name,))
        if alter is not None:
            alter(db)
        db.commit()
        base.write_text("\n".join(db.iterdump())+"\n",encoding="utf-8")
    return base


def check(file):
    return verify_current25_export(
        file,expected_sha256=hashlib.sha256(file.read_bytes()).hexdigest()
    )


class CurrentQA25RestoreTests(unittest.TestCase):
    def test_current25_export_with_real_records_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            file=make_current25(folder)
            original=file.read_bytes()
            verified=check(file)
            self.assertEqual(verified["status"],"OFFLINE_CURRENT_QA_25_RESTORE_PASSED")
            self.assertEqual(verified["lastOwnerObservedQAWorkerVersion"],LAST_QA_WORKER_VERSION)
            self.assertEqual(verified["assertedQAUuid"],qa.UUID)
            self.assertEqual(len(FULL_NAMES),25)
            self.assertEqual(file.read_bytes(),original)
            self.assertTrue(all(verified["checks"].values()))
            for key in ("remoteOperationsPerformed","backupOriginVerified",
                        "hostedRestoreTested","qaUpdateAuthorized",
                        "productionReleaseAuthorized","completeCloudPhotosVerified"):
                self.assertFalse(verified[key])
            receipt=json.dumps(verified)
            for private in ("PRIVATE QA NAME","private-customer","private-payment",
                            "private-estimate","cs_private_value"):
                self.assertNotIn(private,receipt)

    def test_documented_cf_kv_with_blob_restores_without_data_leak(self):
        def add(db):
            db.execute("CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID")
            db.execute("INSERT INTO _cf_KV VALUES('internal',X'FF0001')")
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(all(check(make_current25(folder,add))["checks"].values()))

    def test_existing_signed_audit_history_and_immutable_trigger(self):
        def add(db):
            db.execute("""INSERT INTO deposit_policy_events
              (id,estimate_id,confirmation_id,actor_email,mode,
               previous_total_cents,previous_deposit_cents,
               new_deposit_cents,paid_principal_cents,created_at)
              VALUES ('00000000-0000-4000-8000-000000000099','private-estimate','owner-confirm',
               'synthetic-owner@example.invalid','waive',10000,5000,0,0,
               '2026-10-31T12:00:00Z')""")
            db.execute("""INSERT INTO deposit_agreement_snapshots
              (event_id,estimate_id,document_version,document_digest,total_cents,
               deposit_cents,mode,scope_json,agreement_text,signed_name,
               photo_release,signed_at,accepted_at)
              VALUES('00000000-0000-4000-8000-000000000099','private-estimate','deposit-exception-v1:00000000-0000-4000-8000-000000000099',
               ?,10000,0,'waive','[]',
               'A synthetic complete agreement over fifty characters for local tests only.',
               'Synthetic Customer','no','2026-10-31','2026-10-31')""",("a"*64,))
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(check(make_current25(folder,add))["checks"]["recoveredIntegrityClean"])

    def test_old_23_export_is_not_current25(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(CurrentQAExportStop) as error:
                check(fixture(folder))
            self.assertIn(error.exception.receipt["diagnosticCode"],
                          ("SQLITE_RESTORE_OR_INTEGRITY_FAILED",
                           "CURRENT_25_SCHEMA_JOURNAL_OR_LEDGER_MISMATCH"))

    def test_source_hash_mismatch_and_symlink_denied(self):
        with tempfile.TemporaryDirectory() as folder:
            file=make_current25(folder)
            with self.assertRaises(CurrentQAExportStop) as error:
                verify_current25_export(file,expected_sha256="0"*64)
            self.assertEqual(error.exception.receipt["diagnosticCode"],"OWNER_EXPORT_SHA256_MISMATCH")
            link=Path(folder)/"linked.sql"
            link.symlink_to(file)
            with self.assertRaises(CurrentQAExportStop) as error:
                check(link)
            self.assertEqual(error.exception.receipt["diagnosticCode"],"INVALID_OWNER_PRIVATE_SQL_FILE")

    def test_missing_or_changed_immutable_audit_or_schema_objects(self):
        cases=(
            lambda db: db.execute("DELETE FROM d1_migrations WHERE id=25"),
            lambda db: db.execute("UPDATE d1_migrations SET name='0024_fake.sql' WHERE id=25"),
            lambda db: db.execute("DROP TRIGGER deposit_agreement_snapshots_no_delete"),
            lambda db: db.execute("DROP INDEX idx_payments_stripe_provider_unique"),
            lambda db: db.execute("CREATE TABLE private_surprise(secret TEXT)"),
            lambda db: db.execute("DELETE FROM d1_migrations WHERE id=1"),
            lambda db: db.execute("UPDATE estimates SET customer_id='missing'"),
            lambda db: db.execute("UPDATE payments SET estimate_id='missing'"),
            lambda db: db.execute("UPDATE payments SET amount_cents=-20 WHERE id='private-payment'"),
        )
        for i,change in enumerate(cases):
            with self.subTest(case=i),tempfile.TemporaryDirectory() as folder:
                file=make_current25(folder,change)
                with self.assertRaises(CurrentQAExportStop) as error:
                    check(file)
                self.assertFalse(error.exception.receipt["qaUpdateAuthorized"])

    def test_attach_refused_and_private_rows_never_printed_by_cli(self):
        with tempfile.TemporaryDirectory() as folder:
            file=make_current25(folder)
            file.write_text(file.read_text()+"\nATTACH DATABASE '/tmp/private-qa-abuse' AS external;\n")
            with self.assertRaises(CurrentQAExportStop) as err:
                check(file)
            self.assertEqual(err.exception.receipt["diagnosticCode"],"SQLITE_RESTORE_OR_INTEGRITY_FAILED")
            result=subprocess.run(
                [sys.executable,str(Path(__file__).with_name("verify_qa_current25_d1_export.py")),
                 str(file),"--expected-sha256",hashlib.sha256(file.read_bytes()).hexdigest()],
                check=False,capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            receipt=json.loads(result.stdout)
            self.assertEqual(receipt["status"],"BLOCKED")
            for private in ("PRIVATE QA NAME","private-customer","cs_private_value",
                            "/tmp/private-qa-abuse"):
                self.assertNotIn(private,result.stdout+result.stderr)


if __name__=="__main__":
    unittest.main(verbosity=2)
