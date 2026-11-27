"""Review a private *metadata-only* owner QA D1 capture offline.

This program never contacts Cloudflare, runs migrations, reads customer rows,
changes backups or authorizes QA Worker publication. Its capture is untrusted
until independently cross-checked with the signed-in owner and Cloudflare.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import capture_existing_qa_schema_read_only as qa
from review_qa_update_schema import (
    HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned,
)

FORMAT = "fire-qa-readonly-evidence-decision-v1"
MAX_BYTES = 2_000_000

class OfflineReviewStop(ValueError):
    pass

def evaluate(path: Path) -> dict:
    path=Path(path)
    if path.is_symlink() or not path.is_file():
        raise OfflineReviewStop("Capture file missing or symbolic link.")
    size=path.stat().st_size
    if not 0<size<=MAX_BYTES:
        raise OfflineReviewStop("Capture exceeds safe metadata file size.")
    try:
        raw=path.read_bytes()
        packet=json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeError, ValueError) as e:
        raise OfflineReviewStop("Capture is not valid reviewed UTF-8 JSON.") from e
    if type(packet) is not dict or set(packet)!={"capture","review"}:
        raise OfflineReviewStop("Capture envelope contains unexpected fields.")
    try:
        actual=qa.compare_capture(packet["capture"])
        if packet["review"]!=actual:
            raise OfflineReviewStop("Stored review does not match recalculated schema evidence.")
        captured=datetime.fromisoformat(packet["capture"]["capturedAt"])
        if captured.tzinfo is None:
            raise OfflineReviewStop("Capture timestamp is missing timezone.")
        captured=captured.astimezone(timezone.utc)
        if not datetime(2026,10,16,tzinfo=timezone.utc)<=captured<=datetime.now(timezone.utc):
            raise OfflineReviewStop("Capture date outside approved range.")
        candidate=_read_sql_dir(qa.BASE,"reviewed QA migration candidate")
        _verify_pinned(candidate,{**HISTORICAL_GIT_BLOBS,**NEW_GIT_BLOBS},"reviewed QA migration candidate")
        qa.local_baseline()
    except (ValueError, KeyError, TypeError, OSError) as e:
        raise OfflineReviewStop("Strict QA metadata/schema review failed: "+str(e)) from e
    matches=actual["metadataMatchesOriginal23"]
    return {
        "format":FORMAT,
        "result":"ORIGINAL_QA_23_METADATA_MATCHES_OWNER_REVIEW_REQUIRED" if matches else "QA_SCHEMA_DRIFT_STOP",
        "qaWorker":qa.WORKER,"qaDatabase":qa.NAME,"qaUuid":qa.UUID,
        "observedActiveVersion":qa.ACTIVE_VERSION,
        "captureUtc":captured.isoformat(),
        "captureSha256":hashlib.sha256(raw).hexdigest(),
        "original23SchemaMetadataMatches":matches,
        "candidate25SqlSourcePinned":True,
        "additiveSqlMigrations":sorted(NEW_GIT_BLOBS),
        "schemaDriftIndicators":actual["blockers"],
        "cloudflareCaptureProvenanceIndependentlyAttested":False,
        "hostedBackupAndRestoreVerified":False,
        "migrationApproved":False,"workerPublishApproved":False,
        "physicalIphoneAccepted":False,"productionReady":False,
        "nextStep":"Investigate source identity and hosted QA schema drift. No changes." if not matches else
          "Confirm capture provenance, exact hosted Worker/D1 binding, recoverable private QA backup and rollback; separately request exact owner approvals for migrations and any Worker update."
    }

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--capture-file",type=Path,help="Private FIRE-EXISTING-QA-SCHEMA-ONLY-*.json")
    args=ap.parse_args()
    if args.capture_file is None:
        print("READ-ONLY. No Cloudflare access, file write, migration, or deployment. Supply --capture-file after owner-approved metadata capture.")
        return 0
    try:
        decision=evaluate(args.capture_file)
    except (OfflineReviewStop,OSError) as e:
        print("FIRE QA EVIDENCE REVIEW STOP: "+str(e),file=sys.stderr)
        return 2
    print(json.dumps(decision,indent=2,sort_keys=True))
    return 0 if decision["original23SchemaMetadataMatches"] else 2

if __name__=="__main__":
    raise SystemExit(main())
