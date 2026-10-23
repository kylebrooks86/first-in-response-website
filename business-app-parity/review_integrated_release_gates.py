"""Offline, metadata-only FIRE integrated-release evidence review.

This is an intentionally non-authorizing inspector: no network, credentials,
provider API, SQL connection, migration, deployment, or payment methods.
Success means the *reviewer ran*, never that a release is approved.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
SHA = re.compile(r"^[0-9a-f]{40}$")
TARGETS = ("live", "staging", "doomsday")
EXPECTED_GATES = (
    "deployed identities",
    "remote schema/journals",
    "auth adapter",
    "photo storage",
    "mobile evidence",
    "sandbox integration",
    "rollback/seal",
)
MAX_BYTES = 2_000_000
# A runtime identity should be rechecked near a prospective release, not
# inherited from old screenshots or an old saved GitHub branch.
IDENTITY_FRESHNESS = timedelta(hours=24)


def strict_json(path: Path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Evidence input exceeds the metadata-only size limit")
    def distinct(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key in purported release evidence")
            result[key] = value
        return result
    def reject_constant(value):
        raise ValueError("Non-finite JSON number in release evidence")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=distinct,
                      parse_constant=reject_constant)


def time_utc(value):
    if not isinstance(value, str):
        raise ValueError("Missing UTC timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError("Evidence timestamp must explicitly be UTC")
    return parsed.astimezone(timezone.utc)


def source_status(status):
    if not isinstance(status, dict):
        raise ValueError("Missing release status")
    ready = status.get("productionReadiness")
    if not isinstance(ready, dict) or ready.get("gatesPassed") != 3 or ready.get("totalGates") != 10 \
            or ready.get("percent") != 30 or ready.get("ready") is not False \
            or ready.get("pending") != list(EXPECTED_GATES) or status.get("productionDeployed") is not False:
        raise ValueError("Release status/governed gate policy drift: require explicit independent review")
    schema = status.get("databaseStripeSafety")
    if not isinstance(schema, dict) or schema.get("remoteJournalsVerified") != 0 \
            or schema.get("totalRemoteTargets") != 3:
        raise ValueError("Stored remote schema gate status changed without independently reviewed evidence")
    return ready


def evaluate(candidate_sha, as_of, status, identity, capture=None):
    if not isinstance(candidate_sha, str) or not SHA.fullmatch(candidate_sha):
        raise ValueError("Pin one exact lowercase full 40-character Git commit")
    now = time_utc(as_of)
    source_status(status)
    if not isinstance(identity, dict) or set(TARGETS[:2]) - set(identity):
        raise ValueError("Required historical LIVE and staging metadata missing")
    recorded = time_utc(identity.get("capturedAt"))
    if recorded > now:
        raise ValueError("Historical provider metadata is dated in the future")
    stale = now - recorded > IDENTITY_FRESHNESS
    views = {}
    for target in TARGETS:
        saved = identity.get(target)
        if not isinstance(saved, dict):
            raise ValueError("Historical target metadata missing: " + target)
        if target == "doomsday":
            views[target] = {
                "savedSourceMatchesCandidate": False,
                "historicalSchemaTableNames": None,
                "historicalKnownMissingTables": None,
                "historicalIdentityStatus": str(saved.get("status", "unknown")),
                "verifiedLiveIdentity": False,
                "fullRemoteSchemaJournalVerified": False,
            }
            continue
        version = saved.get("version")
        overview = saved.get("tableOverview")
        if not isinstance(version, dict) or not isinstance(overview, dict):
            raise ValueError("Historical version/table metadata missing: " + target)
        source = version.get("sourceCommit")
        tables = overview.get("tables")
        if not isinstance(source, str) or not SHA.fullmatch(source) or not isinstance(tables, list) \
                or any(not isinstance(t, str) for t in tables) or len(set(tables)) != len(tables):
            raise ValueError("Invalid historical source or table inventory: " + target)
        views[target] = {
            "savedSourceMatchesCandidate": source == candidate_sha,
            "historicalSchemaTableNames": len(tables),
            "historicalKnownMissingTables": ["payment_refunds"] if target == "live" and "payment_refunds" not in tables else [],
            "historicalIdentityStatus": "saved-publication-metadata-only",
            "verifiedLiveIdentity": False,
            "fullRemoteSchemaJournalVerified": False,
        }
    capture_report = None
    if capture is not None:
        # Import lazily: the comparison creates a *disposable local SQLite*
        # candidate schema. It does not open a hosted connection.
        from verify_hosted_schema_capture import evaluate as inspect_capture
        report = inspect_capture(capture)
        capture_report = {
            "candidateSchemaTechnicalMatch": report["candidateSchemaComparisonPassed"],
            "allThreeTargets": report["allThreeTargetsProvided"],
            "providerAttestationVerified": False,
            "deploymentVerified": False,
            "gate4Passed": False,
            "gate5Passed": False,
            "targetBlockerCodes": {k: v["blockers"] for k, v in report["targets"].items()},
        }
    return {
        "format": "fire-integrated-release-read-only-review-v1",
        "candidateSourceSha": candidate_sha,
        "reviewedAt": now.isoformat().replace("+00:00", "Z"),
        "historicalIdentityCapturedAt": recorded.isoformat().replace("+00:00", "Z"),
        "historicalIdentityStaleOver24h": stale,
        "historicalMetadataNotRuntimeProof": True,
        "sourceOnlyGatesPreviouslyPassed": 3,
        "totalProductionGates": 10,
        "verifiedProductionGates": 3,
        "officialReadinessPercent": 30,
        "targets": views,
        "suppliedSchemaPrecheck": capture_report,
        "missingEvidence": [
            {"gate": name, "verified": False, "nextEvidence": detail}
            for name, detail in (
                ("deployed identities", "Fresh provider-authenticated runtime identities and routing for LIVE/staging/Doomsday, immutable DB bindings and source/build digests"),
                ("remote schema/journals", "Fresh read-only 10-query metadata captures from each exact bound DB plus independently attested provenance"),
                ("auth adapter", "Controlled owner/nonowner/customer-link test identities and real target origin/session isolation results"),
                ("photo storage", "Actual bound target R2 identities and safe read/recovery proof; never upload existing customer photos"),
                ("mobile evidence", "Owner's physical Home Screen iPhone light/dark, airplane-mode cold launch, quote/photo/reconnect evidence"),
                ("sandbox integration", "Isolated synthetic agreement-to-invoice payment/refund sandbox acceptance with zero real charges"),
                ("rollback/seal", "Immutable actual backup/photo restore receipts and exact owner-approved commit/target/rollback plan"),
            )
        ],
        "providerAccessPerformed": False,
        "hostedWritesPerformed": False,
        "paymentsOrMessagesSent": False,
        "mergeOrPublicationAuthorized": False,
        "productionReady": False,
        "interpretation": "Completed static review only; stale/pasted/owner-supplied metadata or green CI never close hosted production gates.",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-sha", required=True, help="Exact integrated GitHub HEAD commit")
    parser.add_argument("--at", default=datetime.now(timezone.utc).isoformat(), help="Review UTC clock; used for deterministic test cases")
    parser.add_argument("--capture", type=Path, help="Optional private metadata-only three-target schema JSON; do not commit or upload it")
    args = parser.parse_args(argv)
    try:
        status = strict_json(ROOT / "PROGRESS_STATUS.json")
        historical = strict_json(ROOT / "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json")
        capture = strict_json(args.capture) if args.capture else None
        report = evaluate(args.candidate_sha, args.at, status, historical, capture)
        print(json.dumps(report, indent=2, sort_keys=True))
        # A blocked candidate is the REQUIRED correct result. Exit zero means
        # the reviewer has correctly refused release, never that hosting passed.
        if report["productionReady"] or report["mergeOrPublicationAuthorized"]:
            return 3
        return 0
    except (ValueError, OSError, TypeError, KeyError, json.JSONDecodeError) as error:
        print("Release evidence review BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
