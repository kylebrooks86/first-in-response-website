"""Synthetic negative-control tests for read-only hosted metadata comparison.

Every fixture is built from disposable local SQLite migrations. Nothing here
connects to Cloudflare, reads real customer rows or authorizes a release.
"""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from verify_hosted_schema_capture import (
    EXISTING_DOOMSDAY_D1, REQUIRED_CAPTURE_FORMAT, TARGETS, URLS,
    evaluate, evaluate_path, local_expected,
)

UUIDS = {
    "live": "11111111-1111-4111-8111-111111111111",
    "staging": "22222222-2222-4222-8222-222222222222",
    "doomsday": EXISTING_DOOMSDAY_D1,
}


def fixture():
    result = {"format": REQUIRED_CAPTURE_FORMAT, "captures": []}
    for target in TARGETS:
        queries, _ = local_expected(target)
        result["captures"].append({
            "target": target,
            "url": URLS[target],
            "capturedAt": "2026-10-14T18:00:00Z",
            "providerMetadata": {
                "binding": "DB",
                "databaseUuid": UUIDS[target],
                "activeVersion": "SYNTHETIC-NOT-A-REAL-DEPLOYMENT",
                "sourceCommit": "a" * 40,
                "providerRecordId": "SYNTHETIC-UNATTESTED-NOT-EVIDENCE",
            },
            "truncated": False,
            "queries": [{"rows": rows} for rows in queries],
        })
    return result


class ReadOnlyCapture(unittest.TestCase):
    def setUp(self):
        self.fixture = fixture()
        self.assertEqual(len(self.fixture["captures"]), 3)

    def evaluate_mutation(self, change, contains):
        data = copy.deepcopy(self.fixture)
        change(data)
        result = evaluate(data)
        self.assertFalse(result["candidateSchemaComparisonPassed"])
        errors = [reason for item in result["targets"].values() for reason in item["blockers"]]
        self.assertTrue(any(contains in reason for reason in errors), errors)
        self.assertFalse(result["gate4Passed"])
        self.assertFalse(result["gate5Passed"])
        self.assertFalse(result["productionReady"])
        self.assertFalse(result["publicationAuthorized"])

    def test_all_disposable_candidate_schemas_match_but_do_not_release(self):
        report = evaluate(self.fixture)
        self.assertTrue(report["candidateSchemaComparisonPassed"])
        self.assertTrue(report["suppliedImmutableUuidStringsDistinct"])
        self.assertTrue(report["allThreeTargetsProvided"])
        self.assertEqual([report["targets"][target]["candidateMigrationCount"] for target in TARGETS],
                         [21, 21, 23])
        self.assertFalse(report["providerAttestationVerified"])
        self.assertFalse(report["deployedRuntimeArtifactVerified"])
        self.assertFalse(report["physicalDatabaseIsolationVerified"])
        self.assertFalse(report["gate4Passed"])
        self.assertFalse(report["gate5Passed"])
        self.assertEqual(report["officialReadinessPercent"], 30)

    def test_partial_captures_never_satisfy_three_target_check(self):
        data = copy.deepcopy(self.fixture)
        data["captures"].pop()
        report = evaluate(data)
        self.assertFalse(report["allThreeTargetsProvided"])
        self.assertFalse(report["candidateSchemaComparisonPassed"])
        self.assertFalse(report["gate5Passed"])

    def test_malformed_document_blocks(self):
        with self.assertRaisesRegex(ValueError, "format"):
            evaluate({"format": "not-supported", "captures": []})
        with self.assertRaisesRegex(ValueError, "Unexpected top-level"):
            evaluate({**self.fixture, "customerPaymentRows": [{"balance": 10000}]})
        with self.assertRaisesRegex(ValueError, "duplicate target"):
            evaluate({"format": REQUIRED_CAPTURE_FORMAT, "captures": [
                self.fixture["captures"][0], self.fixture["captures"][0]
            ]})

    def test_mismatched_url(self):
        self.evaluate_mutation(lambda doc: doc["captures"][0].update(url=URLS["staging"]),
                               "TARGET_URL_MISMATCH")

    def test_missing_real_database_identity(self):
        self.evaluate_mutation(lambda doc: doc["captures"][0]["providerMetadata"].update(databaseUuid=None),
                               "IMMUTABLE_DATABASE_UUID_UNAVAILABLE")

    def test_database_identity_collision(self):
        self.evaluate_mutation(lambda doc: doc["captures"][1]["providerMetadata"].update(databaseUuid=UUIDS["live"]),
                               "CROSS_TARGET_DATABASE_UUID_COLLISION")

    def test_doomsday_binding_drift(self):
        self.evaluate_mutation(lambda doc: doc["captures"][2]["providerMetadata"].update(databaseUuid=UUIDS["staging"]),
                               "DOOMSDAY_DATABASE_BINDING_DRIFT_REVIEW_REQUIRED")

    def test_missing_metadata_and_runtime_identity(self):
        for key, code in [
            ("binding", "REQUIRED_DB_BINDING_UNVERIFIED"),
            ("activeVersion", "ACTIVE_DEPLOYMENT_VERSION_UNAVAILABLE"),
            ("sourceCommit", "DEPLOYED_SOURCE_COMMIT_UNAVAILABLE"),
            ("providerRecordId", "IMMUTABLE_PROVIDER_ATTESTATION_REFERENCE_UNAVAILABLE"),
        ]:
            with self.subTest(key=key):
                self.evaluate_mutation(lambda doc, k=key: doc["captures"][0]["providerMetadata"].update({k: None}),
                                       code)

    def test_incomplete_or_uncertain_capture(self):
        self.evaluate_mutation(lambda doc: doc["captures"][0].update(truncated=True),
                               "CAPTURE_COMPLETENESS_UNVERIFIED")
        self.evaluate_mutation(lambda doc: doc["captures"][0].update(capturedAt="not-a-date"),
                               "INVALID_CAPTURE_TIME")
        self.evaluate_mutation(lambda doc: doc["captures"][0]["queries"].pop(),
                               "INCOMPLETE_CAPTURE_QUERY_SET")
        self.evaluate_mutation(lambda doc: doc["captures"][0]["queries"][0].update(error="timeout"),
                               "QUERY_01_MALFORMED_OR_UNAVAILABLE")

    def test_missing_refund_table_or_extra_unapproved_table(self):
        def remove_refund(doc):
            data = doc["captures"][1]["queries"][0]["rows"]
            data[:] = [row for row in data if row["name"] != "payment_refunds"]
        self.evaluate_mutation(remove_refund, "QUERY_01_DIFFERS_FROM_CANDIDATE")
        def add_unexpected(doc):
            doc["captures"][0]["queries"][0]["rows"].append({
                "type": "table", "name": "unexpected_remote_table",
                "tbl_name": "unexpected_remote_table", "sql": "CREATE TABLE unexpected_remote_table(id TEXT)"
            })
        self.evaluate_mutation(add_unexpected, "QUERY_01_DIFFERS_FROM_CANDIDATE")

    def test_schema_sql_partial_index_and_column_drift(self):
        def index_drift(doc):
            items = doc["captures"][1]["queries"][0]["rows"]
            row = next(row for row in items if row["name"] == "idx_payments_stripe_provider_unique")
            row["sql"] = row["sql"].replace("CREATE UNIQUE INDEX", "CREATE INDEX")
        self.evaluate_mutation(index_drift, "QUERY_01_DIFFERS_FROM_CANDIDATE")
        def column_type_drift(doc):
            items = doc["captures"][1]["queries"][1]["rows"]
            row = next(row for row in items if row["table_name"] == "payments" and row["column_name"] == "amount_cents")
            row["type"] = "TEXT"
        self.evaluate_mutation(column_type_drift, "QUERY_02_DIFFERS_FROM_CANDIDATE")

    def test_foreign_key_and_migration_journal_drifts(self):
        def fk_drift(doc):
            items = doc["captures"][1]["queries"][2]["rows"]
            if not items:
                raise AssertionError("Expected foreign keys in candidate")
            items[0]["parent_table"] = "unknown_parent"
        self.evaluate_mutation(fk_drift, "QUERY_03_DIFFERS_FROM_CANDIDATE")
        self.evaluate_mutation(lambda doc: doc["captures"][2]["queries"][4]["rows"].pop(),
                               "QUERY_05_DIFFERS_FROM_CANDIDATE")
        self.evaluate_mutation(lambda doc: doc["captures"][2]["queries"][4]["rows"].append(
            {"name": "0023_unreviewed.sql"}), "QUERY_05_DIFFERS_FROM_CANDIDATE")

    def test_payment_anomalies_and_query_failures(self):
        for query_index in range(5, 10):
            with self.subTest(query=query_index + 1):
                def mutate(doc, index=query_index):
                    rows = doc["captures"][1]["queries"][index]["rows"]
                    assert len(rows) == 1
                    key = next(iter(rows[0]))
                    rows[0][key] = 1
                self.evaluate_mutation(mutate, f"QUERY_{query_index + 1:02}_DIFFERS_FROM_CANDIDATE")
        self.evaluate_mutation(lambda doc: doc["captures"][0]["queries"][7].update(rows=None),
                               "QUERY_08_MALFORMED_OR_UNAVAILABLE")

    def test_extra_capture_fields_are_not_accepted(self):
        self.evaluate_mutation(lambda doc: doc["captures"][0].update(realCustomerIds=["sensitive"]),
                               "UNRECOGNIZED_CAPTURE_FIELDS_OR_SENSITIVE_DATA_RISK")
        self.evaluate_mutation(lambda doc: doc["captures"][0]["providerMetadata"].update(
            apiToken="SHOULD_NOT_BE_STORED"), "UNRECOGNIZED_PROVIDER_FIELDS_OR_SENSITIVE_DATA_RISK")

    def test_refuse_oversized_inputs_and_preserve_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "capture.json"
            before = json.dumps(self.fixture)
            path.write_text(before)
            result = evaluate_path(path)
            self.assertTrue(result["candidateSchemaComparisonPassed"])
            self.assertEqual(path.read_text(), before)
            path.write_text("x" * 2_000_001)
            with self.assertRaisesRegex(ValueError, "oversized"):
                evaluate_path(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
