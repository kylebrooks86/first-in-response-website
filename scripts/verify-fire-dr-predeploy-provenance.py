import hashlib
import json
import subprocess
from pathlib import Path

root = Path('.')
repo_root = Path('..')
provenance_path = root / 'dist/server/FIRE_DR_BUILD_PROVENANCE.json'
wrangler_path = root / 'dist/server/wrangler.independent.json'
inventory_path = repo_root / 'scripts/FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'
overlay_dir = repo_root / 'dr-parity-overlays'

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def git_head() -> str:
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo_root, text=True).strip()

required = [provenance_path, wrangler_path, inventory_path]
missing = [str(path) for path in required if not path.exists()]
if missing:
    print('DR_PREDEPLOY_PROVENANCE=FAIL')
    for path in missing: print(f'- missing required predeploy artifact: {path}')
    raise SystemExit(1)

p = json.loads(provenance_path.read_text())
w = json.loads(wrangler_path.read_text())
i = json.loads(inventory_path.read_text())
errors = []

if p.get('schema_version') != 4: errors.append(f"expected provenance schema 4, found {p.get('schema_version')!r}")
if p.get('checked_out_source_commit') != git_head(): errors.append('checked-out git commit no longer matches the build provenance')
if p.get('sealed_archive', {}).get('sha256') != '2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca': errors.append('sealed v138 archive fingerprint is not the governed hash')
if p.get('release') != {'package_version': '1.0.0-rc.138', 'fire_release': 'v138'}: errors.append('release identity in provenance is not governed v138')

target = p.get('deployment_target') or {}
d1 = w.get('d1_databases') or []
if w.get('name') != 'fire-app-independent-staging' or w.get('topLevelName') != 'fire-app-independent-staging': errors.append('Wrangler Worker target drifted after build')
if len(d1) != 1: errors.append('independent Wrangler config must have exactly one D1 binding')
else:
    db = d1[0]
    if db.get('binding') != 'DB' or db.get('database_name') != 'fire-app-staging-db' or db.get('database_id') != 'afb2c05a-d794-4a9a-b580-924ce01c26ad': errors.append('independent D1 target drifted after build')
if 'r2_buckets' in w: errors.append('R2 binding appeared after the governed build')
if target.get('worker_name') != w.get('name'): errors.append('provenance Worker target no longer matches Wrangler config')
if len(d1) == 1:
    db = d1[0]
    if target.get('d1_database_name') != db.get('database_name') or target.get('d1_database_id') != db.get('database_id'): errors.append('provenance D1 target no longer matches Wrangler config')

listed = i.get('scripts') or []
recorded_scripts = (p.get('governed_script_inventory') or {}).get('script_sha256') or {}
if set(recorded_scripts) != set(listed): errors.append('provenance script set no longer matches governed inventory')
for name in listed:
    path = repo_root / 'scripts' / name
    if not path.exists(): errors.append(f'governed script missing before deploy: {name}')
    elif recorded_scripts.get(name) != sha256(path): errors.append(f'governed script changed after build: {name}')

recorded_governance = p.get('governance_document_sha256') or {}
for name, item in recorded_governance.items():
    path = overlay_dir / name
    if not path.exists(): errors.append(f'governance document missing before deploy: {name}')
    elif item.get('sha256') != sha256(path): errors.append(f'governance document changed after build: {name}')

recorded_migrations = p.get('staged_migration_sha256') or {}
actual_migrations = {path.name: sha256(path) for path in sorted((root / 'dist/server/migrations').glob('*.sql'))}
if actual_migrations != recorded_migrations: errors.append('staged migration set or bytes changed after provenance was written')

if errors:
    print('DR_PREDEPLOY_PROVENANCE=FAIL')
    for error in errors: print(f'- {error}')
    raise SystemExit(1)
print('DR_PREDEPLOY_PROVENANCE=PASS')
print('Checked-out commit, release identity, independent Worker/D1 target, no-R2 rule, governed scripts, governance documents, and all staged migrations still match the prepared build provenance.')
