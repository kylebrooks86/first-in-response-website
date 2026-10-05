import hashlib
import json
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'LIVE_EVIDENCE_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence' / 'live'
errors = []

if not manifest_path.is_file():
    errors.append('formal parity manifest missing')
if not overlay_path.is_file():
    errors.append('persistent LIVE evidence overlay missing')
if errors:
    print('DR_LIVE_EVIDENCE_INTEGRITY=FAIL')
    for error in errors:
        print('- ' + error)
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1:
    errors.append('unexpected LIVE overlay schema')
if overlay.get('side') != 'live':
    errors.append('LIVE overlay side must be live')
registrations = overlay.get('entries')
if not isinstance(registrations, list):
    errors.append('LIVE overlay entries must be an array')
    registrations = []

manifest_entries = manifest.get('entries') or []
by_id = {item.get('id'): item for item in manifest_entries if isinstance(item, dict)}
seen = set()

for registration in registrations:
    if not isinstance(registration, dict):
        errors.append('LIVE overlay contains non-object registration')
        continue
    entry_id = registration.get('id')
    if not isinstance(entry_id, str) or not entry_id:
        errors.append('LIVE overlay registration missing id')
        continue
    if entry_id in seen:
        errors.append(f'duplicate LIVE registration: {entry_id}')
    seen.add(entry_id)
    target = by_id.get(entry_id)
    if target is None:
        errors.append(f'{entry_id}: LIVE registration has no formal manifest entry')
        continue
    evidence = registration.get('evidence')
    if not isinstance(evidence, list) or len(evidence) != 1:
        errors.append(f'{entry_id}: LIVE registration must contain exactly one evidence object')
        continue
    item = evidence[0]
    if not isinstance(item, dict):
        errors.append(f'{entry_id}: LIVE evidence item must be an object')
        continue
    if item.get('side') != 'live':
        errors.append(f'{entry_id}: LIVE evidence side must be live')
    if item.get('comparison_reference') is not True:
        errors.append(f'{entry_id}: LIVE evidence must be designated comparison_reference')
    if item.get('source_environment') != 'live-recapture':
        errors.append(f'{entry_id}: source_environment must be live-recapture')
    if item.get('source_label') != 'user-provided-live-recapture':
        errors.append(f'{entry_id}: source_label must identify user-provided LIVE recapture')
    if item.get('capture_profile_source') != 'live-registrar-v1':
        errors.append(f'{entry_id}: capture profile must come from live-registrar-v1')
    for key in ['pixel_width','pixel_height','viewport_width','viewport_height']:
        value = item.get(key)
        if not isinstance(value, int) or value <= 0:
            errors.append(f'{entry_id}: {key} must be a positive integer')
    if item.get('device_class') not in {'mobile','tablet','desktop'}:
        errors.append(f'{entry_id}: invalid/missing device_class')
    if item.get('orientation') not in {'portrait','landscape'}:
        errors.append(f'{entry_id}: invalid/missing orientation')
    file_value = item.get('file')
    if not isinstance(file_value, str) or not file_value.startswith('evidence/live/'):
        errors.append(f'{entry_id}: LIVE evidence path must be under evidence/live/')
        continue
    filename = Path(file_value).name
    persistent = persistent_dir / filename
    working = root / file_value
    if not persistent.is_file():
        errors.append(f'{entry_id}: persistent LIVE evidence file missing: {filename}')
    if not working.is_file():
        errors.append(f'{entry_id}: working LIVE evidence file missing: {file_value}')
    if persistent.is_file() and working.is_file():
        persistent_sha = hashlib.sha256(persistent.read_bytes()).hexdigest()
        working_sha = hashlib.sha256(working.read_bytes()).hexdigest()
        if persistent_sha != working_sha:
            errors.append(f'{entry_id}: persistent and working LIVE evidence bytes differ')
        if item.get('sha256') != persistent_sha:
            errors.append(f'{entry_id}: registered LIVE SHA-256 differs from bytes')
        if item.get('bytes') != persistent.stat().st_size:
            errors.append(f'{entry_id}: registered LIVE byte count differs from file')
    live_items = [
        evidence_item
        for evidence_item in target.get('evidence', [])
        if isinstance(evidence_item, dict) and evidence_item.get('side') == 'live'
    ]
    refs = [evidence_item for evidence_item in live_items if evidence_item.get('comparison_reference') is True]
    if len(refs) != 1:
        errors.append(f'{entry_id}: rebuilt manifest must have exactly one designated LIVE comparison reference')
    elif refs[0] != item:
        errors.append(f'{entry_id}: rebuilt manifest designated LIVE reference differs from persistent overlay')
    if target.get('live_evidence_status') != 'CAPTURED':
        errors.append(f'{entry_id}: formal LIVE evidence status must be CAPTURED')
    if target.get('comparison_status') == 'VERIFIED_IDENTICAL':
        errors.append(f'{entry_id}: LIVE registration alone must not auto-promote comparison status')

for entry in manifest_entries:
    if not isinstance(entry, dict):
        continue
    refs = [
        item for item in entry.get('evidence', [])
        if isinstance(item, dict)
        and item.get('side') == 'live'
        and item.get('comparison_reference') is True
    ]
    if refs and entry.get('id') not in seen:
        errors.append(f"{entry.get('id')}: designated LIVE comparison reference is not backed by persistent LIVE overlay")

if errors:
    print('DR_LIVE_EVIDENCE_INTEGRITY=FAIL')
    for error in errors:
        print('- ' + error)
    raise SystemExit(1)

print('DR_LIVE_EVIDENCE_INTEGRITY=PASS')
print(f'{len(registrations)} persistent LIVE comparison-reference registration(s) match working manifest/files; legacy LIVE evidence remains retained.')
