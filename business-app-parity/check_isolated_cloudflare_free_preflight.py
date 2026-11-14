"""Owner-side, READ-ONLY Cloudflare capacity check for a new FIRE full-app QA target.

Never provisions Workers, D1, R2, DNS, Secrets or migrations. Never accesses rows.
Cost, Worker availability, R2 subscription and plan cannot be confirmed by D1 list;
these remain explicitly BLOCKED even on a passing inventory.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys

D1_NAME = "fire-fullapp-qa-db-20261016"
WORKER_NAME = "fire-fullapp-qa-20261016"
R2_NAME = "fire-fullapp-qa-photos-20261016"
FREE_D1_MAX = 10
UUID = re.compile(r"^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$")


def inspect_d1_inventory(rows):
    if not isinstance(rows, list) or len(rows) > 50000:
        raise ValueError("Unrecognized D1 account inventory; no capacity accepted.")
    names = set()
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("name"), str) or not row["name"]:
            raise ValueError("D1 resource identity unavailable.")
        name = row["name"]
        uuid = row.get("uuid")
        if not isinstance(uuid, str) or not UUID.fullmatch(uuid.lower()):
            raise ValueError("D1 resource UUID missing or unsupported.")
        if name in names or uuid.lower() in ids:
            raise ValueError("Ambiguous or duplicated D1 resource identity.")
        names.add(name)
        ids.add(uuid.lower())
    if D1_NAME in names:
        raise ValueError("Proposed FIRE QA D1 name already exists; refuse reuse or overwrite.")
    if len(rows) >= FREE_D1_MAX:
        raise ValueError("No remaining D1 Free-plan slot available; no resource creation permitted.")
    return {
        "result": "D1_FREE_TIER_CAPACITY_PRECHECK_ONLY",
        "accountD1Count": len(rows),
        "publishedFreePlanD1Limit": FREE_D1_MAX,
        "oneAdditionalD1WouldFitIfAccountIsFree": len(rows) + 1 <= FREE_D1_MAX,
        "qaD1NameAvailable": True,
        "proposedWorker": WORKER_NAME,
        "proposedD1Name": D1_NAME,
        "proposedR2Name": R2_NAME,
        "cloudflareAccountPlanConfirmed": False,
        "actualZeroCostConfirmed": False,
        "qaWorkerNameAvailableConfirmed": False,
        "r2SubscriptionAndZeroCostConfirmed": False,
        "candidateOwnerAuthProven": False,
        "isolatedRuntimeProven": False,
        "safeToDeploy": False,
        "resourcesCreated": 0,
        "productionResourcesModified": 0,
        "officialReadinessPercent": 30
    }


def read_only_probe(executable):
    # No shell, no auth tokens, no database SQL, no account plan inference.
    try:
        proc = subprocess.run([executable, "d1", "list", "--json"], check=False,
                              capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=90)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("Authenticated read-only Wrangler D1 inventory was unavailable.") from None
    if proc.returncode != 0:
        raise ValueError("Read-only D1 list failed; confirm correct Cloudflare account and login.")
    if len(proc.stdout.encode("utf-8")) > 2_000_000:
        raise ValueError("Read-only D1 inventory too large to inspect safely.")
    try:
        return inspect_d1_inventory(json.loads(proc.stdout))
    except json.JSONDecodeError:
        raise ValueError("Read-only D1 inventory is not supported JSON.") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true",
                        help="Run only 'wrangler d1 list --json' and sanitize account inventory.")
    args = parser.parse_args()
    if not args.capture:
        print("DRY RUN: No Cloudflare calls. --capture reads D1 names/UUIDs privately and outputs only a sanitized count.")
        return 0
    exe = shutil.which("wrangler.cmd") or shutil.which("wrangler")
    if not exe:
        print("BLOCKED: Wrangler CLI not available in this PowerShell session.", file=sys.stderr)
        return 2
    try:
        print(json.dumps(read_only_probe(exe), indent=2, sort_keys=True))
    except ValueError as error:
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
