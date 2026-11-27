"""FIRE source-only pinned SQL verifier for EXISTING synthetic QA D1 23->25 upgrade.

This is NOT a hosted D1 read, migration, authorization or rollback.
All 25 SQL files must match the immutable first-QA history plus exactly
two reviewed additive migrations. CRLF is canonicalized for source checks.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from review_qa_update_schema import (
    HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, QAReviewStop,
    _read_sql_dir, _verify_pinned,
)

REQUIRED_ADDITIONS = (
    "0023_deposit_policy_events.sql",
    "0024_deposit_agreement_snapshots.sql",
)

def verify(directory: Path) -> dict:
    if set(NEW_GIT_BLOBS) != set(REQUIRED_ADDITIONS):
        raise QAReviewStop("Unexpected additive QA migration set")
    current = _read_sql_dir(Path(directory), "qa-23-to-25")
    pins = {**HISTORICAL_GIT_BLOBS, **NEW_GIT_BLOBS}
    _verify_pinned(current, pins, "qa-23-to-25")
    original = sorted(HISTORICAL_GIT_BLOBS)
    additions = sorted(NEW_GIT_BLOBS)
    if len(original) != 23 or len(additions) != 2 or additions != list(REQUIRED_ADDITIONS):
        raise QAReviewStop("Expected exactly original 23 followed by approved 0023/0024")
    return {
        "sourceHistoryVerified": True,
        "expectedOldMigrationCount": len(original),
        "candidateMigrationCount": len(pins),
        "approvedAdditions": additions,
        "expectedRemoteD1Verified": False,
        "remoteWrites": False,
        "migrationApproved": False,
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.candidate), sort_keys=True))
    except QAReviewStop as error:
        parser.exit(2, "FIRE PINNED QA 23->25 STOP: " + str(error) + "\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
