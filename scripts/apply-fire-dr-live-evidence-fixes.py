from pathlib import Path
import subprocess
import sys

# Small DR-only visual/content parity overlays backed by stored LIVE evidence or
# governed cumulative LIVE behavior. The sealed v138 archive remains immutable;
# these changes are applied after extraction by the independent staging script.

accept_path = Path('app/estimate/[token]/accept-button.tsx')
if not accept_path.exists():
    raise SystemExit('app/estimate/[token]/accept-button.tsx not found')

text = accept_path.read_text()
old = 'if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed. Kyle will contact you to schedule.</div>;'
new = 'if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed{signedName?` by ${signedName}`:""}. Kyle will contact you to schedule.</div>;'

if new not in text:
    if old not in text:
        raise SystemExit('Expected approved-estimate confirmation source was not found; refusing to guess.')
    text = text.replace(old, new, 1)
    accept_path.write_text(text)

# v107/v112 governed customer billing behavior: unresolved overpayment or a
# pending refund must hide customer payment actions. The sealed v138 payment
# page omitted pending-refund state and allowed canPay to win before the review
# message, so patch that narrowly after extraction.
pay_path = Path('app/pay/[id]/page.tsx')
if not pay_path.exists():
    raise SystemExit('app/pay/[id]/page.tsx not found')
pay = pay_path.read_text()

replacements = [
    (
        "           COALESCE((SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL),0) AS paymentOverageOpen\n",
        "           COALESCE((SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL),0) AS paymentOverageOpen,\n           COALESCE((SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending'),0) AS pendingRefundCount\n",
    ),
    (
        "acceptedAt:string|null; paidCents:number; paymentOverageOpen:number; customer:string; address:string|null }>();",
        "acceptedAt:string|null; paidCents:number; paymentOverageOpen:number; pendingRefundCount:number; customer:string; address:string|null }>();",
    ),
    (
        "const paymentReviewPending = Number(row.paymentOverageOpen??0)>0;",
        "const paymentReviewPending = Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;",
    ),
    (
        "const canPay = dueNow>0&&approved&&(paymentType===\"deposit\"||row.status===\"completed\");",
        "const canPay = dueNow>0&&approved&&!paymentReviewPending&&(paymentType===\"deposit\"||row.status===\"completed\");",
    ),
    (
        "{canPay?<PayButton shareToken={shareToken} paymentType={paymentType} label={paymentType===\"deposit\"?`Pay ${currency(dueNow)} deposit securely`:`Pay ${currency(dueNow)} remaining balance securely`}/>:paymentReviewPending?<p className=\"pay-note\">Payment received — account review in progress.</p>:balance===0?<p className=\"pay-note\">This job is paid in full.</p>",
        "{canPay?<PayButton shareToken={shareToken} paymentType={paymentType} label={paymentType===\"deposit\"?`Pay ${currency(dueNow)} deposit securely`:`Pay ${currency(dueNow)} remaining balance securely`}/>:Number(row.pendingRefundCount??0)>0?<p className=\"pay-note\">Refund processing.</p>:Number(row.paymentOverageOpen??0)>0?<p className=\"pay-note\">Payment received — account review in progress.</p>:balance===0?<p className=\"pay-note\">This job is paid in full.</p>",
    ),
]

for old_fragment, new_fragment in replacements:
    if new_fragment in pay:
        continue
    if old_fragment not in pay:
        raise SystemExit(f'Expected customer-payment source fragment was not found; refusing to guess: {old_fragment[:90]}')
    pay = pay.replace(old_fragment, new_fragment, 1)

pay_path.write_text(pay)

# The sealed v138 CLI restore script predates one final audit-field spelling that
# the v135-v138 recovery guard intentionally requires. Keep the immutable archive
# sealed and restore that invariant only in the extracted DR working tree.
restore_path = Path('scripts/restore-records-backup.mjs')
if not restore_path.exists():
    raise SystemExit('scripts/restore-records-backup.mjs not found')
restore = restore_path.read_text()
restore_needle = 'lifecycleNotificationUniquenessVerified: true'
if restore_needle not in restore:
    anchor = 'fieldValuesVerified: true'
    if anchor not in restore:
        raise SystemExit('Expected restore-audit field anchor was not found; refusing to guess.')
    restore = restore.replace(anchor, restore_needle + ',' + anchor, 1)
    restore_path.write_text(restore)

# Customer records must remain editable after creation. Apply the governed edit
# overlay here so the capability survives every sealed-v138 extraction.
subprocess.run([sys.executable, '../scripts/apply-fire-dr-customer-edit-flow.py'], check=True)

# STRICT_PARITY_MATRIX.md is governance/evidence-routing state, not sealed app
# source. Restore its canonical copy after every sealed extraction so corrections
# to the capture queue are not silently reverted by a rebuild.
matrix_overlay = Path('../dr-parity-overlays/STRICT_PARITY_MATRIX.md')
matrix_working = Path('STRICT_PARITY_MATRIX.md')
if not matrix_overlay.exists():
    raise SystemExit('Persistent strict parity matrix overlay is missing.')
matrix_working.write_text(matrix_overlay.read_text())

print('DR_LIVE_EVIDENCE_FIXES_APPLIED')
print('Approved estimate confirmation retains signer name; customer payment actions are suppressed during unresolved overpayment or pending refund review; customer profiles remain editable after creation; v138 CLI restore audit retains lifecycle uniqueness verification; strict parity matrix restored from persistent overlay.')
