"""Offline-only synthetic regressions for historical Doomsday pre-0022 comparison."""
from copy import deepcopy
from datetime import datetime, timezone
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
        self.assertEqual(report["currentCandidateMigrationCount"], 23)
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

    def test_0022_migration_cannot_be_mislabeled_historical_baseline(self):
        data = self.receipt()
        data["captures"][0]["queries"][4]["rows"].append({
            "name": "0022_stripe_provider_uniqueness.sql",
        })
        with self.assertRaises(ValueError):
            m.compare_capture(data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
