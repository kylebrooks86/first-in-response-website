/** New FIRE disposable in-memory numbered restore tests ONLY.
 * No owner SQL, no live app, no Cloudflare, no Stripe, no filesystem writes.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {buildNumberedRecordsV2,FIRE_NUMBERED_RECORDS_TABLES}
  from '../shared/lib/numbered-records-v2.mjs';
import {NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION}
  from '../shared/lib/numbered-identity-archive.mjs';
import {restoreNumberedMappingsToDisposableMemory}
  from './restore_numbered_mappings_memory.mjs';

let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const refuse=async(fn,msg)=>{await assert.rejects(fn,/FIRE DISPOSABLE (?:numbered restore|FULL RESTORE) REFUSED|FIRE numbered records v2 REFUSED|Unsafe FIRE numbered-identity archive/,msg);checks++;};
const customerSQL=readFileSync('business-app-parity/customer-numbering/customer_numbers_v1.sql','utf8');
const jobSQL=readFileSync('business-app-parity/job-numbering/job_numbers_v1.sql','utf8');
const rows=Object.fromEntries(FIRE_NUMBERED_RECORDS_TABLES.map(table=>[table,[]]));
rows.customers=[
 {id:'synthetic-c1',created_at:'2026-10-01T10:00:00Z',name:'Synthetic A'},
 {id:'synthetic-c2',created_at:'2026-10-02T10:00:00Z',name:'Synthetic B'}
];
rows.estimates=[
 {id:'synthetic-e1',customer_id:'synthetic-c1',created_at:'2026-10-03T10:00:00Z',total_cents:2500},
 {id:'synthetic-e2',customer_id:'synthetic-c1',created_at:'2026-10-04T10:00:00Z',total_cents:2500},
 {id:'synthetic-e3',customer_id:'synthetic-c2',created_at:'2026-10-05T10:00:00Z',total_cents:5000}
];
rows.invoices=[{id:'invoice-1',estimate_id:'synthetic-e1',total_cents:2500}];
rows.invoice_revisions=[{id:'invoice-r1',invoice_id:'invoice-1',total_cents:2500}];
rows.payments=[{id:'payment-1',estimate_id:'synthetic-e1',amount_cents:2500}];
rows.payment_refunds=[{id:'refund-1',payment_id:'payment-1',amount_cents:1000}];
rows.deposit_policy_events=[{id:'event-1',estimate_id:'synthetic-e1',amount_cents:1000}];
rows.deposit_agreement_snapshots=[{id:'signed-1',event_id:'event-1',digest:'synthetic'}];
rows.customer_photos=[{id:'photo-1',customer_id:'synthetic-c1',object_key:'synthetic-only'}];
const cloned=x=>structuredClone(x);
const records={format:'fire-app-records-backup',version:1,exportedAt:'2026-10-31T20:00:00.000Z',
 includes:{databaseRecords:true,photoMetadata:true,photoFiles:false,invoiceRevisionHistory:true,
  paymentCheckoutSessionSafety:true,paymentRefundHistory:true,
  depositPolicyAuditHistory:true,signedDepositAgreementHistory:true},
 warning:'Actual customer photo bytes are stored separately and not included.',tables:rows};
const identities={
 format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
 allTablesComplete:true,truncated:false,
 customers:rows.customers.map(({id,created_at})=>({id,created_at})),
 estimates:rows.estimates.map(({id,customer_id,created_at})=>({id,customer_id,created_at})),
 fire_customer_numbers:[
  {customer_number:2,customer_id:'synthetic-c1',created_at:rows.customers[0].created_at},
  {customer_number:7,customer_id:'synthetic-c2',created_at:rows.customers[1].created_at}
 ],
 fire_job_numbers:[
  {job_number:3,root_estimate_id:'synthetic-e1',created_at:rows.estimates[0].created_at},
  {job_number:10,root_estimate_id:'synthetic-e3',created_at:rows.estimates[2].created_at}
 ],
 fire_job_estimate_links:[
  {estimate_id:'synthetic-e1',job_number:3},
  {estimate_id:'synthetic-e2',job_number:3},
  {estimate_id:'synthetic-e3',job_number:10}
 ],
 highWater:{customer:12,job:15}
};
const {archive}=await buildNumberedRecordsV2({records,identities});
const quote=x=>'"'+x.replaceAll('"','""')+'"';
function fixture(opts={}){
 const db=new DatabaseSync(opts.filename||':memory:');
 const createSpecial=()=>db.exec(
  'PRAGMA foreign_keys=ON; '+
  'CREATE TABLE customers(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,name TEXT);'+
  'CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),created_at TEXT NOT NULL,total_cents INTEGER);'
 );
 createSpecial();
 for(const table of FIRE_NUMBERED_RECORDS_TABLES){
  if(table==='customers'||table==='estimates')continue;
  const example=rows[table][0]||{id:''};
  const columns=Object.keys(example).map(key=>quote(key)+' '+
    (key==='id'?'TEXT PRIMARY KEY':key.endsWith('_cents')?'INTEGER':'TEXT')).join(',');
  const foreign={
   invoices:'FOREIGN KEY(estimate_id) REFERENCES estimates(id)',
   invoice_revisions:'FOREIGN KEY(invoice_id) REFERENCES invoices(id)',
   payments:'FOREIGN KEY(estimate_id) REFERENCES estimates(id)',
   payment_refunds:'FOREIGN KEY(payment_id) REFERENCES payments(id)',
   deposit_policy_events:'FOREIGN KEY(estimate_id) REFERENCES estimates(id)',
   deposit_agreement_snapshots:'FOREIGN KEY(event_id) REFERENCES deposit_policy_events(id)',
   customer_photos:'FOREIGN KEY(customer_id) REFERENCES customers(id)'
  }[table];
  db.exec('CREATE TABLE '+quote(table)+' ('+columns+(foreign?','+foreign:'')+')');
 }
 function insert(table,data){
  const columns=Object.keys(data);
  const sql='INSERT INTO '+quote(table)+' ('+columns.map(quote).join(',')+
    ') VALUES ('+columns.map(()=>'?').join(',')+')';
  db.prepare(sql).run(...columns.map(k=>data[k]));
 }
 if(!opts.empty)for(const table of FIRE_NUMBERED_RECORDS_TABLES)
  for(const record of rows[table])insert(table,record);
 db.exec(customerSQL);db.exec(jobSQL);
 if(opts.additionalRecord)db.prepare("INSERT INTO customers(id,created_at,name) VALUES('EXTRA','2026-10-21','Not in backup')").run();
 return db;
}
const q=(db,t)=>db.prepare('SELECT COUNT(*) AS n FROM '+quote(t)).get().n;
const sqlSeq=(db,t)=>db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(t)?.seq??0;
const db=fixture();
const restored=await restoreNumberedMappingsToDisposableMemory({db,archive});
eq(restored.restoredCustomerNumbers,2,'Customer number rows restored');
eq(restored.restoredJobNumbers,2,'Job root numbers restored');
eq(restored.restoredEstimateJobLinks,3,'All historical revision links restored');
eq(restored.customerHighWater,12,'Customer serial watermark preserved');
eq(restored.jobHighWater,15,'Job serial watermark preserved');
eq(restored.disposableMemoryOnly,true,'Only isolated offline memory restore');
eq(restored.hostedWritesPerformed,false,'Never asserts any remote writes');
eq(restored.productionRestoreApproved,false,'Never claims production approval');
eq(q(db,'fire_customer_numbers'),2,'Customer serial mapping materialized');
eq(q(db,'fire_job_estimate_links'),3,'Each estimate maps to correct job');
eq(sqlSeq(db,'fire_customer_numbers'),12,'Persisted customer allocator preserves gaps');
eq(sqlSeq(db,'fire_job_numbers'),15,'Persisted Job allocator preserves gaps');
eq(db.prepare("SELECT job_number FROM fire_job_estimate_links WHERE estimate_id='synthetic-e2'").get().job_number,3,'A revised estimate keeps original Job #');
eq(db.prepare("SELECT amount_cents FROM payment_refunds WHERE id='refund-1'").get().amount_cents,1000,'Refund history preserved exactly');
eq(db.prepare("SELECT digest FROM deposit_agreement_snapshots WHERE id='signed-1'").get().digest,'synthetic','Agreement hash preserved');
eq(db.prepare('PRAGMA foreign_key_check').all(),[],'Real FKs valid');
db.prepare("INSERT INTO customers(id,created_at,name) VALUES('synthetic-c3','2026-11-01','C')").run();
db.prepare("INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES('synthetic-c3','2026-11-01')").run();
eq(db.prepare("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='synthetic-c3'").get().customer_number,13,'Next Customer number follows historic high-water');
db.prepare("INSERT INTO estimates(id,customer_id,created_at,total_cents) VALUES('synthetic-e4','synthetic-c2','2026-11-02',500)").run();
db.prepare("INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES('synthetic-e4','2026-11-02')").run();
eq(db.prepare("SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='synthetic-e4'").get().job_number,16,'Next Job number follows historic high-water');
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db,archive}),'Existing numbering refuses implicit reassign/replay');
db.close();
const extra=fixture({additionalRecord:true});
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:extra,archive}),'Extra saved customer not in archive refuses');
eq(q(extra,'fire_customer_numbers'),0,'Mismatch refuses before any numbered inserts');
extra.close();
const money=fixture();
money.prepare("UPDATE payment_refunds SET amount_cents=999 WHERE id='refund-1'").run();
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:money,archive}),'Altered financial record refuses');
eq(q(money,'fire_customer_numbers'),0,'Financial discrepancy causes zero numbered writes');
money.close();
const missingRefund=fixture();
missingRefund.prepare("DELETE FROM payment_refunds WHERE id='refund-1'").run();
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:missingRefund,archive}),'Missing refund record refuses');
missingRefund.close();
const missingPhoto=fixture();
missingPhoto.prepare("DELETE FROM customer_photos WHERE id='photo-1'").run();
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:missingPhoto,archive}),'Missing photo metadata refuses');
missingPhoto.close();
const noTrigger=fixture();
noTrigger.exec('DROP TRIGGER fire_customer_numbers_no_delete');
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:noTrigger,archive}),'No immutable delete protection means no restore');
noTrigger.close();
const attach=fixture();
attach.exec("ATTACH DATABASE ':memory:' AS extra");
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:attach,archive}),'Attached database refuses isolated-memory claim');
attach.close();
const prior=fixture();
prior.exec("INSERT INTO sqlite_sequence(name,seq) VALUES('fire_customer_numbers',50)");
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:prior,archive}),'Previously consumed serials cannot be overwritten');
prior.close();
const failsAfterPartial=fixture();
// Intentionally abort on the first Job insert, after Customer numbers were
// inserted inside the transaction. All writes must roll back atomically.
failsAfterPartial.exec("CREATE TRIGGER fixture_abort_job BEFORE INSERT ON fire_job_numbers BEGIN SELECT RAISE(ABORT,'synthetic injected failure'); END");
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:failsAfterPartial,archive}),'Fault after Customer insertion must rollback entire transaction');
eq(q(failsAfterPartial,'fire_customer_numbers'),0,'Rollback removes all partially inserted Customer numbers');
eq(q(failsAfterPartial,'fire_job_numbers'),0,'Rollback removes any partial Job mapping');
eq(sqlSeq(failsAfterPartial,'fire_customer_numbers'),0,'Rollback does not consume Customer high water');
failsAfterPartial.close();
const corrupted=cloned(archive);
corrupted.records.tables.invoices[0].total_cents=9000;
const clean=fixture();
await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:clean,archive:corrupted}),'Tampered full archive refused by SHA-256');
eq(q(clean,'fire_customer_numbers'),0,'Tampered archive never mutates identity mapping');
clean.close();
// A private SQLite *file* should never be an eligible restore target.
const folder=mkdtempSync(join(tmpdir(),'fire-restore-guard-'));
try{
 const file=join(folder,'forbidden-disk-backed.sqlite');
 const disk=fixture({filename:file});
 await refuse(()=>restoreNumberedMappingsToDisposableMemory({db:disk,archive}),'Physical disk-backed database must be rejected');
 eq(q(disk,'fire_customer_numbers'),0,'Physical file remains free of numbered writes');
 disk.close();
}finally{rmSync(folder,{recursive:true,force:true});}
console.log('PASS '+checks+'/'+checks+' NEW disposable numbered restore, complete records parity, immutable IDs, exact sequence and atomic rollback checks. No hosted resources.');



// NEW complete scratch-DB import: 20 ordinary record families and the
// immutable numbering maps must commit together or ALL roll back.
const {restoreCompleteNumberedRecordsToDisposableMemory}=
  await import('./restore_complete_numbered_records_memory.mjs');
const full=fixture({empty:true});
const complete=await restoreCompleteNumberedRecordsToDisposableMemory({db:full,archive});
eq(complete.ordinaryRecordTables,20,'Complete restore covers all existing 20 ordinary record tables');
eq(complete.restoredCustomerNumbers,2,'Complete restore includes permanent Customer numbers');
eq(complete.restoredJobNumbers,2,'Complete restore includes permanent Job numbers');
eq(complete.restoredRevisionLinks,3,'Complete restore retains all estimate/job revision links');
eq(complete.photoFileBytesRestored,false,'No false claim that external photo file bytes were restored');
eq(complete.hostedWritesPerformed,false,'Scratch restore never writes hosted records');
eq(complete.productionRestoreApproved,false,'Scratch restoration is not production authorization');
eq(q(full,'customers'),2,'Both customer records restored');
eq(q(full,'estimates'),3,'All historical estimate revisions restored');
eq(q(full,'payments'),1,'Payment record restored exactly');
eq(q(full,'payment_refunds'),1,'Refund record restored exactly');
eq(q(full,'deposit_agreement_snapshots'),1,'Signed document audit retained');
eq(q(full,'customer_photos'),1,'Photo metadata retained; not photo files');
eq(q(full,'fire_customer_numbers'),2,'Permanent Customer mapping materialized');
eq(q(full,'fire_job_estimate_links'),3,'Job revision mapping materialized');
eq(sqlSeq(full,'fire_customer_numbers'),12,'Full restore retains old consumed Customer serials');
eq(sqlSeq(full,'fire_job_numbers'),15,'Full restore retains old consumed Job serials');
eq(full.prepare('PRAGMA foreign_key_check').all(),[],'Real linked records and number mappings satisfy all FKs');
await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:full,archive}),
 'Repeat restore refuses overwrite of existing history');
full.close();

const fullRollback=fixture({empty:true});
fullRollback.exec("CREATE TRIGGER fixture_refund_fail BEFORE INSERT ON payment_refunds BEGIN SELECT RAISE(ABORT,'synthetic refund failure'); END");
await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:fullRollback,archive}),
 'Injected refund failure after ordinary inserts must abort entire restore');
eq(q(fullRollback,'customers'),0,'Atomic failure removes previously inserted customer records');
eq(q(fullRollback,'estimates'),0,'Atomic failure removes previously inserted estimates');
eq(q(fullRollback,'invoices'),0,'Atomic failure removes previously inserted invoices');
eq(q(fullRollback,'payments'),0,'Atomic failure removes previously inserted payments');
eq(q(fullRollback,'fire_customer_numbers'),0,'Atomic failure never leaves orphan permanent numbers');
fullRollback.close();

const inconsistent=structuredClone(records);
inconsistent.tables.payment_refunds[0].payment_id='nonexistent-payment';
const forged=await buildNumberedRecordsV2({records:inconsistent,identities});
const unrelated=fixture({empty:true});
await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:unrelated,archive:forged.archive}),
 'Cross-table orphan refund is blocked by actual SQLite FK review');
eq(q(unrelated,'customers'),0,'Malformed financial graph rolls back all customers');
eq(q(unrelated,'payment_refunds'),0,'Malformed financial graph does not retain any refund');
unrelated.close();

const incompleteSchema=fixture({empty:true});
incompleteSchema.exec('ALTER TABLE payment_refunds ADD COLUMN extra_unreviewed TEXT');
await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:incompleteSchema,archive}),
 'Extra unreviewed refund column refuses silent historic loss');
eq(q(incompleteSchema,'customers'),0,'Schema mismatch rolls back earlier customer insertion');
incompleteSchema.close();

const populated=fixture();
await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:populated,archive}),
 'Existing populated record database may never be overwritten or merged');
eq(q(populated,'fire_customer_numbers'),0,'Blocked nonempty target retains absent numbering');
populated.close();

const fullDiskDir=mkdtempSync(join(tmpdir(),'fire-fullrestore-file-'));
try{
 const fullDisk=fixture({filename:join(fullDiskDir,'blocked.sqlite'),empty:true});
 await refuse(()=>restoreCompleteNumberedRecordsToDisposableMemory({db:fullDisk,archive}),
   'Full restore must refuse file-backed SQLite even when empty');
 eq(q(fullDisk,'customers'),0,'File-backed database remains unchanged');
 fullDisk.close();
}finally{rmSync(fullDiskDir,{recursive:true,force:true});}
console.log('PASS '+checks+'/'+checks+' NEW complete 20-family + immutable-number atomic disposable restore checks (no hosted D1).');
