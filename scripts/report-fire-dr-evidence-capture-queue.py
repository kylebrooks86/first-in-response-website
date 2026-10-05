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


def first_independent(item):
    evidence = item.get('evidence') or []
    return next((e for e in evidence if isinstance(e, dict) and e.get('side') == 'independent'), None)


def profile(item):
    live = first_live(item)
    if not live:
        return 'LIVE capture still required first'
    parts = []
    width = live.get('viewport_width') or live.get('pixel_width')
    height = live.get('viewport_height') or live.get('pixel_height')
    if width and height: parts.append(f'{width}x{height}')
    if live.get('device_class'): parts.append(str(live['device_class']))
    if live.get('orientation'): parts.append(str(live['orientation']))
    if live.get('theme'): parts.append(str(live['theme']))
    return ', '.join(parts) if parts else 'match the registered LIVE evidence profile'

capture_dr = []
review_pair = []
mismatches = []
needs_live = []
completed = []
other = []

for item in entries:
    if not isinstance(item, dict):
        continue
    independent_evidence = first_independent(item)
    row = {
        'id': item.get('id'),
        'section': item.get('section'),
        'state': item.get('state'),
        'capture_group': item.get('capture_group'),
        'live': item.get('live_evidence_status'),
        'independent': item.get('independent_evidence_status'),
        'comparison': item.get('comparison_status'),
        'profile': profile(item),
        'profile_match': independent_evidence.get('profile_matches_registered_live') if independent_evidence else None,
    }
    if row['comparison'] == 'VERIFIED_IDENTICAL':
        completed.append(row)
    elif row['comparison'] in {'MISMATCH', 'MISMATCHED'}:
        mismatches.append(row)
    elif row['live'] == 'CAPTURED' and row['independent'] == 'CAPTURED':
        review_pair.append(row)
    elif row['live'] == 'CAPTURED' and row['independent'] != 'CAPTURED':
        capture_dr.append(row)
    elif row['live'] != 'CAPTURED':
        needs_live.append(row)
    else:
        other.append(row)

print('DR_EVIDENCE_CAPTURE_QUEUE=PASS')
print(
    f'Formal states: {len(entries)} | capture DR now: {len(capture_dr)} | review captured pair: {len(review_pair)} | '
    f'mismatches: {len(mismatches)} | LIVE evidence still needed: {len(needs_live)} | verified identical: {len(completed)}'
)

print('\nPRIORITY 1 — CAPTURE DR NOW (LIVE evidence already exists)')
if capture_dr:
    for index, row in enumerate(capture_dr, 1):
        print(f'{index:02d}. {row["id"]} | {row["state"]} | profile: {row["profile"]} | group: {row["capture_group"] or "-"}')
else:
    print('- none')

print('\nPRIORITY 2 — REVIEW REGISTERED LIVE/DR PAIRS')
if review_pair:
    for index, row in enumerate(review_pair, 1):
        profile_state = 'profile-match' if row['profile_match'] is True else 'PROFILE-MISMATCH' if row['profile_match'] is False else 'profile-unknown'
        print(f'{index:02d}. {row["id"]} | {row["state"]} | {profile_state} | comparison={row["comparison"]}')
else:
    print('- none')

print('\nPRIORITY 3 — FIX / RECAPTURE MISMATCHES')
if mismatches:
    for index, row in enumerate(mismatches, 1):
        print(f'{index:02d}. {row["id"]} | {row["state"]} | comparison={row["comparison"]} | profile: {row["profile"]}')
else:
    print('- none')

print('\nPRIORITY 4 — LIVE EVIDENCE STILL REQUIRED BEFORE EXACT COMPARISON')
if needs_live:
    for index, row in enumerate(needs_live, 1):
        print(f'{index:02d}. {row["id"]} | {row["state"]} | LIVE={row["live"]} DR={row["independent"]} | group: {row["capture_group"] or "-"}')
else:
    print('- none')

if other:
    print('\nUNCLASSIFIED / GOVERNANCE REVIEW')
    for row in other:
        print(f'- {row["id"]} | LIVE={row["live"]} DR={row["independent"]} comparison={row["comparison"]}')

if completed:
    print('\nVERIFIED IDENTICAL')
    for row in completed:
        print(f'- {row["id"]} | {row["state"]}')

print('\nRegistration command template:')
print('python3 scripts/register-fire-dr-independent-evidence.py --entry-id <formal-id> --file <screenshot> --notes "Exact DR state captured to match registered LIVE evidence."')
print('\nIdentical comparison command template:')
print('python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result identical --notes "Exact registered LIVE and DR pair reviewed." --visual-review-complete --functional-review-complete')
print('\nMismatch command template:')
print('python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result mismatch --notes "Describe the exact rendered or functional difference."')
print('Evidence registration never promotes comparison_status; deliberate review remains required.')
