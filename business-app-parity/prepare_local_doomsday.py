"""Prepare the current Doomsday candidate for an isolated, local-only build.

No install, build, deploy, remote query, migration or secret configuration occurs.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
LOCAL_DATABASE_ID = "00000000-0000-4000-8000-000000000000"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(destination, dependencies=None):
    destination = Path(destination).expanduser().absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError("Refusing existing destination; preserve previous candidates.")
    if dependencies is not None:
        dependencies = Path(dependencies).resolve()
        for required in ["typescript/package.json", "vite/package.json", "vinext/package.json"]:
            if not (dependencies / required).is_file():
                raise ValueError("Dependencies must be an existing compatible node_modules directory.")
    original = (ROOT / "shared/vite.config.ts").read_text()
    r2 = '  r2_buckets: [{\n    binding: "BUCKET",\n    bucket_name: "fire-app-local",\n  }],\n'
    if (original.count(r2) != 1 or original.count('database_name: "fire-app-local"') != 1
            or original.count('  main: "vinext/server/fetch-handler",') != 1
            or LOCAL_DATABASE_ID not in original):
        raise ValueError("Local config shape changed; review instead of guessing hosting bindings.")
    # Preserve the single authoritative materialization path and adapter exclusions.
    subprocess.run([sys.executable, str(ROOT / "materialize.py"), "doomsday", str(destination)], check=True)
    config = destination / "vite.config.ts"
    config.write_text(original.replace(r2, "").replace(
        '  main: "vinext/server/fetch-handler",',
        '  name: "fire-doomsday-local",\n  main: "vinext/server/fetch-handler",'
    ).replace('database_name: "fire-app-local"', 'database_name: "fire-doomsday-local"'))
    if dependencies is not None:
        (destination / "node_modules").symlink_to(dependencies, target_is_directory=True)
    # Hash source and adapters; generated output/dependencies are deliberately excluded.
    hashes = {}
    for folder in ["app", "lib", "components", "db", "public", "hooks", "vendor", "scripts", "drizzle"]:
        for path in sorted((destination / folder).rglob("*")):
            if path.is_file():
                hashes[path.relative_to(destination).as_posix()] = digest(path)
    manifest = {
        "scope": "FIRE Business App Doomsday candidate local build only",
        "source": "business-app-parity/shared plus adapters/doomsday",
        "localOnly": True,
        "productionReady": False,
        "deployed": False,
        "workerName": "fire-doomsday-local",
        "databaseName": "fire-doomsday-local",
        "databaseId": LOCAL_DATABASE_ID,
        "r2Provisioned": False,
        "secretsConfigured": False,
        "viteConfigSha256": digest(config),
        "filesSha256": hashes,
        "limitations": [
            "Placeholder D1 identity; never use this configuration for publication.",
            "No R2; photo routes must report unavailable, not photo parity.",
            "PIN/hash/session configuration and remote authentication schema remain unverified.",
            "Legacy governed deployment and rollback paths remain unchanged.",
        ],
    }
    (destination / "LOCAL_DOOMSDAY_BUILD.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def verify_build(destination):
    destination = Path(destination).resolve()
    manifest = json.loads((destination / "LOCAL_DOOMSDAY_BUILD.json").read_text())
    if manifest.get("localOnly") is not True or manifest.get("productionReady") is not False:
        raise ValueError("Missing local-only safety classification.")
    if digest(destination / "vite.config.ts") != manifest["viteConfigSha256"]:
        raise ValueError("Build configuration changed after preparation.")
    for relative, expected in manifest["filesSha256"].items():
        path = destination / relative
        if not path.resolve().is_relative_to(destination) or digest(path) != expected:
            raise ValueError("Candidate source changed after preparation.")
    config = json.loads((destination / "dist/server/wrangler.json").read_text())
    expected_db = [{"binding": "DB", "database_name": "fire-doomsday-local", "database_id": LOCAL_DATABASE_ID}]
    if config.get("name") != "fire-doomsday-local" or config.get("d1_databases") != expected_db:
        raise ValueError("Generated build has unexpected Worker or D1 identity.")
    if any(config.get(key) for key in ["r2_buckets", "vars", "services", "kv_namespaces", "routes"]):
        raise ValueError("Generated build has unexpected resources, routes or runtime variables.")
    return {"localBuildVerified": True, "productionReady": False, "deployed": False,
            "wranglerConfigSha256": digest(destination / "dist/server/wrangler.json")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--dependencies", type=Path, help="Reuse installed node_modules; never installs packages.")
    parser.add_argument("--verify-build", action="store_true", help="Read-only verification of prepared source and generated local build bindings.")
    args = parser.parse_args()
    try:
        if args.verify_build:
            if args.dependencies is not None:
                raise ValueError("Do not supply dependencies during build verification.")
            print(json.dumps(verify_build(args.destination), indent=2))
        else:
            prepare(args.destination, args.dependencies)
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        parser.exit(1, str(error) + "\n")
    if not args.verify_build:
        print("Local Doomsday candidate prepared. No build, remote mutation or deployment performed.")
