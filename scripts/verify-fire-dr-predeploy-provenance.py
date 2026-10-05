import hashlib,json,subprocess
from pathlib import Path
root=Path('.'); repo_root=Path('..'); provenance_path=root/'dist/server/FIRE_DR_BUILD_PROVENANCE.json'; wrangler_path=root/'dist/server/wrangler.independent.json'; inventory_path=repo_root/'scripts/FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'; overlay_dir=repo_root/'dr-parity-overlays'; manifest_path=root/'PARITY_EVIDENCE_MANIFEST.json'; release_status_path=root/'RELEASE_STATUS.md'; parity_audit_path=root/'CURRENT_PARITY_AUDIT.md'; evidence_root=repo_root/'dr-parity-evidence'; independent_overlay=evidence_root/'INDEPENDENT_EVIDENCE_OVERLAY.json'; comparison_overlay=evidence_root/'COMPARISON_OVERLAY.json'
expected_governance={'STRICT_RENDERED_PARITY_QUEUE.md','STRICT_PARITY_MATRIX.md','GO_NO_GO.md','INDEPENDENT_DEPLOYMENT.md','LIVE_PARITY_BATCH_AUDIT_2026-10-04.md'}
def sha256(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git_head(): return subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo_root,text=True).strip()
def tree_fingerprint(base,exclude=None):
    exclude=exclude or set(); files=sorted(p for p in base.rglob('*') if p.is_file() and p not in exclude); h=hashlib.sha256(); per={}
    for p in files:
        rel=p.relative_to(base).as_posix(); d=sha256(p); per[rel]=d; h.update(rel.encode()); h.update(b'\0'); h.update(d.encode()); h.update(b'\n')
    return len(files),h.hexdigest(),per
def deployment_tree(): return tree_fingerprint(root/'dist/server',{provenance_path})
required=[provenance_path,wrangler_path,inventory_path,manifest_path,release_status_path,parity_audit_path,independent_overlay,comparison_overlay]
missing=[str(p) for p in required if not p.exists()]
if missing: raise SystemExit('DR_PREDEPLOY_PROVENANCE=FAIL: missing '+', '.join(missing))
p=json.loads(provenance_path.read_text()); w=json.loads(wrangler_path.read_text()); i=json.loads(inventory_path.read_text()); errors=[]
if p.get('schema_version')!=8: errors.append(f"expected provenance schema 8, found {p.get('schema_version')!r}")
if p.get('checked_out_source_commit')!=git_head(): errors.append('checked-out git commit no longer matches build provenance')
if p.get('sealed_archive',{}).get('sha256')!='2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca': errors.append('sealed v138 archive fingerprint mismatch')
if p.get('release')!={'package_version':'1.0.0-rc.138','fire_release':'v138'}: errors.append('release identity mismatch')
parity=p.get('parity_evidence') or {}
if parity.get('manifest_sha256')!=sha256(manifest_path): errors.append('formal parity manifest changed after provenance')
if parity.get('release_status_sha256')!=sha256(release_status_path): errors.append('RELEASE_STATUS changed after provenance')
if parity.get('current_parity_audit_sha256')!=sha256(parity_audit_path): errors.append('CURRENT_PARITY_AUDIT changed after provenance')
if parity.get('persistent_independent_overlay_sha256')!=sha256(independent_overlay): errors.append('persistent independent evidence overlay changed after provenance')
if parity.get('persistent_comparison_overlay_sha256')!=sha256(comparison_overlay): errors.append('persistent comparison overlay changed after provenance')
overlay=json.loads(independent_overlay.read_text()); comparisons=json.loads(comparison_overlay.read_text())
if parity.get('persistent_independent_registration_count')!=len(overlay.get('entries') or []): errors.append('independent evidence registration count changed after provenance')
if parity.get('persistent_comparison_count')!=len(comparisons.get('entries') or []): errors.append('comparison decision count changed after provenance')
safety=p.get('safety',{})
if safety.get('independent_evidence_auto_promotes_comparison') is not False: errors.append('independent evidence comparison-promotion policy invalid')
if safety.get('comparison_decisions_require_exact_evidence_hashes') is not True: errors.append('comparison exact-evidence-hash policy invalid')
if safety.get('parity_summaries_derived_from_manifest') is not True: errors.append('parity summary derivation policy invalid')
evidence_count,evidence_tree,evidence_files=tree_fingerprint(evidence_root); recorded_evidence=p.get('persistent_evidence_tree') or {}
if recorded_evidence.get('file_count')!=evidence_count or recorded_evidence.get('tree_sha256')!=evidence_tree or recorded_evidence.get('file_sha256')!=evidence_files: errors.append('persistent DR evidence/comparison/provenance tree changed after build provenance')
target=p.get('deployment_target') or {}; d1=w.get('d1_databases') or []
if w.get('name')!='fire-app-independent-staging' or w.get('topLevelName')!='fire-app-independent-staging': errors.append('Worker target drifted')
if len(d1)!=1: errors.append('expected exactly one D1 binding')
else:
    db=d1[0]
    if db.get('binding')!='DB' or db.get('database_name')!='fire-app-staging-db' or db.get('database_id')!='afb2c05a-d794-4a9a-b580-924ce01c26ad': errors.append('D1 target drifted')
if 'r2_buckets' in w: errors.append('R2 binding appeared')
secret=(w.get('vars') or {}).get('FIRE_SESSION_SECRET')
if not isinstance(secret,str) or len(secret)!=64: errors.append('session secret missing/malformed')
if target.get('worker_name')!=w.get('name'): errors.append('provenance Worker mismatch')
listed=i.get('scripts') or []; recorded=(p.get('governed_script_inventory') or {}).get('script_sha256') or {}
if (p.get('governed_script_inventory') or {}).get('inventory_sha256')!=sha256(inventory_path): errors.append('script inventory changed')
if set(recorded)!=set(listed): errors.append('script set changed')
for name in listed:
    path=repo_root/'scripts'/name
    if not path.exists() or recorded.get(name)!=sha256(path): errors.append(f'governed script changed/missing: {name}')
recorded_governance=p.get('governance_document_sha256') or {}
if set(recorded_governance)!=expected_governance: errors.append('governance set changed')
for name in expected_governance:
    path=overlay_dir/name; item=recorded_governance.get(name) or {}
    if not path.exists() or item.get('sha256')!=sha256(path): errors.append(f'governance changed/missing: {name}')
recorded_migrations=p.get('staged_migration_sha256') or {}; actual_migrations={x.name:sha256(x) for x in sorted((root/'dist/server/migrations').glob('*.sql'))}
if len(recorded_migrations)!=21 or actual_migrations!=recorded_migrations: errors.append('migration set/bytes changed')
count,tree,files=deployment_tree(); artifact=p.get('deployment_artifact_tree') or {}
if artifact.get('excludes')!=['FIRE_DR_BUILD_PROVENANCE.json'] or artifact.get('file_count')!=count or artifact.get('tree_sha256')!=tree or artifact.get('file_sha256')!=files: errors.append('deployable artifact tree changed')
if errors:
    print('DR_PREDEPLOY_PROVENANCE=FAIL')
    for e in errors: print('- '+e)
    raise SystemExit(1)
print('DR_PREDEPLOY_PROVENANCE=PASS')
print(f'Commit, v138 identity, formal manifest + synchronized parity summaries, persistent evidence/comparison/provenance tree ({evidence_count} files), Worker/D1/no-R2 config, scripts, governance, 21 migrations, and all {count} deployable files match build provenance.')
