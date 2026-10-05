import hashlib
import json
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence/INDEPENDENT_EVIDENCE_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence/independent'
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
    if target.get('comparison_status') == 'VERIFIED_IDENTICAL': errors.append(f'{entry_id}: persistent registration alone must not produce VERIFIED_IDENTICAL')
    if manifest_independent != evidence: errors.append(f'{entry_id}: rebuilt manifest independent evidence differs from persistent overlay')
    for item in evidence:
        if not isinstance(item, dict):
            errors.append(f'{entry_id}: evidence item is not an object')
            continue
        if item.get('side') != 'independent': errors.append(f'{entry_id}: evidence side is not independent')
        if item.get('source_environment') != 'independent-dr': errors.append(f'{entry_id}: source_environment must be independent-dr')
        file_value = item.get('file')
        if not isinstance(file_value, str) or not file_value.startswith('evidence/independent/'):
            errors.append(f'{entry_id}: evidence path is not under evidence/independent/')
            continue
        filename = Path(file_value).name
        persistent = persistent_dir / filename
        working = root / file_value
        if not persistent.is_file(): errors.append(f'{entry_id}: persistent evidence file missing: {filename}')
        if not working.is_file(): errors.append(f'{entry_id}: rebuilt working evidence file missing: {file_value}')
        if persistent.is_file() and working.is_file():
            persistent_sha = hashlib.sha256(persistent.read_bytes()).hexdigest()
            working_sha = hashlib.sha256(working.read_bytes()).hexdigest()
            if persistent_sha != working_sha: errors.append(f'{entry_id}: persistent and rebuilt evidence bytes differ: {filename}')
            if item.get('sha256') != persistent_sha: errors.append(f'{entry_id}: registered SHA-256 differs from evidence bytes: {filename}')
            if item.get('bytes') != persistent.stat().st_size: errors.append(f'{entry_id}: registered byte count differs: {filename}')

# Any independent evidence in the formal manifest must come from the persistent
# overlay. This prevents one-off working-tree captures from disappearing later.
for entry in manifest_entries:
    if not isinstance(entry, dict): continue
    independent_items = [item for item in entry.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent']
    if independent_items and entry.get('id') not in seen:
        errors.append(f"{entry.get('id')}: formal manifest has independent evidence not backed by persistent overlay")

if errors:
    print('DR_INDEPENDENT_EVIDENCE_INTEGRITY=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('DR_INDEPENDENT_EVIDENCE_INTEGRITY=PASS')
print(f'{len(registrations)} persistent independent registration(s) match the rebuilt manifest/files exactly; no registration auto-promotes VERIFIED_IDENTICAL.')
