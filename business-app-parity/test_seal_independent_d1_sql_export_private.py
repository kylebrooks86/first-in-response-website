"""Focused 26-real-migration SQL -> encrypted records -> isolated restore proof.

Disposable synthetic SQLite only. No Wrangler, Cloudflare, Stripe, credentials,
owner backups, provider writes, deployments, or repeated owner QA tests.
Run: python3 business-app-parity/test_seal_independent_d1_sql_export_private.py
"""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

from seal_independent_d1_sql_export_private import (
    LocalBridgeStop, BASE, reviewed_migrations, seal_saved_full_sql_export,
)

PHRASE = "FIRE synthetic PRIVATE D1 SQL bridge recovery phrase 2026"


def migrated(connection, *, with_last=True, sample=False):
    names = reviewed_migrations()
    connection.execute(
        "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "name TEXT NOT NULL UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)"
    )
    for i, name in enumerate(names[:26 if with_last else 25], 1):
        source = (BASE / "adapters/doomsday/drizzle" / name if i <= 25 else
                  BASE / "adapters/independent-live/drizzle" / name)
        connection.executescript(source.read_text("utf-8"))
        connection.execute("INSERT INTO d1_migrations(id,name) VALUES (?,?)", (i, name))
    connection.commit()
    if sample:
        connection.execute(
            "INSERT INTO customers(id,name,created_at) VALUES (?,?,?)",
            ("private-test-customer", "synthetic only", "2026-11-13T00:00:00Z")
        )
        connection.execute(
            "INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES (?,?)",
            ("private-test-customer", "2026-11-13T00:00:00Z")
        )
        connection.execute(
            "INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,"
            "total_cents,deposit_cents,created_at) VALUES (?,?,'completed',3000,0,3000,1500,?)",
            ("private-test-estimate", "private-test-customer", "2026-11-13T00:01:00Z")
        )
        connection.execute(
            "INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)",
            ("private-test-estimate", "2026-11-13T00:01:00Z")
        )
        connection.execute(
            "INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)",
            ("private-test-estimate", 1)
        )
        connection.execute(
            "INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,"
            "created_at) VALUES (?,?,'Balance',3000,'paid',?,?)",
            ("synthetic-paid", "private-test-estimate", "manual:synthetic", "2026-11-13T00:02:00Z")
        )
        connection.execute(
            "INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,"
            "created_at) VALUES (?,?,'Refund',-500,'paid',?,?)",
            ("synthetic-refund-ledger", "private-test-estimate",
             "refund:synthetic-paid:synthetic-refund", "2026-11-13T00:03:00Z")
        )
        connection.execute(
            "INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,"
            "created_at) VALUES (?,?,?,500,'manual','succeeded',?)",
            ("synthetic-refund", "synthetic-paid", "private-test-estimate", "2026-11-13T00:03:00Z")
        )
        connection.commit()


class PrivateD1SqlBridge(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="fire-private-d1-synthetic-")
        self.addCleanup(self.tmp.cleanup)
        folder = Path(self.tmp.name)
        self.source = folder / "original-owner-export-synthetic.sql"
        self.output = folder / "sealed-synthetic.firerecords"
        self.template = folder / "empty-independent-synthetic.sqlite"
        source = sqlite3.connect(":memory:")
        try:
            migrated(source, sample=True)
            self.source.write_text("\n".join(source.iterdump()) + "\n", "utf-8")
        finally:
            source.close()
        independent = sqlite3.connect(self.template)
        try:
            migrated(independent)
        finally:
            independent.close()
        self.hash = hashlib.sha256(self.source.read_bytes()).hexdigest()

    def bridge(self, *, src=None, out=None, digest=None, acknowledged=True):
        return seal_saved_full_sql_export(
            src or self.source, out or self.output, digest or self.hash, PHRASE,
            acknowledged_private_folder=acknowledged,
        )

    def test_real_26_migrations_and_synthetic_financial_values_survive_encryption(self):
        receipt = self.bridge()
        self.assertTrue(receipt["protectedRecordsCreatedAndReadBack"])
        self.assertEqual(receipt["reviewedMigrationCount"], 26)
        self.assertEqual(receipt["localCustomerRowsObserved"], 1)
        self.assertEqual(receipt["sourceSqlSha256"], self.hash)
        self.assertFalse(receipt["sourceProviderCompletenessVerified"])
        self.assertFalse(receipt["encryptedOffDeviceCustodyVerified"])
        self.assertFalse(receipt["gate7Accepted"])
        self.assertEqual(receipt["protectedRecordsSha256"],
                         hashlib.sha256(self.output.read_bytes()).hexdigest())
        self.assertEqual(self.hash, hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual(list(Path(self.tmp.name).glob(".fire-transient-owner-records-*")), [])

        restored = Path(self.tmp.name) / "recovered-synthetic.sqlite"
        node_script = BASE / "protected_complete_isolated_sqlite_recovery.mjs"
        process = subprocess.run(
            ["node", "--experimental-sqlite", str(node_script), "restore",
             str(self.output), str(self.template), str(restored)],
            input=PHRASE + "\n", text=True, capture_output=True, timeout=120
        )
        self.assertEqual(process.returncode, 0, "existing protected-record restore failed")
        opened = json.loads(process.stdout)
        self.assertTrue(opened["sqliteRestoreVerified"])
        self.assertTrue(opened["plaintextJsonFilesWritten"] is False)
        db = sqlite3.connect(restored)
        try:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM d1_migrations").fetchone()[0], 26)
            self.assertEqual(db.execute("SELECT customer_number FROM fire_customer_numbers").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT job_number FROM fire_job_numbers").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT amount_cents FROM payment_refunds").fetchone()[0], 500)
            self.assertEqual(db.execute("SELECT amount_cents FROM payments WHERE type='Refund'").fetchone()[0], -500)
        finally:
            db.close()

    def test_incomplete_both_25_of_26_source_is_rejected_before_ciphertext(self):
        incomplete = Path(self.tmp.name) / "incomplete-25.sql"
        conn = sqlite3.connect(":memory:")
        try:
            migrated(conn, with_last=False)
            incomplete.write_text("\n".join(conn.iterdump()) + "\n", "utf-8")
        finally:
            conn.close()
        with self.assertRaises(LocalBridgeStop):
            self.bridge(src=incomplete, digest=hashlib.sha256(incomplete.read_bytes()).hexdigest())
        self.assertFalse(self.output.exists())

    def test_full_sql_cannot_omit_index_while_preserving_all_journal_rows(self):
        # A filtered/altered dump can keep all 26 migration names but lose an
        # independent refund/financial safeguard. Do not encrypt it as complete.
        db = sqlite3.connect(self.template)
        try:
            chosen = db.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
                " ORDER BY name LIMIT 1"
            ).fetchone()
            self.assertIsNotNone(chosen, "reviewed 26-migration schema needs named indexes")
        finally:
            db.close()
        partial = Path(self.tmp.name) / "omitted-index-full-journal.sql"
        partial.write_text(self.source.read_text("utf-8") +
                           '\nDROP INDEX "' + chosen[0] + '";\n', "utf-8")
        with self.assertRaises(LocalBridgeStop):
            self.bridge(src=partial, digest=hashlib.sha256(partial.read_bytes()).hexdigest())
        self.assertFalse(self.output.exists())

    def test_wrong_hash_and_no_private_folder_approval_fail_closed(self):
        with self.assertRaises(LocalBridgeStop):
            self.bridge(digest="0" * 64)
        with self.assertRaises(LocalBridgeStop):
            self.bridge(acknowledged=False)
        self.assertFalse(self.output.exists())

    def test_no_attach_or_writable_schema_even_with_matching_hash(self):
        for name, payload in (
            ("attack-attach.sql", "ATTACH DATABASE '/tmp/fire-no-write.db' AS outside;"),
            ("attack-pragma.sql", "PRAGMA writable_schema=ON;"),
        ):
            with self.subTest(name=name):
                attempt = Path(self.tmp.name) / name
                attempt.write_text(payload, "utf-8")
                with self.assertRaises(sqlite3.DatabaseError):
                    self.bridge(src=attempt, digest=hashlib.sha256(attempt.read_bytes()).hexdigest())
                self.assertFalse(self.output.exists())

    def test_forged_immutable_number_trigger_body_with_same_name_is_rejected(self):
        # A forged full SQL dump could retain every table, trigger and index
        # NAME yet replace a permanent-number trigger with a no-op.
        # Its independently valid SQL must NOT become a trusted backup.
        original = self.source.read_text("utf-8")
        expected = "BEFORE UPDATE ON fire_customer_numbers"
        self.assertIn(expected, original)
        forged = original.replace(expected, expected + " WHEN 0", 1)
        altered = Path(self.tmp.name) / "matching-names-unsafe-trigger.sql"
        altered.write_text(forged, "utf-8")
        with self.assertRaises(LocalBridgeStop):
            self.bridge(src=altered, digest=hashlib.sha256(altered.read_bytes()).hexdigest())
        self.assertFalse(self.output.exists())

    def test_never_overwrite_preexisting_encrypted_output(self):
        self.output.write_bytes(b"keep original private backup exactly")
        with self.assertRaises(LocalBridgeStop):
            self.bridge()
        self.assertEqual(self.output.read_bytes(), b"keep original private backup exactly")


if __name__ == "__main__":
    unittest.main(verbosity=2)
