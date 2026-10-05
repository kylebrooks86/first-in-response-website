import json
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'COMPARISON_OVERLAY.json'
errors = []

if not manifest_path.is_file(): errors.append('formal parity manifest missing')
if not overlay_path.is_file(): errors.append('persistent comparison overlay missing')
if errors:
    print('DR_COMPARISON_INTEGRITY=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1: errors.append('unexpected comparison overlay schema')
entries = overlay.get('entries')
if not isinstance(entries, list):
    errors.append('comparison overlay entries must be an array')
    entries = []
manifest_entries = manifest.get('entries') or []
by_id = {item.get('id'): item for item in manifest_entries if isinstance(item, dict)}
seen = set()

for decision in entries:
    if not isinstance(decision, dict):
        errors.append('comparison overlay contains non-object decision')
        continue
    entry_id = decision.get('id')
    if not isinstance(entry_id, str) or not entry_id:
        errors.append('comparison decision missing id')
        continue
    if entry_id in seen: errors.append(f'duplicate comparison decision: {entry_id}')
    seen.add(entry_id)
    target = by_id.get(entry_id)
    if target is None:
        errors.append(f'{entry_id}: comparison decision has no formal manifest entry')
        continue
    result = decision.get('result')
    if result not in {'VERIFIED_IDENTICAL','MISMATCH'}: errors.append(f'{entry_id}: invalid comparison result {result!r}')
    if not str(decision.get('notes','')).strip(): errors.append(f'{entry_id}: comparison notes required')
    if not decision.get('reviewed_at'): errors.append(f'{entry_id}: reviewed_at required')
    live = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live'), None)
    independent = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent'), None)
    if not live or target.get('live_evidence_status') != 'CAPTURED': errors.append(f'{entry_id}: LIVE evidence missing/not CAPTURED')
    if not independent or target.get('independent_evidence_status') != 'CAPTURED': errors.append(f'{entry_id}: DR evidence missing/not CAPTURED')
    if live and decision.get('live_sha256') != live.get('sha256'): errors.append(f'{entry_id}: LIVE comparison hash stale')
    if independent and decision.get('independent_sha256') != independent.get('sha256'): errors.append(f'{entry_id}: DR comparison hash stale')
    if target.get('comparison_status') != result: errors.append(f'{entry_id}: manifest comparison_status does not match persistent decision')
    if result == 'VERIFIED_IDENTICAL':
        if independent and independent.get('profile_matches_registered_live') is not True: errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires matching DR capture profile')
        if decision.get('visual_review_complete') is not True: errors.append(f'{entry_id}: VERIFIED_IDENTICAL missing visual review completion')
        if decision.get('functional_review_complete') is not True: errors.append(f'{entry_id}: VERIFIED_IDENTICAL missing functional review completion')

for entry in manifest_entries:
    if not isinstance(entry, dict): continue
    status = entry.get('comparison_status')
    if status in {'VERIFIED_IDENTICAL','MISMATCH','MISMATCHED'} and entry.get('id') not in seen:
        errors.append(f"{entry.get('id')}: formal comparison status {status} is not backed by persistent comparison overlay")

if errors:
    print('DR_COMPARISON_INTEGRITY=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('DR_COMPARISON_INTEGRITY=PASS')
print(f'{len(entries)} persistent comparison decision(s) match the formal manifest and exact registered evidence hashes.')
