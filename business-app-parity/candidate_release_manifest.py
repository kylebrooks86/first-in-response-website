"""Hash coordinated FIRE candidates for review; never authorizes publication."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
TARGETS = ("live", "doomsday", "staging")
APP_ADAPTERS = {
    "app/page.tsx", "app/layout.tsx", "app/chatgpt-auth.ts", "app/owner-auth.ts",
    "app/login/page.tsx", "app/api/auth/login/route.ts", "app/api/auth/logout/route.ts",
    "app/api/app-version/route.ts", "app/api/staging-fixtures/route.ts",
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(directory):
    result = {}
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise ValueError("Source symlinks must be reviewed, not silently sealed.")
        if path.is_file():
            result[path.relative_to(directory).as_posix()] = sha(path)
    return result


def fingerprint(files):
    return hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def build_manifest(root, checkpoint):
    root = Path(root)
    if not re.fullmatch(r"[0-9a-f]{40}", checkpoint):
        raise ValueError("Checkpoint must be an exact commit SHA.")
    progress = json.loads((root / "PROGRESS_STATUS.json").read_text())
    readiness = progress["productionReadiness"]
    passed, total = readiness["gatesPassed"], readiness["totalGates"]
    if not isinstance(passed, int) or not isinstance(total, int) or total <= 0 or not 0 <= passed <= total:
        raise ValueError("Invalid verified readiness counts.")
    if readiness["percent"] != passed / total * 100:
        raise ValueError("Readiness percentage does not match its counts.")
    shared = inventory(root / "shared")
    if not shared:
        raise ValueError("Shared candidate is empty.")
    targets = {}
    common_application = None
    for target in TARGETS:
        adapter_root = root / "adapters" / target
        adapter = inventory(adapter_root)
        absent = json.loads((adapter_root / "ABSENT_FILES.json").read_text())
        if any(not isinstance(path, str) or path.startswith("/") or ".." in Path(path).parts for path in absent):
            raise ValueError("Invalid adapter absence path.")
        merged = {path: digest for path, digest in shared.items() if not path.startswith("drizzle/")}
        merged.update({path: digest for path, digest in adapter.items() if path != "ABSENT_FILES.json"})
        for path in absent:
            merged.pop(path, None)
        common = {path: digest for path, digest in merged.items()
                  if path.split("/")[0] in {"app", "lib", "components", "db", "public", "hooks", "vendor"}
                  and path not in APP_ADAPTERS}
        if common_application is None:
            common_application = common
        elif common != common_application:
            raise ValueError("Shared application source differs across target adapters.")
        migrations = {path: digest for path, digest in merged.items() if re.fullmatch(r"drizzle/\d{4}_.+\.sql", path)}
        numbers = [int(Path(path).name[:4]) for path in sorted(migrations)]
        if not numbers or numbers != list(range(len(numbers))):
            raise ValueError("Migration sequence is missing, duplicated or noncontiguous.")
        targets[target] = {
            "adapterFilesSha256": adapter,
            "absentFiles": absent,
            "materializedFilesSha256": merged,
            "materializedSourceFingerprint": fingerprint(merged),
            "migrationFilesSha256": migrations,
            "migrationFileCount": len(migrations),
            "hostingConfiguration": "local placeholder; target release configuration unverified",
            "deploymentVerified": False,
            "remoteSchemaJournalVerified": False,
            "publicationAuthorized": False,
        }
    return {
        "scope": "FIRE Business App coordinated candidate review only",
        "checkpointBase": checkpoint,
        "meaning": "Working-tree source hashes for review, not deployed release identity or approval.",
        "sharedFilesSha256": shared,
        "sharedSourceFingerprint": fingerprint(shared),
        "sharedApplicationFilesMatched": len(common_application),
        "sharedApplicationFingerprint": fingerprint(common_application),
        "targets": targets,
        "overallVerifiedReadiness": {"passed": passed, "total": total, "percent": passed / total * 100,
                                     "meaning": "verified release gates, not effort or time remaining"},
        "pendingReleaseGates": readiness["pending"],
        "productionReady": False,
        "publicationAuthorized": False,
        "deployed": False,
        "inputFilesSha256": {name: sha(root / name) for name in ["PROGRESS_STATUS.json", "CANDIDATE_COMMITS.json", "FIRE_DEPLOYMENT_INVENTORY.json"]},
    }


def verify_manifest(root, manifest):
    current = build_manifest(root, manifest["checkpointBase"])
    if current != manifest:
        raise ValueError("Candidate source, adapters, migration history or review inputs changed; regenerate and review.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--checkpoint")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    try:
        if args.verify:
            verify_manifest(ROOT, json.loads(args.manifest.read_text()))
            print("Candidate manifest matches source and review inputs; publication remains blocked.")
        else:
            if args.manifest.exists():
                raise ValueError("Refusing to overwrite an existing manifest.")
            args.manifest.write_text(json.dumps(build_manifest(ROOT, args.checkpoint or ""), indent=2) + "\n")
            print("Candidate review manifest saved; no deploy, migration or resource action performed.")
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, str(error) + "\n")
