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
# October 24 owner screenshots are observations, not authenticated provider schema proof.
# Never use these display values to silently authorize a Worker or D1 change.
OWNER_OBSERVED_VERSION = "ab408776-bf5d-4fab-825e-73082eabbce6"
OWNER_OBSERVED_MIGRATIONS = 25
# On October 24 the owner separately read this UUID from the named QA D1
# database page. This matches our configuration; it does NOT attest that the
# active Worker version actually binds this UUID or that its schema is current.
OWNER_PROVIDED_QA_D1_UUID = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
OWNER_OBSERVED_FINAL = (
    "0023_deposit_policy_events.sql",
    "0024_deposit_agreement_snapshots.sql",
)
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

    if OWNER_PROVIDED_QA_D1_UUID != qa.UUID:
        raise QAReadinessStop("Owner-provided QA UUID differs from pinned candidate configuration.")

    captured, matching, captured_at, capture_hash = False, None, None, None
    blockers = []
    if capture_path is None:
        blockers.append("CURRENT_QA_SCHEMA_AND_WORKER_D1_BINDING_NOT_INDEPENDENTLY_VERIFIED")
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
            blockers.append("HISTORICAL_23_MIGRATION_CAPTURE_DRIFT_REQUIRES_INVESTIGATION")
        # This existing validator checks an October 19 *23-migration* capture.
        # Even a matching capture cannot prove the now observed 25-entry QA state.
        blockers.append("HISTORICAL_23_MIGRATION_CAPTURE_NOT_CURRENT_25_SCHEMA")
        blockers.append("CLOUDFLARE_CAPTURE_PROVENANCE_NOT_INDEPENDENTLY_ATTESTED")

    blockers.extend([
        "RECOVERABLE_QA_BACKUP_AND_RESTORE_NOT_VERIFIED",
        "OWNER_OBSERVED_25_MIGRATIONS_NOT_FULL_SCHEMA_ATTESTATION",
        "CURRENT_QA_SERVED_VERSION_NOT_LINKED_TO_CANDIDATE_SOURCE",
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
        "ownerProvidedQaDatabaseUuid": OWNER_PROVIDED_QA_D1_UUID,
        "ownerProvidedUuidMatchesConfig": True,
        "qaWorkerRuntimeBindingIndependentlyAttested": False,
        "pinnedServingVersion": qa.ACTIVE_VERSION,
        "pinnedServingVersionIsHistorical": True,
        "ownerObservedServingVersion": OWNER_OBSERVED_VERSION,
        "ownerObservedMigrationCount": OWNER_OBSERVED_MIGRATIONS,
        "ownerObservedLastMigrations": list(OWNER_OBSERVED_FINAL),
        "ownerObservedEvidenceIndependentlyAttested": False,
        "repeatOwnerObservedMigrationsRequired": False,
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
            "Owner-provided QA D1 UUID now matches repository config; do not ask for "
            "it again. Verify the active QA Worker's actual D1 binding and full "
            "25-migration schema/journal with a current read-only capture. "
            "Owner screenshots already show 0023/0024 applied; never reapply them. "
            "Confirm private backup custody and exact source-to-deployment evidence "
            "before seeking a separate QA-only publication approval. No LIVE action."
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
