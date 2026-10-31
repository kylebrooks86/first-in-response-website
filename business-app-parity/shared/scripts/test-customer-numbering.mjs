/** FIRE Customer # candidate: read-only source + in-memory SQLite proof.
 * Never connects to Cloudflare, uploads secrets, or changes actual records.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  customerNumberLabel,customerNumberingReady,newCustomerNumberStatement,
  customerNumberForCustomer,completedCustomerJobHistory,matchesCustomerNumberQuery,parseCustomerNumberQuery
} from '../lib/customer-numbering.mjs';

const base='business-app-parity/';
const source=path=>readFileSync(base+path,'utf8');
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const truth=(value,label)=>{assert.ok(value,label);checks++;};

eq(customerNumberLabel(1),'Customer #0001','First customer');
eq(customerNumberLabel(42),'Customer #0042','Compact permanent number');
eq(customerNumberLabel(100000),'Customer #100000','Never rolls over');
eq(customerNumberLabel('23'),'Customer #0023','Safe string integer');

for(const query of ['#42','Customer #0042','customer 42','0042','  #00042  '])
  eq(matchesCustomerNumberQuery(42,query),true,'Exact Customer # search: '+query);
for(const query of ['42','#4','#420','Customer #0043','00043','abc42','42 Main St','555-0042','001', ''])
  eq(matchesCustomerNumberQuery(42,query),false,'Reject ambiguous or unrelated number search: '+query);
eq(matchesCustomerNumberQuery(null,'#42'),false,'Feature-off customer cannot be found by invented number');
eq(matchesCustomerNumberQuery(1001,'1001'),true,'Four-digit bare exact customer number is searchable');
eq(matchesCustomerNumberQuery(42,'10042'),false,'Do not match suffixes or adjacent customer numbers');
eq(parseCustomerNumberQuery('Customer #0002'),2,'Safe exact number parser is shared with estimate picker');
eq(parseCustomerNumberQuery('0042'),42,'Padded numeric lookup resolves exact saved Customer #');
eq(parseCustomerNumberQuery('42'),null,'Bare two-digit phone search is not reinterpreted as Customer #');
eq(parseCustomerNumberQuery('#10000000000000000'),null,'Unsafe integers cannot enter bound SQL lookup');
for(const bad of [undefined,null,0,-1,1.5,NaN,Infinity,'','0002','abc','2;DROP',Number.MAX_SAFE_INTEGER+1])
  eq(customerNumberLabel(bad),null,'Never invent a customer number: '+bad);
const inactive={prepare(){throw Error('Disabled numbering must not query D1');}};
eq(await customerNumberingReady(inactive,{}),false,'Disabled feature does not read Cloudflare');
eq(await customerNumberForCustomer(inactive,'cust-a',{}),null,'Legacy customer renders without artificial number');

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE customers(id TEXT PRIMARY KEY,created_at TEXT NOT NULL)');
const d1={prepare(sql){const stmt=db.prepare(sql);let values=[];return {
  bind(...params){values=params;return this},
  async all(){return {results:stmt.all(...values)}},
  async first(){return stmt.get(...values)||null},
  async run(){return stmt.run(...values)},
}}};
const enabled={FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'};
await assert.rejects(customerNumberingReady(d1,enabled),/migration/);checks++;
const schema=source('customer-numbering/customer_numbers_v1.sql');
truth(!/ALTER TABLE customers|DROP TABLE|DELETE FROM customers/i.test(schema),'Additive only');
db.exec(schema);
db.prepare("INSERT INTO customers(id,created_at) VALUES (?,?)").run('second','2026-10-11T12:00:00Z');
db.prepare("INSERT INTO customers(id,created_at) VALUES (?,?)").run('third','2026-10-11T12:00:00Z');
db.prepare("INSERT INTO customers(id,created_at) VALUES (?,?)").run('first','2026-10-01T12:00:00Z');
await assert.rejects(customerNumberingReady(d1,enabled),/backfill/);checks++;
// This is an in-memory REHEARSAL, not a source migration or a hosted operation.
// Historical numbers must be assigned once in stable (createdAt, UUID) order.
db.exec("INSERT INTO fire_customer_numbers(customer_id,created_at) SELECT id,created_at FROM customers ORDER BY created_at,id");
eq(await customerNumberingReady(d1,enabled),true,'Verified full immutable backfill');
eq(await customerNumberForCustomer(d1,'first',enabled),1,'Oldest customer #1');
eq(await customerNumberForCustomer(d1,'second',enabled),2,'Timestamp ties resolve by stable ID');
eq(await customerNumberForCustomer(d1,'third',enabled),3,'Third historical record');
eq(db.prepare("SELECT customer_id AS id FROM fire_customer_numbers WHERE customer_number=?").get(parseCustomerNumberQuery('Customer #0002')).id,'second','Exact Customer # lookup returns the right old customer');
db.prepare('UPDATE customers SET created_at=? WHERE id=?').run('2027-01-01T00:00:00Z','first');
eq(await customerNumberForCustomer(d1,'first',enabled),1,'Changing customer metadata never renumbers');
assert.throws(()=>db.prepare("UPDATE fire_customer_numbers SET customer_number=99 WHERE customer_id='first'").run(),/permanent/);checks++;
assert.throws(()=>db.prepare("DELETE FROM fire_customer_numbers WHERE customer_id='first'").run(),/cannot be reused/);checks++;
assert.throws(()=>db.prepare("DELETE FROM customers WHERE id='first'").run(),/FOREIGN KEY/);checks++;
const id='12345678-1234-4234-8234-123456789012',created='2028-01-01T00:00:00Z';
db.exec('BEGIN');
try{
  db.prepare('INSERT INTO customers(id,created_at) VALUES(?,?)').run(id,created);
  await newCustomerNumberStatement(d1,id,created).run();
  db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e;}
eq(await customerNumberForCustomer(d1,id,enabled),4,'Next customer gets unique consecutive number, later year');
eq(await customerNumberingReady(d1,enabled),true,'After atomic create, full coverage remains');
assert.throws(()=>db.prepare('INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES(?,?)').run(id,created),/UNIQUE/);checks++;
eq(await customerNumberForCustomer(d1,id,enabled),4,'Duplicate save cannot consume a second number');

// A second concurrent request may pass the pre-read before the first insert.
// Repeating the number statement must be a no-op, never consume a new number.
await newCustomerNumberStatement(d1,id,created).run();
eq(await customerNumberForCustomer(d1,id,enabled),4,'Overlapping same-request allocation preserves original Customer #');
eq(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get().seq,4,
  'Idempotent retry does not consume or skip a future Customer #');
const repeatId='33333333-3333-4333-8333-333333333333';
db.prepare("INSERT INTO customers(id,created_at) VALUES(?,?)").run(repeatId,'2028-02-01T00:00:00Z');
await newCustomerNumberStatement(d1,repeatId,'2028-02-01T00:00:00Z').run();
eq(await customerNumberForCustomer(d1,repeatId,enabled),5,
  'Next real customer follows the prior number with no ghost allocation');

assert.throws(()=>newCustomerNumberStatement(d1,'invalid','2028-01-01T00:00:00Z'),TypeError);checks++;
assert.throws(()=>newCustomerNumberStatement(d1,id,'invalid date'),TypeError);checks++;

const fakeHistory=[
 {id:'one',status:'completed',jobNumber:11,createdAt:'2026-01-01'},
 {id:'revision-one',status:'completed',jobNumber:11,createdAt:'2026-01-05'},
 {id:'sent',status:'sent',jobNumber:12,createdAt:'2027-01-01'},
 {id:'scheduled',status:'scheduled',jobNumber:13,createdAt:'2027-01-03'},
 {id:'new-job',status:'completed',jobNumber:14,createdAt:'2028-01-01'},
 {id:'legacy-complete',status:'completed',createdAt:'2025-01-01'},
];
eq(completedCustomerJobHistory(fakeHistory).map(x=>x.id),['new-job','revision-one','legacy-complete'],
  'Repeat customer has distinct completed jobs only; quote revision counted once');
eq(completedCustomerJobHistory([{id:'a',status:'draft'},{id:'b',status:'approved'}]),[],
  'Drafts and approved but unfinished jobs are never counted');
eq(completedCustomerJobHistory(null),[],'Missing history never fabricates counts');

const dashboard=source('shared/app/dashboard.tsx');
const customerLookupApi=source('shared/app/api/customers/lookup/route.ts');
const customerPicker=source('shared/components/customer-lookup.tsx');
const customerApi=source('shared/app/api/customers/route.ts');
const invoiceApi=source('shared/app/api/invoices/route.ts');
const estimateApi=source('shared/app/api/estimate-history/route.ts');
truth(dashboard.includes('customerNumberLabel(selected.customerNumber)')&&dashboard.includes('customerNumberLabel(customer.customerNumber)'),
  'Customer directory and profile show same DB-backed customer label');
truth(dashboard.includes('matchesCustomerNumberQuery(customer.customerNumber,term)')&&dashboard.includes('Find name, Customer #, address or phone'),
  'Directory finds exact Customer # without replacing name/address/phone search');
truth((dashboard.match(/customerNumberLabel\(estimate.customerNumber\)/g)||[]).length>=1,
  'Customer # stays visible below the estimate customer name');
truth(dashboard.includes('Completed jobs ({completedCustomerJobs.length})'),
  'Single collapsed completed-job dropdown includes a count');
truth(dashboard.includes('completedCustomerJobHistory(customerEstimates)'),
  'Completed count follows ONLY selected customer history');
truth(customerApi.includes('newCustomerNumberStatement(env.DB,id,createdAt)')&&customerApi.includes('env.DB.batch([insertStatement,'),
  'Number allocated atomically with guarded new customer creation');
truth(customerApi.includes('await attachedJobNumbers(env.DB,')&&
  customerApi.includes('jobNumber:jobNumbers.get(String(row.id))??null')&&
  customerApi.includes('jobNumber:jobNumbers.get(String(row.estimateId))??null'),
  'Customer history estimates AND invoices attach real immutable Job # when enabled, so revisions count once');
truth(customerLookupApi.includes('const columns=customerColumns+(numbered?')&&!customerLookupApi.includes('NULL AS customerNumber'),
  'Flag-off customer lookup preserves the original five-column response so existing clients and QA remain compatible');
truth(customerLookupApi.includes('parseCustomerNumberQuery(query)')&&
  customerLookupApi.includes('n.customer_number=?')&&customerLookupApi.includes('customerNumber!==null?'),
  'Estimate customer lookup supports safe and gated exact Customer # binding');
truth(customerPicker.includes('customerNumberLabel(row.customerNumber)')&&
  customerPicker.includes('Name, Customer #, phone, or address'),
  'Estimate picker identifies matching saved customers by permanent number');
truth(customerApi.includes('FIRE_JOB_NUMBERS_CANDIDATE')&&customerApi.includes('showJobs?await attachedJobNumbers'),
  'Job numbering lookup remains gated and never touches unmigrated D1');
truth(customerApi.includes('customerNumbers.get(String(row.customerId))'),
  'Owner estimate and invoice rows use the same customer mapping');
truth(estimateApi.includes('customerNumberColumn')&&invoiceApi.includes('customerNumberColumn'),
  'Global owner estimates and invoices include Customer #');
for(const page of ['shared/app/estimate/[token]/page.tsx','shared/app/invoice/[token]/page.tsx']){
 const data=source(page);
 truth(data.indexOf('if(!row)')>=0||data.indexOf('if (!row)')>=0,'Unknown token rejected');
 truth(data.indexOf('customerNumberForCustomer(')>data.indexOf('if(!row)')&&data.includes('{customerLabel&&<small>{customerLabel}</small>}'),
  'Customer document gets number only after resolving opaque link: '+page);
}
console.log('PASS '+checks+' permanent Customer # schema, historical backfill, allocation/retries, completed counts, customer/estimate/invoice source contracts. SQLite memory only.');
