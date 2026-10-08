from pathlib import Path

checks = {
    Path('app/dashboard.tsx'): [
        'function EditCustomer(',
        'Edit customer',
        'Save customer changes',
        'How they found FIRE',
        'method:"PATCH"',
        'body:JSON.stringify({id:customer.id,name:name.trim(),email:email.trim(),phone:phone.trim(),address:address.trim(),leadSource})',
        'This updates the customer profile only. Existing estimates, invoices, payments, and signed agreements keep their recorded history.',
        'EditCustomer customer={selected}',
        'const selected = customers.find((customer) => customer.id === selectedId) ?? null;',
        'setCustomers((current)=>current.map((item)=>item.id===updated.id?updated:item))',
        '{selected.phone ? <a href={`tel:${selected.phone}`}',
        '{selected.phone && <a href={`sms:${selected.phone}`}',
        '{selected.email ? <a href={`mailto:${selected.email}`}',
        '{selected.address ? <a className="primary-tool"',
        '{selected.address && <a href={`https://earth.google.com/web/search/',
        '{selected.address && <a href={`https://www.zillow.com/homes/',
        '{selected.address && <PropertyPreview address={selected.address} />}',
    ],
    Path('app/api/customers/route.ts'): [
        'export async function PATCH(request: Request)',
        'Customer id is required.',
        'Customer name is required.',
        'SELECT id,created_at AS createdAt FROM customers WHERE id=? LIMIT 1',
        'UPDATE customers SET name=?,email=?,phone=?,address=?,lead_source=? WHERE id=?',
        'Customer not found.',
    ],
}

missing=[]
for path, needles in checks.items():
    if not path.is_file():
        missing.append(f'{path}: missing file')
        continue
    text=path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing customer-edit invariant: {needle}')

route=Path('app/api/customers/route.ts').read_text() if Path('app/api/customers/route.ts').is_file() else ''
patch=route.split('export async function PATCH(request: Request)',1)[1] if 'export async function PATCH(request: Request)' in route else ''
# A customer edit must never fall back to creating a new profile, bypass
# owner authentication, or issue updates without a record-id predicate.
if patch:
    if 'if (!await authorized())' not in patch:
        missing.append('app/api/customers/route.ts: PATCH must require owner authentication')
    if 'INSERT INTO customers' in patch or 'DELETE FROM customers' in patch:
        missing.append('app/api/customers/route.ts: PATCH cannot insert/delete customer records')
    if 'WHERE id=?' not in patch:
        missing.append('app/api/customers/route.ts: PATCH requires an explicit customer-id predicate')
    if 'const existing = await env.DB.prepare(' not in patch:
        missing.append('app/api/customers/route.ts: PATCH must confirm that the original customer exists')
    for protected in ('estimate_id','invoice_id','payment_id','contract_initials','signed_at'):
        if protected in patch.lower():
            missing.append(f'app/api/customers/route.ts: PATCH unexpectedly references historical field {protected}')

for forbidden in ['UPDATE estimates','UPDATE invoices','UPDATE payments','UPDATE estimate_items','UPDATE payment_refunds']:
    if forbidden in patch:
        missing.append(f'app/api/customers/route.ts: customer PATCH must not rewrite historical financial/job records: {forbidden}')

if missing:
    print('DR_CUSTOMER_EDIT_FLOW_GUARD=FAIL')
    for item in missing:
        print('- '+item)
    raise SystemExit(1)

print('DR_CUSTOMER_EDIT_FLOW_GUARD=PASS')
print('Edit customer is present for name, email, phone, service address, and lead source; PATCH updates only the existing customer record, the selected profile is derived from updated customer state so contact/property actions refresh immediately, and historical estimates, invoices, payments, line items, or refunds are not rewritten.')
