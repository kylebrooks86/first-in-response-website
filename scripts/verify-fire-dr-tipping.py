from pathlib import Path
import json
import re

root=Path('.')
files={
    'button':root/'app/pay/[id]/pay-button.tsx',
    'checkout':root/'app/api/payments/checkout/route.ts',
    'webhook':root/'app/api/payments/webhook/route.ts',
    'refund':root/'app/api/payments/refund/route.ts',
    'estimate':root/'app/estimate/[token]/page.tsx',
    'invoice':root/'app/invoice/[token]/page.tsx',
    'pay':root/'app/pay/[id]/page.tsx',
    'payments':root/'app/api/payments/route.ts',
    'notifications':root/'app/api/notifications/route.ts',
    'customers':root/'app/api/customers/route.ts',
    'dashboard':root/'app/api/dashboard-summary/route.ts',
    'owner_dashboard':root/'app/dashboard.tsx',
    'forward_sync':root/'FORWARD_SYNC_APPROVED.json',
    'runbook':root/'INDEPENDENT_DEPLOYMENT.md',
    'estimates':root/'app/api/estimates/route.ts',
    'estimate_id':root/'app/api/estimates/[id]/route.ts',
    'invoices':root/'app/api/invoices/route.ts',
    'invoice_id':root/'app/api/invoices/[id]/route.ts',
}
errors=[]
for name,path in files.items():
    if not path.is_file(): errors.append(f'missing tipping target: {path}')
if errors:
    print('DR_TIPPING_GUARD=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)

text={name:path.read_text() for name,path in files.items()}

for needle in [
    'const TIP_PRESETS = [0,5,10,15] as const;',
    'useState<"0"|"5"|"10"|"15"|"custom">("0")',
    'No tip is selected by default.',
    'Add an optional tip',
    '>Custom</button>',
    'paymentType === "balance"',
    'dueAmountCents',
    'tipBaseCents',
    'return Math.round(Number(tipBaseCents) * Number(tipChoice) / 100);',
    'const totalCents = Number(dueAmountCents ?? 0) + tipCents;',
    'Percentage tips are based on the full invoice total.',
    'Tip cannot exceed the invoice total or $500.',
    'tipCents: allowTip ? tipCents : 0',
    'type="number" min="0" step="0.01" placeholder="$0.00"',
]:
    if needle not in text['button']: errors.append(f'pay button missing tip invariant: {needle}')
preset_match=re.search(r'const TIP_PRESETS\s*=\s*\[([^\]]+)\]',text['button'])
if not preset_match:
    errors.append('tip preset declaration could not be parsed')
elif '20' in preset_match.group(1):
    errors.append('20% must not be a default tip preset')
if 'useState<"0"|"5"|"10"|"15"|"custom">("0")' not in text['button']:
    errors.append('No tip must remain the default selection')

for needle in [
    'Tips are available only with the final balance payment.',
    'const maxTipCents = Math.min(totalCents, 50000);',
    'Tip cannot exceed the invoice total or $500.',
    'form.set("metadata[tip_amount_cents]", String(tipCents));',
    'form.set("metadata[expected_charge_cents]", String(chargeAmount));',
    'form.set("line_items[1][price_data][product_data][name]", "Optional tip");',
    ".bind(data.id,row.id,paymentType,chargeAmount,new Date().toISOString()).run();",
]:
    if needle not in text['checkout']: errors.append(f'checkout missing tip invariant: {needle}')

for name in ['webhook','estimate']:
    for needle in [
        "expectedAmount+tipCents!==sessionAmount",
        "paymentType!==\"balance\"&&tipCents>0",
        'const maxTipCents=Math.min(Number(estimate.totalCents),50000);',
        'tip_outside_allowed_range',
        "'Tip',?,'paid'",
        'tip_ledger_verification_failed',
        'Number(tipRow.amountCents)!==tipCents',
        "type NOT IN ('Tip','Tip Refund')",
        '"tip_received"',
    ]:
        if needle not in text[name]: errors.append(f'{name} missing tip accounting invariant: {needle}')

for needle in [
    'CASE WHEN ?=\'Tip\' THEN \'Tip Refund\' ELSE \'Refund\' END',
    '["deposit","balance","Tip"].includes(payment.type)',
    '.replace(/:tip$/,"")',
    "type NOT IN ('Tip','Tip Refund')",
]:
    if needle not in text['refund']: errors.append(f'refund route missing tip invariant: {needle}')

for name in ['invoice','pay','dashboard','estimates','estimate_id','invoices','invoice_id','customers','notifications']:
    if "type NOT IN ('Tip','Tip Refund')" not in text[name] and "p.type NOT IN ('Tip','Tip Refund')" not in text[name]:
        errors.append(f'{name} does not exclude tips from at least one billing paid-total query')

if 'dueAmountCents={balance} tipBaseCents={totalCents}' not in text['invoice']:
    errors.append('invoice page must pass remaining balance separately from full invoice tip base')
if 'dueAmountCents={paymentType==="balance"?dueNow:undefined} tipBaseCents={paymentType==="balance"?row.totalCents:undefined}' not in text['pay']:
    errors.append('payment page must pass remaining balance separately from full invoice tip base')
if 'dueAmountCents={balance} tipBaseCents={billingTotalCents}' not in text['estimate']:
    errors.append('estimate page must pass remaining balance separately from full billing-total tip base')


for needle in [
    'Tip received (optional)',
    'Recorded separately and does not change the invoice balance.',
    '?"Record tip":"Deposit recorded"',
    'body:JSON.stringify({estimateId:estimate.id,amountCents,tipCents,method,reference})',
]:
    if needle not in text['owner_dashboard']:
        errors.append(f'owner Record payment/tip UI missing invariant: {needle}')

for needle in [
    'const tipCents = Math.round(Number(body.tipCents) || 0);',
    'Tips can be recorded only after the job is completed.',
    'This job is already paid in full. Record the tip by itself instead.',
    'Put any extra amount in Tip received instead.',
    'VALUES (?,?, \'Tip\',?,\'paid\',?,?)',
    '"tip_received"',
    'const results=await env.DB.batch([',
    "WHERE EXISTS (SELECT 1 FROM payments WHERE id=? AND estimate_id=? AND status='paid')",
    'if(!results[1]?.meta.changes)return Response.json({ error:"The invoice payment was not paired with its tip record.',
]:
    if needle not in text['payments']:
        errors.append(f'manual payment API missing tip invariant: {needle}')

for name in ['payments','customers']:
    if "p.type IN ('deposit','balance','Tip')" not in text[name]:
        errors.append(f'{name} does not identify Stripe Tip rows as refundable Stripe payments')

if '{payment.type} · {payment.service||"Service"}' not in text['owner_dashboard']:
    errors.append('Payment History must preserve Tip / Tip Refund labels instead of collapsing all negative rows to generic Refund')

try:
    registry=json.loads(text['forward_sync'])
except Exception as exc:
    registry={}
    errors.append(f'forward-sync registry is invalid JSON: {exc}')
tip_entry=next((item for item in registry.get('entries',[]) if isinstance(item,dict) and item.get('id')=='optional-final-payment-tipping'),None)
if not tip_entry:
    errors.append('optional-final-payment-tipping is missing from FORWARD_SYNC_APPROVED.json')
else:
    if tip_entry.get('preserve_in_dr') is not True or tip_entry.get('blocks_full_identical') is not True:
        errors.append('optional-final-payment-tipping must remain preserved in DR and block FULL_IDENTICAL until LIVE sync')
    protected=set(tip_entry.get('protected_behavior') or [])
    for required_behavior in ['No tip selected by default','5% preset','10% preset','15% preset','Custom tip','Tips only on final balance payments','Percentage presets are based on the full invoice total','Stripe card charge equals remaining balance plus tip','Tip stored separately from invoice payment','Tip and Tip Refund excluded from invoice paid/balance math']:
        if required_behavior not in protected:
            errors.append(f'forward-sync tipping registry missing protected behavior: {required_behavior}')

for needle in [
    'Optional tipping is intentionally available only on the final balance card payment',
    'No tip is selected by default',
    '5% / 10% / 15% / Custom',
    'Percentage presets are calculated from the full invoice total',
    'Stripe card charge is only the remaining balance plus the selected tip',
    'Tip / Tip Refund separately',
    'tipping remains a `PENDING_LIVE_SYNC` forward-sync blocker',
]:
    if needle not in text['runbook']:
        errors.append(f'runbook missing tipping rule: {needle}')

# Arithmetic/accounting contract examples. These deliberately mirror the source rules:
# invoice-paid cents are base/refund rows only; Tip/Tip Refund are non-billing ledger rows.
def billing_paid(rows):
    return sum(amount for payment_type, amount in rows if payment_type not in {'Tip','Tip Refund'})

stripe_final=[('balance',15000),('Tip',1500)]
if billing_paid(stripe_final)!=15000 or sum(amount for _,amount in stripe_final)!=16500:
    errors.append('accounting invariant failed: Stripe final balance + 10% tip must charge 16500 while invoice paid remains 15000')

manual_final=[('Venmo',15000),('Tip',750)]
if billing_paid(manual_final)!=15000 or sum(amount for _,amount in manual_final)!=15750:
    errors.append('accounting invariant failed: manual Venmo payment + tip must keep invoice paid separate')

tip_refunded=[('balance',15000),('Tip',1500),('Tip Refund',-1500)]
if billing_paid(tip_refunded)!=15000 or sum(amount for _,amount in tip_refunded)!=15000:
    errors.append('accounting invariant failed: Tip Refund must leave invoice paid at 15000')

invoice_refunded=[('balance',15000),('Tip',1500),('Refund',-5000)]
if billing_paid(invoice_refunded)!=10000:
    errors.append('accounting invariant failed: normal invoice Refund must still reduce invoice paid cents')

# Any invoice/balance SUM over payments that lacks the Tip exclusion is suspect.
billing_files=['dashboard','estimates','estimate_id','invoices','invoice_id','invoice','pay','estimate','customers','checkout','webhook','refund','payments','notifications']
for name in billing_files:
    for line_no,line in enumerate(text[name].splitlines(),1):
        if 'SUM(' in line and 'payments' in line and "status='paid'" in line:
            if "type NOT IN ('Tip','Tip Refund')" not in line and "p.type NOT IN ('Tip','Tip Refund')" not in line:
                # Refund reservation SUMs are over payment_refunds, not invoice-paid totals.
                errors.append(f'{name}:{line_no} paid payment SUM does not exclude Tip/Tip Refund')

if errors:
    print('DR_TIPPING_GUARD=FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('DR_TIPPING_GUARD=PASS')
print('Optional tipping is governed end-to-end: No tip default; 5/10/15/Custom final-card presets calculated from the full invoice total; card charge remains remaining balance plus tip; deposits cannot tip; manual Venmo/Cash App tips can be logged separately/tip-only; Tip/Tip Refund never change invoice math or overpayment reconciliation; Payment History labels, arithmetic separation, and LIVE forward-sync/runbook policy are protected.')
