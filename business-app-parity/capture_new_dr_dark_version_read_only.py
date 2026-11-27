"""One-time owner-only POST-CREATION identity readback for the NEW dark DR Worker.

Different from the historical Doomsday check. The owner already completed the
first approved Cloudflare creation: NEVER redeploy this Worker or repeat DR D1
migrations. This tool deliberately performs NO provider mutation, login,
SQL, read of D1 customer rows, Access update, route enablement or data export.

Without --capture it does not contact Cloudflare.
With --capture it invokes ONLY three read-only Wrangler commands against the
already-authenticated account: deployments status, versions view, D1 list.
It prints a tiny sanitized result, never untrusted raw provider JSON.

Even a PASS is provider version/binding evidence, NOT route, Access, worker
source binary, app parity, backup, production or formal release acceptance.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys

from capture_doomsday_worker_identity_read_only import active_version

WORKER = "fire-fullapp-dr"
VERSION = "b7c42773-5a93-4c6c-91d2-83cdb8e857d9"
DR_DB = "fire-fullapp-dr-db"
DR_UUID = "5e55c5b7-cd67-4c8f-a52e-40f71b5d3145"
ACCOUNT = "bfc00939cfb2f8dfd8581a7a7f5f1307"
WRANGLER = "wrangler@4.162.0"
ORIGIN = "https://fire-fullapp-dr.kyle-bfc.workers.dev"
OTHER_KNOWN_DB_IDS = frozenset({
    "0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662",  # future new LIVE
    "dba421ba-fc66-4cf8-9c31-51616f8249ba",  # Stripe TEST
    "afb2c05a-d794-4a9a-b580-924ce01c26ad",  # independent staging
})
EXPECTED_TEXT = {
    "FIRE_ENV": "isolated-dr",
    "FIRE_DR_AUTH_ENABLED": "blocked",
    "FIRE_PHOTO_STORAGE_MODE": "owner-device-zip",
    "SITE_ORIGIN": ORIGIN,
}
UUID = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")
SAFE_COMMANDS = (
    ("deployments", "status", "--name", WORKER, "--json"),
    ("versions", "view", VERSION, "--name", WORKER, "--json"),
    ("d1", "list", "--json"),
)


def refuse(problem):
    raise ValueError("FIRE NEW DR READ ONLY BLOCKED: " + problem)


def current_version(status):
    """Do not silently accept a stale, partial-traffic or split deployment."""
    try:
        version = active_version(status)
    except ValueError:
        refuse("missing or non-100-percent current version evidence")
    if version != VERSION:
        refuse("Worker version differs from the exact owner-observed new version")
    return version


def actual_binding_contract(details):
    """Match provider-visible version resource bindings, not local wrangler.json."""
    if not isinstance(details, dict):
        refuse("version details are not a supported JSON object")
    identifier = details.get("id", details.get("version_id"))
    if not isinstance(identifier, str) or identifier.lower() != VERSION:
        refuse("version details do not match owner-confirmed Worker version")
    nested = details.get("resources")
    nested_bindings = nested.get("bindings") if isinstance(nested, dict) else None
    root_bindings = details.get("bindings")
    if root_bindings is not None and nested_bindings is not None:
        refuse("ambiguous two sources for hosted version bindings")
    bindings = root_bindings if root_bindings is not None else nested_bindings
    if not isinstance(bindings, list) or len(bindings) != 5:
        refuse("expected exactly the reviewed DR D1 and four inert variables")
    found = {}
    for binding in bindings:
        if not isinstance(binding, dict):
            refuse("malformed Worker binding")
        name = binding.get("name")
        if not isinstance(name, str) or name not in {"DB", *EXPECTED_TEXT} or name in found:
            refuse("unknown or duplicate Worker binding (no Access, secret, R2 or Stripe)")
        found[name] = binding
    if set(found) != {"DB", *EXPECTED_TEXT}:
        refuse("an expected Worker D1 or dark variable is missing")
    db = found["DB"]
    if db.get("type") not in ("d1", "d1_database"):
        refuse("DB is not an explicit Cloudflare D1 binding")
    identifier = db.get("id", db.get("database_id"))
    if not isinstance(identifier, str) or identifier.lower() != DR_UUID:
        refuse("hosted DR binding does not match independently recorded D1 UUID")
    for name, expected in EXPECTED_TEXT.items():
        b = found[name]
        if b.get("type") != "plain_text" or b.get("text") != expected:
            refuse("hosted DR runtime variable is missing, changed, or no longer blocked")
    return True


def inventory_matches(rows):
    """Independent account inventory must confirm the exact physical resource."""
    if not isinstance(rows, list) or len(rows) > 10000:
        refuse("D1 inventory missing or oversized")
    match = [r for r in rows if isinstance(r, dict) and r.get("name") == DR_DB]
    if len(match) != 1 or match[0].get("uuid") != DR_UUID:
        refuse("independent DR database name/UUID not present exactly once")
    all_ids = [r.get("uuid") for r in rows if isinstance(r, dict)]
    if all_ids.count(DR_UUID) != 1 or DR_UUID in OTHER_KNOWN_DB_IDS:
        refuse("ambiguous or cross-environment D1 identity")
    return True


def read_only_cli(npx, args):
    if tuple(args) not in SAFE_COMMANDS:
        refuse("unapproved CLI command (no writes or non-DR Worker queries)")
    try:
        proc = subprocess.run(
            [npx, "--yes", WRANGLER, *args],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            check=False, timeout=90,
        )
    except (OSError, subprocess.TimeoutExpired):
        refuse("read-only Wrangler command unavailable")
    if proc.returncode != 0:
        # stderr may contain credentials or provider-provided text; never echo.
        refuse("read-only Wrangler request failed, outcome not attested")
    if len(proc.stdout.encode("utf-8")) > 600000:
        refuse("read-only provider response exceeds safe metadata limit")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        refuse("unsupported Wrangler JSON, no fallback to guesswork")


def capture(npx, runner=read_only_cli):
    status = runner(npx, list(SAFE_COMMANDS[0]))
    current_version(status)
    detail = runner(npx, list(SAFE_COMMANDS[1]))
    actual_binding_contract(detail)
    rows = runner(npx, list(SAFE_COMMANDS[2]))
    inventory_matches(rows)
    return {
        "result": "FIRE_NEW_DR_DARK_VERSION_DB_BINDING_READ_ONLY_MATCH",
        "worker": WORKER,
        "ownerObservedVersionIdMatched": VERSION,
        "versionBindingsMatchedActualD1": DR_UUID,
        "actualD1InventoryMatched": True,
        "ownerAuthBlockedInVersion": True,
        "photoStorageIsDeviceZipOnly": True,
        "hostedRoutesProviderVerified": False,
        "accessPolicyProviderVerified": False,
        "hostedSourceShaVerified": False,
        "customerDataRead": False,
        "remoteDatabaseChanged": False,
        "workerUpdated": False,
        "gate4Accepted": False,
        "gate5Accepted": False,
        "productionReady": False,
        "acceptedReleaseGates": 4,
        "totalReleaseGates": 10,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true",
                        help="Read only the already-created exact dark DR version and D1 identity.")
    args = parser.parse_args()
    if not args.capture:
        print("DRY RUN: no Cloudflare requests. Owner first-create remains COMPLETE; never redeploy.")
        return 0
    npx = shutil.which("npx.cmd") if sys.platform == "win32" else shutil.which("npx")
    if not npx:
        print("BLOCKED: installed npx executable is unavailable; no login requested.", file=sys.stderr)
        return 2
    try:
        print(json.dumps(capture(npx), sort_keys=True, indent=2))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
