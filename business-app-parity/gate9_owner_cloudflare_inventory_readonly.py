"""FIRE Gate 9: owner-local read-only, sanitized D1 account capacity and DR isolation inventory.

Only optional remote action: wrangler d1 list --json (no SQL, provider writes,
customers, keys, Worker deploy, migrations, Stripe operations or resource creation).
D1 count alone NEVER establishes account plan, zero cost or staging readiness.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from uuid import UUID

QA_NAME = "fire-fullapp-qa-db-20261016"
QA_ID = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
DR_NAME = "fire-app-staging-db"
DR_ID = "afb2c05a-d794-4a9a-b580-924ce01c26ad"
# Name proposed for a NEW DB only. Never create or reuse anything via this script.
NEW_TEST_DB_NAME = "fire-refund-sandbox-db-20261102"
NEW_TEST_WORKER_NAME = "fire-refund-sandbox-20261102"
D1_FREE_MAX = 10
MAX_OUTPUT = 2_000_000


def inventory_report(raw):
    if not isinstance(raw, list) or len(raw) > 50000:
        raise ValueError("D1_LIST_INVALID")
    names = {}
    ids = set()
    for entry in raw:
        if not isinstance(entry, dict):
            raise ValueError("D1_ENTRY_INVALID")
        name, dbid = entry.get("name"), entry.get("uuid")
        if not isinstance(name, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,150}", name):
            raise ValueError("D1_NAME_MISSING_OR_UNSUPPORTED")
        if not isinstance(dbid, str):
            raise ValueError("D1_ID_MISSING")
        try:
            canon = str(UUID(dbid))
        except (ValueError, AttributeError):
            raise ValueError("D1_ID_INVALID") from None
        if canon != dbid:
            raise ValueError("D1_ID_NOT_CANONICAL")
        if name.lower() in names or dbid in ids:
            raise ValueError("D1_DUPLICATE_IDENTITY")
        names[name.lower()] = dbid
        ids.add(dbid)
    qa = names.get(QA_NAME.lower())
    dr = names.get(DR_NAME.lower())
    blockers = []
    if qa != QA_ID:
        blockers.append("PINNED_QA_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT")
    if dr != DR_ID:
        blockers.append("PINNED_HISTORICAL_DR_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT")
    if NEW_TEST_DB_NAME.lower() in names:
        blockers.append("PROPOSED_NEW_TEST_D1_NAME_ALREADY_TAKEN")
    if len(raw) >= D1_FREE_MAX:
        blockers.append("NO_FREE_TIER_D1_SLOT_IF_ACCOUNT_FREE")
    return {
        "status": "READ_ONLY_INVENTORY_ONLY_NOT_RELEASE_APPROVAL",
        "databaseCount": len(raw),
        "publishedWorkersFreeD1Limit": D1_FREE_MAX,
        "possibleOneNewD1UnderFreeCountLimit": len(raw) < D1_FREE_MAX,
        "protectedQaD1MatchesHistoricalPin": qa == QA_ID,
        "protectedDrD1MatchesHistoricalPin": dr == DR_ID,
        "proposedNewDatabaseNameAvailable": NEW_TEST_DB_NAME.lower() not in names,
        "proposedNewDatabaseName": NEW_TEST_DB_NAME,
        "proposedNewWorkerName": NEW_TEST_WORKER_NAME,
        "blockedReasons": blockers,
        "actualCloudflarePlanVerified": False,
        "actualCloudflareBillingVerified": False,
        "newWorkerNameAvailableVerified": False,
        "newWorkerAndDbPhysicallyIsolatedVerified": False,
        "stripeTestWebhookReady": False,
        "safeToProvisionOrDeploy": False,
        "releaseGatesAccepted": 3,
        "releaseGatesTotal": 10,
        "readOnlyProviderCalls": 1,
        "remoteWrites": 0,
        "customerRowsRead": 0,
    }


def capture(executable):
    # No shell or user-supplied extra arguments. Provider output stays private.
    try:
        p = subprocess.run([executable, "d1", "list", "--json"], check=False,
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("WRANGLER_READ_ONLY_LIST_UNAVAILABLE") from None
    if p.returncode != 0:
        raise ValueError("WRANGLER_D1_LIST_FAILED_USE_ORIGINAL_OWNER_ACCOUNT")
    if len(p.stdout.encode("utf-8")) > MAX_OUTPUT:
        raise ValueError("D1_LIST_RESPONSE_TOO_LARGE")
    try:
        return inventory_report(json.loads(p.stdout))
    except json.JSONDecodeError:
        raise ValueError("WRANGLER_D1_JSON_UNAVAILABLE") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true",
                        help="One owner-authenticated wrangler d1 list --json; emit sanitized counts only.")
    args = parser.parse_args()
    if not args.capture:
        print("DRY_RUN_ONLY: No remote call. --capture permits exactly one read-only D1 list.")
        return 0
    exe = shutil.which("wrangler.cmd") or shutil.which("wrangler")
    if not exe:
        print("BLOCKED: WRANGLER_NOT_FOUND", file=sys.stderr)
        return 2
    try:
        result = capture(exe)
    except ValueError as error:
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result["blockedReasons"] else 0


if __name__ == "__main__":
    sys.exit(main())
