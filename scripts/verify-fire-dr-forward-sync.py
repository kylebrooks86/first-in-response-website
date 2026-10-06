import json
import re
from pathlib import Path

root = Path('.')
repo_root = Path('..')
matrix = root / 'STRICT_PARITY_MATRIX.md'
queue = root / 'STRICT_RENDERED_PARITY_QUEUE.md'
persistent_matrix = repo_root / 'dr-parity-overlays' / 'STRICT_PARITY_MATRIX.md'
persistent_queue = repo_root / 'dr-parity-overlays' / 'STRICT_RENDERED_PARITY_QUEUE.md'
dashboard = root / 'app/dashboard.tsx'
registry = root / 'FORWARD_SYNC_APPROVED.json'
persistent_registry = repo_root / 'dr-parity-overlays' / 'FORWARD_SYNC_APPROVED.json'

required = [matrix, queue, persistent_matrix, persistent_queue, dashboard, registry, persistent_registry]
missing = [str(p) for p in required if not p.is_file()]
if missing:
    print('DR_FORWARD_SYNC_GUARD=FAIL')
    for item in missing:
        print(f'- missing required forward-sync input: {item}')
    raise SystemExit(1)

errors = []
matrix_text = matrix.read_text()
queue_text = queue.read_text()
persistent_matrix_text = persistent_matrix.read_text()
persistent_queue_text = persistent_queue.read_text()
dashboard_text = dashboard.read_text()

if matrix_text != persistent_matrix_text:
    errors.append('STRICT_PARITY_MATRIX.md working copy drifted from persistent overlay')
if queue_text != persistent_queue_text:
    errors.append('STRICT_RENDERED_PARITY_QUEUE.md working copy drifted from persistent overlay')

registry_text = registry.read_text()
persistent_registry_text = persistent_registry.read_text()
if registry_text != persistent_registry_text:
    errors.append('FORWARD_SYNC_APPROVED.json working copy drifted from persistent overlay')

try:
    registry_data = json.loads(registry_text)
except Exception as exc:
    registry_data = {}
    errors.append(f'FORWARD_SYNC_APPROVED.json is invalid JSON: {exc}')

entries = registry_data.get('entries') if isinstance(registry_data, dict) else None
if registry_data.get('schema_version') != 1:
    errors.append('FORWARD_SYNC_APPROVED.json schema_version must be 1')
if not isinstance(entries, list):
    entries = []
    errors.append('FORWARD_SYNC_APPROVED.json entries must be an array')

ids = []
expected_rows = []
for item in entries:
    if not isinstance(item, dict):
        errors.append('forward-sync registry contains a non-object entry')
        continue
    entry_id = str(item.get('id') or '').strip()
    if not entry_id:
        errors.append('forward-sync registry contains a blank id')
        continue
    ids.append(entry_id)
    if item.get('status') not in {'PENDING_LIVE_SYNC','SYNCED_TO_LIVE'}:
        errors.append(f'{entry_id}: invalid forward-sync status {item.get("status")!r}')
    if item.get('preserve_in_dr') is not True:
        errors.append(f'{entry_id}: preserve_in_dr must remain true')
    if item.get('blocks_full_identical') is not True:
        errors.append(f'{entry_id}: blocks_full_identical must remain true')
    area = str(item.get('matrix_area') or '').strip()
    pending_note = str(item.get('pending_matrix_note') or '').strip()
    synced_note = str(item.get('synced_matrix_note') or '').strip()
    if not area:
        errors.append(f'{entry_id}: matrix_area is required')
    if not pending_note:
        errors.append(f'{entry_id}: pending_matrix_note is required')
    if not synced_note:
        errors.append(f'{entry_id}: synced_matrix_note is required')
    if item.get('status') == 'SYNCED_TO_LIVE':
        if item.get('same_device_render_reviewed') is not True:
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires same_device_render_reviewed=true')
        if item.get('functional_review_complete') is not True:
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires functional_review_complete=true')
        if not str(item.get('synced_at_utc') or '').strip():
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires synced_at_utc')
        if not str(item.get('sync_notes') or '').strip():
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires sync_notes')
        live_sha = str(item.get('live_screenshot_sha256') or '').strip().lower()
        dr_sha = str(item.get('dr_screenshot_sha256') or '').strip().lower()
        if not re.fullmatch(r'[0-9a-f]{64}', live_sha):
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires valid live_screenshot_sha256')
        if not re.fullmatch(r'[0-9a-f]{64}', dr_sha):
            errors.append(f'{entry_id}: SYNCED_TO_LIVE requires valid dr_screenshot_sha256')
    history = item.get('sync_history')
    if history is not None and not isinstance(history, list):
        errors.append(f'{entry_id}: sync_history must be an array when present')
    if isinstance(history, list):
        for idx, event in enumerate(history):
            if not isinstance(event, dict):
                errors.append(f'{entry_id}: sync_history[{idx}] must be an object')
                continue
            if event.get('event') not in {'SYNCED_TO_LIVE','REOPENED'}:
                errors.append(f'{entry_id}: sync_history[{idx}] has invalid event {event.get("event")!r}')
            if not str(event.get('at_utc') or '').strip():
                errors.append(f'{entry_id}: sync_history[{idx}] requires at_utc')
            if not str(event.get('notes') or '').strip():
                errors.append(f'{entry_id}: sync_history[{idx}] requires notes')
            if event.get('event') == 'SYNCED_TO_LIVE':
                if event.get('same_device_render_reviewed') is not True or event.get('functional_review_complete') is not True:
                    errors.append(f'{entry_id}: sync_history[{idx}] synced event requires both review flags')
                for key in ['live_screenshot_sha256','dr_screenshot_sha256']:
                    if not re.fullmatch(r'[0-9a-f]{64}', str(event.get(key) or '').strip().lower()):
                        errors.append(f'{entry_id}: sync_history[{idx}] synced event requires valid {key}')
    if area and pending_note and synced_note:
        expected_rows.append((entry_id, area, item.get('status'), pending_note, synced_note))

if len(ids) != len(set(ids)):
    errors.append('forward-sync registry contains duplicate ids')

pending_registry = [row for row in expected_rows if row[2] == 'PENDING_LIVE_SYNC']
matrix_pending_rows = [line for line in matrix_text.splitlines() if '| FORWARD SYNC APPROVED |' in line]
if len(matrix_pending_rows) != len(pending_registry):
    errors.append(f'matrix has {len(matrix_pending_rows)} FORWARD SYNC APPROVED rows but registry has {len(pending_registry)} pending LIVE sync entries')
for entry_id, area, status, pending_note, synced_note in expected_rows:
    expected_status = 'FORWARD SYNC APPROVED' if status == 'PENDING_LIVE_SYNC' else 'VERIFIED IDENTICAL'
    expected_note = pending_note if status == 'PENDING_LIVE_SYNC' else synced_note
    row = f'| {area} | {expected_status} | {expected_note} |'
    if row not in matrix_text:
        errors.append(f'{entry_id}: exact matrix row does not match registry status/note: {row}')

queue_needles = [
    'Owner-approved customer-profile forward-sync exception:',
    'the current DR customer section is preferred over the older LIVE customer section',
    'Preserve its customer actions, property preview, and Edit customer capability.',
    'LIVE forward-sync acceptance criteria for this customer-profile exception:',
    'Saving keeps the same customer record/ID and does not create a duplicate customer.',
    'Existing estimates, invoices, payments, signed agreements, pricing, and job history are not rewritten.',
    'Newly added phone/email/address immediately enables the applicable Call / Text / Email / Google Maps / Google Earth / Zillow / property-preview actions after save.',
    'Do not clear any `FORWARD SYNC APPROVED` matrix row until its matching `FORWARD_SYNC_APPROVED.json` entry is deliberately marked `SYNCED_TO_LIVE` after same-device rendered and functional review.',
    'Owner-approved payment forward-sync addition (2026-10-06):',
    'No tip must remain selected by default, with 5% / 10% / 15% / Custom choices.',
    'Deposits must never offer a tip.',
    'Tip and Tip Refund entries must remain separate from invoice-paid/balance calculations.',
    'A Stripe Tip can be refunded as a Tip Refund without reopening an invoice balance.',
    'Do not clear the tipping `FORWARD SYNC APPROVED` state until LIVE and DR are deliberately reviewed on the same device/profile.',
    'do not qualify as `VERIFIED_IDENTICAL` until LIVE is intentionally upgraded to match them',
]
for needle in queue_needles:
    if needle not in queue_text:
        errors.append(f'missing forward-sync queue policy: {needle}')

source_needles = [
    'function EditCustomer(',
    'Edit customer',
    '<Phone />Call</a>',
    '<Send />Text</a>',
    '<Mail />Email</a>',
    '>Google Maps</a>',
    '<StrideButton />',
    '<Globe2 />Google Earth</a>',
    '<House />Zillow</a>',
    '<PropertyPreview address={selected.address} />',
]
for needle in source_needles:
    if needle not in dashboard_text:
        errors.append(f'approved DR customer-profile feature missing from source: {needle}')

if errors:
    print('DR_FORWARD_SYNC_GUARD=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_FORWARD_SYNC_GUARD=PASS')
pending_count=sum(1 for item in entries if isinstance(item,dict) and item.get('status')=='PENDING_LIVE_SYNC')
print(f'{pending_count} owner-approved forward-sync state(s) are protected by the structured registry; DR preserves them and LIVE must catch up before FULL_IDENTICAL.')
