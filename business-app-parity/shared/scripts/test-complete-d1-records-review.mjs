/** Gate7 complete D1 records review: actual 25-migration native SQLite fixture.
 * Tests the SOURCE-ONLY full core+supplemental transactional capture.
 * No account, hosted D1, owner records, Stripe, photo bytes or network.
 */
import assert from 'node:assert/strict';
// Also prove this browser ciphertext restores into the ACTUAL independent
// NEW LIVE 26-migration schema without ever touching hosted D1.
import './test-complete-d1-26-restore.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readOwnerCompleteD1ReviewResponse,MAX_COMPLETE_D1_REVIEW_HTTP_BYTES}
 from '../lib/complete-d1-review-response.mjs';
import {prepareCompleteD1OwnerFile,verifySelectedSavedCompleteD1OwnerFile,
 verifyProtectedCompleteReviewedD1Records}
 from '../lib/protected-complete-d1-records.mjs';
import {inspectSavedProtectedCompleteRecords}
 from '../../protected_complete_isolated_sqlite_recovery.mjs';
import {captureCompleteReviewedD1RecordsReadOnly} from '../lib/complete-d1-records-review.mjs';
import {fingerprintIsolatedSqliteSchema} from '../../fingerprint_isolated_sqlite_schema.mjs';

const base='../adapters/doomsday/drizzle';
const migrations=readdirSync(base).filter(x=>/^[0-9]{4}_.+\.sql$/.test(x)).sort();
assert.equal(migrations.length,25);
const db=new DatabaseSync(':memory:');
let checks=0, batches=0,statements=0,writes=0;
// Browser bundle must use the SAME validation code as existing Node restore,
// with only the import-root adjustment needed by isolated Worker builds.
const shared=readFileSync('lib/complete-supplemental-recovery-validation.mjs','utf8');
const root=readFileSync('../validate_supplemental_recovery_archive.mjs','utf8');
assert.equal(shared,root.replaceAll('./shared/lib/','./'),
 'Browser supplemental validator matches canonical existing offline recovery');
const sharedHistory=readFileSync('lib/complete-supplemental-customer-history.mjs','utf8');
const rootHistory=readFileSync('../validate_supplemental_customer_history.mjs','utf8');
assert.equal(sharedHistory,rootHistory.replaceAll('./shared/lib/','./'),
 'Browser property/service-address checks match existing offline restore');
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
 // Strict *actual route-envelope* reader refuses a malformed, cacheable,
 // interrupted, nonowner/redirect or falsely complete source before encryption.
 const ownerWrapper={format:'fire-complete-d1-records-owner-review',version:1,
  completeBackup:false,recoveryAuthorized:false,offDeviceCustodyVerified:false,
  photoBytesIncluded:false,warning:'ALL REVIEWED DATABASE RECORDS, NOT A PROTECTED OR COMPLETE BACKUP. Actual photo bytes are absent.',
  reviewedRecords:original};
 const fullResponse=(value=ownerWrapper,headers={})=>new Response(JSON.stringify(value),{
  status:200,headers:{'content-type':'application/json','cache-control':'private, no-store',
   'content-disposition':'attachment; filename="fire-complete-records-review-NOT-PROTECTED-BACKUP.json"',
   ...headers}});
 const browserSource=await readOwnerCompleteD1ReviewResponse(fullResponse());
 equal(browserSource.format,'fire-full-d1-records-review',
  'validated HTTP source preserves exact full envelope needed by owner encryption');
 equal(browserSource.core.tables.customers[0].id,'full-review-customer',
  'strict HTTP full-response stream yields exact full customer archive');
 equal(browserSource.supplemental.tables.d1_migrations.length,25,
  'strict HTTP private review preserves full migration journal');
 for(const [name,modified,headers] of [
  ['falsely called backup',{...ownerWrapper,completeBackup:true},{}],
  ['claimed photos',{...ownerWrapper,photoBytesIncluded:true},{}],
  ['supplemental history missing',{...ownerWrapper,reviewedRecords:{...original,
    supplemental:{...original.supplemental,tables:{auth_rate_limits:[]}}}},{}],
  ['cacheable owner response',ownerWrapper,{'cache-control':'public, max-age=600'}],
  ['unlabeled plaintext file',ownerWrapper,{'content-disposition':'attachment; filename="backup.json"'}],
  ['HTML data substituted',ownerWrapper,{'content-type':'text/html'}]]) {
  await assert.rejects(readOwnerCompleteD1ReviewResponse(fullResponse(modified,headers)),
   /FIRE complete D1 owner review blocked:/,'deny '+name);checks++;
 }
 await assert.rejects(readOwnerCompleteD1ReviewResponse(new Response('x'.repeat(MAX_COMPLETE_D1_REVIEW_HTTP_BYTES+1),{
  headers:{'content-type':'application/json','cache-control':'private, no-store',
   'content-disposition':'attachment; filename="fire-complete-records-review-NOT-PROTECTED-BACKUP.json"'}})),
   /FIRE complete D1 owner review blocked:/,
   'full review source exceeding bounded response must be refused');checks++;
 // Browser WebCrypto MUST create the exact existing 48-byte FIRERB01
 // .firerecords format that the already-written Node offline recovery accepts.
 // A new incompatible browser-only backup format would NOT close Gate7.
 const phrase='synthetic-only FIRE complete records recovery phrase 2026';
 // Exercise the REAL owner UI: HTTP stream -> strict reader -> protected file.
 // A reduced validation summary must never replace the full source envelope.
 const prepared=await prepareCompleteD1OwnerFile(browserSource,phrase,phrase,
  new Date('2026-11-15T12:01:00.000Z'));
 equal(prepared.inMemoryEncryptionVerified,true,
  'complete source (core+supplemental) encrypted to private owner Blob');
 equal(prepared.gate7Accepted,false,
  'new file cannot claim live recovery or physical off-device custody');
 const temp=mkdtempSync(join(tmpdir(),'fire-browser-full-records-'));
 try{
  const privateFile=join(temp,prepared.filename);
  writeFileSync(privateFile,Buffer.from(await prepared.blob.arrayBuffer()),{mode:0o600,flag:'wx'});
  const actualSaved=new Blob([readFileSync(privateFile)]);
  const browser=await verifySelectedSavedCompleteD1OwnerFile(prepared,actualSaved,phrase);
  equal(browser.selectedCiphertextIdentical,true,
   'deliberately reopened saved encrypted file matches exact prepared bytes');
  equal(browser.originalPhotoBytesIncluded,false,
   'complete database records do not pretend to carry the original customer photos');
  equal(browser.sourceTables,25,'full protected record file includes migrations and auth table');
  const node=await inspectSavedProtectedCompleteRecords(privateFile,phrase);
  equal(node.savedEncryptedFileReadBack,true,
   'actual existing OFFLINE Node FIRERB01 reader authenticates browser-produced file');
  equal(node.core.tables.customers[0].id,'full-review-customer',
   'Node recovery reads actual encrypted original customer records');
  equal(node.supplemental.tables.d1_migrations.length,25,
   'Node offline recovery reads all 25 original migrations from browser ciphertext');
  equal(node.proof.schemaSha256,original.schemaIdentity.sha256,
   'Node offline recovery preserves full SQLite source schema hash');
  const forged=Buffer.from(readFileSync(privateFile));forged[50]^=1;
  await assert.rejects(verifyProtectedCompleteReviewedD1Records(new Blob([forged]),phrase),
   /FIRE protected complete D1 records blocked:/,
   'tampered encrypted complete file must fail authentication before restore');checks++;
  await assert.rejects(verifyProtectedCompleteReviewedD1Records(actualSaved,
   'not the same 2026 synthetic FIRE private phrase'),
   /FIRE protected complete D1 records blocked:/,
   'wrong phrase cannot expose customer records');checks++;
  equal(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1,
   'encryption, file save and readback never mutate original data');
 }finally{rmSync(temp,{recursive:true,force:true});}
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
