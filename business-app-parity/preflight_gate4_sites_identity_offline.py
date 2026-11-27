"""FIRE Gate 4: offline, strict intake of provider-reported Sites identity metadata.

This tool NEVER contacts Sites/Cloudflare, accepts or verifies credentials, reads
database rows, signs release evidence, or changes release-gate status. It avoids
mistaking Sites project IDs, saved commits, or version strings for *physical D1*
identifiers or for an authenticated serving-artifact linkage.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys

FORMAT = "fire-gate4-sites-identity-v1"
LIMIT_BYTES = 16_384
TARGETS = {
    "live": {
        "projectId": "appgprj_6aaf416f82c88191a292fa2e13a9ea61",
        "url": "https://fire-app.kylebrooks8605.chatgpt.site",
    },
    "refund-staging": {
        "projectId": "appgprj_6ac7e8e358dc81918d0a47c4034c4a41",
        "url": "https://fire-live-refund-staging.kylebrooks8605.chatgpt.site",
    },
}
# Previously verified independent target D1 IDs; do not allow LIVE or staging
# provider-reported values to silently collide with accepted QA/TEST/DR DBs.
OTHER_TARGET_D1_UUIDS = {
    "independent-doomsday": "afb2c05a-d794-4a9a-b580-924ce01c26ad",
    "isolated-stripe-test": "dba421ba-fc66-4cf8-9c31-51616f8249ba",
    "qa": "8ccfb1f8-1657-4074-b1b2-47de78f95003",
}
UUID = re.compile(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\Z")
SHA40 = re.compile(r"[a-f0-9]{40}\Z")
SHA256 = re.compile(r"[a-f0-9]{64}\Z")
# These are the only permitted *metadata keys*, not customer data.
FIELDS = {
    "target", "projectId", "url", "provider", "capturedAt", "evidenceRef",
    "binding", "physicalD1Uuid", "servingDeploymentId", "providerDeploymentId",
    "servingArtifactSha256", "servingSourceCommit",
}
OPTIONAL_IDENTITY = (
    "physicalD1Uuid", "servingDeploymentId", "providerDeploymentId",
    "servingArtifactSha256", "servingSourceCommit", "evidenceRef",
)


def _utc_time(value):
    if not isinstance(value, str):
        return None
    try:
        t = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo is not None else None


def _safe_text(value):
    return isinstance(value, str) and 1 <= len(value) <= 200 and not any(
        ord(c) < 32 or ord(c) > 126 for c in value
    )


def evaluate(document, *, now=None):
    """Validate only the shape/completeness of reported metadata, NOT provenance.

    Never returns an accepted gate or a release authorization.
    """
    if not isinstance(document, dict) or set(document) != {"format", "captures"} or document["format"] != FORMAT:
        raise ValueError("Unsupported Gate 4 identity-capture envelope.")
    captures = document["captures"]
    if not isinstance(captures, list) or not 1 <= len(captures) <= 2:
        raise ValueError("Expected one or two Sites identity captures.")
    now = now or datetime.now(timezone.utc)
    results = {}
    uuid_claims = {}
    for item in captures:
        if not isinstance(item, dict) or set(item) != FIELDS:
            raise ValueError("Capture contains missing/extra fields or possible row-level data.")
        target = item["target"]
        if target not in TARGETS or target in results:
            raise ValueError("Unknown/duplicate Sites target.")
        blocked = []
        missing = []
        expected = TARGETS[target]
        if item["projectId"] != expected["projectId"] or item["url"] != expected["url"]:
            blocked.append("PROJECT_OR_ROUTE_MISMATCH")
        if item["provider"] != "chatgpt-sites" or item["binding"] != "DB":
            blocked.append("PROVIDER_OR_DB_BINDING_UNVERIFIED")
        timestamp = _utc_time(item["capturedAt"])
        if timestamp is None or timestamp > now + timedelta(minutes=5):
            blocked.append("INVALID_OR_FUTURE_CAPTURE_TIME")
        elif now - timestamp > timedelta(days=7):
            blocked.append("STALE_CAPTURE_MUST_REFRESH")
        for key in OPTIONAL_IDENTITY:
            value = item[key]
            if value is None:
                missing.append(key)
                continue
            if not _safe_text(value):
                blocked.append("INVALID_METADATA_FIELD_" + key)
                continue
            if key == "physicalD1Uuid":
                if not UUID.fullmatch(value):
                    blocked.append("PHYSICAL_D1_UUID_MALFORMED")
                else:
                    uuid_claims[target] = value
                    for other, known in OTHER_TARGET_D1_UUIDS.items():
                        if value == known:
                            blocked.append("DATABASE_COLLIDES_WITH_" + other.upper().replace("-", "_"))
            elif key == "servingSourceCommit" and not SHA40.fullmatch(value):
                blocked.append("SOURCE_COMMIT_NOT_FULL_SHA40")
            elif key == "servingArtifactSha256" and not SHA256.fullmatch(value):
                blocked.append("ARTIFACT_DIGEST_NOT_FULL_SHA256")
            elif key == "evidenceRef" and value.upper() in {"SELF-REPORTED", "UNKNOWN", "PLACEHOLDER", "PENDING", "NONE"}:
                blocked.append("NO_PROVIDER_EVIDENCE_REFERENCE")
        results[target] = {"reportedMetadataComplete": not blocked and not missing,
                           "blockers": blocked, "unavailableFields": missing}
    if len(set(uuid_claims.values())) != len(uuid_claims):
        for target in uuid_claims:
            if "CROSS_SITES_DB_UUID_COLLISION" not in results[target]["blockers"]:
                results[target]["blockers"].append("CROSS_SITES_DB_UUID_COLLISION")
                results[target]["reportedMetadataComplete"] = False
    both = set(results) == set(TARGETS)
    return {
        "scope": "Offline syntactic checks of provider-reported Sites identity only",
        "targets": results,
        "bothSitesPresent": both,
        "reportedMetadataCompleteForBoth": both and all(x["reportedMetadataComplete"] for x in results.values()),
        "claimedPhysicalDatabaseUuidsDistinct": len(uuid_claims) == 2 and len(set(uuid_claims.values())) == 2,
        "providerProvenanceIndependentlyVerified": False,
        "currentRoutedArtifactIndependentlyVerified": False,
        "gate4Accepted": False,
        "gate5Accepted": False,
        "productionAuthorized": False,
        "formalGatesAccepted": 3,
        "nextAction": "Authenticate serving resource/artifact and physical DB mapping with provider before Gate 5 SELECT-only queries.",
    }


def evaluate_file(path):
    p = Path(path)
    if p.stat().st_size > LIMIT_BYTES:
        raise ValueError("Oversized input; possible sensitive rows. Refusing to read.")
    return evaluate(json.loads(p.read_text(encoding="utf-8")))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Offline Gate 4 provider identity metadata shape check; no hosted access")
    parser.add_argument("capture", help="Private sanitized metadata file, stored outside Git")
    args = parser.parse_args(argv)
    try:
        result = evaluate_file(args.capture)
    except (ValueError, OSError, json.JSONDecodeError):
        print(json.dumps({"readOnly": True, "gate4Accepted": False, "gate5Accepted": False,
                          "error": "INVALID_OR_UNAVAILABLE_PRIVATE_METADATA_CAPTURE"}, indent=2))
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["reportedMetadataCompleteForBoth"] else 1


if __name__ == "__main__":
    sys.exit(main())
