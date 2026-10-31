"""Synthetic-only negative controls for the non-authorizing FIRE Gate 9 preflight."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

import gate9_staging_preflight as gate

SOURCE = "a" * 40
ORIGIN = "https://independent-staging.example.test"
NOW = datetime(2026, 10, 31, 2, 0, tzinfo=timezone.utc)


def fixture():
    return {
        "format": gate.FORMAT,
        "capturedAtUtc": "2026-10-31T01:30:00Z",
        "sourceCommit": SOURCE,
        "staging": {
            "environment": "staging",
            "workerOrigin": ORIGIN,
            "activeSourceCommit": SOURCE,
            "activeWorkerVersion": "44444444-4444-4444-8444-444444444444",
            "activeTrafficPercent": 100,
            "boundD1Uuid": "33333333-3333-4333-8333-333333333333",
            "otherTargetD1Uuids": {
                "live": "11111111-1111-4111-8111-111111111111",
                "qa": gate.QA_D1,
                "doomsday": "22222222-2222-4222-8222-222222222222",
            },
            "otherTargetOrigins": {
                "live": "https://live.example.test",
                "qa": "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev",
                "doomsday": "https://dr.example.test",
            },
            "schemaAndJournalVerified": True,
            "refundLedgerAndIndexesVerified": True,
            "authIsolationVerified": True,
            "backupAndRollbackVerified": True,
        },
        "stripe": {
            "accountId": gate.ACCOUNT,
            "livemode": False,
            "currency": "usd",
            "webhookInventoryComplete": True,
            "webhookSigningSecretConfigured": True,
            "webhooks": [{
                "url": ORIGIN + "/api/payments/webhook",
                "status": "enabled",
                "livemode": False,
                "apiVersion": gate.STRIPE_API_VERSION,
                "events": sorted(gate.REQUIRED_EVENTS),
            }],
        },
    }


class Gate9ReadOnlyPreflight(unittest.TestCase):
    def review(self, packet=None, origin=ORIGIN, sha=SOURCE, at=NOW):
        return gate.evaluate(copy.deepcopy(packet if packet is not None else fixture()), sha, origin, at)

    def assert_blocked(self, patch, code):
        data = fixture()
        patch(data)
        result = self.review(data)
        self.assertIn(code, result["blockers"])
        self.assertFalse(result["metadataChecklistPassed"])
        self.assertFalse(result["gate9Accepted"])
        self.assertFalse(result["productionReady"])

    def test_complete_synthetic_metadata_never_auto_closes_real_gates(self):
        r = self.review()
        self.assertTrue(r["metadataChecklistPassed"])
        self.assertEqual(r["blockers"], [])
        self.assertFalse(r["gate9Accepted"])
        self.assertFalse(r["providerAuthenticatedByThisTool"])
        self.assertFalse(r["signedWebhookDeliveryVerified"])
        self.assertFalse(r["actualStagingLedgerReconciled"])
        self.assertFalse(r["paymentOrRemoteWriteAuthorized"])
        self.assertEqual((r["productionGatesPassed"], r["productionGatesTotal"]), (3, 10))

    def test_stale_owner_packet_and_future_clock_do_not_count(self):
        self.assert_blocked(lambda d: d.update(capturedAtUtc="2026-10-29T01:30:00Z"),
                            "EVIDENCE_STALE_OR_FUTURE")
        self.assert_blocked(lambda d: d.update(capturedAtUtc="2026-11-01T01:30:00Z"),
                            "EVIDENCE_STALE_OR_FUTURE")

    def test_source_and_sole_worker_version_locks(self):
        cases = [
            (lambda d: d.update(sourceCommit="b"*40), "EVIDENCE_SOURCE_DIFFERENT"),
            (lambda d: d["staging"].update(activeSourceCommit="b"*40), "STAGING_ACTIVE_SOURCE_UNVERIFIED"),
            (lambda d: d["staging"].update(activeWorkerVersion="not-a-version"), "WORKER_VERSION_INVALID"),
            (lambda d: d["staging"].update(activeTrafficPercent=99), "WORKER_TRAFFIC_NOT_SOLE_100_PERCENT"),
            (lambda d: d["staging"].update(activeTrafficPercent=100.0), "WORKER_TRAFFIC_NOT_SOLE_100_PERCENT"),
        ]
        for patch, code in cases:
            with self.subTest(code=code):
                self.assert_blocked(patch, code)

    def test_staging_never_reuses_qa_live_dr_worker_or_db(self):
        cases = [
            (lambda d: d["staging"].update(environment="live"), "NOT_ISOLATED_STAGING"),
            (lambda d: d["staging"].update(boundD1Uuid=gate.QA_D1), "STAGING_D1_NOT_ISOLATED"),
            (lambda d: d["staging"].update(boundD1Uuid=d["staging"]["otherTargetD1Uuids"]["live"]), "STAGING_D1_NOT_ISOLATED"),
            (lambda d: d["staging"]["otherTargetD1Uuids"].update(qa="55555555-5555-4555-8555-555555555555"), "QA_D1_PIN_MISMATCH"),
            (lambda d: d["staging"]["otherTargetD1Uuids"].update(doomsday=d["staging"]["otherTargetD1Uuids"]["live"]), "PROTECTED_D1_IDENTITIES_INCOMPLETE"),
            (lambda d: d["staging"]["otherTargetOrigins"].update(live=ORIGIN), "STAGING_ORIGIN_NOT_ISOLATED"),
            (lambda d: d["staging"]["otherTargetOrigins"].update(qa=d["staging"]["otherTargetOrigins"]["live"]), "PROTECTED_ORIGINS_INCOMPLETE"),
        ]
        for patch, code in cases:
            with self.subTest(code=code):
                self.assert_blocked(patch, code)

    def test_reject_synthetic_qa_and_legacy_sites_as_staging(self):
        for origin in ("https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev",
                       "https://fire-app.kylebrooks8605.chatgpt.site"):
            d = fixture()
            d["staging"]["workerOrigin"] = origin
            r = self.review(d, origin=origin)
            self.assertIn("QA_OR_SITES_ORIGIN_FORBIDDEN", r["blockers"])

    def test_origin_drift_and_unapproved_url_shapes(self):
        self.assert_blocked(lambda d: d["staging"].update(workerOrigin="https://other.example.test"),
                            "STAGING_ORIGIN_MISMATCH")
        for url in ("http://independent-staging.example.test",
                    "https://test:secret@independent-staging.example.test",
                    "https://independent-staging.example.test/path",
                    "https://independent-staging.example.test/?key=secret",
                    "https://independent-staging.example.test:8443"):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "EXACT_HTTPS"):
                self.review(origin=url)

    def test_staging_hosted_evidence_refusal(self):
        for name in ("schemaAndJournalVerified", "refundLedgerAndIndexesVerified",
                     "authIsolationVerified", "backupAndRollbackVerified"):
            with self.subTest(name=name):
                self.assert_blocked(lambda d: d["staging"].update({name: False}),
                                    name.upper() + "_MISSING")

    def test_sandbox_account_currency_and_mode_fail_closed(self):
        cases = [
            (lambda d: d["stripe"].update(accountId="acct_another"), "STRIPE_TEST_ACCOUNT_PIN_MISMATCH"),
            (lambda d: d["stripe"].update(livemode=True), "STRIPE_LIVE_MODE_FORBIDDEN"),
            (lambda d: d["stripe"].update(currency="eur"), "STRIPE_USD_REQUIRED"),
            (lambda d: d["stripe"].update(webhookInventoryComplete=False), "STRIPE_WEBHOOK_INVENTORY_INCOMPLETE"),
            (lambda d: d["stripe"].update(webhookSigningSecretConfigured=False), "STAGING_WEBHOOK_SECRET_MISSING"),
        ]
        for patch, code in cases:
            with self.subTest(code=code):
                self.assert_blocked(patch, code)

    def test_webhook_must_be_unique_current_and_subscribed_to_five_events(self):
        self.assert_blocked(lambda d: d["stripe"].update(webhooks=[]), "EXACT_STAGING_WEBHOOK_NOT_UNIQUE")
        self.assert_blocked(lambda d: d["stripe"]["webhooks"].append(
            copy.deepcopy(d["stripe"]["webhooks"][0])), "EXACT_STAGING_WEBHOOK_NOT_UNIQUE")
        cases = [
            (lambda x: x.update(status="disabled"), "STAGING_WEBHOOK_DISABLED"),
            (lambda x: x.update(livemode=True), "STAGING_WEBHOOK_LIVE_MODE_FORBIDDEN"),
            (lambda x: x.update(apiVersion="2025-01-01"), "STAGING_WEBHOOK_API_VERSION_MISMATCH"),
            (lambda x: x.update(events=["checkout.session.completed",
                                       "checkout.session.async_payment_succeeded",
                                       "checkout.session.async_payment_failed"]),
             "STAGING_WEBHOOK_REQUIRED_EVENTS_MISSING"),
            (lambda x: x.update(events=["*"]), "STAGING_WEBHOOK_REQUIRED_EVENTS_MISSING"),
        ]
        for patch, code in cases:
            with self.subTest(code=code):
                self.assert_blocked(lambda d: patch(d["stripe"]["webhooks"][0]), code)

    def test_unknown_secret_bearing_fields_and_malformed_types_rejected(self):
        for patch in (
            lambda d: d["stripe"].update(secretKey="do not accept this"),
            lambda d: d.update(customerRows=[]),
            lambda d: d["stripe"]["webhooks"][0].update(signingSecret="whsec_unsafe"),
            lambda d: d["staging"].update(otherTargetD1Uuids={}),
        ):
            with self.assertRaises(ValueError):
                self.review(dict(copy.deepcopy(fixture()), **{})) if False else gate.evaluate(
                    self.patched(patch), SOURCE, ORIGIN, NOW)

    @staticmethod
    def patched(patch):
        d = fixture()
        patch(d)
        return d

    def test_candidate_and_timestamp_must_be_exact(self):
        for sha in ("abc", "A"*40, "b"*41):
            with self.subTest(sha=sha), self.assertRaisesRegex(ValueError, "EXACT_CANDIDATE"):
                self.review(sha=sha)
        for stamp in ("2026-10-31T01:30:00", "2026-10-31T01:30:00-05:00", "junk"):
            d = fixture()
            d["capturedAtUtc"] = stamp
            with self.subTest(stamp=stamp), self.assertRaises(ValueError):
                self.review(d)

    def test_file_reader_rejects_duplicate_json_keys_and_nonfinite_values(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)/"private-evidence.json"
            for content in ('{"format":"one","format":"two"}', '{"x":NaN}', ''):
                p.write_text(content, encoding="utf-8")
                with self.subTest(content=content), self.assertRaises(ValueError):
                    gate.read_evidence(p)
            p.write_text(json.dumps(fixture()), encoding="utf-8")
            self.assertEqual(gate.read_evidence(p)["format"], gate.FORMAT)


if __name__ == "__main__":
    unittest.main()
