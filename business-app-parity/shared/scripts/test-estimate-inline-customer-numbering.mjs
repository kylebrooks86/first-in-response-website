/** Actual New Estimate route + disposable SQLite: customer and job serials
 * allocated atomically with a brand-new customer. Source-only gated candidate.
 * No hosted DB, Stripe, real calls, customer records or migrations.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;console.log('PASS: '+label)};
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sample=(n,other={})=>({
  requestId:uuid(n),customer:'Synthetic Numbering '+n,
  email:'synthetic-number-'+n+'@example.invalid',
  phone:'918555'+String(n).padStart(4,'0'),
  address:n+' Test-Only Way, Tulsa, OK',
  items:[{name:'Custom Service',description:'Synthetic $25 test quote',quantity:1,unit:'job',totalCents:2500}],
  appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,
  bundleDiscountCents:0,...other
});
const counts=db=>({
 customers:db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
 estimates:db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n,
 numbered:db.prepare('SELECT COUNT(*) AS n FROM fire_customer_numbers').get().n,
 jobs:db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,
 links:db.prepare('SELECT COUNT(*) AS n FROM fire_job_estimate_links').get().n
});

// Feature flagged but missing immutable tables: reject before any row insert.
const missing=stackedRuntime();
try{
 missing.env.FIRE_CUSTOMER_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const response=await missing.post(sample(1));
 check(response.status===503,'Approved Customer # without schema fails closed');
 check(missing.db.prepare('SELECT COUNT(*) AS n FROM customers').get().n===0,'Missing schema cannot create an unnumbered customer');
 check(missing.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,'Missing schema cannot orphan an estimate');
}finally{missing.db.close();}

const partial=stackedRuntime();
try{
 partial.db.exec(readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8'));
 partial.env.FIRE_CUSTOMER_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 partial.db.prepare("INSERT INTO customers(id,name,created_at) VALUES (?,?,?)")
   .run(uuid(401),'Historical Synthetic Customer','2026-10-01T12:00:00Z');
 const response=await partial.post(sample(2));
 check(response.status===503,'Flagged but incomplete historical Customer # backfill blocks inline create');
 check(partial.db.prepare('SELECT COUNT(*) AS n FROM customers').get().n===1 &&
       partial.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,
       'Incomplete history preserves original customer row and creates no estimate');
 const existingResponse=await partial.post(sample(203,{customerId:uuid(401),customer:'Historical Synthetic Customer'}));
 check(existingResponse.status===503,'Existing customer quote is also blocked while approved Customer # backfill is incomplete');
 check(partial.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,
       'Partially active numbering cannot attach a new quote to an unnumbered existing customer');
}finally{partial.db.close();}

// The mere presence of both Job # tables and all four immutability triggers
// cannot authorize a partial / cross-customer historic backfill.
const missingJob=stackedRuntime();
try{
 missingJob.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const response=await missingJob.post(sample(7));
 check(response.status===503,'Enabled Job # without tables/triggers refuses a quote');
 check(missingJob.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,
       'Missing Job # schema leaves quote records untouched');
}finally{missingJob.db.close();}

const jobPartial=stackedRuntime();
try{
 jobPartial.db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 jobPartial.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const a=uuid(801),b=uuid(802),root=uuid(901),other=uuid(902);
 const stamp='2026-10-01T12:00:00Z';
 for(const [id,name] of [[a,'Historical synthetic A'],[b,'Historical synthetic B']])
   jobPartial.db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(id,name,stamp);
 for(const [id,customer] of [[root,a],[other,b]])
   jobPartial.db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,share_token,created_at) VALUES (?,?,'draft',2500,2500,1250,?,?)")
     .run(id,customer,'local-test-'+id,stamp);
 const before=jobPartial.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n;
 const incomplete=await jobPartial.post(sample(8,{customerId:a,customer:'Historical synthetic A'}));
 check(incomplete.status===503,'Job # table/triggers alone do not authorize an incomplete historical backfill');
 check(jobPartial.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===before,
       'Incomplete historical Job # map cannot save another estimate');
 jobPartial.db.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES(?,?)').run(root,stamp);
 const number=jobPartial.db.prepare('SELECT job_number AS n FROM fire_job_numbers WHERE root_estimate_id=?').get(root).n;
 jobPartial.db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)').run(root,number);
 jobPartial.db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)').run(other,number);
 const wrongCustomer=await jobPartial.post(sample(9,{customerId:a,customer:'Historical synthetic A'}));
 check(wrongCustomer.status===503,'Cross-customer Job # mapping is rejected despite all estimates being linked');
 check(jobPartial.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===before,
       'Cross-customer Job # contamination produces no new quote or serial');
}finally{jobPartial.db.close();}

const rt=stackedRuntime();
try{
 rt.db.exec(readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8'));
 rt.db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 rt.env.FIRE_CUSTOMER_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 rt.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 rt.failMetadata(true);
 const interrupted=await rt.post(sample(3));
 check(interrupted.status===500,'Synthetic late audit-write failure reports an uncertain estimate save');
 check(JSON.stringify(counts(rt.db))===JSON.stringify({customers:0,estimates:0,numbered:0,jobs:0,links:0}),
       'Atomic rollback preserves no customer, job number or orphaned estimate on late failure');
 rt.failMetadata(false);
 const response=await rt.post(sample(3));
 const first=await response.json();
 check(response.status===201&&first.jobNumber===1,'New Estimate allocates Job #0001 on approved combined candidate');
 check(first.customerId&&rt.db.prepare('SELECT customer_number AS number FROM fire_customer_numbers WHERE customer_id=?')
   .get(first.customerId)?.number===1,'New inline customer receives real Customer #0001');
 check(JSON.stringify(counts(rt.db))===JSON.stringify({customers:1,estimates:1,numbered:1,jobs:1,links:1}),
       'One atomic save creates exactly one customer, customer number, quote, job and link');
 const before=JSON.stringify(counts(rt.db));
 const replayResponse=await rt.post(sample(3));
 const replay=await replayResponse.json();
 check(replayResponse.status===200&&replay.replayed===true&&replay.id===first.id,
       'Exact same request replays saved estimate ID rather than adding records');
 check(JSON.stringify(counts(rt.db))===before,'Retry never allocates a second Customer # or Job #');

 const secondResponse=await rt.post(sample(4));
 const second=await secondResponse.json();
 check(secondResponse.status===201&&second.jobNumber===2,'Repeat owner creates a distinct second job');
 check(rt.db.prepare('SELECT customer_number AS number FROM fire_customer_numbers WHERE customer_id=?')
   .get(second.customerId)?.number===2,'Second new inline customer receives Customer #0002');
 const existingResponse=await rt.post(sample(5,{
   customerId:first.customerId,customer:'Synthetic Numbering 3',
   email:'synthetic-number-3@example.invalid',phone:'9185550003'
 }));
 const existing=await existingResponse.json();
 check(existingResponse.status===201&&existing.jobNumber===3,'Existing customer gets a new job with its own Job #');
 check(rt.db.prepare('SELECT COUNT(*) AS n FROM fire_customer_numbers').get().n===2,
       'Existing customer quote never duplicates their permanent Customer #');
 check(rt.db.prepare('SELECT COUNT(*) AS n FROM fire_job_estimate_links').get().n===3,
       'Every new quote receives exactly one job link');
 check(rt.db.prepare('PRAGMA foreign_key_check').all().length===0,'Combined Customer # / Job # data remains referentially valid');
}finally{rt.db.close();}

// Old production without feature flags stays on original path.
const legacy=stackedRuntime();
try{
 const response=await legacy.post(sample(6));
 check(response.status===201,'Feature-off New Estimate behavior remains unchanged');
 check(legacy.db.prepare('SELECT COUNT(*) AS n FROM customers').get().n===1,
       'Feature-off customer and estimate save still completes');
}finally{legacy.db.close();}
console.log('PASS '+checks+' real route/atomic SQLite Customer # and Job # creation, replay, rollback and flag-off cases. NO HOSTED OPERATIONS.');
