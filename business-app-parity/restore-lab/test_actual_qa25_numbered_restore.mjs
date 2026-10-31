/** New review against the ACTUAL QA 25 source migrations (not simplified tables).
 * No owner files, provider, network, Cloudflare or SQL on a remote database.
 * Create two temporary :memory: SQLite databases exclusively from repo SQL.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {FIRE_NUMBERED_RECORDS_TABLES,buildNumberedRecordsV2}
  from '../shared/lib/numbered-records-v2.mjs';
import {NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION}
  from '../shared/lib/numbered-identity-archive.mjs';
import {verifyNumberedRecordsV2CriticalIntegrity}
  from '../shared/lib/numbered-records-v2-integrity.mjs';
import {restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory}
  from './restore_complete_numbered_records_memory.mjs';
import {captureFinanciallyVerifiedNumberedRecordsV2FromD1}
  from '../shared/lib/numbered-records-v2-d1-read.mjs';

const root='business-app-parity/';
const path=root+'adapters/doomsday/drizzle/';
const files=readdirSync(path).filter(n=>n.endsWith('.sql')).sort();
assert.equal(files.length,25,'Refuse migration drift: expected QA 25 source migrations');
assert.equal(files[24],'0024_deposit_agreement_snapshots.sql');
const schema=files.map(n=>readFileSync(path+n,'utf8')).join('\n');
const numbers=['customer-numbering/customer_numbers_v1.sql',
 'job-numbering/job_numbers_v1.sql'].map(p=>readFileSync(root+p,'utf8')).join('\n');
let checks=0;
function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
async function reject(fn,label){await assert.rejects(fn,/FIRE DISPOSABLE FULL RESTORE REFUSED|FIRE v2 FINANCIAL INTEGRITY REFUSED|FIRE numbered records v2 REFUSED|FIRE numbered D1 READ REFUSED/,label);checks++;}
function fresh(){
 const db=new DatabaseSync(':memory:');
 db.exec(schema);
 db.exec(numbers);
 db.exec('PRAGMA foreign_keys=ON');
 eq(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1,'QA migration schema enforces FKs');
 return db;
}
const source=fresh();
source.exec(
  "INSERT INTO customers(id,name,created_at) VALUES('c1','Synthetic only','2026-10-31T14:00:00Z');"+
  "INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at)"+
  " VALUES('e1','c1','completed',10000,10000,5000,'2026-10-31T14:01:00Z');"+
  "INSERT INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,total_cents,created_at)"+
  " VALUES('i1','e1','c1','sent',10000,10000,'2026-10-31T14:02:00Z');"+
  "INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES"+
  " ('p1','e1','Cash',10000,'paid','cash-synthetic','2026-10-31T14:03:00Z'),"+
  " ('p2','e1','Refund',-2500,'paid','refund:p1:r1','2026-10-31T14:04:00Z');"+
  "INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at)"+
  " VALUES('r1','p1','e1',2500,'manual','succeeded','2026-10-31T14:04:00Z');"+
  "INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at)"+
  " VALUES(4,'c1','2026-10-31T14:00:00Z');"+
  "INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at)"+
  " VALUES(6,'e1','2026-10-31T14:01:00Z');"+
  "INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES('e1',6);"+
  "UPDATE sqlite_sequence SET seq=12 WHERE name='fire_customer_numbers';"+
  "UPDATE sqlite_sequence SET seq=15 WHERE name='fire_job_numbers';"
);

// Test the new SOURCE inventory guard against the ACTUAL 25-migration schema.
// This D1-shaped adapter executes only in disposable SQLite, never Wrangler.
const localD1={
 prepare(sql){return{sql};},
 async batch(statements){
  const results=[];
  source.exec('BEGIN');
  try{
   for(const {sql} of statements)results.push({success:true,results:source.prepare(sql).all()});
   source.exec('COMMIT');
  }catch(error){source.exec('ROLLBACK');throw error;}
  return results;
 }
};
const strictRealCapture=await captureFinanciallyVerifiedNumberedRecordsV2FromD1({
 db:localD1,now:()=> '2026-10-31T14:05:00Z'
});
eq(strictRealCapture.archive.tableCounts.payment_refunds,1,
 'Strict one-batch D1 capture includes real QA refund history');
eq(strictRealCapture.archive.identities.highWater.job,15,
 'Strict one-batch source capture includes old Job number allocations');
source.exec('CREATE TABLE unreviewed_future_customer_data(id TEXT PRIMARY KEY)');
await reject(()=>captureFinanciallyVerifiedNumberedRecordsV2FromD1({
 db:localD1,now:()=> '2026-10-31T14:05:00Z'
}),'Extra real SQLite app table refuses a silent partial records backup');
source.exec('DROP TABLE unreviewed_future_customer_data');

const tableRows=Object.fromEntries(FIRE_NUMBERED_RECORDS_TABLES.map(name=>
 [name,source.prepare('SELECT * FROM "'+name+'"').all()]));
eq(Object.keys(tableRows).length,20,'All 20 actual QA record families read');
eq(tableRows.payment_refunds.length,1,'Real QA schema contains synthetic refund');
eq(tableRows.invoices.length,1,'Real QA schema contains synthetic invoice');
eq(await verifyNumberedRecordsV2CriticalIntegrity(tableRows),true,
 'Full real-schema customer/invoice/refund graph passes semantic validation');
const ids={
 format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
 allTablesComplete:true,truncated:false,
 customers:tableRows.customers.map(({id,created_at})=>({id,created_at})),
 estimates:tableRows.estimates.map(({id,customer_id,created_at})=>({id,customer_id,created_at})),
 fire_customer_numbers:source.prepare('SELECT * FROM fire_customer_numbers').all(),
 fire_job_numbers:source.prepare('SELECT * FROM fire_job_numbers').all(),
 fire_job_estimate_links:source.prepare('SELECT * FROM fire_job_estimate_links').all(),
 highWater:{
  customer:source.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get().seq,
  job:source.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq
 }
};
const {archive}=await buildNumberedRecordsV2({records:{
 format:'fire-app-records-backup',version:1,exportedAt:'2026-10-31T14:05:00Z',
 includes:{databaseRecords:true,photoMetadata:true,photoFiles:false,
  invoiceRevisionHistory:true,paymentCheckoutSessionSafety:true,
  paymentRefundHistory:true,depositPolicyAuditHistory:true,
  signedDepositAgreementHistory:true},
 warning:'Synthetic database backup excludes customer photo file bytes.',
 tables:tableRows
},identities:ids});
const target=fresh();
const restored=await restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory({db:target,archive});
eq(restored.restoredCustomerNumbers,1,'Actual 25-schema database Customer # restored');
eq(restored.restoredJobNumbers,1,'Actual 25-schema Job # restored');
eq(restored.customerHighWater,12,'Original Customer number allocation history retained');
eq(restored.jobHighWater,15,'Original Job allocation history retained');
for(const name of FIRE_NUMBERED_RECORDS_TABLES)
 eq(target.prepare('SELECT * FROM "'+name+'"').all(),source.prepare('SELECT * FROM "'+name+'"').all(),
    'Real 25-schema exact records match for '+name);
for(const name of ['fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'])
 eq(target.prepare('SELECT * FROM "'+name+'"').all(),source.prepare('SELECT * FROM "'+name+'"').all(),
    'Real 25-schema exact permanent identity matches '+name);
eq(target.prepare('PRAGMA foreign_key_check').all(),[],'True 25-schema FK constraints remain valid');
eq(target.prepare('PRAGMA integrity_check').get().integrity_check,'ok','True 25-schema SQLite integrity passes');
eq(target.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq,15,
 'Original job sequence retained in true QA schema');
eq(target.prepare('SELECT amount_cents FROM payment_refunds WHERE id=?').get('r1').amount_cents,2500,
 'True real-schema refund original cents retained');
source.close();target.close();
const injected=fresh();
injected.exec("CREATE TRIGGER synthetic_fail_payment BEFORE INSERT ON payment_refunds BEGIN SELECT RAISE(ABORT,'synthetic error'); END");
await reject(()=>restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory({db:injected,archive}),
 'A real QA payment refund write failure rolls back the entire restore');
eq(injected.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0,
 'Real 25-schema rollback removed prior customer insert');
eq(injected.prepare('SELECT COUNT(*) AS n FROM invoices').get().n,0,
 'Real 25-schema rollback removed prior invoice insert');
eq(injected.prepare('SELECT COUNT(*) AS n FROM payments').get().n,0,
 'Real 25-schema rollback removed prior payment insert');
eq(injected.prepare('SELECT COUNT(*) AS n FROM fire_customer_numbers').get().n,0,
 'Real 25-schema rollback did not assign permanent Customer #');
injected.close();
console.log('PASS '+checks+'/'+checks+' NEW authentic QA 25-migration schema and atomic disposable numbered recovery checks. No hosted resources.');
