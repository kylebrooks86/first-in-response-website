import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

root = Path('.')
repo_root = Path('..')
out_path = root / 'dist/server/FIRE_DR_BUILD_PROVENANCE.json'
archive = repo_root / 'FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip'
wrangler_path = root / 'dist/server/wrangler.independent.json'
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def source_commit() -> str | None:
    for key in ('CF_PAGES_COMMIT_SHA', 'GITHUB_SHA', 'COMMIT_SHA'):
        value = os.environ.get(key, '').strip()
        if value:
            return value
    try:
        return subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=repo_root, text=True, stderr=subprocess.DEVNULL
        ).strip() or None
    except Exception:
        return None

required = [archive, wrangler_path, manifest_path, root / 'package.json', root / 'CURRENT_VERSION.json']
missing = [str(path) for path in required if not path.exists()]
if missing:
    print('DR_BUILD_PROVENANCE=FAIL')
    for path in missing:
        print(f'- missing provenance input: {path}')
    raise SystemExit(1)

package = json.loads((root / 'package.json').read_text())
version = json.loads((root / 'CURRENT_VERSION.json').read_text())
wrangler = json.loads(wrangler_path.read_text())
parity = json.loads(manifest_path.read_text())
entries = parity.get('entries', [])

live_captured = sum(1 for item in entries if isinstance(item, dict) and item.get('live_evidence_status') == 'CAPTURED')
independent_captured = sum(1 for item in entries if isinstance(item, dict) and item.get('independent_evidence_status') == 'CAPTURED')
verified_identical = sum(1 for item in entries if isinstance(item, dict) and item.get('comparison_status') == 'VERIFIED_IDENTICAL')
mismatches = sum(1 for item in entries if isinstance(item, dict) and item.get('comparison_status') in {'MISMATCH', 'MISMATCHED'})

overlay_names = [
    'apply-fire-dr-mobile-shell-fix.py',
    'apply-fire-dr-template-parity-fix.py',
    'apply-fire-dr-live-evidence-fixes.py',
    'verify-fire-dr-overlay-idempotency.py',
    'verify-fire-dr-live-parity-overlays.py',
    'verify-fire-dr-owner-workflows.py',
    'verify-fire-dr-live-service-catalog.py',
    'verify-fire-dr-live-evidence-coverage.py',
    'verify-fire-dr-customer-workflows.py',
    'verify-fire-dr-parity-ledger-consistency.py',
    'verify-fire-dr-postbuild-artifacts.py',
]
overlays = {}
for name in overlay_names:
    path = repo_root / 'scripts' / name
    if not path.exists():
        print('DR_BUILD_PROVENANCE=FAIL')
        print(f'- missing governed overlay/guard: {path}')
        raise SystemExit(1)
    overlays[name] = sha256(path)

migrations = {}
for path in sorted((root / 'dist/server/migrations').glob('*.sql')):
    migrations[path.name] = sha256(path)
if len(migrations) != 21:
    print('DR_BUILD_PROVENANCE=FAIL')
    print(f'- expected 21 staged migrations, found {len(migrations)}')
    raise SystemExit(1)

d1 = wrangler.get('d1_databases') or []
d1_record = d1[0] if len(d1) == 1 else {}
secret = (wrangler.get('vars') or {}).get('FIRE_SESSION_SECRET')

record = {
    'schema_version': 1,
    'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    'source_commit': source_commit(),
    'sealed_archive': {
        'file': archive.name,
        'sha256': sha256(archive),
    },
    'release': {
        'package_version': package.get('version'),
        'fire_release': version.get('fire_release'),
    },
    'deployment_target': {
        'worker_name': wrangler.get('name'),
        'd1_binding': d1_record.get('binding'),
        'd1_database_name': d1_record.get('database_name'),
        'd1_database_id': d1_record.get('database_id'),
        'r2_binding_present': 'r2_buckets' in wrangler,
        'session_secret_present': isinstance(secret, str) and len(secret) > 0,
        'session_secret_value_recorded': False,
    },
    'parity_evidence': {
        'formal_states': len(entries),
        'live_captured': live_captured,
        'independent_captured': independent_captured,
        'verified_identical': verified_identical,
        'mismatches': mismatches,
        'manifest_sha256': sha256(manifest_path),
    },
    'overlay_and_guard_sha256': overlays,
    'staged_migration_sha256': migrations,
    'safety': {
        'sealed_archive_modified': False,
        'live_deployment_modified_by_prepare_script': False,
        'production_dns_modified_by_prepare_script': False,
        'photo_storage_r2_provisioned': False,
    },
}

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')

# Read back and enforce the critical no-secret / isolated-target invariants.
written = json.loads(out_path.read_text())
target = written['deployment_target']
errors = []
if written['sealed_archive']['sha256'] != '2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca':
    errors.append('sealed archive hash in provenance is not the governed v138 hash')
if written['release'] != {'package_version': '1.0.0-rc.138', 'fire_release': 'v138'}:
    errors.append(f"unexpected release identity: {written['release']}")
if target.get('worker_name') != os.environ.get('FIRE_WORKER_NAME', 'fire-app-independent-staging').strip():
    errors.append('provenance worker target does not match expected independent worker')
if target.get('d1_database_name') != os.environ.get('FIRE_D1_DATABASE_NAME', 'fire-app-staging-db').strip():
    errors.append('provenance D1 name does not match expected isolated staging database')
if target.get('d1_database_id') != os.environ.get('FIRE_D1_DATABASE_ID', 'afb2c05a-d794-4a9a-b580-924ce01c26ad').strip():
    errors.append('provenance D1 id does not match expected isolated staging database')
if target.get('r2_binding_present'):
    errors.append('provenance indicates an unexpected R2 binding')
if not target.get('session_secret_present') or target.get('session_secret_value_recorded'):
    errors.append('session-secret provenance policy failed')
if errors:
    print('DR_BUILD_PROVENANCE=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_BUILD_PROVENANCE=PASS')
print(f'Wrote {out_path} with governed release, target, evidence counts, overlays, and migration fingerprints; no session secret value was recorded.')
