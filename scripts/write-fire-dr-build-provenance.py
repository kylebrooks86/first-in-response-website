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
inventory_path = repo_root / 'scripts/FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'
overlay_dir = repo_root / 'dr-parity-overlays'
governance_names = ['STRICT_RENDERED_PARITY_QUEUE.md','STRICT_PARITY_MATRIX.md','GO_NO_GO.md','INDEPENDENT_DEPLOYMENT.md','LIVE_PARITY_BATCH_AUDIT_2026-10-04.md']


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def git_head() -> str | None:
    try:
        return subprocess.check_output(['git','rev-parse','HEAD'], cwd=repo_root, text=True, stderr=subprocess.DEVNULL).strip() or None
    except Exception:
        return None


def provider_trigger_commit() -> str | None:
    for key in ('CF_PAGES_COMMIT_SHA','GITHUB_SHA','COMMIT_SHA'):
        value = os.environ.get(key, '').strip()
        if value: return value
    return None


def deployment_tree() -> tuple[int, str, dict[str, str]]:
    base = root / 'dist/server'
    files = sorted(p for p in base.rglob('*') if p.is_file() and p != out_path)
    h = hashlib.sha256()
    per_file = {}
    for path in files:
        rel = path.relative_to(base).as_posix()
        digest = sha256(path)
        per_file[rel] = digest
        h.update(rel.encode('utf-8')); h.update(b'\0'); h.update(digest.encode('ascii')); h.update(b'\n')
    return len(files), h.hexdigest(), per_file

required=[archive,wrangler_path,manifest_path,inventory_path,root/'package.json',root/'CURRENT_VERSION.json']
for name in governance_names: required.extend([root/name, overlay_dir/name])
missing=[str(p) for p in required if not p.exists()]
if missing:
    print('DR_BUILD_PROVENANCE=FAIL')
    for p in missing: print(f'- missing provenance input: {p}')
    raise SystemExit(1)

package=json.loads((root/'package.json').read_text()); version=json.loads((root/'CURRENT_VERSION.json').read_text())
wrangler=json.loads(wrangler_path.read_text()); parity=json.loads(manifest_path.read_text()); inventory=json.loads(inventory_path.read_text())
entries=parity.get('entries',[])
live=sum(1 for x in entries if isinstance(x,dict) and x.get('live_evidence_status')=='CAPTURED')
independent=sum(1 for x in entries if isinstance(x,dict) and x.get('independent_evidence_status')=='CAPTURED')
verified=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status')=='VERIFIED_IDENTICAL')
mismatches=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status') in {'MISMATCH','MISMATCHED'})

names=inventory.get('scripts')
if not isinstance(names,list) or not names or any(not isinstance(n,str) or not n for n in names) or len(names)!=len(set(names)):
    raise SystemExit('DR_BUILD_PROVENANCE=FAIL: governed script inventory is missing/malformed/duplicated')
scripts_dir=repo_root/'scripts'
discovered={p.name for p in scripts_dir.iterdir() if p.is_file() and (p.name.startswith(('apply-fire-dr-','verify-fire-dr-','write-fire-dr-','deploy-fire-dr-')) or p.name=='prepare-fire-v138-dr-no-r2.sh')}
listed=set(names)
if discovered!=listed:
    print('DR_BUILD_PROVENANCE=FAIL')
    if discovered-listed: print('- unregistered DR scripts: '+', '.join(sorted(discovered-listed)))
    if listed-discovered: print('- missing inventoried DR scripts: '+', '.join(sorted(listed-discovered)))
    raise SystemExit(1)
governed_scripts={n:sha256(scripts_dir/n) for n in sorted(names)}

governance={}
for name in governance_names:
    working=root/name; canonical=overlay_dir/name
    if sha256(working)!=sha256(canonical): raise SystemExit(f'DR_BUILD_PROVENANCE=FAIL: governance overlay drift: {name}')
    governance[name]={'sha256':sha256(canonical),'working_copy_matches_persistent_overlay':True}

migrations={p.name:sha256(p) for p in sorted((root/'dist/server/migrations').glob('*.sql'))}
if len(migrations)!=21: raise SystemExit(f'DR_BUILD_PROVENANCE=FAIL: expected 21 staged migrations, found {len(migrations)}')
d1=wrangler.get('d1_databases') or []; d1_record=d1[0] if len(d1)==1 else {}
secret=(wrangler.get('vars') or {}).get('FIRE_SESSION_SECRET')
artifact_count, artifact_tree_sha256, artifact_files = deployment_tree()

record={
 'schema_version':5,
 'generated_at_utc':datetime.now(timezone.utc).isoformat(),
 'checked_out_source_commit':git_head(),
 'provider_trigger_commit':provider_trigger_commit(),
 'sealed_archive':{'file':archive.name,'sha256':sha256(archive)},
 'release':{'package_version':package.get('version'),'fire_release':version.get('fire_release')},
 'deployment_target':{'worker_name':wrangler.get('name'),'d1_binding':d1_record.get('binding'),'d1_database_name':d1_record.get('database_name'),'d1_database_id':d1_record.get('database_id'),'r2_binding_present':'r2_buckets' in wrangler,'session_secret_present':isinstance(secret,str) and len(secret)>0,'session_secret_value_recorded':False},
 'parity_evidence':{'formal_states':len(entries),'live_captured':live,'independent_captured':independent,'verified_identical':verified,'mismatches':mismatches,'manifest_sha256':sha256(manifest_path)},
 'governed_script_inventory':{'inventory_file':inventory_path.name,'inventory_sha256':sha256(inventory_path),'script_count':len(names),'all_matching_dr_scripts_accounted_for':discovered==listed,'script_sha256':governed_scripts},
 'governance_document_sha256':governance,
 'staged_migration_sha256':migrations,
 'deployment_artifact_tree':{'excludes':['FIRE_DR_BUILD_PROVENANCE.json'],'file_count':artifact_count,'tree_sha256':artifact_tree_sha256,'file_sha256':artifact_files},
 'safety':{'sealed_archive_modified':False,'live_deployment_modified_by_prepare_script':False,'production_dns_modified_by_prepare_script':False,'photo_storage_r2_provisioned':False},
}
out_path.parent.mkdir(parents=True,exist_ok=True); out_path.write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')

written=json.loads(out_path.read_text()); target=written['deployment_target']; errors=[]
if written.get('schema_version')!=5: errors.append('unexpected provenance schema version')
if not written.get('checked_out_source_commit') or written.get('checked_out_source_commit')!=git_head(): errors.append('checked-out source commit not captured correctly')
if written['sealed_archive']['sha256']!='2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca': errors.append('sealed archive hash is not governed v138')
if written['release']!={'package_version':'1.0.0-rc.138','fire_release':'v138'}: errors.append('unexpected release identity')
if target.get('worker_name')!=os.environ.get('FIRE_WORKER_NAME','fire-app-independent-staging').strip(): errors.append('unexpected Worker target')
if target.get('d1_database_name')!=os.environ.get('FIRE_D1_DATABASE_NAME','fire-app-staging-db').strip() or target.get('d1_database_id')!=os.environ.get('FIRE_D1_DATABASE_ID','afb2c05a-d794-4a9a-b580-924ce01c26ad').strip(): errors.append('unexpected D1 target')
if target.get('r2_binding_present') or not target.get('session_secret_present') or target.get('session_secret_value_recorded'): errors.append('deployment target/session-secret policy failed')
if set((written.get('governed_script_inventory') or {}).get('script_sha256') or {})!=discovered: errors.append('provenance script set mismatch')
if set(written.get('governance_document_sha256') or {})!=set(governance_names): errors.append('governance document set mismatch')
art=written.get('deployment_artifact_tree') or {}
if art.get('file_count')!=artifact_count or art.get('tree_sha256')!=artifact_tree_sha256 or art.get('file_sha256')!=artifact_files: errors.append('deployment artifact tree provenance mismatch')
if errors:
    print('DR_BUILD_PROVENANCE=FAIL')
    for e in errors: print(f'- {e}')
    raise SystemExit(1)
print('DR_BUILD_PROVENANCE=PASS')
print(f'Wrote {out_path}; fingerprinted {len(discovered)} governed DR scripts, {len(governance_names)} governance documents, 21 migrations, and {artifact_count} deployable dist/server files; no session secret value was recorded.')
