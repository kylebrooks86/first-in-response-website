/** FIRE core v2 numbered records recovery — all synthetic, offline, no D1.
 * Validator intentionally DOES NOT enable real backup/restore or certify
 * supplemental property/photo blob tables. Existing HTTP 409 locks remain.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 validateNumberedCoreRecordsV2,planNumberedCoreRecordsV2Restore
} from '../lib/numbered-records-v2-preflight.mjs';
let checks=0;
const ok=(v,reason)=>{assert.ok(v,reason);checks++;};
const eq=(a,b,reason)=>{assert.deepEqual(a,b,reason);checks++;};
const blocked=(fn,reason)=>{assert.throws(fn,/FIRE numbered records v2 blocked/,reason);checks++;};
const tables=()=>Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(t=>[t,[]]));
const copy=structuredClone;
function archive(){
 const rows=tables();
 rows.customers=[
  {id:'c1',name:'Synthetic First',created_at:'2026-10-01T12:00:00Z'},
  {id:'c2',name:'Synthetic Second',created_at:'2026-10-02T12:00:00Z'}];
 rows.estimates=[
  {id:'e1',customer_id:'c1',created_at:'2026-10-03T12:00:00Z',status:'superseded',total_cents:3000},
  {id:'e2',customer_id:'c1',created_at:'2026-10-04T12:00:00Z',status:'completed',total_cents:3000},
  {id:'e3',customer_id:'c2',created_at:'2026-10-05T12:00:00Z',status:'draft',total_cents:5000}];
 rows.fire_customer_numbers=rows.customers.map((r,i)=>({customer_id:r.id,customer_number:i+1,created_at:r.created_at}));
 rows.fire_job_numbers=[{job_number:2,root_estimate_id:'e1',created_at:rows.estimates[0].created_at},
  {job_number:6,root_estimate_id:'e3',created_at:rows.estimates[2].created_at}];
 rows.fire_job_estimate_links=[{estimate_id:'e1',job_number:2},{estimate_id:'e2',job_number:2},{estimate_id:'e3',job_number:6}];
 rows.customer_notes=[{id:'note-1',customer_id:'c1',body:'Synthetic note',created_at:'2026-10-06T12:00:00Z'}];
 rows.estimate_items=[{id:'line-1',estimate_id:'e2',name:'Synthetic $30 service',quantity:1,unit:'job',total_cents:3000}];
 rows.invoices=[{id:'inv-1',estimate_id:'e2',customer_id:'c1',total_cents:3000,status:'partial'}];
 rows.invoice_items=[{id:'inv-line-1',invoice_id:'inv-1',total_cents:3000,name:'Synthetic service'}];
 rows.payments=[
  {id:'p1',estimate_id:'e2',amount_cents:3000,status:'paid',type:'Balance',provider_id:'manual:synth-1'},
  {id:'p2',estimate_id:'e2',amount_cents:-1000,status:'paid',type:'Refund',provider_id:'refund:p1:refund-1'}];
 rows.payment_refunds=[
  {id:'refund-1',payment_id:'p1',estimate_id:'e2',amount_cents:1000,mode:'manual',status:'succeeded',provider_refund_id:null}];
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables:rows,highWater:{customer:7,job:11}};
}
const empty=()=>({...archive(),tables:tables(),highWater:{customer:0,job:0}});
const sample=archive();
const validated=validateNumberedCoreRecordsV2(sample);
eq(validated.customerNumbers,2,'Both real Customer # mappings retained');
eq(validated.jobNumbers,2,'Separate real job identities retained');
eq(validated.jobLinks,3,'Revision shares its original saved Job #');
eq(validated.customerHighWater,7,'Customer high-water includes previously consumed values');
eq(validated.jobHighWater,11,'Job high-water includes previously consumed values');
eq(validated.coreTables,20,'Every core legacy records table is mandatory');
eq(validated.identityTables,3,'All three numbered identity tables are mandatory');
ok(validated.coreRows>0&&!validated.hostedWritesPerformed,'Core snapshot validated without any remote write');
const clean=planNumberedCoreRecordsV2Restore(sample,empty());
eq(clean.insertCoreRecords.customers,2,'Fresh restore plan includes all customer rows');
eq(clean.insertCoreRecords.payments,2,'Fresh restore plan includes original plus negative refund ledger');
eq(clean.insertCoreRecords.payment_refunds,1,'Refund audit is included in prospective recovery');
eq(clean.insertCustomerNumbers,2,'Historical Customer # is not recomputed');
eq(clean.insertJobNumbers,2,'Original Job # and gaps are preserved');
eq(clean.insertJobLinks,3,'Revision links are included');
eq(clean.jobHighWater,11,'Job high-water remains preserved after blank destination');
eq(clean.hostedWritesPerformed,false,'No live, QA or local database mutations occurred');
ok(clean.requiresCompleteSupplementalTableAndPhotoEvidence,'This is not falsely labeled a full app backup');

const replay=planNumberedCoreRecordsV2Restore(sample,copy(sample));
ok(Object.values(replay.insertCoreRecords).every(x=>x===0),'Idempotent replay skips all existing core rows');
eq(replay.insertCustomerNumbers+replay.insertJobNumbers+replay.insertJobLinks,0,'Identity links are never duplicated');

for(const [name,alter] of [
 ['missing payments table',x=>delete x.tables.payments],
 ['missing refunds table',x=>delete x.tables.payment_refunds],
 ['missing signed agreements table',x=>delete x.tables.deposit_agreement_snapshots],
 ['missing identity table',x=>delete x.tables.fire_job_estimate_links],
 ['partial core array',x=>x.tables.notifications={rows:[]}],
 ['truncated',x=>x.truncated=true],
 ['unknown format',x=>x.format='other'],
 ['unknown unreviewed SQL table',x=>x.tables.secret_unexpected=[]],
 ['duplicate payment id',x=>x.tables.payments.push(copy(x.tables.payments[0]))],
 ['missing note customer',x=>x.tables.customer_notes[0].customer_id='unknown'],
 ['orphaned invoice',x=>x.tables.invoices[0].customer_id='c2'],
 ['invalid manual refund',x=>x.tables.payment_refunds[0].amount_cents=5000],
 ['orphan negative refund ledger',x=>x.tables.payment_refunds=[]],
 ['incomplete Customer # mapping',x=>x.tables.fire_customer_numbers.pop()],
 ['cross-customer Job # revision',x=>x.tables.fire_job_estimate_links[1].job_number=6],
 ['missing high-water proof',x=>delete x.highWater],
 ['serial consumption lost',x=>x.highWater.job=3],
 ['non-json undefined',x=>x.tables.customer_notes[0].body=undefined],
 ['non-json infinite',x=>x.tables.payments[0].amount_cents=Infinity]
]){
 const x=copy(sample);alter(x);blocked(()=>validateNumberedCoreRecordsV2(x),name);
}
const collision=copy(sample);collision.tables.customer_notes[0].body='Different existing note text';
blocked(()=>planNumberedCoreRecordsV2Restore(sample,collision),'Existing record differences refuse blind overwrite');
const consumed=empty();consumed.highWater.customer=5;
blocked(()=>planNumberedCoreRecordsV2Restore(sample,consumed),'Consumed destination serial refuses import');

// Validate the PROPOSED UNION, not only each individually valid archive.
// A source and destination may both have a valid Stripe/refund ledger while
// their combined records would be financially corrupt.
const stripeSource=copy(sample),stripeTarget=copy(sample);
stripeSource.tables.payments.push({id:'p-source-stripe',estimate_id:'e2',type:'Balance',status:'paid',amount_cents:100,
 provider_id:'cs_synthetic_dup'});
stripeTarget.tables.payments.push({id:'p-target-stripe',estimate_id:'e2',type:'Balance',status:'paid',amount_cents:100,
 provider_id:'cs_synthetic_dup'});
ok(validateNumberedCoreRecordsV2(stripeSource).coreRows>0,'Source with distinct Stripe receipt is internally valid');
ok(validateNumberedCoreRecordsV2(stripeTarget).coreRows>0,'Destination with distinct Stripe receipt is internally valid');
blocked(()=>planNumberedCoreRecordsV2Restore(stripeSource,stripeTarget),
 'Cross-snapshot duplicate Stripe provider reference cannot create two payment ledgers');

const otherRefund=copy(sample);
otherRefund.tables.payment_refunds=[{id:'refund-2',payment_id:'p1',estimate_id:'e2',amount_cents:2500,
 mode:'manual',status:'succeeded',provider_refund_id:null}];
otherRefund.tables.payments=otherRefund.tables.payments.filter(x=>x.id!=='p2');
otherRefund.tables.payments.push({id:'p3',estimate_id:'e2',type:'Refund',
 status:'paid',amount_cents:-2500,provider_id:'refund:p1:refund-2'});
ok(validateNumberedCoreRecordsV2(otherRefund).coreRows>0,
 'Different 2500-cent refund is internally valid when isolated');
blocked(()=>planNumberedCoreRecordsV2Restore(sample,otherRefund),
 'Separate 1000-cent + 2500-cent refunds cannot overdraw one 3000-cent original payment');

const safeNewNotes=copy(sample);
safeNewNotes.tables.customer_notes.push({id:'note-2',customer_id:'c2',
 body:'Independent verified note',created_at:'2026-10-20T00:00:00Z'});
const safeUnion=planNumberedCoreRecordsV2Restore(safeNewNotes,sample);
eq(safeUnion.insertCoreRecords.customer_notes,1,
 'Compatible independent customer note may be included without changing original records');
eq(safeUnion.insertCoreRecords.payment_refunds,0,
 'Compatible merge does not duplicate an existing refund ledger');

function schemaDB(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON; CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,created_at TEXT NOT NULL);'+
 'CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),created_at TEXT NOT NULL);');
 db.exec(readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8'));
 db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 return db;
}
const db=schemaDB();
try{
 db.exec('BEGIN');
 for(const row of sample.tables.customers)db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)')
  .run(row.id,row.name,row.created_at);
 for(const row of sample.tables.estimates)db.prepare('INSERT INTO estimates(id,customer_id,created_at) VALUES(?,?,?)')
  .run(row.id,row.customer_id,row.created_at);
 for(const row of sample.tables.fire_customer_numbers)db.prepare(
  'INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)')
  .run(row.customer_number,row.customer_id,row.created_at);
 for(const row of sample.tables.fire_job_numbers)db.prepare(
  'INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)')
  .run(row.job_number,row.root_estimate_id,row.created_at);
 for(const row of sample.tables.fire_job_estimate_links)db.prepare(
  'INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)')
  .run(row.estimate_id,row.job_number);
 db.prepare("UPDATE sqlite_sequence SET seq=7 WHERE name='fire_customer_numbers'").run();
 db.prepare("UPDATE sqlite_sequence SET seq=11 WHERE name='fire_job_numbers'").run();
 db.exec('COMMIT');
 eq(db.prepare('PRAGMA foreign_key_check').all(),[],'Restored immutable linked identities have valid SQLite FKs');
 eq(db.prepare('SELECT job_number FROM fire_job_estimate_links WHERE estimate_id=?').get('e1').job_number,
    db.prepare('SELECT job_number FROM fire_job_estimate_links WHERE estimate_id=?').get('e2').job_number,
    'Historical quote replacement retains same stored job number');
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)')
  .run('c4','Synthetic Future','2026-11-01T10:00:00Z');
 db.prepare('INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES(?,?)')
  .run('c4','2026-11-01T10:00:00Z');
 eq(db.prepare("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='c4'").get().customer_number,8,
  'Next Customer # advances from SQLite high-water instead of current max');
 db.prepare('INSERT INTO estimates(id,customer_id,created_at) VALUES(?,?,?)')
  .run('e4','c4','2026-11-01T11:00:00Z');
 db.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES(?,?)')
  .run('e4','2026-11-01T11:00:00Z');
 eq(db.prepare("SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='e4'").get().job_number,12,
  'Next Job # advances past consumed numbering gaps');
}finally{db.close();}
console.log('PASS '+checks+' core v2 numbered record, payment/refund, source collision and SQLite high-water safety checks. No hosted writes.');
