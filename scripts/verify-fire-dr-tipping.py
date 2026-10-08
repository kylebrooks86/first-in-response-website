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

if text['estimate'].count('const refreshedPaid=') != 1:
    errors.append('customer estimate payment success flow must declare refreshedPaid exactly once')
if "AND type NOT IN ('Tip','Tip Refund') AND type NOT IN ('Tip','Tip Refund')" in text['estimate']:
    errors.append('customer estimate paid-total query must not duplicate the Tip/Tip Refund exclusion')


for needle in [
    'const TIP_PRESETS = [0,5,10,15] as const;',
    'useState<"0"|"5"|"10"|"15"|"custom">("0")',
    'No tip is selected by default.',
    'Add an optional tip',
    '<span className="text-sm font-bold">Custom</span>',
    'paymentType === "balance"',
    'dueAmountCents',
    'tipBaseCents',
    'return Math.round(Number(tipBaseCents) * Number(tipChoice) / 100);',
    'const totalCents = Number(dueAmountCents ?? 0) + tipCents;',
    'grid grid-cols-2 gap-2 sm:grid-cols-5',
    'aria-pressed={tipChoice===String(percent)}',
    'aria-pressed={tipChoice==="custom"}',
    'currency(Math.round(Number(tipBaseCents)*percent/100))',
    'Percentages are based on the full invoice total.',
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

for needle in [
    "expectedAmount+tipCents!==sessionAmount",
    'const maxTipCents=Math.min(Number(estimate.totalCents),50000);',
    'tip_outside_allowed_range',
    "'Tip',?,'paid'",
    'tip_ledger_verification_failed',
    'payment_ledger_verification_failed',
    'Number(tipRow.amountCents)!==tipCents',
    'Number(prior.amountCents)!==expectedAmount',
    'Number(raced.amountCents)!==expectedAmount',
    "type NOT IN ('Tip','Tip Refund')",
    "tip_received",
]:
    if needle not in text['webhook']: errors.append(f'webhook missing tip accounting invariant: {needle}')

if not re.search(r'paymentType\s*!==\s*"balance"\s*&&\s*tipCents\s*>\s*0', text['webhook']):
    errors.append('webhook tip-on-balance guard could not be parsed')
if not re.search(r'["\']tip_received["\']', text['webhook']):
    errors.append('webhook tip notification type is missing')

for needle in [
    "expectedAmount+tipCents!==sessionAmount",
    "paymentType!==\"balance\"&&tipCents>0",
    'const maxTipCents=Math.min(Number(estimate.totalCents),50000);',
    "'Tip',?,'paid'",
    'Number(tipRow.amountCents)!==tipCents',
    'Number(prior.amountCents)!==expectedAmount',
    'Number(raced.amountCents)!==expectedAmount',
    "type NOT IN ('Tip','Tip Refund')",
]:
    if needle not in text['estimate']: errors.append(f'estimate success-page fallback missing tip accounting invariant: {needle}')

if not re.search(r'["\']tip_received["\']', text['estimate']):
    errors.append('estimate success-page tip notification type is missing')

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
    'const maxTipCents=Math.min(normalized.totalCents,50000);',
    'Tip cannot exceed the invoice total or $500.',
    'Recorded separately and does not change the invoice balance.',
    '?"Record tip":"Deposit recorded"',
]:
    if needle not in text['owner_dashboard']:
        errors.append(f'owner Record payment/tip UI missing invariant: {needle}')


owner_payloads = re.findall(r'JSON\.stringify\(\{([^}]*)\}\)', text['owner_dashboard'])
if not any(
    'estimateId:estimate.id' in payload
    and 'amountCents' in payload
    and 'tipCents' in payload
    for payload in owner_payloads
):
    errors.append('owner Record payment/tip UI must send estimateId, amountCents, and tipCents')

for needle in [
    'const tipCents = Math.round(Number(body.tipCents) || 0);',
    'const maxTipCents=Math.min(Number(estimate.totalCents),50000);',
    'Tip cannot exceed the invoice total or $500.',
    'Tips can be recorded only after the job is completed.',
    'This job is already paid in full. Record the tip by itself instead.',
    'Put any extra amount in Tip received instead.',
    'const results=await env.DB.batch([',
    "WHERE EXISTS (SELECT 1 FROM payments WHERE id=? AND estimate_id=? AND status='paid')",
    'if(!results[1]?.meta.changes)return Response.json({ error:"The invoice payment was not paired with its tip record.',
]:
    if needle not in text['payments']:
        errors.append(f'manual payment API missing tip invariant: {needle}')


if not re.search(
    r"INSERT INTO payments\s*\([^)]*\)\s*VALUES\s*\(\?,\?\s*,\s*'Tip'\s*,\s*\?\s*,\s*'paid'\s*,",
    text['payments'],
):
    errors.append('manual payment API must insert a paid Tip ledger row with the supplied tip amount')

if not re.search(r'["\']tip_received["\']', text['payments']):
    errors.append('manual payment API tip notification type is missing')

for name in ['payments','customers']:
    if "p.type IN ('deposit','balance','Tip')" not in text[name]:
        errors.append(f'{name} does not identify Stripe Tip rows as refundable Stripe payments')

if '{payment.type} · {payment.service||"Service"}' not in text['owner_dashboard']:
    errors.append('Payment History must preserve Tip / Tip Refund labels instead of collapsing all negative rows to generic Refund')
if 'const tipRevenue=Math.max(0,safeSignedSumCents(payments.filter((item)=>item.type==="Tip"||item.type==="Tip Refund").map((item)=>item.amountCents)));' not in text['owner_dashboard']:
    errors.append('Payments summary must calculate net Tip revenue separately from invoice balances')
if '<small>Tip revenue</small><strong>{money(tipRevenue)}</strong>' not in text['owner_dashboard']:
    errors.append('Payments summary must display separate Tip revenue')

if 'const customerPaidTotal=Math.max(0,safeSignedSumCents(customerPayments.filter((payment)=>payment.type!=="Tip"&&payment.type!=="Tip Refund").map((payment)=>payment.amountCents)));' not in text['owner_dashboard']:
    errors.append('customer profile Paid total must exclude Tip / Tip Refund rows')
if '<strong>{payment.type==="Tip"?"Tip":payment.type==="Tip Refund"?"Tip refund":payment.amountCents<0?"Refund":`${paymentTypeLabel(payment.type)} payment`}</strong>' not in text['owner_dashboard']:
    errors.append('customer payment history must label Tip and Tip refund explicitly')

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
    for required_behavior in ['No tip selected by default','5% preset','10% preset','15% preset','Custom tip','Tips only on final balance payments','Percentage presets are based on the full invoice total','Stripe card charge equals remaining balance plus tip','Tip stored separately from invoice payment','Tip and Tip Refund excluded from invoice paid/balance math','Customer profile Paid total excludes Tip and Tip Refund','Customer payment history labels Tip and Tip refund explicitly','Net tip revenue shown separately in Payments summary','Stripe webhook and success-page replay reconciliation verify existing invoice-payment and tip ledger rows','Stripe and manual tips are capped at the lesser of the full invoice total or $500']:
        if required_behavior not in protected:
            errors.append(f'forward-sync tipping registry missing protected behavior: {required_behavior}')

for needle in [
    'Optional tipping is intentionally available only on the final balance card payment',
    'No tip is selected by default',
    '5% / 10% / 15% / Custom',
    'Percentage presets are calculated from the full invoice total',
    'Stripe card charge is only the remaining balance plus the selected tip',
    'Tip / Tip Refund separately',
    'The Payments summary shows net tip revenue separately',
    'Customer-profile **Paid** totals exclude Tip / Tip Refund rows',
    'customer payment history labels **Tip** and **Tip refund** explicitly',
    'Both Stripe and manual tips are capped at the lesser of the full invoice total or $500',
    'Both the Stripe webhook and the customer success-page fallback verify replayed invoice-payment and tip ledger rows',
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

preset_base=20000
expected_presets={5:1000,10:2000,15:3000}
for percent,expected_tip in expected_presets.items():
    actual=round(preset_base*percent/100)
    if actual!=expected_tip:
        errors.append(f'accounting invariant failed: {percent}% preset should produce {expected_tip} cents from a 20000-cent invoice')

custom_tip=[('balance',15000),('Tip',2345)]
if billing_paid(custom_tip)!=15000 or sum(amount for _,amount in custom_tip)!=17345:
    errors.append('accounting invariant failed: custom tip must stay separate from invoice paid cents')

tip_only=[('Tip',2500)]
if billing_paid(tip_only)!=0:
    errors.append('accounting invariant failed: tip-only manual entry must not create invoice-paid cents')

deposit_without_tip=[('deposit',10000)]
if billing_paid(deposit_without_tip)!=10000:
    errors.append('accounting invariant failed: deposit without tip must still count normally toward invoice-paid cents')

# Model mixed deposits, final balances, tips, partial refunds and full refunds.
# This catches an accidental regression that makes a tipped job appear paid in
# full when only the tip was collected or reopens a balance after a tip refund.
ledger_scenarios = [
    ("unpaid with tip only", 20000, [('Tip', 1000)], 20000),
    ("deposit plus final tipped balance", 20000, [('deposit', 10000), ('balance', 10000), ('Tip', 2000)], 0),
    ("final payment plus refunded tip", 20000, [('deposit', 10000), ('balance', 10000), ('Tip', 2000), ('Tip Refund', -2000)], 0),
    ("partial invoice refund while keeping tip", 20000, [('deposit', 10000), ('balance', 10000), ('Tip', 2000), ('Refund', -3000)], 3000),
    ("full invoice refund without tip refund", 20000, [('deposit', 10000), ('balance', 10000), ('Tip', 2000), ('Refund', -20000)], 20000),
    ("full invoice and tip refund", 20000, [('deposit', 10000), ('balance', 10000), ('Tip', 2000), ('Refund', -20000), ('Tip Refund', -2000)], 20000),
]
for label, total, rows, expected_due in ledger_scenarios:
    paid = billing_paid(rows)
    due = max(0, total - paid)
    if due != expected_due:
        errors.append(f'accounting scenario {label}: expected balance {expected_due}, got {due}')

# Manual final-payment tip selection must be quick and must not be offered
# on deposit-only records. Tip rows stay separate from invoice balance.
owner = text['owner_dashboard']
for needle in ['aria-label="Optional tip choices"', 'No tip', 'Custom', 'fire-manual-tip', 'normalized.status==="completed"', 'Recorded separately and does not change the invoice balance.']:
    if needle not in owner:
        errors.append(f'manual final-payment tipping missing: {needle}')
if 'onClick={()=>setTip((Math.round(normalized.totalCents*percent/100)/100).toFixed(2))}' not in owner:
    errors.append('manual tip presets must calculate amounts from the full invoice total')

# Customers must see why final card checkout is hidden without bypassing
# completion or Stripe readiness conditions.
invoice_text=text['invoice']
for needle in [
    'Secure final-balance card payment becomes available after the job is marked completed.',
    'Online card payment is currently unavailable. Please contact First In Response Exteriors to arrange payment.',
    'row.estimateStatus!=="completed"',
    'row.estimateStatus==="completed"&&!paymentsReady',
]:
    if needle not in invoice_text:
        errors.append(f'customer invoice missing payment-availability explanation: {needle}')

# Customer-facing manual payment cards must retain dynamic handles and stay
# inside the completed-job, billing-safe invoice gate.
for needle in [
    'Other Payment Options',
    'href="https://cash.app/$FIREExteriors"',
    'href="https://venmo.com/u/FirstInResponseExteriors"',
    'target="_blank" rel="noopener noreferrer"',
    'aria-label="Open Cash App to pay $FIREExteriors"',
    'aria-label="Open Venmo to pay @FirstInResponseExteriors"',
    'You can also pay manually using Cash App or Venmo.',
    '{handles.cashApp}',
    '{handles.venmo}',
    'grid grid-cols-1 gap-3 sm:grid-cols-2',
    'aria-label="Other payment options"',
    'footer?.body||templateByKey("invoiceFooter").body',
]:
    if needle not in text['invoice']:
        errors.append(f'customer invoice missing approved manual payment design: {needle}')

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
print('Optional tipping is governed end-to-end: No tip default; 5/10/15/Custom final-card presets calculated from the full invoice total; card charge remains remaining balance plus tip; deposits cannot tip; manual Venmo/Cash App tips can be logged separately/tip-only; Tip/Tip Refund never change invoice math or overpayment reconciliation; Payment History labels, customer-profile paid-total separation, arithmetic separation, and LIVE forward-sync/runbook policy are protected.')
