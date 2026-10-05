import hashlib
import json
import os
import re
from pathlib import Path

errors: list[str] = []

# Verify release identity is still the governed sealed v138 baseline.
package_path = Path('package.json')
version_path = Path('CURRENT_VERSION.json')
if not package_path.exists():
    errors.append('package.json missing after build')
else:
    package = json.loads(package_path.read_text())
    if package.get('version') != '1.0.0-rc.138':
        errors.append(f'unexpected package version: {package.get("version")!r}')
if not version_path.exists():
    errors.append('CURRENT_VERSION.json missing after build')
else:
    version = json.loads(version_path.read_text())
    if str(version.get('fire_release')) != 'v138':
        errors.append(f'unexpected FIRE release: {version.get("fire_release")!r}')

# Verify the generated independent Wrangler config still points only at the
# intended isolated DR resources and has no photo/R2 binding.
config_path = Path('dist/server/wrangler.independent.json')
if not config_path.exists():
    errors.append('dist/server/wrangler.independent.json missing')
else:
    config = json.loads(config_path.read_text())
    expected_worker = os.environ.get('FIRE_WORKER_NAME', '').strip()
    expected_db_name = os.environ.get('FIRE_D1_DATABASE_NAME', '').strip()
    expected_db_id = os.environ.get('FIRE_D1_DATABASE_ID', '').strip()
    if config.get('name') != expected_worker:
        errors.append(f'worker name mismatch: {config.get("name")!r}')
    if config.get('topLevelName') != expected_worker:
        errors.append(f'topLevelName mismatch: {config.get("topLevelName")!r}')
    dbs = config.get('d1_databases')
    if not isinstance(dbs, list) or len(dbs) != 1:
        errors.append('independent config must contain exactly one D1 binding')
    else:
        db = dbs[0]
        if db.get('binding') != 'DB': errors.append(f'unexpected D1 binding: {db.get("binding")!r}')
        if db.get('database_name') != expected_db_name: errors.append(f'D1 database name mismatch: {db.get("database_name")!r}')
        if db.get('database_id') != expected_db_id: errors.append(f'D1 database id mismatch: {db.get("database_id")!r}')
    if 'r2_buckets' in config:
        errors.append('R2 binding unexpectedly present in independent config')
    secret = (config.get('vars') or {}).get('FIRE_SESSION_SECRET')
    if not isinstance(secret, str) or not re.fullmatch(r'[0-9a-f]{64}', secret):
        errors.append('FIRE_SESSION_SECRET missing or malformed')

# Verify the exact migration files staged for Wrangler are byte-for-byte copies
# of the canonical drizzle migrations, with no omissions, additions, or renames.
def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

source_dir = Path('drizzle')
staged_dir = Path('dist/server/migrations')
source_files = sorted(source_dir.glob('*.sql')) if source_dir.exists() else []
staged_files = sorted(staged_dir.glob('*.sql')) if staged_dir.exists() else []
source_names = [p.name for p in source_files]
staged_names = [p.name for p in staged_files]
if source_names != staged_names:
    errors.append(f'staged migration filenames differ from canonical set: source={source_names}, staged={staged_names}')
for source in source_files:
    staged = staged_dir / source.name
    if not staged.exists():
        continue
    if sha256(source) != sha256(staged):
        errors.append(f'staged migration bytes differ: {source.name}')

if errors:
    print('DR_POSTBUILD_ARTIFACT_INTEGRITY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_POSTBUILD_ARTIFACT_INTEGRITY=PASS')
print(f'Governed v138 release identity is intact; isolated Wrangler config is valid; {len(source_files)} staged migrations are byte-for-byte identical to canonical source.')
