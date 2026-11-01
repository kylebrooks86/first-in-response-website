/** FIRE actual Cloudflare workerd local D1+R2 binding integration gate.
 * Unlike prior hand-built D1/R2 mocks, this creates the EXACT 25 checked-in
 * migrations in an isolated ephemeral local D1 and stores a real R2 object.
 * The fixture has a hard-coded dummy account and no remote bindings.
 *
 * REQUIRES: Wrangler getPlatformProxy({persist:false,remoteBindings:false}).
 * NEVER set remote=true, use a real D1 ID, access owner data, or deploy.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getPlatformProxy} from 'wrangler';
import {captureEncryptedNumberedV2PrivateKitFromProviders}
 from '../lib/numbered-records-v2-source-export.mjs';
import {openNumberedV2PrivateRecoveryKit}
 from '../lib/numbered-records-v2-private-kit.mjs';
import {captureFinanciallyVerifiedNumberedRecordsV2FromD1}
 from '../lib/numbered-records-v2-d1-read.mjs';
import {FIRE_NUMBERED_RECORDS_TABLES}
 from '../lib/numbered-records-v2.mjs';
import {rehearseCompleteKitIntoDisposableWorkerd}
 from './rehearse-workerd-private-restore.mjs';

const base=resolve(fileURLToPath(new URL('.',import.meta.url)),'../../');
const config=resolve(base,'shared/scripts/fire-v2-disposable-bindings.json');
const raw=JSON.parse(readFileSync(config,'utf8'));
assert.equal(raw.d1_databases.length,3);
assert.deepEqual(raw.d1_databases.map(x=>x.binding),['DB','RECOVERY_DB','FAULT_DB']);
assert.deepEqual(raw.r2_buckets.map(x=>x.binding),['BUCKET','RECOVERY_BUCKET','FAULT_BUCKET']);
assert.deepEqual(raw.d1_databases.map(x=>x.database_id),[
 '00000000-0000-4000-8000-000000000000',
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002'
]);
assert.equal(raw.d1_databases[0].database_id,'00000000-0000-4000-8000-000000000000');
assert.equal(raw.r2_buckets[0].bucket_name,'fire-v2-disposable-local-only');
assert.equal(raw.name,'fire-v2-disposable-local-proxy-only');
const proxy=await getPlatformProxy({configPath:config,persist:false,remoteBindings:false});
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const refuse=async(fn,label)=>{
 await assert.rejects(fn,/FIRE v2 SOURCE EXPORT REFUSED|FIRE PHOTO VAULT V2 REFUSED|FIRE numbered D1 READ REFUSED|FIRE v2 FINANCIAL INTEGRITY REFUSED/,label);
 checks++;
};
const dummyPass='Synthetic test-only owner-held backup passphrase, never real';
const src=resolve(base,'adapters/doomsday/drizzle');
const numbers=resolve(base,'customer-numbering/customer_numbers_v1.sql');
const jobs=resolve(base,'job-numbering/job_numbers_v1.sql');
const migrations=readdirSync(src).filter(x=>x.endsWith('.sql')).sort();
assert.equal(migrations.length,25,'Only previously reviewed 25 QA D1 migrations are allowed');
assert.equal(migrations.at(-1),'0024_deposit_agreement_snapshots.sql');
try{
 const db=proxy.env.DB,bucket=proxy.env.BUCKET;
 const recoveryDb=proxy.env.RECOVERY_DB,recoveryBucket=proxy.env.RECOVERY_BUCKET;
 const faultDb=proxy.env.FAULT_DB,faultBucket=proxy.env.FAULT_BUCKET;
 assert.ok(db&&bucket&&recoveryDb&&recoveryBucket&&faultDb&&faultBucket,
  'All six independent disposable local D1/R2 bindings are available');
 // All writes here seed ONLY the disposable local D1 and R2. Export itself
 // must NEVER PUT, DELETE or UPDATE provider bindings.
 // D1 .exec() is line-oriented and does NOT accept a whole migration
 // containing multiline CREATE TABLE/TRIGGER plus multiple SQL statements.
 // Apply checked-in Drizzle marker-separated statements individually.
 const runStatements=async(targetDb,sql,drizzle)=>{
  const parts=drizzle
   ?sql.split(/--> statement-breakpoint/g)
   :sql.split(/(?=^CREATE (?:TABLE|TRIGGER|INDEX)\b)/m);
  for(const part of parts){
   const stmt=part.trim();
   if(!stmt||/^--[^\n]*(?:\n--[^\n]*)*\s*$/.test(stmt))continue;
   await targetDb.prepare(stmt).run();
  }
 };
 const materialize=async targetDb=>{
  for(const name of migrations)
   await runStatements(targetDb,readFileSync(resolve(src,name),'utf8'),true);
  await runStatements(targetDb,readFileSync(numbers,'utf8'),false);
  await runStatements(targetDb,readFileSync(jobs,'utf8'),false);
 };
 await materialize(db);
 await materialize(recoveryDb);
 await materialize(faultDb);
 const epoch='2026-10-31T21:00:00Z';
 await db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)")
  .bind('synthetic-c1','Cloudflare Local Synthetic Customer',epoch).run();
 await db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)")
  .bind('synthetic-e1','synthetic-c1','completed',25000,25000,12500,epoch).run();
 await db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,total_cents,created_at) VALUES(?,?,?,?,?,?,?)")
  .bind('synthetic-i1','synthetic-e1','synthetic-c1','sent',25000,25000,epoch).run();
 await db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,?,?,?,?,?)")
  .bind('synthetic-p1','synthetic-e1','Cash',25000,'paid','local-test-only',epoch).run();
 await db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,?,?,?,?,?)")
  .bind('synthetic-p2','synthetic-e1','Refund',-5000,'paid','refund:synthetic-p1:synthetic-r1',epoch).run();
 await db.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)")
  .bind('synthetic-r1','synthetic-p1','synthetic-e1',5000,'manual','succeeded',epoch).run();
 await db.prepare("INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)")
  .bind(3,'synthetic-c1',epoch).run();
 await db.prepare("INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)")
  .bind(9,'synthetic-e1',epoch).run();
 await db.prepare("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)")
  .bind('synthetic-e1',9).run();
 await db.prepare("UPDATE sqlite_sequence SET seq=11 WHERE name='fire_customer_numbers'").run();
 await db.prepare("UPDATE sqlite_sequence SET seq=15 WHERE name='fire_job_numbers'").run();
 await db.prepare("INSERT INTO auth_rate_limits(key,attempts,window_started_at,blocked_until) VALUES(?,?,?,?)")
  .bind('dummy-login-throttle',2,1793480000,1793480060).run();

 const key='customers/synthetic-c1/photo1.jpg';
 const bytes=new Uint8Array([0,3,12,55,70,99,112,187,254,44,20]);
 await bucket.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 const original=await bucket.head(key);
 assert.ok(original&&typeof original.etag==='string');
 await db.prepare("INSERT INTO customer_photos(id,customer_id,category,caption,filename,content_type,size_bytes,object_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
  .bind('photo1','synthetic-c1','before',null,'photo1.jpg','image/jpeg',bytes.byteLength,key,epoch).run();
 const tableNames=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results.map(row=>row.name);
 const expectedTables=new Set(['d1_migrations','_cf_KV',
  'customers','estimates','invoices','payments','payment_refunds','fire_customer_numbers',
  'fire_job_numbers','fire_job_estimate_links','auth_rate_limits',
  'customer_notes','invoice_items','invoice_revisions','payment_checkout_sessions',
  'deposit_policy_events','deposit_agreement_snapshots','estimate_items','customer_photos',
  'customer_messages','notifications','message_templates','estimate_change_requests',
  'tasks','expenses','job_reports']);
 eq(tableNames.filter(name=>!expectedTables.has(name)),['_cf_METADATA'],
  'Cloudflare local workerd introduces exactly the reviewed provider metadata table');
 const before=await db.prepare('SELECT COUNT(*) AS count FROM payment_refunds').first();
 const first=await captureEncryptedNumberedV2PrivateKitFromProviders({
  db,bucket,passphrase:dummyPass,now:()=>epoch
 });
 eq(first.proof.encryptedPrivateKitCreated,true,'Real workerd D1/R2 created encrypted complete kit');
 eq(first.proof.databaseReadBatches,2,'Real workerd D1 batch twice before export');
 eq(first.proof.photoObjectHeadsRechecked,1,'Actual R2 HEAD stable ETag attested');
 const decrypted=await openNumberedV2PrivateRecoveryKit({
  kit:first.kit,passphrase:dummyPass
 });
 eq(decrypted.photos[0].bytes,bytes,'Real local R2 photo bytes exactly recovered');
 eq(decrypted.archive.records.tables.payment_refunds[0].amount_cents,5000,
  'Real local D1 refund preserved in sealed backup');
 eq(decrypted.archive.identities.highWater.job,15,
  'Real local D1 preserves consumed historic Job numbers');
 eq(decrypted.archive.records.tables.auth_rate_limits[0].attempts,2,
  'Real local D1 auth throttling history preserved');
 const after=await db.prepare('SELECT COUNT(*) AS count FROM payment_refunds').first();
 eq(after.count,before.count,'Readonly export did not alter D1 refunds');
 const afterPhoto=await bucket.head(key);
 eq(afterPhoto.etag,original.etag,'Readonly export did not mutate original R2 photo');

 // New MAJOR milestone: prove ACTUAL reverse recovery into an independent
 // empty Cloudflare LOCAL D1 and R2 namespace; not merely an in-memory SQLite.
 const restored=await rehearseCompleteKitIntoDisposableWorkerd({
  sourceDb:db,targetDb:recoveryDb,targetBucket:recoveryBucket,
  kit:first.kit,passphrase:dummyPass
 });
 eq(restored.reviewedRecordTables,21,'Real workerd replay covers all application record families');
 eq(restored.reviewedNumberedTables,3,'Real workerd replay covers immutable number and revision maps');
 eq(restored.photosRestored,1,'Real workerd replay restores original R2 file bytes');
 eq(restored.verifiedOriginalDatabaseChecksum,true,
  'Fresh local D1 capture matches exact original encrypted records checksum');
 eq(restored.verifiedOriginalPhotoBytes,true,
  'Recovered local R2 image content byte-for-byte matches original');
 eq(restored.independentD1R2AtomicCommitGuaranteed,false,
  'Local rehearsal never claims cross-provider transactional restore');
 eq(restored.realHostedRestorePerformed,false,
  'No hosted source or target was used');
 const newRefund=await recoveryDb.prepare("SELECT amount_cents FROM payment_refunds WHERE id='synthetic-r1'").first();
 eq(newRefund.amount_cents,5000,'Recovered real D1 refund maintains exact original cents');
 const newCash=await recoveryDb.prepare("SELECT amount_cents FROM payments WHERE id='synthetic-p1'").first();
 eq(newCash.amount_cents,25000,'Recovered original paid cash ledger preserved');
 const newNumber=await recoveryDb.prepare("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='synthetic-c1'").first();
 eq(newNumber.customer_number,3,'Original permanent Customer number maintained on new D1');
 const newJob=await recoveryDb.prepare("SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='synthetic-e1'").first();
 eq(newJob.job_number,9,'Original Job root mapping maintained on new D1');
 const newSeq=await recoveryDb.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").first();
 eq(newSeq.seq,15,'Recovered real D1 keeps never-reuse Job number allocator high water');
 const newPhoto=await recoveryBucket.get(key);
 eq(new Uint8Array(await newPhoto.arrayBuffer()),bytes,
  'Original customer image bytes are present in DIFFERENT local R2 bucket');
 await assert.rejects(()=>rehearseCompleteKitIntoDisposableWorkerd({
  sourceDb:db,targetDb:recoveryDb,targetBucket:recoveryBucket,
  kit:first.kit,passphrase:dummyPass
 }),/FIRE LOCAL WORKERD RESTORE REFUSED/,
 'Refuse any replay over existing recovered customer/financial data');checks++;
 await assert.rejects(()=>rehearseCompleteKitIntoDisposableWorkerd({
  sourceDb:db,targetDb:faultDb,targetBucket:faultBucket,
  kit:first.kit,passphrase:'wrong synthetic private kit passphrase testing'
 }),/FIRE PRIVATE RECOVERY KIT REFUSED/,
 'Wrong owner passphrase cannot write new database or photo files');checks++;
 eq((await faultDb.prepare("SELECT COUNT(*) AS n FROM customers").first()).n,0,
  'Wrong private key leaves fault target D1 unchanged');
 eq((await faultBucket.list({limit:1})).objects.length,0,
  'Wrong private key leaves fault target R2 unchanged');
 await assert.rejects(()=>rehearseCompleteKitIntoDisposableWorkerd({
  sourceDb:db,targetDb:faultDb,targetBucket:faultBucket,
  kit:first.kit,passphrase:dummyPass,
  beforeAtomicBatch:async scratch=>{
   // Deliberately abort refund INSERT after prior customer/estimate/payment
   // inserts; all D1 writes must ROLLBACK. Independent local R2 is cleaned.
   await scratch.prepare("CREATE TRIGGER fire_disposable_fault_refund BEFORE INSERT ON payment_refunds BEGIN SELECT RAISE(ABORT,'synthetic fault'); END").run();
  }
 }),/FIRE LOCAL WORKERD RESTORE REFUSED/,
 'Real local workerd D1 transactional rollback refuses midway refund failure');checks++;
 eq((await faultDb.prepare("SELECT COUNT(*) AS n FROM customers").first()).n,0,
  'Real local D1 batch failure removes earlier inserted customer');
 eq((await faultDb.prepare("SELECT COUNT(*) AS n FROM payments").first()).n,0,
  'Real local D1 batch failure removes earlier inserted payment');
 eq((await faultDb.prepare("SELECT COUNT(*) AS n FROM payment_refunds").first()).n,0,
  'Real local D1 batch failure leaves no refund');
 eq((await faultDb.prepare("SELECT COUNT(*) AS n FROM fire_customer_numbers").first()).n,0,
  'Real local D1 batch failure leaves no assigned Customer number');
 eq((await faultBucket.list({limit:1})).objects.length,0,
  'In throwaway R2, staged photo is cleaned after failed D1 batch');

 // Meaningful new negative control, ONLY on a throwaway bucket:
 // same photo metadata in D1 but R2 object gone means NO partial backup.
 await bucket.delete(key);
 await refuse(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
  db,bucket,passphrase:dummyPass,now:()=>epoch
 }),'Actual local R2 missing object refuses complete backup');
 console.log('PASS '+checks+'/'+checks+' NEW REAL workerd-local export AND RESTORE into independent D1/R2, 25 migrations, atomic D1 rollback and photo cleanup. NO remote resources.');
}finally{
 await proxy.dispose();
}
