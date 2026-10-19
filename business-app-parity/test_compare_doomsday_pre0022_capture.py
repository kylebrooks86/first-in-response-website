"""Offline-only synthetic regressions for historical Doomsday pre-0022 comparison."""
from copy import deepcopy
from datetime import datetime, timezone
from contextlib import redirect_stdout
from io import StringIO
import unittest
import compare_doomsday_pre0022_capture as m


class HistoricalDoonsdayComparisonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = m.expected_baseline()

    def receipt(self):
        return {
            "format": m.verifier.REQUIRED_CAPTURE_FORMAT,
            "captures": [{
                "target": "doomsday",
                "url": m.verifier.URLS["doomsday"],
                "capturedAt": datetime.now(timezone.utc).isoformat(),
                "providerMetadata": {
                    "binding": "DB", "databaseUuid": m.collector.UUID,
                    "activeVersion": "", "sourceCommit": "", "providerRecordId": "",
                },
                "truncated": False,
                "queries": [{"rows": deepcopy(rows)} for rows in self.baseline],
            }],
        }

    def test_22_migration_offline_baseline_matches(self):
        report = m.compare_capture(self.receipt())
        self.assertEqual(report["result"], "MATCH")
        self.assertEqual(report["baselineMigrationCount"], 22)
        self.assertEqual(report["currentCandidateMigrationCount"], 25)
        self.assertEqual(report["differenceQueryNumbers"], [])
        self.assertTrue(report["readOnlyFinancialChecksAllZero"])
        self.assertFalse(report["gate5Accepted"])
        self.assertFalse(report["providerAttestedActiveWorker"])
        self.assertEqual(report["officialReadinessPercent"], 30)

    def test_missing_or_extra_schema_is_reported_without_approval(self):
        data = self.receipt()
        data["captures"][0]["queries"][0]["rows"].pop()
        report = m.compare_capture(data)
        self.assertIn(1, report["differenceQueryNumbers"])
        self.assertEqual(report["result"], "REVIEW_REQUIRED")
        self.assertFalse(report["gate5Accepted"])

    def test_nonzero_financial_count_blocks_match(self):
        data = self.receipt()
        data["captures"][0]["queries"][6]["rows"][0]["provider_collision_groups"] = 1
        report = m.compare_capture(data)
        self.assertEqual(report["result"], "REVIEW_REQUIRED")
        self.assertIn(7, report["differenceQueryNumbers"])
        self.assertFalse(report["readOnlyFinancialChecksAllZero"])

    def test_wrong_or_missing_target_and_provider_claims_fail_closed(self):
        cases = [
            ("providerMetadata", "databaseUuid", "00000000-0000-0000-0000-000000000000"),
            ("providerMetadata", "sourceCommit", "f" * 40),
            ("root", "target", "live"),
            ("root", "url", "https://wrong.example"),
            ("root", "truncated", True),
        ]
        for field, name, value in cases:
            with self.subTest(field=field, name=name):
                data = self.receipt()
                obj = data["captures"][0]
                (obj["providerMetadata"] if field == "providerMetadata" else obj)[name] = value
                with self.assertRaises(ValueError):
                    m.compare_capture(data)

    def test_no_missing_queries_or_extra_private_columns(self):
        data = self.receipt()
        data["captures"][0]["queries"].pop()
        with self.assertRaises(ValueError):
            m.compare_capture(data)
        data = self.receipt()
        data["captures"][0]["queries"][6]["rows"][0]["customer_email"] = "should-not-exist"
        with self.assertRaises(ValueError):
            m.compare_capture(data)

    def test_query1_whitespace_candidate_requires_review_not_acceptance(self):
        expected = self.baseline[0]
        actual = deepcopy(expected)
        item = next(i for i, row in enumerate(actual) if isinstance(row["sql"], str))
        actual[item]["sql"] += " "
        detail = m.schema_object_differences(actual, expected)
        self.assertEqual(len(detail["changed"]), 1)
        self.assertEqual(detail["changed"][0][1], "WHITESPACE_TOKEN_CANDIDATE")
        self.assertFalse(detail["rowOrderOnly"])
        with redirect_stdout(StringIO()) as captured:
            m.print_schema_diagnostic(detail)
        self.assertNotIn("CREATE TABLE", captured.getvalue())
        self.assertNotIn("CREATE INDEX", captured.getvalue())
        data = self.receipt()
        data["captures"][0]["queries"][0]["rows"] = actual
        self.assertEqual(m.compare_capture(data)["result"], "REVIEW_REQUIRED")

    def test_query1_missing_and_unexpected_object_identifiers(self):
        expected = self.baseline[0]
        actual = deepcopy(expected)
        absent = actual.pop(0)
        actual.append({"type": "index", "name": "synthetic_new_index",
                       "tbl_name": "payments", "sql": "CREATE INDEX synthetic_new_index ON payments(id)"})
        detail = m.schema_object_differences(actual, expected)
        self.assertIn((absent["type"], absent["name"], absent["tbl_name"]), detail["missing"])
        self.assertIn(("index", "synthetic_new_index", "payments"), detail["unexpected"])

    def test_query1_structural_change_is_not_dismissed_as_formatting(self):
        expected = self.baseline[0]
        actual = deepcopy(expected)
        item = next(i for i, row in enumerate(actual) if isinstance(row["sql"], str))
        actual[item]["sql"] += " /* changed */"
        detail = m.schema_object_differences(actual, expected)
        self.assertEqual(detail["changed"][0][1], "DEFINITION_REVIEW_REQUIRED")

    def test_query1_order_only_and_duplicate_fail_closed(self):
        expected = self.baseline[0]
        actual = list(reversed(deepcopy(expected)))
        detail = m.schema_object_differences(actual, expected)
        self.assertTrue(detail["rowOrderOnly"])
        self.assertEqual(detail["changed"], [])
        actual = deepcopy(expected) + [deepcopy(expected[0])]
        with self.assertRaisesRegex(ValueError, "Duplicate schema object"):
            m.schema_object_differences(actual, expected)

    @staticmethod
    def reserved_table():
        return {"type": "table", "name": "_cf_KV", "tbl_name": "_cf_KV",
                "sql": "CREATE TABLE _cf_KV (\n key TEXT PRIMARY KEY,\n value BLOB\n) WITHOUT ROWID"}

    def test_exact_documented_d1_reserved_table_is_only_exception(self):
        data = self.receipt()
        data["captures"][0]["queries"][0]["rows"].append(self.reserved_table())
        report = m.compare_capture(data)
        self.assertEqual(report["result"], "MATCH_D1_RESERVED_TABLE")
        self.assertTrue(report["documentedD1ReservedTableOnly"])
        self.assertEqual(report["differenceQueryNumbers"], [1])
        self.assertEqual(report["applicationSchemaDifferenceQueryNumbers"], [])
        self.assertTrue(report["pre0022StructuralMatch"])
        self.assertTrue(report["readOnlyFinancialChecksAllZero"])
        self.assertFalse(report["providerAttestedActiveWorker"])
        self.assertFalse(report["physicalDatabaseIsolationVerified"])
        self.assertFalse(report["gate5Accepted"])
        self.assertEqual(report["officialReadinessPercent"], 30)

    def test_cf_kv_lookalikes_and_unreviewed_definitions_are_not_accepted(self):
        for field, value in [
                ("name", "_cf_METADATA"), ("tbl_name", "_cf_METADATA"),
                ("sql", "CREATE TABLE _cf_KV (secret TEXT)"),
                ("sql", "CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB, extra TEXT) WITHOUT ROWID"),
                ("sql", None)]:
            with self.subTest(field=field, value=value):
                data = self.receipt()
                row = self.reserved_table()
                row[field] = value
                data["captures"][0]["queries"][0]["rows"].append(row)
                report = m.compare_capture(data)
                self.assertEqual(report["result"], "REVIEW_REQUIRED")
                self.assertFalse(report["documentedD1ReservedTableOnly"])

    def test_reserved_object_does_not_mask_application_definition_drift(self):
        data = self.receipt()
        rows = data["captures"][0]["queries"][0]["rows"]
        rows.append(self.reserved_table())
        idx = next(i for i, row in enumerate(rows)
                   if row["name"] != "_cf_KV" and isinstance(row["sql"], str))
        rows[idx]["sql"] += " -- unreviewed change"
        report = m.compare_capture(data)
        self.assertEqual(report["result"], "REVIEW_REQUIRED")
        self.assertFalse(report["pre0022StructuralMatch"])

    def test_other_unexpected_objects_still_block_reserved_exception(self):
        data = self.receipt()
        rows = data["captures"][0]["queries"][0]["rows"]
        rows.append(self.reserved_table())
        rows.append({"type": "index", "name": "unreviewed_extra_index",
                     "tbl_name": "payments", "sql": "CREATE INDEX unreviewed_extra_index ON payments(id)"})
        report = m.compare_capture(data)
        self.assertEqual(report["result"], "REVIEW_REQUIRED")
        self.assertFalse(report["documentedD1ReservedTableOnly"])

    def test_financial_anomalies_block_even_if_only_cf_kv_is_extra(self):
        data = self.receipt()
        data["captures"][0]["queries"][0]["rows"].append(self.reserved_table())
        data["captures"][0]["queries"][6]["rows"][0]["provider_collision_groups"] = 1
        report = m.compare_capture(data)
        self.assertEqual(report["result"], "REVIEW_REQUIRED")
        self.assertFalse(report["readOnlyFinancialChecksAllZero"])
        self.assertFalse(report["gate5Accepted"])

    def test_0022_migration_cannot_be_mislabeled_historical_baseline(self):
        data = self.receipt()
        data["captures"][0]["queries"][4]["rows"].append({
            "name": "0022_stripe_provider_uniqueness.sql",
        })
        with self.assertRaises(ValueError):
            m.compare_capture(data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
