"""FIRE Gate 9: offline, read-only staging/Stripe configuration evidence screening.

This checks *owner-supplied sanitized metadata*, not remote authenticity.
Even a complete matching packet does NOT close Gate 9 or authorize any action.
No provider SDK, network, database, token, payment or deployment operation.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
from uuid import UUID

FORMAT = "fire-gate9-staging-readonly-v1"
ACCOUNT = "acct_1ULRIG7ND12rd1wI"
QA_D1 = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
STRIPE_API_VERSION = "2026-08-26.dahlia"
REQUIRED_EVENTS = frozenset({
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "refund.created",
    "refund.updated",
})
SHA = re.compile(r"^[0-9a-f]{40}$")
MAX_INPUT = 131072
MAX_AGE = timedelta(hours=24)
TARGETS = {"live", "qa", "doomsday"}
STAGING_FIELDS = {
    "environment", "workerOrigin", "activeSourceCommit", "activeWorkerVersion",
    "activeTrafficPercent", "boundD1Uuid", "otherTargetD1Uuids",
    "otherTargetOrigins", "schemaAndJournalVerified",
    "refundLedgerAndIndexesVerified", "authIsolationVerified",
    "backupAndRollbackVerified",
}
STRIPE_FIELDS = {
    "accountId", "livemode", "currency", "webhookInventoryComplete",
    "webhookSigningSecretConfigured", "webhooks",
}
WEBHOOK_FIELDS = {"url", "status", "livemode", "apiVersion", "events"}


def exact_fields(data, names, label):
    if type(data) is not dict or set(data) != names:
        raise ValueError(label + "_FIELDS_INVALID")
    return data


def utc(value):
    if type(value) is not str or not value.endswith("Z"):
        raise ValueError("TIMESTAMP_MUST_BE_UTC_Z")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("TIMESTAMP_INVALID") from error
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError("TIMESTAMP_NOT_UTC")
    return parsed.astimezone(timezone.utc)


def canonical_origin(value):
    if type(value) is not str:
        return None
    try:
        url = urlsplit(value)
        if (url.scheme != "https" or not url.hostname or url.username or url.password
                or url.port is not None or url.query or url.fragment
                or url.path not in ("", "/") or url.netloc.lower() != url.hostname):
            return None
        if not re.fullmatch(r"[a-z0-9.-]+", url.hostname):
            return None
        return "https://" + url.hostname
    except ValueError:
        return None


def canonical_uuid(value):
    if type(value) is not str:
        return None
    try:
        parsed = UUID(value)
    except (ValueError, AttributeError):
        return None
    return value if str(parsed) == value else None


def evaluate(evidence, candidate_sha, expected_origin, now):
    if type(candidate_sha) is not str or not SHA.fullmatch(candidate_sha):
        raise ValueError("EXACT_CANDIDATE_SHA_REQUIRED")
    if type(now) is not datetime or now.tzinfo is None:
        raise ValueError("UTC_REVIEW_CLOCK_REQUIRED")
    now = now.astimezone(timezone.utc)
    expected = canonical_origin(expected_origin)
    if expected is None:
        raise ValueError("EXACT_HTTPS_STAGING_ORIGIN_REQUIRED")
    exact_fields(evidence, {"format", "capturedAtUtc", "sourceCommit", "staging", "stripe"}, "TOP")
    if evidence["format"] != FORMAT:
        raise ValueError("UNSUPPORTED_EVIDENCE_FORMAT")
    stage = exact_fields(evidence["staging"], STAGING_FIELDS, "STAGING")
    stripe = exact_fields(evidence["stripe"], STRIPE_FIELDS, "STRIPE")
    if type(stripe["webhooks"]) is not list or len(stripe["webhooks"]) > 100:
        raise ValueError("WEBHOOK_LIST_INVALID")
    for index, item in enumerate(stripe["webhooks"]):
        exact_fields(item, WEBHOOK_FIELDS, "WEBHOOK_" + str(index))
    ids = exact_fields(stage["otherTargetD1Uuids"], TARGETS, "PROTECTED_DB")
    origins = exact_fields(stage["otherTargetOrigins"], TARGETS, "PROTECTED_ORIGIN")

    blockers = []
    def stop(condition, code):
        if not condition:
            blockers.append(code)

    stamp = utc(evidence["capturedAtUtc"])
    stop(timedelta(0) <= now - stamp <= MAX_AGE, "EVIDENCE_STALE_OR_FUTURE")
    stop(evidence["sourceCommit"] == candidate_sha, "EVIDENCE_SOURCE_DIFFERENT")
    stop(stage["environment"] == "staging", "NOT_ISOLATED_STAGING")
    source = stage["activeSourceCommit"]
    stop(type(source) is str and SHA.fullmatch(source) is not None and source == candidate_sha,
         "STAGING_ACTIVE_SOURCE_UNVERIFIED")
    stop(canonical_uuid(stage["activeWorkerVersion"]) is not None, "WORKER_VERSION_INVALID")
    stop(type(stage["activeTrafficPercent"]) is int and stage["activeTrafficPercent"] == 100,
         "WORKER_TRAFFIC_NOT_SOLE_100_PERCENT")
    origin = canonical_origin(stage["workerOrigin"])
    stop(origin == expected, "STAGING_ORIGIN_MISMATCH")
    stop(origin is not None and not origin.endswith(".chatgpt.site")
         and origin != "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev",
         "QA_OR_SITES_ORIGIN_FORBIDDEN")

    db = canonical_uuid(stage["boundD1Uuid"])
    stop(db is not None, "STAGING_D1_UUID_MISSING")
    other_db = {key: canonical_uuid(ids[key]) for key in TARGETS}
    stop(all(other_db.values()) and len(set(other_db.values())) == 3,
         "PROTECTED_D1_IDENTITIES_INCOMPLETE")
    stop(other_db["qa"] == QA_D1, "QA_D1_PIN_MISMATCH")
    stop(db is not None and db not in other_db.values(), "STAGING_D1_NOT_ISOLATED")
    protected_origins = [canonical_origin(origins[key]) for key in sorted(TARGETS)]
    stop(all(protected_origins) and len(set(protected_origins)) == 3,
         "PROTECTED_ORIGINS_INCOMPLETE")
    stop(origin is not None and origin not in protected_origins, "STAGING_ORIGIN_NOT_ISOLATED")
    for key in ("schemaAndJournalVerified", "refundLedgerAndIndexesVerified",
                "authIsolationVerified", "backupAndRollbackVerified"):
        stop(stage[key] is True, key.upper() + "_MISSING")

    stop(stripe["accountId"] == ACCOUNT, "STRIPE_TEST_ACCOUNT_PIN_MISMATCH")
    stop(stripe["livemode"] is False, "STRIPE_LIVE_MODE_FORBIDDEN")
    stop(stripe["currency"] == "usd", "STRIPE_USD_REQUIRED")
    stop(stripe["webhookInventoryComplete"] is True, "STRIPE_WEBHOOK_INVENTORY_INCOMPLETE")
    stop(stripe["webhookSigningSecretConfigured"] is True, "STAGING_WEBHOOK_SECRET_MISSING")
    required_url = expected + "/api/payments/webhook"
    matching = [item for item in stripe["webhooks"] if item["url"] == required_url]
    stop(len(matching) == 1, "EXACT_STAGING_WEBHOOK_NOT_UNIQUE")
    if len(matching) == 1:
        webhook = matching[0]
        stop(webhook["status"] == "enabled", "STAGING_WEBHOOK_DISABLED")
        stop(webhook["livemode"] is False, "STAGING_WEBHOOK_LIVE_MODE_FORBIDDEN")
        stop(webhook["apiVersion"] == STRIPE_API_VERSION, "STAGING_WEBHOOK_API_VERSION_MISMATCH")
        events = webhook["events"]
        stop(type(events) is list and all(type(e) is str for e in events)
             and len(events) == len(set(events)) and REQUIRED_EVENTS.issubset(events),
             "STAGING_WEBHOOK_REQUIRED_EVENTS_MISSING")
    return {
        "format": "fire-gate9-staging-preflight-result-v1",
        "candidateSha": candidate_sha,
        "expectedStagingOrigin": expected,
        "metadataChecklistPassed": not blockers,
        "blockers": blockers,
        "ownerSuppliedMetadataOnly": True,
        "providerAuthenticatedByThisTool": False,
        "signedWebhookDeliveryVerified": False,
        "actualStagingLedgerReconciled": False,
        "gate9Accepted": False,
        "productionGatesPassed": 3,
        "productionGatesTotal": 10,
        "productionReady": False,
        "paymentOrRemoteWriteAuthorized": False,
        "nextAction": ("Independent provider authentication and separate owner approval "
                       "are still required before synthetic staging writes or webhook changes."),
    }


def read_evidence(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_INPUT:
        raise ValueError("PRIVATE_EVIDENCE_FILE_INVALID")
    def distinct(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("DUPLICATE_JSON_FIELD")
            result[key] = value
        return result
    def reject_number(value):
        raise ValueError("NONFINITE_JSON_NUMBER")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=distinct,
                      parse_constant=reject_number)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True,
                        help="Locally stored sanitized metadata; keep outside the repository")
    parser.add_argument("--candidate-sha", required=True)
    parser.add_argument("--expected-staging-origin", required=True)
    parser.add_argument("--at", default=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    args = parser.parse_args(argv)
    try:
        result = evaluate(read_evidence(args.evidence), args.candidate_sha,
                          args.expected_staging_origin, utc(args.at))
        print(json.dumps(result, indent=2, sort_keys=True))
        # A metadata-only tool must never report Gate 9 or production approved.
        return 0 if result["metadataChecklistPassed"] else 1
    except (ValueError, TypeError, OSError, json.JSONDecodeError) as error:
        print("FIRE Gate 9 preflight BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
