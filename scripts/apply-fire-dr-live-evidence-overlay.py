import json
import shutil
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'LIVE_EVIDENCE_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence' / 'live'
working_dir = root / 'evidence' / 'live'

if not manifest_path.is_file():
    raise SystemExit('DR_LIVE_EVIDENCE_OVERLAY=FAIL: PARITY_EVIDENCE_MANIFEST.json missing')
if not overlay_path.is_file():
    raise SystemExit('DR_LIVE_EVIDENCE_OVERLAY=FAIL: persistent LIVE evidence overlay missing')

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
errors = []

if overlay.get('schema_version') != 1:
    errors.append(f"unexpected LIVE overlay schema_version: {overlay.get('schema_version')!r}")
if overlay.get('side') != 'live':
    errors.append('LIVE overlay side must be live')
entries = overlay.get('entries')
if not isinstance(entries, list):
    errors.append('LIVE overlay entries must be an array')
    entries = []

manifest_entries = manifest.get('entries') or []
by_id = {item.get('id'): item for item in manifest_entries if isinstance(item, dict)}
seen = set()
working_dir.mkdir(parents=True, exist_ok=True)

for registration in entries:
    if not isinstance(registration, dict):
        errors.append('LIVE overlay contains non-object registration')
        continue
    entry_id = registration.get('id')
    if not isinstance(entry_id, str) or not entry_id:
        errors.append('LIVE overlay registration missing id')
        continue
    if entry_id in seen:
        errors.append(f'duplicate LIVE overlay registration: {entry_id}')
        continue
    seen.add(entry_id)
    target = by_id.get(entry_id)
    if target is None:
        errors.append(f'{entry_id}: LIVE registration does not map to formal manifest')
        continue
    evidence = registration.get('evidence')
    if not isinstance(evidence, list) or len(evidence) != 1:
        errors.append(f'{entry_id}: LIVE registration must contain exactly one designated evidence object')
        continue
    item = evidence[0]
    if not isinstance(item, dict) or item.get('side') != 'live':
        errors.append(f'{entry_id}: designated LIVE evidence object is malformed')
        continue
    if item.get('comparison_reference') is not True:
        errors.append(f'{entry_id}: designated LIVE evidence must set comparison_reference=true')
        continue
    file_value = item.get('file')
    if not isinstance(file_value, str) or not file_value.startswith('evidence/live/'):
        errors.append(f'{entry_id}: LIVE overlay evidence path must be under evidence/live/')
        continue
    filename = Path(file_value).name
    persistent = persistent_dir / filename
    working = working_dir / filename
    if not persistent.is_file():
        errors.append(f'{entry_id}: persistent LIVE evidence file missing: {filename}')
        continue
    shutil.copy2(persistent, working)

    rebuilt = []
    for existing in target.get('evidence', []):
        if not isinstance(existing, dict):
            rebuilt.append(existing)
            continue
        if existing.get('side') == 'live' and existing.get('source_environment') == 'live-recapture':
            continue
        if existing.get('side') == 'live' and existing.get('comparison_reference') is True:
            existing = dict(existing)
            existing.pop('comparison_reference', None)
        rebuilt.append(existing)
    rebuilt.append(item)
    target['evidence'] = rebuilt
    target['live_evidence_status'] = 'CAPTURED'
    target['comparison_status'] = 'PENDING'
    target['last_updated_at'] = registration.get('last_updated_at') or target.get('last_updated_at')

if errors:
    print('DR_LIVE_EVIDENCE_OVERLAY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print('DR_LIVE_EVIDENCE_OVERLAY=PASS')
print(f'Applied {len(entries)} persistent LIVE comparison-reference registration(s) without deleting sealed legacy LIVE evidence.')
