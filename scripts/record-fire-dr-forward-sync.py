import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
app_dir = repo_root / 'fire-app-dr'
persistent_registry = repo_root / 'dr-parity-overlays' / 'FORWARD_SYNC_APPROVED.json'
working_registry = app_dir / 'FORWARD_SYNC_APPROVED.json'
persistent_matrix = repo_root / 'dr-parity-overlays' / 'STRICT_PARITY_MATRIX.md'
working_matrix = app_dir / 'STRICT_PARITY_MATRIX.md'

parser = argparse.ArgumentParser(
    description='Deliberately record or reopen one owner-approved DR-to-LIVE forward-sync state.'
)
parser.add_argument('--entry-id', required=True)
parser.add_argument('--result', required=True, choices=['synced', 'reopen'])
parser.add_argument('--notes', required=True)
parser.add_argument('--same-device-render-reviewed', action='store_true')
parser.add_argument('--functional-review-complete', action='store_true')
args = parser.parse_args()

for path in [persistent_registry, working_registry, persistent_matrix, working_matrix]:
    if not path.is_file():
        raise SystemExit(f'DR_FORWARD_SYNC_RECORD=FAIL: missing {path}')

notes = args.notes.strip()
if not notes:
    raise SystemExit('DR_FORWARD_SYNC_RECORD=FAIL: notes must not be blank')

registry = json.loads(persistent_registry.read_text())
if registry.get('schema_version') != 1 or not isinstance(registry.get('entries'), list):
    raise SystemExit('DR_FORWARD_SYNC_RECORD=FAIL: forward-sync registry malformed')

entry = next(
    (
        item for item in registry['entries']
        if isinstance(item, dict) and item.get('id') == args.entry_id
    ),
    None,
)
if entry is None:
    raise SystemExit(f'DR_FORWARD_SYNC_RECORD=FAIL: unknown forward-sync id: {args.entry_id}')

area = str(entry.get('matrix_area') or '').strip()
pending_note = str(entry.get('pending_matrix_note') or '').strip()
synced_note = str(entry.get('synced_matrix_note') or '').strip()
if not area or not pending_note or not synced_note:
    raise SystemExit(
        'DR_FORWARD_SYNC_RECORD=FAIL: registry entry requires matrix_area, '
        'pending_matrix_note, and synced_matrix_note'
    )

current_status = entry.get('status')
now = datetime.now(timezone.utc).isoformat()

if args.result == 'synced':
    if current_status == 'SYNCED_TO_LIVE':
        raise SystemExit(
            f'DR_FORWARD_SYNC_RECORD=FAIL: {args.entry_id} is already SYNCED_TO_LIVE'
        )
    if current_status != 'PENDING_LIVE_SYNC':
        raise SystemExit(
            f'DR_FORWARD_SYNC_RECORD=FAIL: unexpected current status {current_status!r}'
        )
    if not args.same_device_render_reviewed or not args.functional_review_complete:
        raise SystemExit(
            'DR_FORWARD_SYNC_RECORD=FAIL: synced result requires both '
            '--same-device-render-reviewed and --functional-review-complete'
        )
    entry['status'] = 'SYNCED_TO_LIVE'
    entry['synced_at_utc'] = now
    entry['sync_notes'] = notes
    entry['same_device_render_reviewed'] = True
    entry['functional_review_complete'] = True
    matrix_status = 'VERIFIED IDENTICAL'
    matrix_note = synced_note
else:
    if current_status != 'SYNCED_TO_LIVE':
        raise SystemExit(
            f'DR_FORWARD_SYNC_RECORD=FAIL: {args.entry_id} is not currently SYNCED_TO_LIVE'
        )
    entry['status'] = 'PENDING_LIVE_SYNC'
    entry['reopened_at_utc'] = now
    entry['reopen_notes'] = notes
    entry.pop('synced_at_utc', None)
    entry.pop('sync_notes', None)
    entry.pop('same_device_render_reviewed', None)
    entry.pop('functional_review_complete', None)
    matrix_status = 'FORWARD SYNC APPROVED'
    matrix_note = pending_note

new_registry = json.dumps(registry, indent=2) + '\n'
persistent_registry.write_text(new_registry)
working_registry.write_text(new_registry)

matrix = persistent_matrix.read_text()
lines = matrix.splitlines()
prefix = f'| {area} |'
matches = [i for i, line in enumerate(lines) if line.startswith(prefix)]
if len(matches) != 1:
    raise SystemExit(
        f'DR_FORWARD_SYNC_RECORD=FAIL: expected exactly one matrix row for {area!r}, '
        f'found {len(matches)}'
    )
lines[matches[0]] = f'| {area} | {matrix_status} | {matrix_note} |'
new_matrix = '\n'.join(lines) + ('\n' if matrix.endswith('\n') else '')
persistent_matrix.write_text(new_matrix)
working_matrix.write_text(new_matrix)

subprocess.run(
    [sys.executable, '../scripts/verify-fire-dr-forward-sync.py'],
    cwd=app_dir,
    check=True,
)
subprocess.run(
    [sys.executable, '../scripts/apply-fire-dr-parity-summary-sync.py'],
    cwd=app_dir,
    check=True,
)
subprocess.run(
    [sys.executable, '../scripts/verify-fire-dr-parity-ledger-consistency.py'],
    cwd=app_dir,
    check=True,
)
subprocess.run(
    [sys.executable, '../scripts/verify-fire-dr-release-readiness.py'],
    cwd=app_dir,
    check=True,
)

print('DR_FORWARD_SYNC_RECORD=PASS')
print(f'{args.entry_id}: {entry["status"]}')
print(
    'Forward-sync registry and strict matrix were updated together; '
    'governance, parity summaries, ledger consistency, and release readiness passed.'
)
