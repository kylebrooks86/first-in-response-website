"""Offline tests of Gate4 metadata-only intake; NO provider or secrets."""
import copy
import importlib.util
from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest

MODULE = Path(__file__).with_name("preflight_gate4_sites_identity_offline.py")
SPEC = importlib.util.spec_from_file_location("fire_gate4_identity", MODULE)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
NOW = datetime(2026, 11, 3, 18, 0, tzinfo=timezone.utc)


def capture(target, uuid):
    return {
        "target": target,
        "projectId": m.TARGETS[target]["projectId"],
        "url": m.TARGETS[target]["url"],
        "provider": "chatgpt-sites",
        "capturedAt": "2026-11-03T17:59:00Z",
        "evidenceRef": "provider-attestation-ref-only",
        "binding": "DB",
        "physicalD1Uuid": uuid,
        "servingDeploymentId": "appgdep_6ac6f067e2548191aaf38c28d25c54f5",
        "providerDeploymentId": "site---provider-current-routed-artifact",
        "servingArtifactSha256": "a" * 64,
        "servingSourceCommit": "b" * 40,
    }


def doc(a=None, b=None):
    captures = [capture("live", "11111111-2222-4333-8444-555555555555") if a is None else a,
                capture("refund-staging", "22222222-3333-4444-8555-666666666666") if b is None else b]
    return {"format": m.FORMAT, "captures": captures}


class Gate4OfflineEvidenceTest(unittest.TestCase):
    def evaluate(self, data):
        return m.evaluate(data, now=NOW)

    def test_complete_claim_never_accepts_gate(self):
        out = self.evaluate(doc())
        self.assertTrue(out["reportedMetadataCompleteForBoth"])
        self.assertTrue(out["claimedPhysicalDatabaseUuidsDistinct"])
        self.assertFalse(out["providerProvenanceIndependentlyVerified"])
        self.assertFalse(out["currentRoutedArtifactIndependentlyVerified"])
        self.assertFalse(out["gate4Accepted"])
        self.assertFalse(out["gate5Accepted"])
        self.assertFalse(out["productionAuthorized"])
        self.assertEqual(out["formalGatesAccepted"], 3)

    def test_one_target_is_partial_not_pass(self):
        data = doc()
        data["captures"].pop()
        out = self.evaluate(data)
        self.assertFalse(out["bothSitesPresent"])
        self.assertFalse(out["reportedMetadataCompleteForBoth"])

    def test_missing_live_uuid_is_explicit_not_synthetic(self):
        data = doc()
        data["captures"][0]["physicalD1Uuid"] = None
        out = self.evaluate(data)
        self.assertIn("physicalD1Uuid", out["targets"]["live"]["unavailableFields"])
        self.assertFalse(out["claimedPhysicalDatabaseUuidsDistinct"])

    def test_missing_artifact_is_explicit_open(self):
        data = doc()
        data["captures"][1]["servingArtifactSha256"] = None
        out = self.evaluate(data)
        self.assertIn("servingArtifactSha256", out["targets"]["refund-staging"]["unavailableFields"])

    def test_duplicate_sites_physical_uuid_blocks(self):
        data = doc()
        data["captures"][1]["physicalD1Uuid"] = data["captures"][0]["physicalD1Uuid"]
        out = self.evaluate(data)
        for item in out["targets"].values():
            self.assertIn("CROSS_SITES_DB_UUID_COLLISION", item["blockers"])

    def test_colliding_known_qa_test_doomsday_block(self):
        for label, uid in m.OTHER_TARGET_D1_UUIDS.items():
            with self.subTest(label=label):
                data = doc()
                data["captures"][0]["physicalD1Uuid"] = uid
                out = self.evaluate(data)
                self.assertTrue(any("DATABASE_COLLIDES_WITH" in v for v in out["targets"]["live"]["blockers"]))

    def test_cannot_pass_with_sites_project_id_as_physical_uuid(self):
        data = doc()
        data["captures"][0]["physicalD1Uuid"] = m.TARGETS["live"]["projectId"]
        self.assertIn("PHYSICAL_D1_UUID_MALFORMED", self.evaluate(data)["targets"]["live"]["blockers"])

    def test_wrong_target_binding_url_provider(self):
        for key, value in (("url", "https://wrong.example"),
                           ("projectId", "not-an-appgprj"),
                           ("provider", "personal-cloudflare"),
                           ("binding", "OTHER")):
            with self.subTest(field=key):
                data = doc()
                data["captures"][0][key] = value
                self.assertFalse(self.evaluate(data)["targets"]["live"]["reportedMetadataComplete"])

    def test_future_stale_and_naive_times(self):
        for stamp in ("2026-11-04T10:00:00Z", "2026-10-12T10:00:00Z",
                      "2026-11-03T17:59:00", "not-a-time"):
            with self.subTest(stamp=stamp):
                data = doc()
                data["captures"][0]["capturedAt"] = stamp
                self.assertFalse(self.evaluate(data)["targets"]["live"]["reportedMetadataComplete"])

    def test_short_hash_and_placeholder_ref_block(self):
        for key, value in (("servingArtifactSha256", "sha256:not-a-digest"),
                           ("servingSourceCommit", "105"), ("evidenceRef", "PENDING")):
            with self.subTest(field=key):
                data = doc()
                data["captures"][0][key] = value
                self.assertFalse(self.evaluate(data)["targets"]["live"]["reportedMetadataComplete"])

    def test_unrecognized_sensitive_data_field_fails(self):
        for key in ("customers", "payments", "secret", "token", "customerEmail"):
            with self.subTest(key=key):
                data = doc()
                data["captures"][0][key] = "MUST NEVER CAPTURE"
                with self.assertRaises(ValueError):
                    self.evaluate(data)

    def test_missing_required_field_fails(self):
        data = doc()
        del data["captures"][0]["binding"]
        with self.assertRaises(ValueError):
            self.evaluate(data)

    def test_duplicate_target_fails(self):
        data = doc()
        data["captures"].append(copy.deepcopy(data["captures"][0]))
        with self.assertRaises(ValueError):
            self.evaluate(data)

    def test_bad_envelope_fails(self):
        for data in ([], {}, {"format": "wrong", "captures": []},
                     {"format": m.FORMAT, "captures": [], "sensitive": True}):
            with self.subTest(data=type(data).__name__):
                with self.assertRaises(ValueError):
                    self.evaluate(data)

    def test_no_network_database_or_write_primitives(self):
        source = MODULE.read_text()
        for banned in ("requests.get(", "urllib.request", "sqlite3.connect(",
                       "subprocess.", "open(path, 'w')", "os.system(", "cloudflare_api_token"):
            self.assertNotIn(banned, source)


if __name__ == "__main__":
    unittest.main()
