import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
app_dir = repo_root / 'fire-app-dr'
manifest_path = app_dir / 'PARITY_EVIDENCE_MANIFEST.json'
live_overlay_path = repo_root / 'dr-parity-evidence' / 'LIVE_EVIDENCE_OVERLAY.json'
independent_overlay_path = repo_root / 'dr-parity-evidence' / 'INDEPENDENT_EVIDENCE_OVERLAY.json'
comparison_overlay_path = repo_root / 'dr-parity-evidence' / 'COMPARISON_OVERLAY.json'
persistent_live_dir = repo_root / 'dr-parity-evidence' / 'live'
persistent_independent_dir = repo_root / 'dr-parity-evidence' / 'independent'
working_independent_dir = app_dir / 'evidence' / 'independent'

parser = argparse.ArgumentParser(
    description='Register one newer LIVE screenshot as the designated comparison reference while retaining sealed legacy LIVE evidence.'
)
parser.add_argument('--entry-id', required=True)
parser.add_argument('--file', required=True)
parser.add_argument('--notes', required=True)
parser.add_argument('--replace', action='store_true', help='Replace an existing designated LIVE reference for this entry and invalidate stale comparison decisions.')
parser.add_argument('--invalidate-independent', action='store_true', help='Required when this entry already has DR evidence; removes that stale DR registration so it can be recaptured against the new LIVE reference.')
parser.add_argument('--captured-at', help='Optional ISO-8601 capture time; defaults to registration time.')
parser.add_argument('--viewport-width', type=int)
parser.add_argument('--viewport-height', type=int)
parser.add_argument('--device-class', choices=['mobile','tablet','desktop'])
parser.add_argument('--orientation', choices=['portrait','landscape'])
parser.add_argument('--theme', choices=['light','dark','system'])
parser.add_argument('--pixel-width', type=int)
parser.add_argument('--pixel-height', type=int)
args = parser.parse_args()

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def detect_dimensions(path: Path, suffix: str):
    data = path.read_bytes()
    if suffix == '.png':
        if len(data) >= 24 and data[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', data[16:24])
        return None
    if suffix in {'.jpg', '.jpeg'}:
        if len(data) < 4 or data[:2] != b'\xff\xd8':
            return None
        i = 2
        sof = {0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF}
        while i + 4 <= len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            while i < len(data) and data[i] == 0xFF:
                i += 1
            if i >= len(data):
                break
            marker = data[i]
            i += 1
            if marker in {0xD8,0xD9}:
                continue
            if i + 2 > len(data):
                break
            length = int.from_bytes(data[i:i+2], 'big')
            if length < 2 or i + length > len(data):
                break
            if marker in sof and length >= 7:
                height = int.from_bytes(data[i+3:i+5], 'big')
                width = int.from_bytes(data[i+5:i+7], 'big')
                return width, height
            i += length
    return None

source = Path(args.file).expanduser().resolve()
for path, label in [
    (source, 'evidence file'),
    (manifest_path, 'formal parity manifest'),
    (live_overlay_path, 'persistent LIVE evidence overlay'),
    (independent_overlay_path, 'persistent independent evidence overlay'),
    (comparison_overlay_path, 'persistent comparison overlay'),
]:
    if not path.is_file():
        raise SystemExit(f'DR_LIVE_EVIDENCE_REGISTER=FAIL: missing {label}: {path}')

notes = args.notes.strip()
if not notes:
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: notes must not be blank')

manifest = json.loads(manifest_path.read_text())
target = next(
    (item for item in manifest.get('entries', []) if isinstance(item, dict) and item.get('id') == args.entry_id),
    None,
)
if target is None:
    raise SystemExit(f'DR_LIVE_EVIDENCE_REGISTER=FAIL: unknown formal parity id: {args.entry_id}')

suffix = source.suffix.lower()
media_types = {'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp'}
if suffix not in media_types:
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: evidence file must be PNG, JPG/JPEG, or WEBP')
raw = source.read_bytes()
digest = sha256_bytes(raw)
size = len(raw)
detected = detect_dimensions(source, suffix)
if detected:
    pixel_width, pixel_height = detected
else:
    pixel_width, pixel_height = args.pixel_width, args.pixel_height
if not pixel_width or not pixel_height or pixel_width <= 0 or pixel_height <= 0:
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: could not determine image dimensions; provide --pixel-width and --pixel-height')
if args.pixel_width and args.pixel_width != pixel_width:
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: supplied pixel width does not match image')
if args.pixel_height and args.pixel_height != pixel_height:
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: supplied pixel height does not match image')

viewport_width = args.viewport_width or pixel_width
viewport_height = args.viewport_height or pixel_height
device_class = args.device_class or ('mobile' if viewport_width < 1600 else 'tablet' if viewport_width < 2400 else 'desktop')
orientation = args.orientation or ('portrait' if viewport_height >= viewport_width else 'landscape')
theme = args.theme
now = datetime.now(timezone.utc).isoformat()
captured_at = args.captured_at or now
try:
    datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
except ValueError:
    raise SystemExit(f'DR_LIVE_EVIDENCE_REGISTER=FAIL: invalid --captured-at ISO-8601 value: {captured_at}')

live_overlay = json.loads(live_overlay_path.read_text())
independent_overlay = json.loads(independent_overlay_path.read_text())
comparison_overlay = json.loads(comparison_overlay_path.read_text())
if live_overlay.get('schema_version') != 1 or live_overlay.get('side') != 'live' or not isinstance(live_overlay.get('entries'), list):
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: LIVE evidence overlay malformed')
if independent_overlay.get('schema_version') != 1 or independent_overlay.get('side') != 'independent' or not isinstance(independent_overlay.get('entries'), list):
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: independent evidence overlay malformed')
if comparison_overlay.get('schema_version') != 1 or not isinstance(comparison_overlay.get('entries'), list):
    raise SystemExit('DR_LIVE_EVIDENCE_REGISTER=FAIL: comparison overlay malformed')

live_entries = live_overlay['entries']
existing_live_index = next((i for i,item in enumerate(live_entries) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if existing_live_index is not None and not args.replace:
    raise SystemExit(f'DR_LIVE_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has a designated LIVE reference; use --replace after deliberate review')

independent_entries = independent_overlay['entries']
independent_index = next((i for i,item in enumerate(independent_entries) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if independent_index is not None and not args.invalidate_independent:
    raise SystemExit(
        f'DR_LIVE_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has DR evidence tied to the old LIVE reference; '
        'use --invalidate-independent and recapture DR afterward'
    )

comparison_entries = comparison_overlay['entries']
comparison_index = next((i for i,item in enumerate(comparison_entries) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if comparison_index is not None and not args.replace:
    raise SystemExit(
        f'DR_LIVE_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has a deliberate comparison; '
        'replacing the LIVE reference requires --replace and fresh review'
    )

safe_id = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in args.entry_id)
filename = f'{safe_id}_{digest[:12]}{suffix}'
persistent_live_dir.mkdir(parents=True, exist_ok=True)
destination = persistent_live_dir / filename
relative_file = f'evidence/live/{filename}'
shutil.copy2(source, destination)

evidence = {
    'side':'live',
    'file':relative_file,
    'captured_at':captured_at,
    'registered_at':now,
    'source_environment':'live-recapture',
    'source_label':'user-provided-live-recapture',
    'source_release':'live-current',
    'route_family':args.entry_id,
    'notes':notes,
    'sha256':digest,
    'bytes':size,
    'media_type':media_types[suffix],
    'pixel_width':pixel_width,
    'pixel_height':pixel_height,
    'viewport_width':viewport_width,
    'viewport_height':viewport_height,
    'device_class':device_class,
    'orientation':orientation,
    'capture_profile_source':'live-registrar-v1',
    'comparison_reference':True,
}
if theme:
    evidence['theme'] = theme
registration = {'id':args.entry_id,'last_updated_at':now,'evidence':[evidence]}

if existing_live_index is None:
    live_entries.append(registration)
else:
    old = live_entries[existing_live_index]
    old_files = [
        Path(str(item.get('file',''))).name
        for item in old.get('evidence', [])
        if isinstance(item, dict)
    ]
    live_entries[existing_live_index] = registration
    for old_name in old_files:
        old_path = persistent_live_dir / old_name
        if old_path != destination and old_path.is_file():
            old_path.unlink()

if comparison_index is not None:
    comparison_entries.pop(comparison_index)

if independent_index is not None:
    old = independent_entries.pop(independent_index)
    for item in old.get('evidence', []):
        if not isinstance(item, dict):
            continue
        old_name = Path(str(item.get('file',''))).name
        for directory in [persistent_independent_dir, working_independent_dir]:
            old_path = directory / old_name
            if old_path.is_file():
                old_path.unlink()
    target['evidence'] = [
        item for item in target.get('evidence', [])
        if not (isinstance(item, dict) and item.get('side') == 'independent')
    ]
    target['independent_evidence_status'] = 'READY_FOR_CAPTURE'

target['comparison_status'] = 'PENDING'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
live_overlay_path.write_text(json.dumps(live_overlay, indent=2) + '\n')
independent_overlay_path.write_text(json.dumps(independent_overlay, indent=2) + '\n')
comparison_overlay_path.write_text(json.dumps(comparison_overlay, indent=2) + '\n')

subprocess.run([sys.executable, '../scripts/apply-fire-dr-live-evidence-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-independent-evidence-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-comparison-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-parity-summary-sync.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-live-registered-evidence-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-independent-evidence-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-comparison-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-parity-ledger-consistency.py'], cwd=app_dir, check=True)

print('DR_LIVE_EVIDENCE_REGISTER=PASS')
print(f'Registered designated LIVE comparison reference for {args.entry_id}: {relative_file}')
print(f'SHA256={digest} bytes={size} pixels={pixel_width}x{pixel_height} viewport={viewport_width}x{viewport_height} {device_class}/{orientation}')
if independent_index is not None:
    print('STALE_DR_EVIDENCE_INVALIDATED=YES; recapture/register DR against the new LIVE reference.')
if comparison_index is not None:
    print('PRIOR_COMPARISON_INVALIDATED=YES; fresh visual/functional review is required.')
print('Legacy sealed LIVE evidence remains retained in the formal manifest.')
