"""Read-only QA iPhone release decision from pinned source and optional owner schema capture.

No Cloudflare authentication, network request, database query, migration, deployment,
backup overwrite, or customer records. A local capture does NOT authorize publishing.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys

import capture_existing_qa_schema_read_only as qa
import review_existing_qa_capture_offline as offline
from review_qa_update_schema import HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned

FORMAT = "fire-qa-iphone-release-decision-v1"
CAPTURE_MAX_AGE = timedelta(hours=24)
SCREENS = [
    {"screen": "Job Report", "acceptance": "Synthetic job: checklist fits, draft/completed saves, retry and offline restrictions."},
    {"screen": "Job Costs", "acceptance": "Synthetic expense: correct cents and totals, no double taps, visible errors and recovery."},
    {"screen": "Customer View", "acceptance": "Owner return, original customer agreement/price and no leaked owner-only controls."},
    {"screen": "View Invoice", "acceptance": "Return, invoice total, paid principal, remaining balance and narrow iPhone width."},
]

class QAReadinessStop(ValueError):
    pass

def decision(capture_path: Path | None = None, *, schema_root: Path | None = None,
             at: datetime | None = None) -> dict:
    now = (at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    root = schema_root or qa.BASE
    try:
        files = _read_sql_dir(root, "reviewed QA candidate")
        _verify_pinned(files, {**HISTORICAL_GIT_BLOBS, **NEW_GIT_BLOBS}, "reviewed QA candidate")
        qa.local_baseline()
    except (ValueError, OSError) as error:
        raise QAReadinessStop("Pinned local schema differs: " + str(error)) from error

    captured, matching, captured_at, capture_hash = False, None, None, None
    blockers = []
    if capture_path is None:
        blockers.append("OWNER_READ_ONLY_HOSTED_QA_SCHEMA_CAPTURE_MISSING")
    else:
        try:
            review = offline.evaluate(capture_path)
        except (ValueError, OSError, TypeError) as error:
            raise QAReadinessStop("Untrusted QA capture rejected: " + str(error)) from error
        captured = True
        matching = review["original23SchemaMetadataMatches"]
        captured_at = review["captureUtc"]
        capture_hash = review["captureSha256"]
        timestamp = datetime.fromisoformat(captured_at)
        if timestamp > now or now - timestamp > CAPTURE_MAX_AGE:
            blockers.append("QA_METADATA_CAPTURE_EXPIRED_OR_FUTURE")
        if not matching:
            blockers.append("HOSTED_QA_SCHEMA_DRIFT_REQUIRES_INVESTIGATION")
        blockers.append("CLOUDFLARE_CAPTURE_PROVENANCE_NOT_INDEPENDENTLY_ATTESTED")

    blockers.extend([
        "RECOVERABLE_QA_BACKUP_AND_RESTORE_NOT_VERIFIED",
        "HOSTED_23_TO_25_QA_MIGRATION_NOT_APPROVED",
        "EXISTING_QA_CODE_ONLY_UPDATE_BLOCKED_BY_SCHEMA_DIFFERENCE",
        "EXACT_OWNER_APPROVAL_FOR_QA_CODE_UPDATE_MISSING",
        "HOSTED_AND_PHYSICAL_IPHONE_ACCEPTANCE_MISSING",
    ])
    return {
        "format": FORMAT,
        "result": "STOP_HOSTED_QA_UPDATE_PENDING_OWNER_EVIDENCE_AND_APPROVAL",
        "pinnedSourceSchemaVerified": True,
        "originalMigrationCount": len(HISTORICAL_GIT_BLOBS),
        "candidateMigrationCount": len(files),
        "additionalMigrations": sorted(NEW_GIT_BLOBS),
        "qaWorker": qa.WORKER,
        "qaDatabase": qa.NAME,
        "qaDatabaseUuid": qa.UUID,
        "pinnedServingVersion": qa.ACTIVE_VERSION,
        "ownerQaMetadataCaptureProvided": captured,
        "captureMatchesOriginal23Schema": matching,
        "captureUtc": captured_at,
        "captureSha256": capture_hash,
        "captureOriginIndependentlyAttested": False,
        "hostedMigrationApproved": False,
        "workerUpdateApproved": False,
        "codeOnlyQaUpdateEligible": False,
        "sourceChangesDeployedForIphone": False,
        "physicalIphoneAccepted": False,
        "productionReleaseGatesPassed": 3,
        "productionReleaseGatesTotal": 10,
        "productionReady": False,
        "blockers": blockers,
        "iphoneReviewScreens": SCREENS,
        "nextSafeAction": (
            "On the original owner Windows profile, execute the existing read-only "
            "capture_existing_qa_schema_read_only.py --capture with exact typed "
            "consent into a private folder. Review the packet offline. Do not "
            "run migrations or QA publishing scripts."
        ) if not captured else (
            "Verify capture provenance, unchanged hosted original 23 schema, "
            "recoverable QA backup, rollback and distinct exact owner approvals. "
            "No migration or deployment is authorized by this report."
        ),
    }

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--capture-file", type=Path, help="Optional private QA schema-only capture JSON")
    args = p.parse_args(argv)
    try:
        report = decision(args.capture_file)
    except (QAReadinessStop, OSError) as error:
        print("FIRE QA READINESS STOP: " + str(error), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
