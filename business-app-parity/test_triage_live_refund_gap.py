"""Local-only LIVE refund Gate 5 triage regressions; no hosted credentials."""
import copy
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

import triage_live_refund_gap as m

STAMP = "2026-10-22T22:30:00Z"


def cap(n):
    return {
        "format": m.FORMAT,
        "target": "live",
        "url": m.LIVE_URL,
        "capturedAt": STAMP,
        "queries": [{"rows": r} for r in m.fixture(n)],
    }


class RefundGapReadOnlyTriage(unittest.TestCase):
    def test_three_selects_work_with_missing_payment_refunds(self):
        statements = m.select_queries()
        self.assertEqual(len(statements), 3)
        self.assertTrue(all(s.lstrip().upper().startswith("SELECT ") for s in statements))
        for n in (18, 19, 20, 21, 23):
            with self.subTest(migrations=n):
                data = cap(n)
                self.assertEqual(len(data["queries"]), 3)
                self.assertEqual(data["queries"][2]["rows"], [{"provider_collision_groups": 0}])
                self.assertEqual([x["name"] for x in data["queries"][1]["rows"]],
                                 [p.name for p in m.candidates()[:n]])
                self.assertFalse(m.evaluate(data)["authorizedToApplyMigration"])

    def test_0019_not_applied_is_a_diagnostic_not_automatic_migration_permission(self):
        r = m.evaluate(cap(19))
        self.assertEqual(r["disposition"], "CONSISTENT_WITH_0019_NOT_YET_APPLIED")
        self.assertFalse(r["paymentRefundsPresent"])
        self.assertTrue(r["wholeSchemaMatchesObservedLocalPrefix"])
        self.assertTrue(r["journalExactCandidatePrefix"])
        self.assertEqual(r["observedMigrationEntries"], 19)
        self.assertEqual(r["refundMigration"], "0019_unknown_jubilee.sql")
        self.assertFalse(r["gate5Passed"])
        self.assertFalse(r["authorizedToApplyMigration"])
        self.assertFalse(r["productionReady"])

    def test_initial_refund_migration_present_with_indexes_not_release_approved(self):
        for n in (20, 21, 23):
            with self.subTest(n=n):
                r = m.evaluate(cap(n))
                self.assertTrue(r["paymentRefundsPresent"])
                self.assertTrue(r["wholeSchemaMatchesObservedLocalPrefix"])
                self.assertEqual(r["disposition"], "REFUND_TABLE_PRESENT_IN_TECHNICALLY_MATCHING_LOCAL_PREFIX")
                self.assertFalse(r["gate4Passed"])
                self.assertFalse(r["gate5Passed"])

    def test_table_missing_but_0019_in_journal_reports_inconsistent_state(self):
        data = cap(20)
        data["queries"][0]["rows"] = [row for row in data["queries"][0]["rows"]
                                       if row["tbl_name"] != "payment_refunds"]
        r = m.evaluate(data)
        self.assertEqual(r["disposition"], "REFUND_TABLE_MISSING_DESPITE_0019_JOURNAL")
        self.assertFalse(r["wholeSchemaMatchesObservedLocalPrefix"])
        self.assertFalse(r["authorizedToApplyMigration"])

    def test_table_present_but_0019_absent_from_journal_reports_inconsistent_state(self):
        data = cap(20)
        data["queries"][1]["rows"].pop()
        r = m.evaluate(data)
        self.assertEqual(r["disposition"], "REFUND_TABLE_PRESENT_WITHOUT_0019_JOURNAL")
        self.assertFalse(r["wholeSchemaMatchesObservedLocalPrefix"])

    def test_wrong_or_out_of_order_or_unknown_migration_journal_blocks(self):
        for modify in (
            lambda rows: rows.reverse(),
            lambda rows: rows.append({"name": "0023_unknown.sql"}),
            lambda rows: rows.__setitem__(0, {"name": "0000_wrong.sql"}),
            lambda rows: rows.pop(8),
        ):
            data = cap(20)
            modify(data["queries"][1]["rows"])
            r = m.evaluate(data)
            self.assertFalse(r["journalExactCandidatePrefix"])
            self.assertEqual(r["disposition"], "UNKNOWN_OR_NONPREFIX_MIGRATION_JOURNAL")
            self.assertFalse(r["authorizedToApplyMigration"])

    def test_unexpected_sql_or_missing_index_blocks_without_auto_repair(self):
        data = cap(20)
        rows = data["queries"][0]["rows"]
        target = next(x for x in rows if x["name"] == "idx_payment_refunds_provider")
        target["sql"] = target["sql"] + " -- extra"
        r = m.evaluate(data)
        self.assertEqual(r["disposition"], "SCHEMA_JOURNAL_DISAGREE_OR_UNREVIEWED_DDL")
        self.assertFalse(r["wholeSchemaMatchesObservedLocalPrefix"])
        self.assertFalse(r["gate5Passed"])

    def test_provider_collisions_block_unique_index_even_with_correct_schema(self):
        data = cap(20)
        data["queries"][2]["rows"][0]["provider_collision_groups"] = 3
        r = m.evaluate(data)
        self.assertEqual(r["disposition"], "PAYMENT_PROVIDER_COLLISIONS_BLOCK_INDEX_0020")
        self.assertFalse(r["authorizedToApplyMigration"])

    def test_malformed_and_unavailable_results_never_default_to_empty(self):
        baseline = cap(20)
        for modify in (
            lambda d: d["queries"].pop(),
            lambda d: d["queries"][0].update(error="Missing table"),
            lambda d: d["queries"][0].update(rows=""),
            lambda d: d["queries"][1].update(rows=[{"value": "fake"}]),
            lambda d: d["queries"][2].update(rows=[{"provider_collision_groups": False}]),
            lambda d: d["queries"][2].update(rows=[]),
            lambda d: d.update(target="staging"),
            lambda d: d.update(url="https://evil.invalid"),
            lambda d: d.update(customerPaymentRows=[{"id": "do-not-include"}]),
        ):
            data = copy.deepcopy(baseline)
            modify(data)
            with self.assertRaises(ValueError):
                m.evaluate(data)

    def test_real_saved_sites_inventory_ends_at_journal_blocker(self):
        path = m.ROOT / "HOSTED_READ_ONLY_VERIFICATION_20261022.json"
        data = m.strict_json(path)
        result = m.from_saved_sites_receipt(data)
        self.assertEqual(result["liveObservedTableNames"], 18)
        self.assertFalse(result["paymentRefundsPresent"])
        self.assertFalse(result["migrationJournalObtained"])
        self.assertFalse(result["physicalD1UuidObtained"])
        self.assertEqual(result["candidateIntroducesPaymentRefundsAtMigration"],
                         "0019_unknown_jubilee.sql")
        self.assertFalse(result["safeToMigrate"])
        self.assertFalse(result["gate5Passed"])

    def test_saved_sites_overview_must_be_complete(self):
        original = m.strict_json(m.ROOT / "HOSTED_READ_ONLY_VERIFICATION_20261022.json")
        for mutate in (
            lambda d: d["targets"][0]["databaseOverview"]["model_projection"].update(truncated=True),
            lambda d: d["targets"][0].update(projectId="wrong"),
            lambda d: d["targets"][0]["databaseOverview"].update(tables=["payments", "payments"]),
            lambda d: d.pop("targets"),
        ):
            data = copy.deepcopy(original)
            mutate(data)
            with self.assertRaises(ValueError):
                m.from_saved_sites_receipt(data)

    def test_strict_json_rejects_duplicate_keys_nan_and_large_data(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "metadata.json"
            for contents in ('{"format":"x","format":"y"}',
                             '{"something":NaN}', '{"something":-Infinity}',
                             "[" + "0," * 1_050_000 + "0]"):
                p.write_text(contents)
                with self.assertRaises(ValueError):
                    m.strict_json(p)

    def test_diagnostic_selects_leave_disposable_database_unmodified(self):
        files = m.candidates()
        with sqlite3.connect(":memory:") as db:
            for file in files[:19]:
                db.executescript(file.read_text(encoding="utf-8"))
            db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)")
            db.executemany("INSERT INTO d1_migrations(name) VALUES (?)",
                           [(x.name,) for x in files[:19]])
            before_changes = db.total_changes
            before_ddl = list(db.iterdump())
            db.execute("PRAGMA query_only=ON")
            for query in m.select_queries():
                db.execute(query).fetchall()
            self.assertEqual(before_changes, db.total_changes)
            self.assertEqual(before_ddl, list(db.iterdump()))

    def test_cli_saved_site_receipt_is_read_only_blocked_gate(self):
        from contextlib import redirect_stdout
        from io import StringIO
        capture = StringIO()
        with redirect_stdout(capture):
            result = m.main(["--sites-receipt", str(m.ROOT / "HOSTED_READ_ONLY_VERIFICATION_20261022.json")])
        self.assertEqual(result, 0)
        report = json.loads(capture.getvalue())
        self.assertFalse(report["safeToMigrate"])
        self.assertFalse(report["gate4Passed"])
        self.assertFalse(report["gate5Passed"])


if __name__ == "__main__":
    unittest.main()
