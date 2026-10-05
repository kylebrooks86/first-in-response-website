import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
app_dir = repo_root / 'fire-app-dr'
manifest_path = app_dir / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'INDEPENDENT_EVIDENCE_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence' / 'independent'

parser = argparse.ArgumentParser(description='Register one rendered independent-DR parity evidence file without promoting comparison status.')
parser.add_argument('--entry-id', required=True, help='Formal PARITY_EVIDENCE_MANIFEST entry id')
parser.add_argument('--file', required=True, help='Path to the screenshot/evidence file to register')
parser.add_argument('--notes', required=True, help='What exact DR state this evidence proves')
parser.add_argument('--replace', action='store_true', help='Explicitly replace an existing independent registration for this entry')
parser.add_argument('--captured-at', help='Optional ISO-8601 capture time; defaults to registration time')
args = parser.parse_args()

source = Path(args.file).expanduser().resolve()
if not source.is_file():
    raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: evidence file does not exist: {source}')
if not manifest_path.is_file():
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: fire-app-dr/PARITY_EVIDENCE_MANIFEST.json is missing; run the governed prepare flow first')
if not overlay_path.is_file():
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent independent evidence overlay is missing')
notes = args.notes.strip()
if not notes:
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: notes must not be blank')

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries') or []
target = next((item for item in entries if isinstance(item, dict) and item.get('id') == args.entry_id), None)
if target is None:
    raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: unknown formal parity id: {args.entry_id}')
if target.get('independent_evidence_status') not in {'READY_FOR_CAPTURE', 'PENDING', 'CAPTURED'}:
    raise SystemExit(f"DR_EVIDENCE_REGISTER=FAIL: state is not eligible for independent capture: {target.get('independent_evidence_status')!r}")

suffix = source.suffix.lower()
media_types = {'.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp'}
if suffix not in media_types:
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: evidence file must be PNG, JPG/JPEG, or WEBP')

raw = source.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
size = len(raw)
now = datetime.now(timezone.utc).isoformat()
captured_at = args.captured_at or now
safe_id = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in args.entry_id)
filename = f'{safe_id}_{digest[:12]}{suffix}'
destination = persistent_dir / filename
relative_file = f'evidence/independent/{filename}'

try:
    datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
except ValueError:
    raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: --captured-at is not valid ISO-8601: {captured_at}')

overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1 or overlay.get('side') != 'independent' or not isinstance(overlay.get('entries'), list):
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent independent evidence overlay is malformed')
registrations = overlay['entries']
existing_index = next((i for i, item in enumerate(registrations) if isinstance(item, dict) and item.get('id') == args.entry_id), None)
if existing_index is not None and not args.replace:
    raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has persistent independent evidence; use --replace only after deliberate review')

persistent_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, destination)

registration = {
    'id': args.entry_id,
    'last_updated_at': now,
    'evidence': [{
        'side': 'independent',
        'file': relative_file,
        'captured_at': captured_at,
        'registered_at': now,
        'source_environment': 'independent-dr',
        'source_label': 'fire-app-independent-staging',
        'source_release': 'v138-dr-staging',
        'route_family': args.entry_id,
        'deployment_provenance_source': 'FIRE_DR_BUILD_PROVENANCE.json',
        'notes': notes,
        'sha256': digest,
        'bytes': size,
        'media_type': media_types[suffix],
    }],
}
if existing_index is None:
    registrations.append(registration)
else:
    old = registrations[existing_index]
    old_files = [Path(str(item.get('file', ''))).name for item in old.get('evidence', []) if isinstance(item, dict)]
    registrations[existing_index] = registration
    for old_name in old_files:
        old_path = persistent_dir / old_name
        if old_path != destination and old_path.is_file():
            old_path.unlink()

overlay_path.write_text(json.dumps(overlay, indent=2) + '\n')

# Immediately merge the persistent overlay into the current extracted app so the
# formal ledger and its byte/hash guard can be exercised before the next commit.
subprocess.run([sys.executable, '../scripts/apply-fire-dr-independent-evidence-overlay.py'], cwd=app_dir, check=True)

updated = json.loads(manifest_path.read_text())
updated_target = next(item for item in updated.get('entries', []) if isinstance(item, dict) and item.get('id') == args.entry_id)
if updated_target.get('independent_evidence_status') != 'CAPTURED':
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: independent status did not become CAPTURED after merge')
if updated_target.get('comparison_status') == 'VERIFIED_IDENTICAL':
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: registrar must never auto-promote comparison status')

print('DR_EVIDENCE_REGISTER=PASS')
print(f'Registered independent evidence for {args.entry_id}: {relative_file}')
print(f'SHA256={digest} bytes={size}')
print('Comparison status was not promoted; a deliberate LIVE-vs-DR comparison is still required.')
