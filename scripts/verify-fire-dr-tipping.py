from pathlib import Path
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
    'customers':root/'app/api/customers/route.ts',
    'dashboard':root/'app/api/dashboard-summary/route.ts',
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
    'tipCents: allowTip ? tipCents : 0',
]:
    if needle not in text['button']: errors.append(f'pay button missing tip invariant: {needle}')
if '20' in re.search(r'const TIP_PRESETS\s*=\s*\[([^\]]+)\]',text['button']).group(1):
    errors.append('20% must not be a default tip preset')
if 'useState<"0"|"5"|"10"|"15"|"custom">("0")' not in text['button']:
    errors.append('No tip must remain the default selection')

for needle in [
    'Tips are available only with the final balance payment.',
    'const maxTipCents = Math.min(amount, 50000);',
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
        "'Tip',?,'paid'",
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

for name in ['invoice','pay','dashboard','estimates','estimate_id','invoices','invoice_id','customers']:
    if "type NOT IN ('Tip','Tip Refund')" not in text[name] and "p.type NOT IN ('Tip','Tip Refund')" not in text[name]:
        errors.append(f'{name} does not exclude tips from at least one billing paid-total query')

for name in ['invoice','pay','estimate']:
    if 'baseAmountCents=' not in text[name]:
        errors.append(f'{name} does not pass final balance to tip selector')

for name in ['payments','customers']:
    if "p.type IN ('deposit','balance','Tip')" not in text[name]:
        errors.append(f'{name} does not identify Stripe Tip rows as refundable Stripe payments')

# Any invoice/balance SUM over payments that lacks the Tip exclusion is suspect.
billing_files=['dashboard','estimates','estimate_id','invoices','invoice_id','invoice','pay','estimate','customers','checkout','webhook','refund','payments']
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
print('Optional final-payment tipping is governed: No tip default; 5/10/15/Custom presets; deposits cannot tip; Stripe tip is a separate line/payment entry; Tip and Tip Refund never change invoice paid/balance math.')
