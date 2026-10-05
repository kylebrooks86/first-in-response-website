import hashlib
import json
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence/INDEPENDENT_EVIDENCE_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence/independent'
persistent_provenance_dir = repo_root / 'dr-parity-evidence/provenance'
errors = []

if not manifest_path.is_file(): errors.append('formal parity manifest missing')
if not overlay_path.is_file(): errors.append('persistent independent evidence overlay missing')
if errors:
    print('DR_INDEPENDENT_EVIDENCE_INTEGRITY=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1: errors.append('unexpected persistent overlay schema')
if overlay.get('side') != 'independent': errors.append('persistent overlay side must be independent')
registrations = overlay.get('entries')
if not isinstance(registrations, list):
    errors.append('persistent overlay entries must be an array')
    registrations = []
manifest_entries = manifest.get('entries') or []
by_id = {item.get('id'): item for item in manifest_entries if isinstance(item, dict)}
seen = set()

for registration in registrations:
    if not isinstance(registration, dict):
        errors.append('persistent overlay contains non-object registration')
        continue
    entry_id = registration.get('id')
    if not isinstance(entry_id, str) or not entry_id:
        errors.append('persistent overlay registration missing id')
        continue
    if entry_id in seen: errors.append(f'duplicate persistent registration: {entry_id}')
    seen.add(entry_id)
    if 'comparison_status' in registration or 'live_evidence_status' in registration:
        errors.append(f'{entry_id}: independent overlay may not contain comparison/LIVE status')
    target = by_id.get(entry_id)
    if target is None:
        errors.append(f'{entry_id}: registration does not map to formal manifest')
        continue
    evidence = registration.get('evidence')
    if not isinstance(evidence, list) or not evidence:
        errors.append(f'{entry_id}: registration has no evidence')
        continue
    manifest_independent = [item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent']
    if target.get('independent_evidence_status') != 'CAPTURED': errors.append(f'{entry_id}: formal independent status is not CAPTURED')
    if target.get('comparison_status') == 'VERIFIED_IDENTICAL': errors.append(f'{entry_id}: persistent registration alone must not produce VERIFIED_IDENTICAL before comparison overlay')
    if manifest_independent != evidence: errors.append(f'{entry_id}: rebuilt manifest independent evidence differs from persistent overlay')
    live = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live'), None)
    for item in evidence:
        if not isinstance(item, dict):
            errors.append(f'{entry_id}: evidence item is not an object')
            continue
        if item.get('side') != 'independent': errors.append(f'{entry_id}: evidence side is not independent')
        if item.get('source_environment') != 'independent-dr': errors.append(f'{entry_id}: source_environment must be independent-dr')
        if item.get('source_label') != 'fire-app-independent-staging': errors.append(f'{entry_id}: source_label must identify independent staging')
        if item.get('source_release') != 'v138-dr-staging': errors.append(f'{entry_id}: source_release must be v138-dr-staging')
        provenance_sha = item.get('deployment_provenance_sha256')
        provenance_source = item.get('deployment_provenance_source')
        if not isinstance(provenance_sha, str) or len(provenance_sha) != 64 or any(ch not in '0123456789abcdef' for ch in provenance_sha):
            errors.append(f'{entry_id}: invalid/missing deployment provenance SHA-256')
            provenance_sha = None
        if provenance_sha:
            expected_source = f'dr-parity-evidence/provenance/{provenance_sha}.json'
            if provenance_source != expected_source: errors.append(f'{entry_id}: deployment provenance source must be {expected_source}')
            snapshot = persistent_provenance_dir / f'{provenance_sha}.json'
            if not snapshot.is_file():
                errors.append(f'{entry_id}: persisted source build provenance snapshot missing: {snapshot.name}')
            else:
                snapshot_bytes = snapshot.read_bytes()
                actual_provenance_sha = hashlib.sha256(snapshot_bytes).hexdigest()
                if actual_provenance_sha != provenance_sha: errors.append(f'{entry_id}: persisted provenance snapshot hash mismatch')
                else:
                    source_provenance = json.loads(snapshot_bytes)
                    if source_provenance.get('deployment_target', {}).get('worker_name') != 'fire-app-independent-staging': errors.append(f'{entry_id}: source provenance Worker is not independent staging')
                    if source_provenance.get('release') != {'package_version':'1.0.0-rc.138','fire_release':'v138'}: errors.append(f'{entry_id}: source provenance release is not governed v138')
                    if item.get('source_commit') != source_provenance.get('checked_out_source_commit'): errors.append(f'{entry_id}: evidence source commit differs from persisted provenance')
        if item.get('capture_profile_source') != 'dr-registrar-v3': errors.append(f'{entry_id}: capture profile was not produced by governed DR registrar v3')
        for key in ['pixel_width','pixel_height','viewport_width','viewport_height']:
            value = item.get(key)
            if not isinstance(value, int) or value <= 0: errors.append(f'{entry_id}: {key} must be a positive integer')
        if item.get('device_class') not in {'mobile','tablet','desktop'}: errors.append(f'{entry_id}: invalid/missing device_class')
        if item.get('orientation') not in {'portrait','landscape'}: errors.append(f'{entry_id}: invalid/missing orientation')
        if item.get('profile_matches_registered_live') not in {True, False}: errors.append(f'{entry_id}: profile_matches_registered_live must be explicit boolean')
        if item.get('profile_matches_registered_live') is False and not item.get('profile_mismatch_notes'): errors.append(f'{entry_id}: profile mismatch requires explicit mismatch notes')
        if live and item.get('profile_matches_registered_live') is True:
            for key in ['pixel_width','pixel_height','viewport_width','viewport_height','device_class','orientation','theme']:
                live_value = live.get(key); dr_value = item.get(key)
                if live_value is not None and dr_value is not None and live_value != dr_value:
                    errors.append(f'{entry_id}: profile declared matching but {key} differs: LIVE={live_value!r}, DR={dr_value!r}')
        file_value = item.get('file')
        if not isinstance(file_value, str) or not file_value.startswith('evidence/independent/'):
            errors.append(f'{entry_id}: evidence path is not under evidence/independent/')
            continue
        filename = Path(file_value).name
        persistent = persistent_dir / filename; working = root / file_value
        if not persistent.is_file(): errors.append(f'{entry_id}: persistent evidence file missing: {filename}')
        if not working.is_file(): errors.append(f'{entry_id}: rebuilt working evidence file missing: {file_value}')
        if persistent.is_file() and working.is_file():
            persistent_sha = hashlib.sha256(persistent.read_bytes()).hexdigest(); working_sha = hashlib.sha256(working.read_bytes()).hexdigest()
            if persistent_sha != working_sha: errors.append(f'{entry_id}: persistent and rebuilt evidence bytes differ: {filename}')
            if item.get('sha256') != persistent_sha: errors.append(f'{entry_id}: registered SHA-256 differs from evidence bytes: {filename}')
            if item.get('bytes') != persistent.stat().st_size: errors.append(f'{entry_id}: registered byte count differs: {filename}')

for entry in manifest_entries:
    if not isinstance(entry, dict): continue
    independent_items = [item for item in entry.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent']
    if independent_items and entry.get('id') not in seen: errors.append(f"{entry.get('id')}: formal manifest has independent evidence not backed by persistent overlay")

if errors:
    print('DR_INDEPENDENT_EVIDENCE_INTEGRITY=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('DR_INDEPENDENT_EVIDENCE_INTEGRITY=PASS')
print(f'{len(registrations)} persistent independent registration(s) match rebuilt manifest/files, capture profiles, and their persisted source-build provenance snapshots; comparison promotion remains separate.')
