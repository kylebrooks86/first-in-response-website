"""Hash coordinated FIRE candidates for review; never authorizes publication."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import importlib.util

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


def native_table_preflight(root, target, migrations, evidence):
    if target == "doomsday" or evidence is None:
        return {"observed": False, "tableNamesMatch": None,
                "reason": "Independent metadata unavailable" if target == "doomsday" else "No native table evidence",
                "completeRemoteSchemaVerified": False, "productionReady": False}
    spec = importlib.util.spec_from_file_location("native_table_inventory", ROOT / "check-deployed-table-inventory.py")
    inspector = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inspector)
    with sqlite3.connect(":memory:") as fixture:
        for name in sorted(migrations):
            fixture.executescript((root / "adapters" / target / name).read_text())
        expected = [row[0] for row in fixture.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    report = inspector.compare(evidence.get(target, {}).get("tableOverview"), target, expected)
    return {"observed": True, **report}


def validate_snapshots(snapshots):
    if not isinstance(snapshots, dict) or set(snapshots) != set(TARGETS) or any(
            not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value)
            for value in snapshots.values()):
        raise ValueError("Latest candidate snapshot references must identify all three exact commits.")


def evidence_sources(root, evidence, label):
    if not isinstance(evidence, dict):
        raise ValueError(f"Malformed {label} evidence.")
    sources = evidence.get("changedFilesSha256")
    if not isinstance(sources, dict) or not sources:
        raise ValueError(f"Missing {label} source hashes.")
    for name, digest in sources.items():
        if not isinstance(name, str):
            raise ValueError(f"Invalid {label} evidence source path or hash.")
        relative = Path(name)
        if (not name.startswith("shared/") or relative.is_absolute() or ".." in relative.parts
                or relative.as_posix() != name or not isinstance(digest, str)
                or not re.fullmatch(r"[0-9a-f]{64}", digest)):
            raise ValueError(f"Invalid {label} evidence source path or hash.")
        if any(parent.is_symlink() for parent in [root / relative, *(root / relative).parents]):
            raise ValueError("Source symlinks must be reviewed, not silently sealed.")
    return sources


def latest_verified_evidence(root, commits):
    has_snapshots = "latestVerifiedCandidateCommits" in commits
    has_evidence = "latestVerifiedCandidateEvidence" in commits
    if has_snapshots != has_evidence:
        raise ValueError("Latest candidate references and evidence pointer must be supplied together.")
    if not has_snapshots:
        return None, None, None
    snapshots = commits["latestVerifiedCandidateCommits"]
    validate_snapshots(snapshots)
    name = commits["latestVerifiedCandidateEvidence"]
    if not isinstance(name, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]*_EVIDENCE\.json", name):
        raise ValueError("Invalid latest evidence pointer; expected a local evidence filename.")
    path = root / name
    if path.is_symlink():
        raise ValueError("Evidence symlinks must be reviewed, not silently sealed.")
    evidence = json.loads(path.read_text())
    if not isinstance(evidence, dict):
        raise ValueError("Malformed latest evidence.")
    if evidence.get("candidateSnapshotCommits") != snapshots:
        raise ValueError("Latest candidate snapshot references conflict with verified latest evidence.")
    for passed_key, total_key in [("suiteRunsPassed", "suiteRunsTotal"),
                                  ("typescriptTargetsPassed", "typescriptTargetsTotal"),
                                  ("buildTargetsPassed", "buildTargetsTotal")]:
        passed, total = evidence.get(passed_key), evidence.get(total_key)
        if type(passed) is not int or type(total) is not int or total <= 0 or passed != total:
            raise ValueError("Latest evidence contains incomplete or invalid test/build counts.")
        if total_key != "suiteRunsTotal" and total != len(TARGETS):
            raise ValueError("Latest evidence must verify all three target builds and type checks.")
    results = evidence.get("resultsByTarget")
    if not isinstance(results, dict) or set(results) != set(TARGETS):
        raise ValueError("Latest evidence is missing target test results.")
    suite_count = 0
    for result in results.values():
        if not isinstance(result, dict):
            raise ValueError("Latest evidence has malformed target results.")
        for key in ["typescriptExitCode", "buildExitCode"]:
            if type(result.get(key)) is not int or result[key] != 0:
                raise ValueError("Latest evidence records a failed target check.")
        suites = [value for value in result.values() if isinstance(value, dict) and "exitCode" in value]
        if not suites or any(type(value["exitCode"]) is not int or value["exitCode"] != 0 for value in suites):
            raise ValueError("Latest evidence records missing or failed suites.")
        suite_count += len(suites)
    if suite_count != evidence["suiteRunsTotal"]:
        raise ValueError("Latest evidence suite counts conflict with target results.")
    for key in ["productionReady", "deployed"]:
        if evidence.get(key) is not False:
            raise ValueError("Latest local evidence must not claim production readiness or deployment.")
    return snapshots, name, evidence


def build_manifest(root, checkpoint):
    root = Path(root)
    if not re.fullmatch(r"[0-9a-f]{40}", checkpoint):
        raise ValueError("Checkpoint must be an exact commit SHA.")
    progress = json.loads((root / "PROGRESS_STATUS.json").read_text())
    readiness = progress["productionReadiness"]
    passed, total = readiness["gatesPassed"], readiness["totalGates"]
    if type(passed) is not int or type(total) is not int or total <= 0 or not 0 <= passed <= total:
        raise ValueError("Invalid verified readiness counts.")
    if readiness["percent"] != passed / total * 100:
        raise ValueError("Readiness percentage does not match its counts.")
    commits = json.loads((root / "CANDIDATE_COMMITS.json").read_text())
    historical_snapshots = commits.get("reliabilityRecoveryCandidateCommits")
    if historical_snapshots is not None:
        validate_snapshots(historical_snapshots)
    latest_snapshots, latest_name, latest = latest_verified_evidence(root, commits)
    snapshots = latest_snapshots if latest is not None else historical_snapshots
    latest_sources = evidence_sources(root, latest, "latest") if latest is not None else {}
    for name, digest in latest_sources.items():
        if sha(root / name) != digest:
            raise ValueError("Verified latest source has changed; reverify the affected behavior.")
    superseded = {}
    reliability_path = root / "RELIABILITY_RECOVERY_EVIDENCE.json"
    if reliability_path.exists():
        reliability = json.loads(reliability_path.read_text())
        if historical_snapshots != reliability.get("candidateSnapshotCommits"):
            raise ValueError("Historical candidate snapshot references conflict with verified reliability evidence.")
        for name, digest in evidence_sources(root, reliability, "reliability").items():
            if sha(root / name) != digest:
                if name not in latest_sources:
                    raise ValueError("Verified reliability source has changed; reverify the affected behavior.")
                superseded[name] = {"historicalSha256": digest, "latestSha256": latest_sources[name]}
    native_path = root / "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json"
    native = json.loads(native_path.read_text()) if native_path.exists() else None
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
            "candidateSnapshotCommitReference": snapshots.get(target) if snapshots else None,
            "snapshotReferenceMeaning": "Verified batch reference; source hashes below are the current review inputs, not a deployed commit.",
            "nativeTablePreflight": native_table_preflight(root, target, migrations, native),
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
        "verifiedCandidateEvidence": {
            "latestEvidenceFile": latest_name,
            "latestEvidenceSha256": sha(root / latest_name) if latest_name else None,
            "historicalReliabilitySourcesSuperseded": superseded,
            "meaning": "Saved local batch evidence references; superseded hashes retain historical provenance, not current runtime or deployed proof.",
        },
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
        "inputFilesSha256": {name: sha(root / name) for name in [
            "PROGRESS_STATUS.json", "CANDIDATE_COMMITS.json", "FIRE_DEPLOYMENT_INVENTORY.json",
            "RELIABILITY_RECOVERY_EVIDENCE.json", "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json",
            "candidate_release_manifest.py", "test_candidate_release_manifest.py",
            "check-deployed-table-inventory.py", "test-deployed-table-inventory.py",
        ] + ([latest_name] if latest_name else []) if (root / name).exists()},
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
