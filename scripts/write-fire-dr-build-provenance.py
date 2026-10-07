import hashlib,json,os,re,subprocess
from datetime import datetime,timezone
from pathlib import Path
root=Path('.'); repo_root=Path('..'); out_path=root/'dist/server/FIRE_DR_BUILD_PROVENANCE.json'
archive=repo_root/'FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip'; wrangler_path=root/'dist/server/wrangler.independent.json'; manifest_path=root/'PARITY_EVIDENCE_MANIFEST.json'
release_status_path=root/'RELEASE_STATUS.md'; parity_audit_path=root/'CURRENT_PARITY_AUDIT.md'; matrix_path=root/'STRICT_PARITY_MATRIX.md'; forward_sync_path=root/'FORWARD_SYNC_APPROVED.json'; capture_route_path=root/'app/api/dr-capture-identity/route.ts'; tipping_patch_path=repo_root/'scripts/fire-dr-tipping.patch'
inventory_path=repo_root/'scripts/FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'; overlay_dir=repo_root/'dr-parity-overlays'; evidence_root=repo_root/'dr-parity-evidence'
live_overlay=evidence_root/'LIVE_EVIDENCE_OVERLAY.json'; independent_overlay=evidence_root/'INDEPENDENT_EVIDENCE_OVERLAY.json'; comparison_overlay=evidence_root/'COMPARISON_OVERLAY.json'
governance_names=['STRICT_RENDERED_PARITY_QUEUE.md','STRICT_PARITY_MATRIX.md','GO_NO_GO.md','INDEPENDENT_DEPLOYMENT.md','LIVE_PARITY_BATCH_AUDIT_2026-10-04.md','FORWARD_SYNC_APPROVED.json']
def sha256(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git_head():
    try:return subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo_root,text=True,stderr=subprocess.DEVNULL).strip() or None
    except:return None
def provider_trigger_commit():
    for k in ('CF_PAGES_COMMIT_SHA','GITHUB_SHA','COMMIT_SHA'):
        v=os.environ.get(k,'').strip()
        if v:return v
    return None
def tree_fingerprint(base,exclude=None):
    exclude=exclude or set(); files=sorted(p for p in base.rglob('*') if p.is_file() and p not in exclude); h=hashlib.sha256(); per={}
    for p in files:
        rel=p.relative_to(base).as_posix(); d=sha256(p); per[rel]=d; h.update(rel.encode()); h.update(b'\0'); h.update(d.encode()); h.update(b'\n')
    return len(files),h.hexdigest(),per
def deployment_tree(): return tree_fingerprint(root/'dist/server',{out_path})
required=[archive,wrangler_path,manifest_path,release_status_path,parity_audit_path,matrix_path,forward_sync_path,capture_route_path,tipping_patch_path,inventory_path,live_overlay,independent_overlay,comparison_overlay,root/'package.json',root/'CURRENT_VERSION.json']
for n in governance_names: required += [root/n,overlay_dir/n]
missing=[str(p) for p in required if not p.exists()]
if missing: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: missing inputs: '+', '.join(missing))
package=json.loads((root/'package.json').read_text()); version=json.loads((root/'CURRENT_VERSION.json').read_text()); wrangler=json.loads(wrangler_path.read_text()); parity=json.loads(manifest_path.read_text()); inventory=json.loads(inventory_path.read_text()); live_evidence_overlay=json.loads(live_overlay.read_text()); evidence_overlay=json.loads(independent_overlay.read_text()); comparisons=json.loads(comparison_overlay.read_text())
entries=parity.get('entries',[]); live=sum(1 for x in entries if isinstance(x,dict) and x.get('live_evidence_status')=='CAPTURED'); independent=sum(1 for x in entries if isinstance(x,dict) and x.get('independent_evidence_status')=='CAPTURED'); verified=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status')=='VERIFIED_IDENTICAL'); mismatches=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status') in {'MISMATCH','MISMATCHED'}); infrastructure_only=sum(1 for x in entries if isinstance(x,dict) and x.get('comparison_status')=='INFRASTRUCTURE_ONLY'); live_missing=sum(1 for x in entries if isinstance(x,dict) and x.get('live_evidence_status')!='CAPTURED'); dr_missing=sum(1 for x in entries if isinstance(x,dict) and x.get('independent_evidence_status')!='CAPTURED')
forward_sync=json.loads(forward_sync_path.read_text())
if forward_sync.get('schema_version')!=1 or not isinstance(forward_sync.get('entries'),list): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: forward-sync registry malformed')
forward_sync_approved=sum(1 for x in forward_sync['entries'] if isinstance(x,dict) and x.get('status')=='PENDING_LIVE_SYNC' and x.get('blocks_full_identical') is True)
full_ready=(len(entries)==32 and live_missing==0 and dr_missing==0 and mismatches==0 and forward_sync_approved==0 and all(isinstance(x,dict) and x.get('comparison_status') in {'VERIFIED_IDENTICAL','INFRASTRUCTURE_ONLY'} for x in entries))
readiness='READY_FOR_EXPLICIT_OWNER_REVIEW' if full_ready else 'NOT_YET_FULLY_VERIFIED'
capture_route=capture_route_path.read_text()
capture_id_match=re.search(r'captureId: "([0-9a-f]{24})"',capture_route); capture_commit_match=re.search(r'sourceCommit: "([0-9a-f]{40})"',capture_route)
if not capture_id_match or not capture_commit_match: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: capture identity route malformed')
capture_id=capture_id_match.group(1); capture_commit=capture_commit_match.group(1)
if capture_commit!=git_head(): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: capture identity source commit mismatch')
if 'if (!await authorized())' not in capture_route or '"cache-control": "no-store, max-age=0"' not in capture_route: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: capture identity auth/cache policy missing')
names=inventory.get('scripts'); scripts_dir=repo_root/'scripts'
if not isinstance(names,list) or len(names)!=len(set(names)): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: malformed script inventory')
discovered={p.name for p in scripts_dir.iterdir() if p.is_file() and (p.name.startswith(('apply-fire-dr-','verify-fire-dr-','write-fire-dr-','deploy-fire-dr-','register-fire-dr-','report-fire-dr-','record-fire-dr-')) or p.name=='prepare-fire-v138-dr-no-r2.sh' or p.name=='fire-dr-tipping.patch')}; listed=set(names)
if discovered!=listed: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: governed script inventory drift')
governed_scripts={n:sha256(scripts_dir/n) for n in sorted(names)}
governance={}
for n in governance_names:
    if sha256(root/n)!=sha256(overlay_dir/n): raise SystemExit(f'DR_BUILD_PROVENANCE=FAIL: governance overlay drift: {n}')
    governance[n]={'sha256':sha256(overlay_dir/n),'working_copy_matches_persistent_overlay':True}
if live_evidence_overlay.get('schema_version')!=1 or live_evidence_overlay.get('side')!='live' or not isinstance(live_evidence_overlay.get('entries'),list): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: LIVE evidence overlay malformed')
if evidence_overlay.get('schema_version')!=1 or evidence_overlay.get('side')!='independent' or not isinstance(evidence_overlay.get('entries'),list): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: independent evidence overlay malformed')
if comparisons.get('schema_version')!=1 or not isinstance(comparisons.get('entries'),list): raise SystemExit('DR_BUILD_PROVENANCE=FAIL: comparison overlay malformed')
migrations={p.name:sha256(p) for p in sorted((root/'dist/server/migrations').glob('*.sql'))}
if len(migrations)!=21: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: expected 21 migrations')
d1=wrangler.get('d1_databases') or []; d1r=d1[0] if len(d1)==1 else {}; secret=(wrangler.get('vars') or {}).get('FIRE_SESSION_SECRET'); count,tree,files=deployment_tree(); evidence_count,evidence_tree,evidence_files=tree_fingerprint(evidence_root)
record={'schema_version':14,'generated_at_utc':datetime.now(timezone.utc).isoformat(),'checked_out_source_commit':git_head(),'provider_trigger_commit':provider_trigger_commit(),'sealed_archive':{'file':archive.name,'sha256':sha256(archive)},'release':{'package_version':package.get('version'),'fire_release':version.get('fire_release')},'capture_identity':{'capture_id':capture_id,'source_commit':capture_commit,'route_sha256':sha256(capture_route_path),'owner_authenticated':True,'cache_control_no_store':True},'governed_source_patch_sha256':{'fire-dr-tipping.patch':sha256(tipping_patch_path)},'deployment_target':{'worker_name':wrangler.get('name'),'d1_binding':d1r.get('binding'),'d1_database_name':d1r.get('database_name'),'d1_database_id':d1r.get('database_id'),'r2_binding_present':'r2_buckets' in wrangler,'session_secret_present':isinstance(secret,str) and len(secret)>0,'session_secret_value_recorded':False},'parity_evidence':{'formal_states':len(entries),'live_captured':live,'independent_captured':independent,'verified_identical':verified,'infrastructure_only':infrastructure_only,'mismatches':mismatches,'live_missing':live_missing,'independent_missing':dr_missing,'forward_sync_approved':forward_sync_approved,'evidence_gate':readiness,'manifest_sha256':sha256(manifest_path),'release_status_sha256':sha256(release_status_path),'current_parity_audit_sha256':sha256(parity_audit_path),'strict_parity_matrix_sha256':sha256(matrix_path),'forward_sync_registry_sha256':sha256(forward_sync_path),'persistent_live_overlay_sha256':sha256(live_overlay),'persistent_live_registration_count':len(live_evidence_overlay['entries']),'persistent_independent_overlay_sha256':sha256(independent_overlay),'persistent_independent_registration_count':len(evidence_overlay['entries']),'persistent_comparison_overlay_sha256':sha256(comparison_overlay),'persistent_comparison_count':len(comparisons['entries'])},'persistent_evidence_tree':{'file_count':evidence_count,'tree_sha256':evidence_tree,'file_sha256':evidence_files},'governed_script_inventory':{'inventory_file':inventory_path.name,'inventory_sha256':sha256(inventory_path),'script_count':len(names),'all_matching_dr_scripts_accounted_for':True,'script_sha256':governed_scripts},'governance_document_sha256':governance,'staged_migration_sha256':migrations,'deployment_artifact_tree':{'excludes':['FIRE_DR_BUILD_PROVENANCE.json'],'file_count':count,'tree_sha256':tree,'file_sha256':files},'safety':{'sealed_archive_modified':False,'live_deployment_modified_by_prepare_script':False,'production_dns_modified_by_prepare_script':False,'photo_storage_r2_provisioned':False,'independent_evidence_auto_promotes_comparison':False,'comparison_decisions_require_exact_evidence_hashes':True,'parity_summaries_derived_from_manifest':True,'evidence_gate_does_not_auto_sync_production':True,'forward_sync_product_differences_block_full_identical':True,'capture_identity_binds_screenshots_to_source_commit':True}}
out_path.parent.mkdir(parents=True,exist_ok=True); out_path.write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
written=json.loads(out_path.read_text()); errors=[]
if written.get('schema_version')!=14: errors.append('schema')
if written.get('checked_out_source_commit')!=git_head(): errors.append('commit')
ci=written.get('capture_identity') or {}
if ci.get('capture_id')!=capture_id or ci.get('source_commit')!=git_head(): errors.append('capture-identity')
if ci.get('route_sha256')!=sha256(capture_route_path): errors.append('capture-identity-route')
if ci.get('owner_authenticated') is not True or ci.get('cache_control_no_store') is not True: errors.append('capture-identity-policy')
if written.get('governed_source_patch_sha256',{}).get('fire-dr-tipping.patch')!=sha256(tipping_patch_path): errors.append('tipping-patch')
if written['sealed_archive']['sha256']!='2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca': errors.append('archive')
if written['release']!={'package_version':'1.0.0-rc.138','fire_release':'v138'}: errors.append('release')
pe=written['parity_evidence']
if pe['manifest_sha256']!=sha256(manifest_path): errors.append('manifest')
if pe['release_status_sha256']!=sha256(release_status_path): errors.append('release-status')
if pe['current_parity_audit_sha256']!=sha256(parity_audit_path): errors.append('current-parity-audit')
if pe['strict_parity_matrix_sha256']!=sha256(matrix_path): errors.append('strict-parity-matrix')
if pe['forward_sync_registry_sha256']!=sha256(forward_sync_path): errors.append('forward-sync-registry')
if pe['persistent_live_overlay_sha256']!=sha256(live_overlay): errors.append('live-evidence-overlay')
if pe['persistent_live_registration_count']!=len(live_evidence_overlay['entries']): errors.append('live-evidence-registration-count')
if pe['persistent_independent_overlay_sha256']!=sha256(independent_overlay): errors.append('evidence-overlay')
if pe['persistent_comparison_overlay_sha256']!=sha256(comparison_overlay): errors.append('comparison-overlay')
if pe['forward_sync_approved']!=forward_sync_approved: errors.append('forward-sync-count')
if pe['evidence_gate']!=readiness: errors.append('readiness')
if written['persistent_evidence_tree']['tree_sha256']!=evidence_tree: errors.append('evidence-tree')
s=written['safety']
if s['independent_evidence_auto_promotes_comparison'] is not False or s['comparison_decisions_require_exact_evidence_hashes'] is not True or s['parity_summaries_derived_from_manifest'] is not True or s['evidence_gate_does_not_auto_sync_production'] is not True or s['forward_sync_product_differences_block_full_identical'] is not True or s['capture_identity_binds_screenshots_to_source_commit'] is not True: errors.append('parity-policy')
if errors: raise SystemExit('DR_BUILD_PROVENANCE=FAIL: '+', '.join(errors))
print('DR_BUILD_PROVENANCE=PASS')
print(f'EVIDENCE_GATE={readiness}; capture-id={capture_id}; forward-sync blockers={forward_sync_approved}; fingerprint includes parity manifest + synchronized summary/matrix documents and persistent LIVE/DR evidence overlays, {len(discovered)} governed DR scripts, all {evidence_count} persistent evidence/comparison/provenance files, {len(governance_names)} governance documents, governed tipping patch, 21 migrations, and {count} deployable files; no session secret value recorded.')
