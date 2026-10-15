"""Verify one disposable coordinated candidate is an exact shared+adapter assembly.

This is a source-only verifier. It never talks to providers, opens a network
connection, touches a production resource or executes a deployment command.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

from candidate_release_manifest import APP_ADAPTERS, ROOT, inventory

TARGETS = ("live", "doomsday", "staging")


def check(target, directory):
    if target not in TARGETS:
        raise ValueError("Unknown candidate; expected live, doomsday or staging.")
    directory = Path(directory).resolve(strict=True)
    if not directory.is_dir() or directory.is_symlink():
        raise ValueError("Candidate must be a real directory, not a symlink.")
    shared = inventory(ROOT / "shared")
    adapter_dir = ROOT / "adapters" / target
    adapters = inventory(adapter_dir)
    absent_path = adapter_dir / "ABSENT_FILES.json"
    absent = json.loads(absent_path.read_text())
    if not isinstance(absent, list) or len(absent) != len(set(absent)):
        raise ValueError("Adapter absence list must be unique and explicit.")
    for name in absent:
        if not isinstance(name, str) or name not in APP_ADAPTERS:
            raise ValueError("Adapter may only remove explicitly listed auth/hosting files.")
        # Absence manifests describe target capability boundaries. They may
        # explicitly exclude an adapter-only auth route that is not in shared,
        # provided the name belongs to the reviewed adapter allowlist.
    for name in adapters:
        if name == "ABSENT_FILES.json":
            continue
        if not name.startswith("drizzle/") and name not in APP_ADAPTERS:
            raise ValueError("Adapter contains an unapproved business source override: " + name)
    identity = adapter_dir / "app/local-customer-deployment.ts"
    if not identity.is_file():
        raise ValueError("Required target-fixed local-customer identity adapter is missing.")
    identity_source = identity.read_text()
    expected_identity = f"export const LOCAL_CUSTOMER_DEPLOYMENT = '{target}' as const;"
    declarations = re.findall(r"export\\s+(?:const|function|class)\\s+([A-Za-z0-9_]+)", identity_source)
    if declarations != ["LOCAL_CUSTOMER_DEPLOYMENT"] or expected_identity not in identity_source:
        raise ValueError("Local-customer deployment identity does not match target " + target)
    if re.search(r"(?m)^\\s*(?:import|require\\(|export\\s+default)", identity_source):
        raise ValueError("Local-customer identity adapter may not import or execute external code.")
    expected = {name: digest for name, digest in shared.items() if not name.startswith("drizzle/")}
    expected.update({name: digest for name, digest in adapters.items() if name != "ABSENT_FILES.json"})
    for name in absent:
        expected.pop(name, None)
    actual = inventory(directory)
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    altered = sorted(name for name in expected.keys() & actual.keys() if expected[name] != actual[name])
    if missing or unexpected or altered:
        raise ValueError("Candidate fingerprint mismatch: " + json.dumps({
            "missing": missing[:8], "unexpected": unexpected[:8], "altered": altered[:8]}))
    migrations = sorted(name for name in expected if re.fullmatch(r"drizzle/\d{4}_.+\.sql", name))
    numbers = [int(Path(name).name[:4]) for name in migrations]
    if not numbers or numbers != list(range(len(numbers))):
        raise ValueError("Candidate migration sequence is missing, duplicated or noncontiguous.")
    # Fingerprint only source bytes, not mutable runtime artifacts.
    digest = hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    result = {
        "candidate": target,
        "exactSourceFiles": len(expected),
        "adapterFiles": len(adapters) - 1,
        "migrationFiles": len(migrations),
        "sourceFingerprint": digest,
        "identicalToSharedPlusAuthorizedAdapter": True,
        "deployed": False,
        "remoteSchemaVerified": False,
        "publicationAuthorized": False,
    }
    return result


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python verify_materialized_candidate.py <live|doomsday|staging> <directory>")
    try:
        print(json.dumps(check(sys.argv[1], sys.argv[2]), indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        sys.exit("Candidate verification BLOCKED: " + str(error))
