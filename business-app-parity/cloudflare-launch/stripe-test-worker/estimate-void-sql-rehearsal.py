#!/usr/bin/env python3
"""Synthetic in-memory SQLite rehearsal of the EXACT guarded Void SQL from route.ts.

No Cloudflare connection, no credentials, no real customer records, no D1 writes.
This verifies actual SQL effects, not just source substring matching.
"""
from __future__ import annotations
import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
ROUTE = ROOT / "shared/app/api/estimates/[id]/void/route.ts"
SOURCE = ROUTE.read_text(encoding="utf-8")
MATCH = re.search(r"const update = await env.DB.prepare\(\`([\s\S]*?)\`\)\.bind\(", SOURCE)
if not MATCH:
    raise RuntimeError("Void SQL query not found, fail closed rather than silently skipping tests")
SQL = MATCH.group(1)
DEPENDENCIES = ["invoices", "payments", "payment_refunds", "payment_checkout_sessions", "job_reports"]
QUOTE_ID = "00000000-0000-4000-8000-000000000001"
OTHER_ID = "00000000-0000-4000-8000-000000000002"

def db(*, missing_refunds=False):
    cn = sqlite3.connect(":memory:")
    cn.execute("PRAGMA foreign_keys=ON")
    cn.execute("CREATE TABLE estimates (id TEXT PRIMARY KEY, status TEXT, accepted_at TEXT, signed_at TEXT, scheduled_at TEXT)")
    for table in DEPENDENCIES:
        if missing_refunds and table == "payment_refunds":
            continue
        cn.execute(f"CREATE TABLE {table} (id TEXT PRIMARY KEY, estimate_id TEXT)")
    cn.execute("INSERT INTO estimates VALUES (?,?,?,?,?)", (OTHER_ID, "sent", None, None, None))
    return cn

def add(cn, status="draft", accepted=None, signed=None, scheduled=None, dependency=None):
    cn.execute("INSERT INTO estimates VALUES (?,?,?,?,?)",
               (QUOTE_ID, status, accepted, signed, scheduled))
    if dependency:
        cn.execute(f"INSERT INTO {dependency} VALUES (?,?)", ("dependency-"+dependency, QUOTE_ID))

def state(cn):
    return cn.execute("SELECT status,accepted_at,signed_at,scheduled_at FROM estimates WHERE id=?",
                      (QUOTE_ID,)).fetchone()

def attempt(cn):
    return cn.execute(SQL, [QUOTE_ID]*6).rowcount

class VoidSqlRehearsal(unittest.TestCase):
    def test_only_fresh_unaccepted_draft_or_sent_moves_to_lost(self):
        for status in ("draft","sent"):
            with self.subTest(status=status):
                cn=db()
                add(cn,status=status)
                self.assertEqual(attempt(cn),1)
                self.assertEqual(state(cn),("declined",None,None,None))
                self.assertEqual(attempt(cn),0,"no duplicate status transition")
                self.assertEqual(cn.execute("SELECT status FROM estimates WHERE id=?",(OTHER_ID,)).fetchone()[0],"sent")
                cn.close()

    def test_status_acceptance_signature_and_scheduling_independently_block(self):
        cases=[
            dict(status="approved"),
            dict(status="superseded"),
            dict(status="declined"),
            dict(status="draft", accepted="2026-11-02T15:00:00Z"),
            dict(status="sent", signed="2026-11-02T15:00:00Z"),
            dict(status="draft", scheduled="2026-11-04T10:00:00Z"),
        ]
        for kw in cases:
            with self.subTest(case=kw):
                cn=db()
                add(cn,**kw)
                before=state(cn)
                self.assertEqual(attempt(cn),0)
                self.assertEqual(state(cn),before)
                cn.close()

    def test_each_financial_or_job_dependency_rejects_void_without_mutation(self):
        for dependency in DEPENDENCIES:
            for status in ("draft","sent"):
                with self.subTest(dependency=dependency,status=status):
                    cn=db()
                    add(cn,status=status,dependency=dependency)
                    self.assertEqual(attempt(cn),0)
                    self.assertEqual(state(cn)[0],status)
                    self.assertEqual(cn.execute(f"SELECT COUNT(*) FROM {dependency} WHERE estimate_id=?",
                                                (QUOTE_ID,)).fetchone()[0],1)
                    cn.close()

    def test_missing_refund_ledger_fails_closed_instead_of_voiding(self):
        cn=db(missing_refunds=True)
        add(cn)
        with self.assertRaises(sqlite3.OperationalError):
            attempt(cn)
        self.assertEqual(state(cn)[0],"draft")
        cn.close()

    def test_no_destructive_sql_in_void_route(self):
        self.assertNotRegex(SOURCE, r"\bDELETE\s+FROM\b")
        self.assertEqual(SQL.count("?"),6)
        self.assertIn("status='declined'",SQL)

if __name__=="__main__":
    unittest.main(verbosity=2)
