import json
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
manifest_path = repo_root / 'fire-app-dr' / 'PARITY_EVIDENCE_MANIFEST.json'

if not manifest_path.is_file():
    raise SystemExit('DR_EVIDENCE_CAPTURE_QUEUE=FAIL: fire-app-dr/PARITY_EVIDENCE_MANIFEST.json is missing; run the governed prepare flow first')

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries') or []
if not isinstance(entries, list) or len(entries) != 32:
    raise SystemExit(f'DR_EVIDENCE_CAPTURE_QUEUE=FAIL: expected 32 formal entries, found {len(entries) if isinstance(entries, list) else "invalid"}')


def first_live(item):
    evidence = item.get('evidence') or []
    return next((e for e in evidence if isinstance(e, dict) and e.get('side') == 'live'), None)


def profile(item):
    live = first_live(item)
    if not live:
        return 'LIVE capture still required first'
    parts = []
    width = live.get('viewport_width') or live.get('pixel_width')
    height = live.get('viewport_height') or live.get('pixel_height')
    if width and height:
        parts.append(f'{width}x{height}')
    if live.get('device_class'):
        parts.append(str(live['device_class']))
    if live.get('orientation'):
        parts.append(str(live['orientation']))
    if live.get('theme'):
        parts.append(str(live['theme']))
    return ', '.join(parts) if parts else 'match the registered LIVE evidence profile'

ready_now = []
needs_live = []
completed = []
for item in entries:
    if not isinstance(item, dict):
        continue
    row = {
        'id': item.get('id'),
        'section': item.get('section'),
        'state': item.get('state'),
        'capture_group': item.get('capture_group'),
        'live': item.get('live_evidence_status'),
        'independent': item.get('independent_evidence_status'),
        'comparison': item.get('comparison_status'),
        'profile': profile(item),
    }
    if row['comparison'] == 'VERIFIED_IDENTICAL':
        completed.append(row)
    elif row['live'] == 'CAPTURED' and row['independent'] != 'CAPTURED':
        ready_now.append(row)
    else:
        needs_live.append(row)

print('DR_EVIDENCE_CAPTURE_QUEUE=PASS')
print(f'Formal states: {len(entries)} | DR captures ready now: {len(ready_now)} | states still needing LIVE evidence first: {len(needs_live)} | verified identical: {len(completed)}')
print('\nPRIORITY 1 — CAPTURE DR NOW (LIVE evidence already exists)')
for index, row in enumerate(ready_now, 1):
    print(f'{index:02d}. {row["id"]} | {row["state"]} | profile: {row["profile"]} | group: {row["capture_group"] or "-"}')

print('\nPRIORITY 2 — LIVE EVIDENCE STILL REQUIRED BEFORE EXACT COMPARISON')
for index, row in enumerate(needs_live, 1):
    print(f'{index:02d}. {row["id"]} | {row["state"]} | LIVE={row["live"]} DR={row["independent"]} | group: {row["capture_group"] or "-"}')

if completed:
    print('\nVERIFIED IDENTICAL')
    for row in completed:
        print(f'- {row["id"]} | {row["state"]}')

print('\nRegistration command template:')
print('python3 scripts/register-fire-dr-independent-evidence.py --entry-id <formal-id> --file <screenshot> --notes "Exact DR state captured to match registered LIVE evidence."')
print('Registering DR evidence does not promote comparison_status; deliberate LIVE-vs-DR review remains required.')
