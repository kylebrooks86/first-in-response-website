from pathlib import Path

root = Path('.')
repo_root = Path('..')
matrix = root / 'STRICT_PARITY_MATRIX.md'
queue = root / 'STRICT_RENDERED_PARITY_QUEUE.md'
persistent_matrix = repo_root / 'dr-parity-overlays' / 'STRICT_PARITY_MATRIX.md'
persistent_queue = repo_root / 'dr-parity-overlays' / 'STRICT_RENDERED_PARITY_QUEUE.md'
dashboard = root / 'app/dashboard.tsx'

required = [matrix, queue, persistent_matrix, persistent_queue, dashboard]
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

expected_rows = [
    '| Customer detail profile shell / action row / property tools | FORWARD SYNC APPROVED |',
    '| Edit existing customer | FORWARD SYNC APPROVED |',
]
for row in expected_rows:
    if row not in matrix_text:
        errors.append(f'missing approved forward-sync matrix row: {row}')

forward_sync_rows = [
    line for line in matrix_text.splitlines()
    if '| FORWARD SYNC APPROVED |' in line
]
if len(forward_sync_rows) != 2:
    errors.append(f'expected exactly 2 FORWARD SYNC APPROVED matrix rows, found {len(forward_sync_rows)}')

queue_needles = [
    'Owner-approved customer-profile forward-sync exception:',
    'the current DR customer section is preferred over the older LIVE customer section',
    'Preserve its customer actions, property preview, and Edit customer capability.',
    'LIVE forward-sync acceptance criteria for this customer-profile exception:',
    'Saving keeps the same customer record/ID and does not create a duplicate customer.',
    'Existing estimates, invoices, payments, signed agreements, pricing, and job history are not rewritten.',
    'Newly added phone/email/address immediately enables the applicable Call / Text / Email / Google Maps / Google Earth / Zillow / property-preview actions after save.',
    'Do not remove the two `FORWARD SYNC APPROVED` matrix rows until the upgraded LIVE customer profile is rendered on the same device/profile and deliberately compared against DR.',
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
print('Exactly two owner-approved customer-profile forward-sync states are protected; richer DR customer actions/property tools/Edit customer remain present and LIVE must catch up before FULL_IDENTICAL.')
