import json
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'COMPARISON_OVERLAY.json'

if not manifest_path.is_file():
    raise SystemExit('DR_COMPARISON_OVERLAY=FAIL: PARITY_EVIDENCE_MANIFEST.json missing')
if not overlay_path.is_file():
    raise SystemExit('DR_COMPARISON_OVERLAY=FAIL: persistent comparison overlay missing')

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
errors = []

if overlay.get('schema_version') != 1:
    errors.append(f"unexpected comparison overlay schema_version: {overlay.get('schema_version')!r}")
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
    if entry_id in seen:
        errors.append(f'duplicate comparison decision: {entry_id}')
        continue
    seen.add(entry_id)
    target = by_id.get(entry_id)
    if target is None:
        errors.append(f'{entry_id}: comparison decision does not map to formal manifest')
        continue
    result = decision.get('result')
    if result not in {'VERIFIED_IDENTICAL', 'MISMATCH'}:
        errors.append(f'{entry_id}: invalid comparison result {result!r}')
        continue
    notes = str(decision.get('notes', '')).strip()
    if not notes:
        errors.append(f'{entry_id}: comparison notes are required')
    live = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live'), None)
    independent = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent'), None)
    if target.get('live_evidence_status') != 'CAPTURED' or not live:
        errors.append(f'{entry_id}: comparison requires registered LIVE evidence')
        continue
    if target.get('independent_evidence_status') != 'CAPTURED' or not independent:
        errors.append(f'{entry_id}: comparison requires registered independent evidence')
        continue
    if decision.get('live_sha256') != live.get('sha256'):
        errors.append(f'{entry_id}: comparison LIVE hash no longer matches registered evidence')
    if decision.get('independent_sha256') != independent.get('sha256'):
        errors.append(f'{entry_id}: comparison DR hash no longer matches registered evidence')
    if result == 'VERIFIED_IDENTICAL' and independent.get('profile_matches_registered_live') is not True:
        errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires a DR capture profile matching the registered LIVE capture')
    if result == 'VERIFIED_IDENTICAL' and (decision.get('visual_review_complete') is not True or decision.get('functional_review_complete') is not True):
        errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires explicit visual and functional review completion')
    if errors and errors[-1].startswith(f'{entry_id}:'):
        continue
    target['comparison_status'] = result
    target['last_updated_at'] = decision.get('reviewed_at') or target.get('last_updated_at')

if errors:
    print('DR_COMPARISON_OVERLAY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print('DR_COMPARISON_OVERLAY=PASS')
print(f'Applied {len(entries)} deliberate comparison decision(s), each tied to exact registered LIVE/DR evidence hashes.')
