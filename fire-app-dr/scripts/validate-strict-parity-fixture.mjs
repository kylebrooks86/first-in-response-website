import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('../fixtures/strict-parity-records.json', import.meta.url), 'utf8'));
const requiredTables = ['customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions','payment_checkout_sessions','estimate_items','payments','payment_refunds','customer_photos','customer_messages','notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports'];
if (fixture?.format !== 'fire-app-records-backup' || fixture?.version !== 1) throw new Error('Invalid parity fixture format.');
for (const table of requiredTables) if (!Array.isArray(fixture.tables?.[table])) throw new Error(`Missing fixture table: ${table}`);
const allRows = requiredTables.flatMap((table)=>fixture.tables[table].map((row)=>({table,row})));
for (const {table,row} of allRows) {
  const identity = table === 'message_templates' ? row.key : row.id;
  if (identity && !String(identity).startsWith('parity-')) throw new Error(`${table} contains non-parity identity: ${identity}`);
}
const statuses = new Set(fixture.tables.estimates.map((row)=>row.status));
for (const status of ['draft','sent','approved','scheduled','completed']) if (!statuses.has(status)) throw new Error(`Fixture is missing estimate status ${status}`);
if (!fixture.tables.estimates.some((row)=>row.signed_name && row.signed_at)) throw new Error('Fixture is missing a signed estimate.');
if (!fixture.tables.estimate_change_requests.some((row)=>row.status === 'open')) throw new Error('Fixture is missing an open change request.');
if (fixture.tables.invoices.length < 2) throw new Error('Fixture must include open and paid invoice states.');
if (!fixture.tables.payments.some((row)=>row.type === 'Cash App') || !fixture.tables.payments.some((row)=>row.type === 'Venmo')) throw new Error('Fixture must include Cash App and Venmo history.');
if (!fixture.tables.job_reports.some((row)=>row.status === 'completed')) throw new Error('Fixture is missing a completed job report.');
if (!fixture.tables.payment_refunds.some((row)=>row.status === 'succeeded')) throw new Error('Fixture is missing a succeeded refund state.');
if (!fixture.tables.payment_refunds.some((row)=>row.status === 'pending')) throw new Error('Fixture is missing a pending refund state.');
const succeededRefund=fixture.tables.payment_refunds.find((row)=>row.status==='succeeded');
if (!fixture.tables.payments.some((row)=>row.provider_id===`refund:${succeededRefund.payment_id}:${succeededRefund.id}` && row.amount_cents===-succeededRefund.amount_cents)) throw new Error('Fixture succeeded refund is missing its negative ledger entry.');

console.log(`PASS  Strict parity fixture format`);
console.log(`PASS  Disposable parity identities only`);
console.log(`PASS  Estimate lifecycle states present: ${[...statuses].join(', ')}`);
console.log(`PASS  Signed estimate + open change request`);
console.log(`PASS  Invoice/payment/refund/job-report states present`);
console.log(`PASS  Records available: ${allRows.length}`);
