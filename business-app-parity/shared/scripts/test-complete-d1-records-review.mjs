/** Gate7 complete D1 records review: actual 25-migration native SQLite fixture.
 * Tests the SOURCE-ONLY full core+supplemental transactional capture.
 * No account, hosted D1, owner records, Stripe, photo bytes or network.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {captureCompleteReviewedD1RecordsReadOnly} from '../lib/complete-d1-records-review.mjs';
import {fingerprintIsolatedSqliteSchema} from '../../fingerprint_isolated_sqlite_schema.mjs';

const base='../adapters/doomsday/drizzle';
const migrations=readdirSync(base).filter(x=>/^[0-9]{4}_.+\.sql$/.test(x)).sort();
assert.equal(migrations.length,25);
const db=new DatabaseSync(':memory:');
let checks=0, batches=0,statements=0,writes=0;
const equal=(a,b,why)=>{assert.deepEqual(a,b,why);checks++;};
const deny=async(promise,label)=>{
 await assert.rejects(promise,/FIRE full D1 review BLOCKED:|FIRE numbered records v2 blocked/ ,label);
 checks++;
};
const makeD1=(tamper=()=>{})=>({
 prepare(sql){
  if(!/^(?:SELECT\b|PRAGMA\s+table_xinfo\()/i.test(sql)){
   writes++;throw Error('unexpected write in reviewed D1 snapshot');
  }
  statements++;
  return {sql,values:[],bind(...values){return {sql,values}}};
 },
 async batch(items){
  batches++;
  const before=db.prepare('SELECT COUNT(*) AS n FROM customers').get().n;
  db.exec('BEGIN');
  let response;
  try{
   response=items.map(x=>({success:true,results:db.prepare(x.sql).all(...(x.values||[]))}));
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,before);
  tamper(response);
  return response;
 }
});
try{
 db.exec(migrations.map(x=>readFileSync(base+'/'+x,'utf8')).join('\n'));
 db.exec(readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8'));
 db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 // Wrangler creates this table. A local fixture must mirror its complete
 // archived migration journal without altering any real D1 account.
 db.exec('CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)');
 const journal=db.prepare('INSERT INTO d1_migrations(name) VALUES (?)');
 for(const file of migrations)journal.run(file);
 const now='2026-11-15T12:00:00.000Z';
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('full-review-customer','Synthetic full review',now);
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'draft',10000,10000,5000,?)")
  .run('full-review-estimate','full-review-customer',now);
 db.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES (?,?,?)')
  .run(1,'full-review-customer',now);
 db.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES (?,?,?)')
  .run(1,'full-review-estimate',now);
 db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)')
  .run('full-review-estimate',1);
 const original=await captureCompleteReviewedD1RecordsReadOnly(makeD1());
 equal(batches,1,'all core/supplemental metadata and rows use one D1 batch');
 assert.ok(statements>50,'genuine complete snapshot is no longer artificially limited to 49 statements');checks++;
 equal(original.sourceTables,25,'23 core and both existing supplemental tables captured');
 equal(original.core.rowCounts.customers,1,'original customer row carried');
 equal(original.core.highWater,{customer:1,job:1},'permanent job/customer sequence preserved');
 equal(original.supplemental.rowCounts.d1_migrations,25,'complete applied migration journal saved');
 equal(original.supplemental.tables.d1_migrations.at(-1).name,migrations.at(-1),'journal history is not reconstructed');
 equal(original.schemaIdentity.sha256,fingerprintIsolatedSqliteSchema(db).sha256,
  'D1 read-only schema fingerprint identical to existing isolated SQLite algorithm');
 equal(original.completeBackup,false,'review data never claims encrypted complete backup');
 equal(original.photoBytesIncluded,false,'customer photo metadata is not actual image bytes');
 equal(original.cloudflareWritesPerformed,false,'no provider or D1 modifications');
 equal(writes,0,'all captured SQL is read-only');
 // Provider-owned D1 internal tables must not be silently mistaken for
 // customer photos or archived as business data. Their precise reviewed DDL
 // is allowed without altering the physical business-schema fingerprint.
 db.exec('CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB)');
 db.exec('CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID');
 const provider=await captureCompleteReviewedD1RecordsReadOnly(makeD1());
 equal(provider.schemaIdentity.sha256,original.schemaIdentity.sha256,
  'exact Cloudflare provider bookkeeping does not corrupt source schema seal');
 equal(provider.sourceTables,25,'provider-only internal tables not exported as business');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(res=>{
  res[0].results.find(x=>x.name==='_cf_METADATA').sql='CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB, secret TEXT)';
 })), 'provider table with invented durable field must fail closed');
 db.exec('DROP TABLE _cf_METADATA; DROP TABLE _cf_KV');
 const originalRows=original.core.rowCounts.customers;
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(results=>{
  results[2].results.find(x=>x.table_name==='customers').count=0;
 })), 'fabricated independent count rejected');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(results=>{
  results[3].results[0].name=undefined;
 })), 'malformed customer data rejected');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(results=>{
  results.pop();
 })), 'partial batch response rejected');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(results=>{
  results[0].results.push({type:'table',name:'unreviewed_private',tbl_name:'unreviewed_private',sql:'CREATE TABLE unreviewed_private(id TEXT)'});
 })), 'unreviewed physical table must never be omitted');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(),{customerProperties:true,serviceLocations:false}),
  'property records without matching service locations are disallowed');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1(),{serviceLocations:true}),
  'feature-enabled missing optional source table is blocked');
 db.exec('CREATE TABLE unreviewed_business_history (id TEXT PRIMARY KEY,body TEXT)');
 await deny(captureCompleteReviewedD1RecordsReadOnly(makeD1()),
  'new unexpected durable table blocks allegedly complete backup');
 db.exec('DROP TABLE unreviewed_business_history');
 equal(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,originalRows,
  'all negative cases preserve original source business data');
 console.log('PASS '+checks+'/'+checks+' transactional FULL 25-table reviewed D1 core+supplemental records inventory, source schema hash, sequence and corruption guards; NO CLOUD/PHOTOS.');
}finally{db.close();}
