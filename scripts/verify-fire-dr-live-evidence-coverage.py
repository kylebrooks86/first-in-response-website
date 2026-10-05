import json
import subprocess
import sys
from pathlib import Path

manifest_path = Path('PARITY_EVIDENCE_MANIFEST.json')
if not manifest_path.exists():
    raise SystemExit('PARITY_EVIDENCE_MANIFEST.json not found')

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries', [])

# Every formal state that already has LIVE evidence must be intentionally mapped
# to a source/evidence protection area. This does not claim rendered identity;
# it prevents a newly captured LIVE state from being forgotten by the DR parity
# work and makes the build stop until coverage is updated.
covered = {
    'owner-app-customer-payments-tab': 'core LIVE guard: exact customer Payments empty state and payment-method wording',
    'owner-app-customer-invoices-tab': 'core LIVE guard: exact customer Invoices empty state and create-invoice wording',
    'owner-app-customer-photos-tab': 'core LIVE guard: Photos controls and no-photo empty state',
    'owner-app-50-deposit-scheduling-rule': 'core LIVE guard: scheduling without hard deposit gate plus next-step wording',
    'owner-app-before-after-photos-workflow': 'core LIVE guard: Before/After/Property photo workflow controls',
    'owner-app-empty-error-states-across-all-owner-routes': 'owner/customer guards: captured empty/error states remain protected while broader visual coverage stays pending',
    'customer-facing-ap-customer-approval-signature-flow': 'customer guard + evidence overlay: approved signer-name confirmation and approval flow',
    'customer-facing-ap-customer-invoice-view': 'customer/core guards: invoice structure, balance, due state, manual payment instructions, Back/Home',
    'shared-business-be-service-catalog-pricing-rules': 'service-catalog guard: exact captured service option order',
    'shared-business-be-50-deposit-requirement': 'core LIVE guard: 50% deposit remains displayed/collectible but is not a scheduling gate',
    'shared-business-be-completion-before-final-balance-workflow': 'core LIVE guard: Completed -> Create invoice -> Invoice created / Send invoice transition',
}

captured = {
    str(entry.get('id'))
    for entry in entries
    if isinstance(entry, dict) and entry.get('live_evidence_status') == 'CAPTURED'
}

errors = []
missing_coverage = sorted(captured - set(covered))
stale_coverage = sorted(set(covered) - captured)
if missing_coverage:
    errors.append('LIVE-captured formal states missing guard coverage: ' + ', '.join(missing_coverage))
if stale_coverage:
    errors.append('Coverage map claims LIVE capture that the manifest does not: ' + ', '.join(stale_coverage))

for entry in entries:
    if not isinstance(entry, dict) or entry.get('live_evidence_status') != 'CAPTURED':
        continue
    entry_id = str(entry.get('id'))
    evidence = [item for item in entry.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live']
    if not evidence:
        errors.append(f'{entry_id}: CAPTURED but no LIVE evidence object exists')
        continue
    for item in evidence:
        if not item.get('file'):
            errors.append(f'{entry_id}: LIVE evidence missing file path')
        if not item.get('sha256'):
            errors.append(f'{entry_id}: LIVE evidence missing sha256')
        if not item.get('notes'):
            errors.append(f'{entry_id}: LIVE evidence missing notes')

if len(captured) != 11:
    errors.append(f'Expected current formal LIVE capture count 11, found {len(captured)}. Update the evidence-coverage guard intentionally when new LIVE evidence is registered.')

if errors:
    print('DR_LIVE_EVIDENCE_COVERAGE=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

# Recovery/lifecycle/payment integrity milestones are not all rendered states,
# but they are required DR behavior. Run dedicated subguards so every normal
# build protects them in addition to the formal LIVE-evidence mapping.
for guard_name in [
    'verify-fire-dr-restore-identity.py',
    'verify-fire-dr-lifecycle-v134.py',
    'verify-fire-dr-restore-v135-v138.py',
    'verify-fire-dr-refund-stripe-workflows.py',
]:
    guard = Path(__file__).with_name(guard_name)
    subprocess.run([sys.executable, str(guard)], check=True)

print('DR_LIVE_EVIDENCE_COVERAGE=PASS')
print(f'All {len(captured)} currently LIVE-captured formal states are explicitly mapped to DR parity protection.')
for entry_id in sorted(captured):
    print(f'- {entry_id}: {covered[entry_id]}')
print('Restore identity/relationship safety, v134 lifecycle-race integrity, v135-v138 restore/recovery invariants, and refund/Stripe payment safety also passed their dedicated subguards.')
print('This is coverage/accountability only; independent rendered evidence is still required before VERIFIED_IDENTICAL.')
