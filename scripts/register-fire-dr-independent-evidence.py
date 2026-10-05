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
overlay_path = repo_root / 'dr-parity-evidence' / 'INDEPENDENT_EVIDENCE_OVERLAY.json'
comparison_overlay_path = repo_root / 'dr-parity-evidence' / 'COMPARISON_OVERLAY.json'
persistent_dir = repo_root / 'dr-parity-evidence' / 'independent'
provenance_path = app_dir / 'dist/server/FIRE_DR_BUILD_PROVENANCE.json'
persistent_provenance_dir = repo_root / 'dr-parity-evidence' / 'provenance'

parser = argparse.ArgumentParser(description='Register one rendered independent-DR parity evidence file without promoting comparison status.')
parser.add_argument('--entry-id', required=True, help='Formal PARITY_EVIDENCE_MANIFEST entry id')
parser.add_argument('--file', required=True, help='Path to the screenshot/evidence file to register')
parser.add_argument('--notes', required=True, help='What exact DR state this evidence proves')
parser.add_argument('--replace', action='store_true', help='Explicitly replace an existing independent registration for this entry; any prior comparison decision is invalidated')
parser.add_argument('--captured-at', help='Optional ISO-8601 capture time; defaults to registration time')
parser.add_argument('--viewport-width', type=int, help='Rendered viewport width; defaults to registered LIVE profile when known')
parser.add_argument('--viewport-height', type=int, help='Rendered viewport height; defaults to registered LIVE profile when known')
parser.add_argument('--device-class', choices=['mobile','tablet','desktop'], help='Capture device class; defaults to LIVE profile when known')
parser.add_argument('--orientation', choices=['portrait','landscape'], help='Capture orientation; defaults to LIVE profile when known')
parser.add_argument('--theme', choices=['light','dark','system'], help='Capture theme when known')
parser.add_argument('--pixel-width', type=int, help='Required only when image dimensions cannot be detected automatically')
parser.add_argument('--pixel-height', type=int, help='Required only when image dimensions cannot be detected automatically')
parser.add_argument('--allow-profile-mismatch', action='store_true', help='Explicitly allow a DR capture profile that differs from registered LIVE evidence; comparison remains pending')
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
            if i >= len(data): break
            marker = data[i]; i += 1
            if marker in {0xD8,0xD9}: continue
            if i + 2 > len(data): break
            length = int.from_bytes(data[i:i+2], 'big')
            if length < 2 or i + length > len(data): break
            if marker in sof and length >= 7:
                height = int.from_bytes(data[i+3:i+5], 'big')
                width = int.from_bytes(data[i+5:i+7], 'big')
                return width, height
            i += length
    return None

source = Path(args.file).expanduser().resolve()
if not source.is_file(): raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: evidence file does not exist: {source}')
if not manifest_path.is_file(): raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: fire-app-dr/PARITY_EVIDENCE_MANIFEST.json is missing; run the governed prepare flow first')
if not overlay_path.is_file(): raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent independent evidence overlay is missing')
if not comparison_overlay_path.is_file(): raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent comparison overlay is missing')
if not provenance_path.is_file(): raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: build provenance is missing; prepare the governed DR build before registering rendered evidence')
notes = args.notes.strip()
if not notes: raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: notes must not be blank')

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries') or []
target = next((item for item in entries if isinstance(item, dict) and item.get('id') == args.entry_id), None)
if target is None: raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: unknown formal parity id: {args.entry_id}')
if target.get('independent_evidence_status') not in {'READY_FOR_CAPTURE', 'PENDING', 'CAPTURED'}:
    raise SystemExit(f"DR_EVIDENCE_REGISTER=FAIL: state is not eligible for independent capture: {target.get('independent_evidence_status')!r}")

suffix = source.suffix.lower(); media_types = {'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp'}
if suffix not in media_types: raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: evidence file must be PNG, JPG/JPEG, or WEBP')
raw = source.read_bytes(); digest = sha256_bytes(raw); size = len(raw); detected = detect_dimensions(source, suffix)
if detected: pixel_width, pixel_height = detected
else: pixel_width, pixel_height = args.pixel_width, args.pixel_height
if not pixel_width or not pixel_height or pixel_width <= 0 or pixel_height <= 0:
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: could not determine image dimensions; provide --pixel-width and --pixel-height')
if args.pixel_width and args.pixel_width != pixel_width: raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: supplied pixel width {args.pixel_width} does not match detected width {pixel_width}')
if args.pixel_height and args.pixel_height != pixel_height: raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: supplied pixel height {args.pixel_height} does not match detected height {pixel_height}')

live = next((item for item in target.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live'), None)
live_profile = live or {}
viewport_width = args.viewport_width or live_profile.get('viewport_width') or pixel_width
viewport_height = args.viewport_height or live_profile.get('viewport_height') or pixel_height
device_class = args.device_class or live_profile.get('device_class') or ('mobile' if viewport_width < 820 else 'tablet' if viewport_width < 1200 else 'desktop')
orientation = args.orientation or live_profile.get('orientation') or ('portrait' if viewport_height >= viewport_width else 'landscape')
theme = args.theme or live_profile.get('theme')
profile_mismatches = []
if live:
    for label, live_value, dr_value in [('pixel width',live.get('pixel_width'),pixel_width),('pixel height',live.get('pixel_height'),pixel_height),('viewport width',live.get('viewport_width'),viewport_width),('viewport height',live.get('viewport_height'),viewport_height),('device class',live.get('device_class'),device_class),('orientation',live.get('orientation'),orientation),('theme',live.get('theme'),theme)]:
        if live_value is not None and dr_value is not None and live_value != dr_value: profile_mismatches.append(f'{label}: LIVE={live_value!r}, DR={dr_value!r}')
if profile_mismatches and not args.allow_profile_mismatch:
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: capture profile differs from registered LIVE evidence; recapture to match or explicitly use --allow-profile-mismatch:\n- ' + '\n- '.join(profile_mismatches))

provenance_bytes = provenance_path.read_bytes(); provenance = json.loads(provenance_bytes)
if provenance.get('checked_out_source_commit') is None: raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: build provenance does not identify the checked-out source commit')
if provenance.get('deployment_target', {}).get('worker_name') != 'fire-app-independent-staging': raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: provenance is not for governed independent staging Worker')
provenance_sha256 = sha256_bytes(provenance_bytes)
persistent_provenance_dir.mkdir(parents=True, exist_ok=True)
persistent_provenance = persistent_provenance_dir / f'{provenance_sha256}.json'
if persistent_provenance.exists() and sha256_bytes(persistent_provenance.read_bytes()) != provenance_sha256:
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: existing persisted provenance snapshot has unexpected bytes')
if not persistent_provenance.exists():
    persistent_provenance.write_bytes(provenance_bytes)

now = datetime.now(timezone.utc).isoformat(); captured_at = args.captured_at or now
safe_id = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in args.entry_id)
filename = f'{safe_id}_{digest[:12]}{suffix}'; destination = persistent_dir / filename; relative_file = f'evidence/independent/{filename}'
try: datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
except ValueError: raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: --captured-at is not valid ISO-8601: {captured_at}')

overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1 or overlay.get('side') != 'independent' or not isinstance(overlay.get('entries'), list): raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent independent evidence overlay is malformed')
registrations = overlay['entries']; existing_index = next((i for i,item in enumerate(registrations) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if existing_index is not None and not args.replace: raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has persistent independent evidence; use --replace only after deliberate review')

comparison_overlay = json.loads(comparison_overlay_path.read_text())
if comparison_overlay.get('schema_version') != 1 or not isinstance(comparison_overlay.get('entries'), list):
    raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: persistent comparison overlay is malformed')
comparison_entries = comparison_overlay['entries']
comparison_index = next((i for i,item in enumerate(comparison_entries) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if comparison_index is not None and not args.replace:
    raise SystemExit(f'DR_EVIDENCE_REGISTER=FAIL: {args.entry_id} already has a deliberate comparison decision; replacement evidence requires --replace and re-review')
if comparison_index is not None:
    comparison_entries.pop(comparison_index)
    comparison_overlay_path.write_text(json.dumps(comparison_overlay, indent=2) + '\n')

persistent_dir.mkdir(parents=True, exist_ok=True); shutil.copy2(source, destination)
evidence = {'side':'independent','file':relative_file,'captured_at':captured_at,'registered_at':now,'source_environment':'independent-dr','source_label':'fire-app-independent-staging','source_release':'v138-dr-staging','route_family':args.entry_id,'deployment_provenance_source':f'dr-parity-evidence/provenance/{provenance_sha256}.json','deployment_provenance_sha256':provenance_sha256,'source_commit':provenance.get('checked_out_source_commit'),'notes':notes,'sha256':digest,'bytes':size,'media_type':media_types[suffix],'pixel_width':pixel_width,'pixel_height':pixel_height,'viewport_width':viewport_width,'viewport_height':viewport_height,'device_class':device_class,'orientation':orientation,'capture_profile_source':'dr-registrar-v4','profile_matches_registered_live':not profile_mismatches}
if theme: evidence['theme'] = theme
if profile_mismatches: evidence['profile_mismatch_notes'] = profile_mismatches
registration = {'id':args.entry_id,'last_updated_at':now,'evidence':[evidence]}
if existing_index is None: registrations.append(registration)
else:
    old = registrations[existing_index]; old_files = [Path(str(item.get('file',''))).name for item in old.get('evidence',[]) if isinstance(item,dict)]; registrations[existing_index] = registration
    for old_name in old_files:
        old_path = persistent_dir / old_name
        if old_path != destination and old_path.is_file(): old_path.unlink()
overlay_path.write_text(json.dumps(overlay, indent=2) + '\n')

# Rebuild the working evidence/comparison state immediately. A replaced capture
# invalidates any prior comparison because that decision was tied to the old hash.
subprocess.run([sys.executable, '../scripts/apply-fire-dr-independent-evidence-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-comparison-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-parity-summary-sync.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-independent-evidence-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-comparison-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-parity-ledger-consistency.py'], cwd=app_dir, check=True)

updated = json.loads(manifest_path.read_text()); updated_target = next(item for item in updated.get('entries',[]) if isinstance(item,dict) and item.get('id') == args.entry_id)
if updated_target.get('independent_evidence_status') != 'CAPTURED': raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: independent status did not become CAPTURED after merge')
if updated_target.get('comparison_status') == 'VERIFIED_IDENTICAL': raise SystemExit('DR_EVIDENCE_REGISTER=FAIL: registrar must never auto-promote comparison status')
print('DR_EVIDENCE_REGISTER=PASS')
print(f'Registered independent evidence for {args.entry_id}: {relative_file}')
print(f'SHA256={digest} bytes={size} pixels={pixel_width}x{pixel_height} viewport={viewport_width}x{viewport_height} {device_class}/{orientation}')
print('PROFILE_MATCH=' + ('YES' if not profile_mismatches else 'NO (explicitly accepted; comparison remains pending)'))
print(f'BUILD_PROVENANCE_SHA256={provenance_sha256} (persisted snapshot)')
if comparison_index is not None: print('PRIOR_COMPARISON_INVALIDATED=YES (replacement evidence requires fresh review)')
print('Parity summaries and ledger were synchronized; comparison status was not promoted.')
