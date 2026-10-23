"""Release evidence review negative controls: all synthetic/stored metadata only."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

import review_integrated_release_gates as gates

SHA = "21e6aa66ac7db97155452f337a040cc0fbf86f77"
CLOCK = "2026-10-22T22:30:00Z"
# Tests use the existing historical inventory; these are NOT live provider reads.
STATUS = gates.strict_json(gates.ROOT / "PROGRESS_STATUS.json")
HISTORY = gates.strict_json(gates.ROOT / "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json")


class ReleaseReadOnlyReview(unittest.TestCase):
    def review(self, status=None, history=None, capture=None, sha=SHA, at=CLOCK):
        return gates.evaluate(sha, at, copy.deepcopy(status if status is not None else STATUS),
                              copy.deepcopy(history if history is not None else HISTORY),
                              copy.deepcopy(capture))

    def test_stale_historical_inventory_shows_concrete_open_gates(self):
        result = self.review()
        self.assertEqual(result["candidateSourceSha"], SHA)
        self.assertTrue(result["historicalIdentityStaleOver24h"])
        self.assertEqual(result["verifiedProductionGates"], 3)
        self.assertEqual(result["totalProductionGates"], 10)
        self.assertEqual(result["officialReadinessPercent"], 30)
        self.assertEqual([x["gate"] for x in result["missingEvidence"]], list(gates.EXPECTED_GATES))
        self.assertTrue(all(x["verified"] is False for x in result["missingEvidence"]))
        self.assertIn("payment_refunds", result["targets"]["live"]["historicalKnownMissingTables"])
        self.assertEqual(result["targets"]["live"]["historicalSchemaTableNames"], 18)
        self.assertEqual(result["targets"]["staging"]["historicalSchemaTableNames"], 19)
        self.assertFalse(result["targets"]["live"]["savedSourceMatchesCandidate"])
        self.assertFalse(result["targets"]["staging"]["savedSourceMatchesCandidate"])
        self.assertEqual(result["targets"]["doomsday"]["historicalIdentityStatus"], "BLOCKED_METADATA_ACCESS")
        self.assertFalse(result["providerAccessPerformed"])
        self.assertFalse(result["productionReady"])
        self.assertFalse(result["mergeOrPublicationAuthorized"])
        self.assertIsNone(result["suppliedSchemaPrecheck"])

    def test_fresh_looking_historical_metadata_still_cannot_become_runtime_proof(self):
        doc = copy.deepcopy(HISTORY)
        doc["capturedAt"] = CLOCK
        doc["live"]["version"]["sourceCommit"] = SHA
        doc["staging"]["version"]["sourceCommit"] = SHA
        r = self.review(history=doc)
        self.assertFalse(r["historicalIdentityStaleOver24h"])
        self.assertTrue(r["targets"]["live"]["savedSourceMatchesCandidate"])
        self.assertTrue(r["targets"]["staging"]["savedSourceMatchesCandidate"])
        self.assertFalse(r["targets"]["live"]["verifiedLiveIdentity"])
        self.assertFalse(r["targets"]["staging"]["fullRemoteSchemaJournalVerified"])
        self.assertEqual(r["verifiedProductionGates"], 3)
        self.assertFalse(r["productionReady"])

    def test_candidate_must_be_exact_lowercase_sha(self):
        for bad in ("", "abc123", "A"*40, "f"*41, 123, None):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ValueError, "exact lowercase"):
                    self.review(sha=bad)

    def test_future_inventory_and_unzoned_times_refused(self):
        for stamp in ("2026-10-23T00:00:00Z", "2026-10-22T22:30:00",
                      "2026-10-22T17:30:00-05:00", "not-a-date"):
            d = copy.deepcopy(HISTORY); d["capturedAt"] = stamp
            with self.subTest(stamp=stamp):
                with self.assertRaises(ValueError):
                    self.review(history=d)

    def test_age_boundary_for_24_hour_identity_recheck(self):
        d = copy.deepcopy(HISTORY)
        d["capturedAt"] = "2026-10-21T22:30:00Z"
        self.assertFalse(self.review(history=d)["historicalIdentityStaleOver24h"])
        d["capturedAt"] = "2026-10-21T22:29:59Z"
        self.assertTrue(self.review(history=d)["historicalIdentityStaleOver24h"])

    def test_paper_status_cannot_self_promote_production_gates(self):
        for mutate in (
            lambda d: d["productionReadiness"].update(gatesPassed=10, percent=100, ready=True),
            lambda d: d["productionReadiness"].update(pending=[]),
            lambda d: d["databaseStripeSafety"].update(remoteJournalsVerified=3),
            lambda d: d.update(productionDeployed=True),
            lambda d: d["productionReadiness"].update(totalGates=9),
        ):
            d = copy.deepcopy(STATUS); mutate(d)
            with self.assertRaises(ValueError):
                self.review(status=d)

    def test_historical_tables_and_source_strings_must_not_be_malformed(self):
        for mutate in (
            lambda d: d["live"]["version"].update(sourceCommit="not-an-exact-sha"),
            lambda d: d["live"]["tableOverview"].update(tables=["payments", "payments"]),
            lambda d: d["staging"].update(tableOverview={"tables": [100]}),
            lambda d: d.pop("staging"),
            lambda d: d.pop("doomsday"),
        ):
            d = copy.deepcopy(HISTORY); mutate(d)
            with self.assertRaises(ValueError):
                self.review(history=d)

    def test_supplied_synthetic_schema_still_never_accepts_hosted_gates(self):
        # A manually constructed "perfect" local schema can be identical to a
        # candidate. Such JSON cannot attest what is running at any provider.
        from test_hosted_schema_capture import fixture
        r = self.review(capture=fixture())
        cap = r["suppliedSchemaPrecheck"]
        self.assertTrue(cap["candidateSchemaTechnicalMatch"])
        self.assertTrue(cap["allThreeTargets"])
        self.assertFalse(cap["providerAttestationVerified"])
        self.assertFalse(cap["gate4Passed"])
        self.assertFalse(cap["gate5Passed"])
        self.assertEqual(r["verifiedProductionGates"], 3)
        self.assertFalse(r["mergeOrPublicationAuthorized"])

    def test_missing_schema_target_is_not_accepted(self):
        from test_hosted_schema_capture import fixture
        data = fixture(); data["captures"].pop()
        result = self.review(capture=data)
        self.assertFalse(result["suppliedSchemaPrecheck"]["candidateSchemaTechnicalMatch"])
        self.assertFalse(result["suppliedSchemaPrecheck"]["allThreeTargets"])

    def test_duplicate_json_keys_nan_and_oversized_input_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "capture.json"
            for raw in ('{"a":1,"a":2}', '{"data":NaN}', '{"data":Infinity}', "["+"0,"*1_100_000+"0]"):
                p.write_text(raw)
                with self.assertRaises(ValueError):
                    gates.strict_json(p)

    def test_cli_prints_blocked_report_without_network_or_approval(self):
        from contextlib import redirect_stdout
        from io import StringIO
        buffer = StringIO()
        with redirect_stdout(buffer):
            code = gates.main(["--candidate-sha", SHA, "--at", CLOCK])
        self.assertEqual(code, 0, "Zero means safe evidence review completed, not release passed")
        report = json.loads(buffer.getvalue())
        self.assertFalse(report["productionReady"])
        self.assertFalse(report["mergeOrPublicationAuthorized"])
        self.assertEqual(len(report["missingEvidence"]), 7)


if __name__ == "__main__":
    unittest.main()
