"""Owner-only, opt-in read-only Cloudflare Worker deployment identity check.

NO deployment, migration, SQL execution, credential export, or secret output.
Supports only explicit version/resource result shapes; unknown CLI shape fails closed.
This proves nothing about ChatGPT Sites LIVE/refund staging or source-code hashes.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys

WORKER = "fire-app-independent-staging"
DATABASE = "fire-app-staging-db"
DB_UUID = "afb2c05a-d794-4a9a-b580-924ce01c26ad"
OLD_VERSION = "61fa32a3-3461-469d-9245-a9df6dd3f036"
UUID_RE = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")


def required_uuid(value):
    if not isinstance(value, str) or not UUID_RE.fullmatch(value.lower()):
        raise ValueError("Current Worker version identifier missing/invalid.")
    return value.lower()


def active_version(status):
    """Accept only exactly one, explicitly 100-percent active version."""
    if not isinstance(status, dict) or not isinstance(status.get("versions"), list):
        raise ValueError("Unknown Wrangler deployment-status schema. No identity accepted.")
    versions = status["versions"]
    if len(versions) != 1 or not isinstance(versions[0], dict):
        raise ValueError("Unexpected split/missing deployment; inspect directly.")
    row = versions[0]
    percent = row.get("percentage")
    if type(percent) not in (int, float) or percent != 100:
        raise ValueError("Active version is not explicitly at 100% of deployment.")
    version = row.get("version_id")
    if version is None:
        version = row.get("id")
    return required_uuid(version)


def version_database_binding(version, selected):
    """Never infer a Worker binding from local wrangler.json or a similar name."""
    if not isinstance(version, dict):
        raise ValueError("Unrecognized version-view response.")
    vid = version.get("id", version.get("version_id"))
    if required_uuid(vid) != selected:
        raise ValueError("Version-view ID and deployed version disagree.")
    nested = version.get("resources")
    root_bindings = version.get("bindings")
    nested_bindings = nested.get("bindings") if isinstance(nested, dict) else None
    if root_bindings is not None and nested_bindings is not None:
        raise ValueError("Ambiguous version binding sources.")
    bindings = root_bindings if root_bindings is not None else nested_bindings
    if not isinstance(bindings, list):
        raise ValueError("Provider response does not expose version bindings.")
    db = [b for b in bindings if isinstance(b, dict) and b.get("name") == "DB"]
    if len(db) != 1:
        raise ValueError("Missing or duplicate DB binding in active version.")
    binding = db[0]
    if binding.get("type") not in ("d1", "d1_database"):
        raise ValueError("DB binding is not an explicitly identified D1 resource.")
    dbid = binding.get("id")
    if dbid is None:
        dbid = binding.get("database_id")
    if not isinstance(dbid, str) or dbid.lower() != DB_UUID:
        raise ValueError("Active Worker DB resource ID does not match pinned D1 UUID.")
    return True


def inventory_check(inventory):
    if not isinstance(inventory, list):
        raise ValueError("Unrecognized account D1 inventory.")
    matches = [row for row in inventory if isinstance(row, dict)
               and row.get("name") == DATABASE]
    if len(matches) != 1 or matches[0].get("uuid") != DB_UUID:
        raise ValueError("Account D1 inventory cannot independently confirm exact target.")
    if sum(1 for row in inventory if isinstance(row, dict) and row.get("uuid") == DB_UUID) != 1:
        raise ValueError("Duplicate matching D1 identifiers in inventory.")
    return True


def parse_command(wrangler, args):
    # No shell, no file persistence, and never print raw CLI responses or errors.
    try:
        proc = subprocess.run([wrangler, *args], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=90, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError("Wrangler read-only request unavailable or timed out.") from None
    if proc.returncode != 0:
        raise ValueError("Wrangler read-only request failed; verify account and CLI support.")
    if len(proc.stdout.encode("utf-8")) > 600000:
        raise ValueError("Provider response oversized; possible unsafe metadata.")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise ValueError("Provider CLI did not return supported JSON.") from None


def read_only_check(wrangler, runner=parse_command):
    # Strictly allowlist the three read-only CLI commands. No SQL/query/export/write.
    status = runner(wrangler, ["deployments", "status", "--name", WORKER, "--json"])
    vid = active_version(status)
    details = runner(wrangler, ["versions", "view", vid, "--name", WORKER, "--json"])
    version_database_binding(details, vid)
    inventory = runner(wrangler, ["d1", "list", "--json"])
    inventory_check(inventory)
    return {
        "result": "INDEPENDENT_DOOMSDAY_READ_ONLY_BINDING_MATCH",
        "worker": WORKER,
        "deployedVersionId": vid,
        "databaseUuid": DB_UUID,
        "matchingD1Inventory": True,
        "historicalObservedVersionChanged": vid != OLD_VERSION,
        "liveAndRefundStagingVerified": False,
        "artifactSourceShaVerified": False,
        "physicalThreeTargetIsolationVerified": False,
        "gate4Passed": False,
        "gate5Passed": False,
        "officialReadinessPercent": 30,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true",
                        help="Read current independent Doomsday Worker deployment/version and D1 list.")
    args = parser.parse_args()
    if not args.capture:
        print("DRY RUN: Three read-only commands available; no network request.")
        return 0
    wrangler = shutil.which("wrangler.cmd") or shutil.which("wrangler")
    if not wrangler:
        print("BLOCKED: Installed Wrangler CLI not found.", file=sys.stderr)
        return 2
    try:
        print(json.dumps(read_only_check(wrangler), indent=2))
    except ValueError as err:
        print("BLOCKED: " + str(err), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
