import hashlib,json,re,subprocess
from pathlib import Path
root=Path('.'); repo_root=Path('..'); provenance_path=root/'dist/server/FIRE_DR_BUILD_PROVENANCE.json'; wrangler_path=root/'dist/server/wrangler.independent.json'; inventory_path=repo_root/'scripts/FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'; overlay_dir=repo_root/'dr-parity-overlays'; manifest_path=root/'PARITY_EVIDENCE_MANIFEST.json'; release_status_path=root/'RELEASE_STATUS.md'; parity_audit_path=root/'CURRENT_PARITY_AUDIT.md'; matrix_path=root/'STRICT_PARITY_MATRIX.md'; forward_sync_path=root/'FORWARD_SYNC_APPROVED.json'; capture_route_path=root/'app/api/dr-capture-identity/route.ts'; tipping_patch_path=repo_root/'scripts/fire-dr-tipping.patch'; processing_patch_path=repo_root/'scripts/fire-dr-processing-fees.patch'; evidence_root=repo_root/'dr-parity-evidence'; live_overlay=evidence_root/'LIVE_EVIDENCE_OVERLAY.json'; independent_overlay=evidence_root/'INDEPENDENT_EVIDENCE_OVERLAY.json'; comparison_overlay=evidence_root/'COMPARISON_OVERLAY.json'
expected_governance={'STRICT_RENDERED_PARITY_QUEUE.md','STRICT_PARITY_MATRIX.md','GO_NO_GO.md','INDEPENDENT_DEPLOYMENT.md','LIVE_PARITY_BATCH_AUDIT_2026-10-04.md','FORWARD_SYNC_APPROVED.json'}
def sha256(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git_head(): return subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo_root,text=True).strip()
def tree_fingerprint(base,exclude=None):
    exclude=exclude or set(); files=sorted(p for p in base.rglob('*') if p.is_file() and p not in exclude); h=hashlib.sha256(); per={}
    for p in files:
        rel=p.relative_to(base).as_posix(); d=sha256(p); per[rel]=d; h.update(rel.encode()); h.update(b'\0'); h.update(d.encode()); h.update(b'\n')
    return len(files),h.hexdigest(),per
def deployment_tree(): return tree_fingerprint(root/'dist/server',{provenance_path})
def readiness_from_manifest_and_registry():
    data=json.loads(manifest_path.read_text()); entries=data.get('entries') or []
    live_missing=sum(1 for x in entries if not isinstance(x,dict) or x.get('live_evidence_status')!='CAPTURED')
    dr_missing=sum(1 for x in entries if not isinstance(x,dict) or x.get('independent_evidence_status')!='CAPTURED')
    mismatches=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status') in {'MISMATCH','MISMATCHED'})
    registry=json.loads(forward_sync_path.read_text())
    if registry.get('schema_version')!=1 or not isinstance(registry.get('entries'),list):
        raise SystemExit('DR_PREDEPLOY_PROVENANCE=FAIL: forward-sync registry malformed')
    forward_sync=sum(1 for x in registry['entries'] if isinstance(x,dict) and x.get('status')=='PENDING_LIVE_SYNC' and x.get('blocks_full_identical') is True)
    full=(len(entries)==32 and live_missing==0 and dr_missing==0 and mismatches==0 and forward_sync==0 and all(isinstance(x,dict) and x.get('comparison_status') in {'VERIFIED_IDENTICAL','INFRASTRUCTURE_ONLY'} for x in entries))
    return ('READY_FOR_EXPLICIT_OWNER_REVIEW' if full else 'NOT_YET_FULLY_VERIFIED', live_missing, dr_missing, mismatches, forward_sync)
required=[provenance_path,wrangler_path,inventory_path,manifest_path,release_status_path,parity_audit_path,matrix_path,forward_sync_path,capture_route_path,tipping_patch_path,processing_patch_path,live_overlay,independent_overlay,comparison_overlay]
missing=[str(p) for p in required if not p.exists()]
if missing: raise SystemExit('DR_PREDEPLOY_PROVENANCE=FAIL: missing '+', '.join(missing))
p=json.loads(provenance_path.read_text()); w=json.loads(wrangler_path.read_text()); i=json.loads(inventory_path.read_text()); errors=[]
if p.get('schema_version')!=14: errors.append(f"expected provenance schema 14, found {p.get('schema_version')!r}")
if p.get('checked_out_source_commit')!=git_head(): errors.append('checked-out git commit no longer matches build provenance')
capture_route=capture_route_path.read_text()
capture_id_match=re.search(r'captureId: "([0-9a-f]{24})"',capture_route); capture_commit_match=re.search(r'sourceCommit: "([0-9a-f]{40})"',capture_route)
if not capture_id_match or not capture_commit_match:
    errors.append('capture identity route malformed')
else:
    ci=p.get('capture_identity') or {}
    if capture_commit_match.group(1)!=git_head(): errors.append('capture identity source commit no longer matches checked-out git commit')
    if ci.get('capture_id')!=capture_id_match.group(1): errors.append('capture identity ID changed after provenance')
    if ci.get('source_commit')!=capture_commit_match.group(1): errors.append('capture identity source commit changed after provenance')
    if ci.get('route_sha256')!=sha256(capture_route_path): errors.append('capture identity route changed after provenance')
    if ci.get('owner_authenticated') is not True or ci.get('cache_control_no_store') is not True: errors.append('capture identity policy changed after provenance')
if (p.get('governed_source_patch_sha256') or {}).get('fire-dr-tipping.patch')!=sha256(tipping_patch_path): errors.append('governed tipping patch changed after provenance')
if (p.get('governed_source_patch_sha256') or {}).get('fire-dr-processing-fees.patch')!=sha256(processing_patch_path): errors.append('governed processing-fee patch changed after provenance')
if p.get('sealed_archive',{}).get('sha256')!='2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca': errors.append('sealed v138 archive fingerprint mismatch')
if p.get('release')!={'package_version':'1.0.0-rc.138','fire_release':'v138'}: errors.append('release identity mismatch')
parity=p.get('parity_evidence') or {}
if parity.get('manifest_sha256')!=sha256(manifest_path): errors.append('formal parity manifest changed after provenance')
if parity.get('release_status_sha256')!=sha256(release_status_path): errors.append('RELEASE_STATUS changed after provenance')
if parity.get('current_parity_audit_sha256')!=sha256(parity_audit_path): errors.append('CURRENT_PARITY_AUDIT changed after provenance')
if parity.get('strict_parity_matrix_sha256')!=sha256(matrix_path): errors.append('STRICT_PARITY_MATRIX changed after provenance')
if parity.get('forward_sync_registry_sha256')!=sha256(forward_sync_path): errors.append('FORWARD_SYNC_APPROVED registry changed after provenance')
if parity.get('persistent_live_overlay_sha256')!=sha256(live_overlay): errors.append('persistent LIVE evidence overlay changed after provenance')
if parity.get('persistent_independent_overlay_sha256')!=sha256(independent_overlay): errors.append('persistent independent evidence overlay changed after provenance')
if parity.get('persistent_comparison_overlay_sha256')!=sha256(comparison_overlay): errors.append('persistent comparison overlay changed after provenance')
current_readiness,live_missing,dr_missing,mismatches,forward_sync=readiness_from_manifest_and_registry()
if parity.get('evidence_gate')!=current_readiness: errors.append(f"evidence readiness changed after provenance: recorded={parity.get('evidence_gate')!r}, current={current_readiness!r}")
if parity.get('live_missing')!=live_missing: errors.append('LIVE-missing count changed after provenance')
if parity.get('independent_missing')!=dr_missing: errors.append('DR-missing count changed after provenance')
if parity.get('mismatches')!=mismatches: errors.append('mismatch count changed after provenance')
if parity.get('forward_sync_approved')!=forward_sync: errors.append('forward-sync blocker count changed after provenance')
live_overlay_data=json.loads(live_overlay.read_text()); overlay=json.loads(independent_overlay.read_text()); comparisons=json.loads(comparison_overlay.read_text())
if parity.get('persistent_live_registration_count')!=len(live_overlay_data.get('entries') or []): errors.append('LIVE evidence registration count changed after provenance')
if parity.get('persistent_independent_registration_count')!=len(overlay.get('entries') or []): errors.append('independent evidence registration count changed after provenance')
if parity.get('persistent_comparison_count')!=len(comparisons.get('entries') or []): errors.append('comparison decision count changed after provenance')
safety=p.get('safety',{})
if safety.get('independent_evidence_auto_promotes_comparison') is not False: errors.append('independent evidence comparison-promotion policy invalid')
if safety.get('comparison_decisions_require_exact_evidence_hashes') is not True: errors.append('comparison exact-evidence-hash policy invalid')
if safety.get('parity_summaries_derived_from_manifest') is not True: errors.append('parity summary derivation policy invalid')
if safety.get('evidence_gate_does_not_auto_sync_production') is not True: errors.append('evidence-gate production-control policy invalid')
if safety.get('forward_sync_product_differences_block_full_identical') is not True: errors.append('forward-sync blocker policy invalid')
if safety.get('capture_identity_binds_screenshots_to_source_commit') is not True: errors.append('capture identity binding policy invalid')
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
if len(recorded_migrations)!=22 or actual_migrations!=recorded_migrations: errors.append('migration set/bytes changed')
count,tree,files=deployment_tree(); artifact=p.get('deployment_artifact_tree') or {}
if artifact.get('excludes')!=['FIRE_DR_BUILD_PROVENANCE.json'] or artifact.get('file_count')!=count or artifact.get('tree_sha256')!=tree or artifact.get('file_sha256')!=files: errors.append('deployable artifact tree changed')
if errors:
    print('DR_PREDEPLOY_PROVENANCE=FAIL')
    for e in errors: print('- '+e)
    raise SystemExit(1)
print('DR_PREDEPLOY_PROVENANCE=PASS')
print(f'EVIDENCE_GATE={current_readiness}; capture-id={(p.get("capture_identity") or {}).get("capture_id")}; forward-sync blockers={forward_sync}; commit, v138 identity, formal manifest + synchronized parity summaries/matrix, persistent evidence/comparison/provenance tree ({evidence_count} files), Worker/D1/no-R2 config, scripts, governance, governed tipping/processing-fee patches, 22 migrations, and all {count} deployable files match build provenance.')
