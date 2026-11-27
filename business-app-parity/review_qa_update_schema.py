"""Read-only, pinned QA schema delta review for the existing synthetic Worker.

This is NOT a migration runner, a live schema verification, or approval to publish.
Prints a review packet to stdout only. Never opens Cloudflare or writes a file.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

FIRST_QA_SOURCE = "f650d25b18d23bc9f71a4d55c9322bfd5870ef75"
HISTORICAL_GIT_BLOBS = {
  "0000_wise_namora.sql": "6fe91db0c425c7af3160211278153acc720aa05a",
  "0001_elite_cammi.sql": "e807e23c29b428366bcf281f2b63ea0cf2ba2efb",
  "0002_tearful_ink.sql": "2e1da24c23cab7271d2183c66f94534af508628b",
  "0003_absent_dracula.sql": "b4cdefd5fb1b2a3526027d6c7b0bc52f1896c675",
  "0004_volatile_fenris.sql": "406dc8b47511f4d4938e2700638f2aade46bd558",
  "0005_unknown_king_cobra.sql": "ea58cc5fa8fe24acdce87f5c38dcc7e830598e8b",
  "0006_open_solo.sql": "f05fdb817400f4f04c6abfaa4c42a3489d323fdb",
  "0007_open_bloodaxe.sql": "a1a9cf381d5d71368fc3bbdbad75028f4f32fbe4",
  "0008_typical_tomorrow_man.sql": "773696b06f18e767ece661cfe94cee91f08cd8ba",
  "0009_spicy_micromax.sql": "bb9d794f23bb036359e700197d12a4d67f981f1d",
  "0010_discount_mode.sql": "af66be4021276149cb75db53943084b46c98aceb",
  "0011_editable_invoices.sql": "59e0bf1a3cd2b07e5f06d713c48f7d5173d79e73",
  "0012_invoice_revisions.sql": "db700b2609f543a497b2ed0ce247c9db3aaf87cf",
  "0013_checkout_sessions.sql": "50e9f90335b225e6f7a2bd7d83939b688cc23c20",
  "0014_notification_resolution.sql": "e59a4270ab9ba3779120384285b3f0b8288fe526",
  "0015_single_open_checkout.sql": "904da8dde374eb2ec722f20b84f0b8c8564b42d0",
  "0016_notification_resolution_note.sql": "29255ce812bbef926b77a510fc7bda7a4ea49b0f",
  "0017_one_invoice_per_estimate.sql": "138c56c30a4267790f015f3710c1ee5a944a2368",
  "0018_payment_refunds.sql": "7c117a31e82849a40676b860f564d6bd9f94d57b",
  "0019_refund_ledger_unique.sql": "02903910851d495ae72d264c4ab6ecb0e1cf3f4e",
  "0020_notification_lifecycle_unique.sql": "e7ffba84306ce939e7f1da7ebd30fb56579943c0",
  "0021_manual_processing_fees.sql": "bcd94bcab354e7d6566e95b367c08e2b7d53f0a3",
  "0022_stripe_provider_uniqueness.sql": "da0f5382947984da5036273e87bbbbe9bdcb43a6"
}
NEW_GIT_BLOBS = {
  "0023_deposit_policy_events.sql": "0b3d257ebec85e7e1abefa39051e5f808b844cc0",
  "0024_deposit_agreement_snapshots.sql": "01d8405e7d44dbf0924ab819fbf82d7f9165fa8d"
}
SQL_NAME = re.compile(r"^\d{4}_[a-z0-9_]+\.sql$")


class QAReviewStop(ValueError):
    """Refuse incomplete, changed or unexpected migration evidence."""


def _git_blob_id(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode("ascii") + b"\0" + content).hexdigest()


def _read_sql_dir(folder: Path, label: str) -> dict[str, bytes]:
    if folder.is_symlink() or not folder.is_dir():
        raise QAReviewStop(label + ": missing or linked local migration directory")
    contents: dict[str, bytes] = {}
    for item in folder.iterdir():
        if item.suffix.lower() != ".sql":
            continue
        if item.is_symlink() or not item.is_file() or not SQL_NAME.fullmatch(item.name):
            raise QAReviewStop(label + ": unexpected or linked SQL migration " + item.name)
        if item.name in contents:
            raise QAReviewStop(label + ": duplicate SQL migration")
        if item.stat().st_size > 2_000_000:
            raise QAReviewStop(label + ": unreviewed large SQL file")
        contents[item.name] = item.read_bytes()
    return contents


def _canonical_migration_bytes(content: bytes) -> bytes:
    """Only paired CRLF -> LF; no trimming, decoding, BOM removal or SQL rewriting."""
    canonical = content.replace(b"\r\n", b"\n")
    if b"\r" in canonical:
        raise QAReviewStop("Unreviewed bare CR in migration source")
    return canonical


def _verify_pinned(files: dict[str, bytes], pins: dict[str, str], label: str) -> dict[str, bytes]:
    if set(files) != set(pins):
        raise QAReviewStop(
            label + ": unreviewed missing/new migration filenames; "
            + "missing=" + repr(sorted(set(pins) - set(files)))
            + " extra=" + repr(sorted(set(files) - set(pins)))
        )
    verified: dict[str, bytes] = {}
    for name in sorted(pins):
        canonical = _canonical_migration_bytes(files[name])
        if _git_blob_id(canonical) != pins[name]:
            raise QAReviewStop(label + ": migration content differs from pinned history: " + name)
        verified[name] = canonical
    indexes = sorted(int(name[:4]) for name in files)
    if indexes != list(range(len(files))):
        raise QAReviewStop(label + ": migrations are not numbered contiguously")
    # Return a verified memory-only snapshot. Never alter working-tree files.
    return verified


def review(baseline_dir: Path, candidate_dir: Path, checkpoint: str) -> dict:
    """Reject tampering; report exactly the two known new migrations, never approve."""
    if not re.fullmatch(r"[a-f0-9]{40}", checkpoint):
        raise QAReviewStop("A complete exact reviewed candidate SHA is required")
    first = _read_sql_dir(Path(baseline_dir), "first-hosted-QA")
    latest = _read_sql_dir(Path(candidate_dir), "current-candidate")
    raw_first, raw_latest = first, latest
    first = _verify_pinned(first, HISTORICAL_GIT_BLOBS, "first-hosted-QA")
    latest = _verify_pinned(latest, {**HISTORICAL_GIT_BLOBS, **NEW_GIT_BLOBS}, "current-candidate")
    if any(latest[name] != first[name] for name in first):
        raise QAReviewStop("Original hosted-QA migration bytes must stay unchanged")
    append = sorted(NEW_GIT_BLOBS)
    return {
        "result": "CODE_ONLY_QA_UPDATE_BLOCKED",
        "candidateSourceCommit": checkpoint,
        "pinnedOriginalSource": FIRST_QA_SOURCE,
        "originalSqlCount": len(first),
        "candidateSqlCount": len(latest),
        "originalMigrationsByteIdentical": all(raw_first[n] == raw_latest[n] for n in first),
        "originalMigrationsLfEquivalent": True,
        "migrationLineEndingPolicy": "CRLF-to-LF only, then exact pinned Git blob verification",
        "sha256Scope": "verified LF-canonical migration bytes; backup export hashes remain raw bytes",
        "additionalMigrations": [
            {"name": name, "gitBlob": NEW_GIT_BLOBS[name],
             "sha256": hashlib.sha256(latest[name]).hexdigest(),
             "workingTreeSha256": hashlib.sha256(raw_latest[name]).hexdigest(),
             "crlfConversionObserved": raw_latest[name] != latest[name]} for name in append
        ],
        "reviewScope": "local verified LF/CRLF-equivalent SQL only; remote QA journal/schema and live customer records not read",
        "hostedJournalVerified": False,
        "codeOnlyUpdateEligible": False,
        "migrationPermissionGranted": False,
        "publicationAuthorized": False,
        "requiredNextStep": (
            "Independent read-only hosted QA schema/journal review, backup/rollback evidence, "
            "and distinct exact owner approval before any additive migration or Worker update"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True,
                        help="preserved first-hosted QA materialized drizzle directory")
    parser.add_argument("--candidate", type=Path, required=True,
                        help="current candidate materialized drizzle directory")
    parser.add_argument("--checkpoint", required=True, help="40-character source commit")
    args = parser.parse_args()
    try:
        print(json.dumps(review(args.baseline, args.candidate, args.checkpoint),
                         indent=2, sort_keys=True))
    except QAReviewStop as problem:
        parser.exit(2, "FIRE QA READ-ONLY SCHEMA STOP: " + str(problem) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
