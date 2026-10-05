import hashlib
import json
import shutil
from pathlib import Path

root = Path('.')
repo_root = Path('..')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'INDEPENDENT_EVIDENCE_OVERLAY.json'
persistent_files = repo_root / 'dr-parity-evidence' / 'independent'
working_files = root / 'evidence' / 'independent'

if not manifest_path.exists():
    raise SystemExit('DR_INDEPENDENT_EVIDENCE_OVERLAY=FAIL: PARITY_EVIDENCE_MANIFEST.json missing')
if not overlay_path.exists():
    raise SystemExit('DR_INDEPENDENT_EVIDENCE_OVERLAY=FAIL: persistent independent evidence overlay missing')

manifest = json.loads(manifest_path.read_text())
overlay = json.loads(overlay_path.read_text())
errors = []

if overlay.get('schema_version') != 1:
    errors.append(f"unexpected overlay schema_version: {overlay.get('schema_version')!r}")
if overlay.get('side') != 'independent':
    errors.append('persistent evidence overlay must be independent-side only')
overlay_entries = overlay.get('entries')
if not isinstance(overlay_entries, list):
    errors.append('overlay entries must be an array')
    overlay_entries = []

manifest_entries = manifest.get('entries')
if not isinstance(manifest_entries, list):
    errors.append('formal manifest entries must be an array')
    manifest_entries = []
manifest_by_id = {item.get('id'): item for item in manifest_entries if isinstance(item, dict)}

seen_ids = set()
for registration in overlay_entries:
    if not isinstance(registration, dict):
        errors.append('overlay contains a non-object registration')
        continue
    entry_id = registration.get('id')
    if not isinstance(entry_id, str) or not entry_id:
        errors.append('overlay registration has invalid id')
        continue
    if entry_id in seen_ids:
        errors.append(f'duplicate independent overlay registration for {entry_id}')
        continue
    seen_ids.add(entry_id)
    target = manifest_by_id.get(entry_id)
    if target is None:
        errors.append(f'overlay references unknown formal parity id: {entry_id}')
        continue
    if 'comparison_status' in registration or 'live_evidence_status' in registration:
        errors.append(f'{entry_id}: independent overlay may not alter LIVE or comparison status')
        continue
    evidence = registration.get('evidence')
    if not isinstance(evidence, list) or not evidence:
        errors.append(f'{entry_id}: independent registration requires at least one evidence object')
        continue

    validated = []
    for item in evidence:
        if not isinstance(item, dict):
            errors.append(f'{entry_id}: evidence contains a non-object item')
            continue
        if item.get('side') != 'independent':
            errors.append(f'{entry_id}: overlay evidence side must be independent')
            continue
        file_value = item.get('file')
        digest = str(item.get('sha256', '')).lower()
        notes = str(item.get('notes', '')).strip()
        if not isinstance(file_value, str) or not file_value.startswith('evidence/independent/'):
            errors.append(f'{entry_id}: evidence file must be under evidence/independent/')
            continue
        if '..' in Path(file_value).parts or Path(file_value).is_absolute():
            errors.append(f'{entry_id}: invalid evidence path: {file_value}')
            continue
        if len(digest) != 64 or any(ch not in '0123456789abcdef' for ch in digest):
            errors.append(f'{entry_id}: invalid SHA-256 for {file_value}')
            continue
        if not notes:
            errors.append(f'{entry_id}: evidence notes are required')
            continue
        filename = Path(file_value).name
        source = persistent_files / filename
        if not source.is_file():
            errors.append(f'{entry_id}: persistent evidence file missing: {source}')
            continue
        actual = hashlib.sha256(source.read_bytes()).hexdigest()
        if actual != digest:
            errors.append(f'{entry_id}: persistent evidence SHA-256 mismatch for {filename}')
            continue
        recorded_bytes = item.get('bytes')
        if not isinstance(recorded_bytes, int) or recorded_bytes != source.stat().st_size:
            errors.append(f'{entry_id}: persistent evidence byte count mismatch for {filename}')
            continue
        validated.append(item)

    if len(validated) != len(evidence):
        continue

    existing = target.get('evidence')
    if not isinstance(existing, list):
        existing = []
    retained = [item for item in existing if not (isinstance(item, dict) and item.get('side') == 'independent')]
    target['evidence'] = retained + validated
    target['independent_evidence_status'] = 'CAPTURED'
    target['comparison_status'] = target.get('comparison_status', 'PENDING')
    if target['comparison_status'] == 'VERIFIED_IDENTICAL':
        errors.append(f'{entry_id}: overlay refuses to preserve VERIFIED_IDENTICAL without deliberate comparison workflow')
        target['comparison_status'] = 'PENDING'
    if registration.get('last_updated_at'):
        target['last_updated_at'] = registration['last_updated_at']

    working_files.mkdir(parents=True, exist_ok=True)
    for item in validated:
        filename = Path(item['file']).name
        shutil.copy2(persistent_files / filename, working_files / filename)

if errors:
    print('DR_INDEPENDENT_EVIDENCE_OVERLAY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print('DR_INDEPENDENT_EVIDENCE_OVERLAY=PASS')
print(f'Merged {len(overlay_entries)} persistent independent evidence registration(s); comparison statuses were not promoted.')
