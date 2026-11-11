/** FIRE Gate 7 read-only legacy Sites review: real disposable SQLite source,
 * double-read contents, 18-table missing refund ledger and drift controls.
 * No Cloudflare, user data, Stripe, R2, production SQL or files are touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {captureLegacySitesReviewReadOnly} from '../lib/legacy-sites-readonly-export.mjs';
import {rehearseLegacySitesReviewToDisposableMemory} from './rehearse-legacy-sites-review-in-memory.mjs';

const legacyTables=[
 'customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions',
 'payment_checkout_sessions','estimate_items','payments','customer_photos',
 'customer_messages','notifications','message_templates','estimate_change_requests',
 'tasks','expenses','job_reports','deposit_policy_events'
];
assert.equal(legacyTables.length,18);
const initialize=()=>{
 const db=new DatabaseSync(':memory:');
 for(const table of legacyTables)db.exec('CREATE TABLE "'+table+'" (id TEXT PRIMARY KEY, owner TEXT, cents INTEGER)');
 db.exec('CREATE INDEX first_customer_owner_idx ON customers(owner)');
 db.prepare('INSERT INTO customers VALUES (?,?,?)').run('synthetic-customer','Owner-Only Sample',1);
 db.prepare('INSERT INTO estimates VALUES (?,?,?)').run('synthetic-estimate','synthetic-customer',2000);
 db.prepare('INSERT INTO payments VALUES (?,?,?)').run('synthetic-payment','synthetic-estimate',2000);
 return db;
};
const adapt=(db,mutate=()=>{})=>{
 let queries=0,batches=0,writes=0;
 const prepare=sql=>{
  if(!/^SELECT\b/i.test(sql)) {writes++;throw Error('Mutation blocked by synthetic D1 read-only adapter');}
  queries++;
  return {sql,all:async()=>({success:true,results:db.prepare(sql).all()})};
 };
 return {
  prepare,
  async batch(statements){
   batches++;
   const result=statements.map(statement=>({success:true,results:db.prepare(statement.sql).all()}));
   mutate(batches,db,result);
   return result;
  },
  stats:()=>({queries,batches,writes})
 };
};
test('legacy 18-table physical SQLite source exports all present rows, missing refund table honestly',async()=>{
 const db=initialize();
 try{
  const d1=adapt(db),snapshot=await captureLegacySitesReviewReadOnly(d1);
  assert.equal(snapshot.format,'fire-sites-legacy-records-review');
  assert.equal(snapshot.version,1);
  assert.equal(snapshot.completeBackup,false);
  assert.equal(snapshot.recoveryAuthorized,false);
  assert.equal(snapshot.sameInstantProviderSnapshotVerified,false);
  assert.equal(snapshot.originalPaymentRefundTablePresent,false);
  assert.equal(snapshot.missingRefundLedger,true);
  assert.equal(snapshot.photoObjectBytesIncluded,false);
  assert.equal(snapshot.sourceD1UuidVerified,false);
  assert.equal(snapshot.repeatReadRowsMatch,true);
  assert.equal(snapshot.schemaObjects.some(item=>item.name==='first_customer_owner_idx'),true);
  assert.match(snapshot.recordsSelfCheckSHA256,/^[0-9a-f]{64}$/);
  assert.equal(snapshot.recordsSelfCheckIsProviderAttestation,false);
  assert.equal(snapshot.sourceTables.length,18);
  assert.equal(snapshot.rowCounts.customers,1);
  assert.equal(snapshot.tables.payments[0].cents,2000);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot.tables,'payment_refunds'),false);
  assert.deepEqual(d1.stats(),{queries:39,batches:2,writes:0});
 }finally{db.close();}
});
test('legitimately present refund journal is exported without fabricating others',async()=>{
 const db=initialize();
 try{
  db.exec('CREATE TABLE payment_refunds (id TEXT PRIMARY KEY, payment_id TEXT, amount_cents INTEGER)');
  db.prepare('INSERT INTO payment_refunds VALUES (?,?,?)').run('refund1','synthetic-payment',200);
  const snapshot=await captureLegacySitesReviewReadOnly(adapt(db));
  assert.equal(snapshot.originalPaymentRefundTablePresent,true);
  assert.equal(snapshot.missingRefundLedger,false);
  assert.equal(snapshot.rowCounts.payment_refunds,1);
  assert.equal(snapshot.completeBackup,false);
 }finally{db.close();}
});
test('unknown source business tables are included, never silently discarded',async()=>{
 const db=initialize();
 try{
  db.exec('CREATE TABLE later_feature (id TEXT PRIMARY KEY, owner TEXT)');
  db.prepare('INSERT INTO later_feature VALUES (?,?)').run('row1','synthetic');
  const snapshot=await captureLegacySitesReviewReadOnly(adapt(db));
  assert.equal(snapshot.sourceTables.length,19);
  assert.equal(snapshot.tables.later_feature[0].id,'row1');
 }finally{db.close();}
});
test('same-count financial edits between two physical read batches block custody',async()=>{
 const db=initialize();
 try{
  const d1=adapt(db,batch=>{
   if(batch===1)db.exec("UPDATE payments SET cents=9999 WHERE id='synthetic-payment'");
  });
  await assert.rejects(()=>captureLegacySitesReviewReadOnly(d1),/BLOCKED/);
  assert.equal(d1.stats().writes,0);
 }finally{db.close();}
});
test('new permanent-number table refuses legacy path, requires separate v2',async()=>{
 const db=initialize();
 try{
  db.exec('CREATE TABLE fire_job_numbers (job_number INTEGER PRIMARY KEY, root_estimate_id TEXT)');
  await assert.rejects(()=>captureLegacySitesReviewReadOnly(adapt(db)),/BLOCKED/);
 }finally{db.close();}
});
test('source table-count quota cannot overrun D1 Free 50-query contract',async()=>{
 const db=initialize();
 try{
  for(let i=0;i<6;i++)db.exec('CREATE TABLE new_feature_'+i+' (id TEXT)');
  const d1=adapt(db);
  await assert.rejects(()=>captureLegacySitesReviewReadOnly(d1),/BLOCKED/);
  assert.equal(d1.stats().batches,0);
 }finally{db.close();}
});
test('sensitive source error is never forwarded by owner-only route',async()=>{
 const source=readFileSync(new URL('../app/api/backup/legacy-review/route.ts',import.meta.url),'utf8');
 assert.ok(!/export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)/.test(source));
 let js=source.slice(source.indexOf('const OWNER_EMAIL='))
  .replaceAll('status:number','status')
  .replaceAll('message:string','message')
  .replace('env as typeof env & {FIRE_LEGACY_SITES_REVIEW_EXPORT?:string}','env')
  .replace('export async function GET()','async function GET()');
 const state={env:{DB:{},FIRE_LEGACY_SITES_REVIEW_EXPORT:'owner-review-only'},
   LOCAL_CUSTOMER_DEPLOYMENT:'live',
   getChatGPTUser:async()=>null,
   captureLegacySitesReviewReadOnly:async()=>{throw Error('PRIVATE SQL CUSTOMER RECORDS MUST NOT LEAK')},
   Response};
 vm.runInNewContext(js+'\nthis.GET=GET;',state);
 const rejected=await state.GET();
 assert.equal(rejected.status,401);
 state.getChatGPTUser=async()=>({email:'synthetic-nonowner@example.invalid'});
 assert.equal((await state.GET()).status,401);
 state.getChatGPTUser=async()=>({email:'kylebrooks8605@gmail.com'});
 state.env.FIRE_LEGACY_SITES_REVIEW_EXPORT='';
 assert.equal((await state.GET()).status,404);
 state.env.FIRE_LEGACY_SITES_REVIEW_EXPORT='owner-review-only';
 state.LOCAL_CUSTOMER_DEPLOYMENT='qa';
 assert.equal((await state.GET()).status,404);
 state.LOCAL_CUSTOMER_DEPLOYMENT='live';
 const response=await state.GET();
 assert.equal(response.status,503);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal((await response.text()).includes('PRIVATE SQL CUSTOMER RECORDS'),false);
});

test('complete legacy record rows and SQL index definitions restore losslessly into new disposable memory',async()=>{
 const db=initialize();
 try{
  const source=await captureLegacySitesReviewReadOnly(adapt(db));
  const outcome=rehearseLegacySitesReviewToDisposableMemory(source);
  assert.equal(outcome.disposableInMemoryRoundTripVerified,true);
  assert.equal(outcome.recreatedTables,18);
  assert.ok(outcome.recreatedSchemaObjects>18);
  assert.equal(outcome.recoveredRecordCount,3);
  assert.equal(outcome.actualRemoteRestorePerformed,false);
  assert.equal(outcome.photoBytesRestored,false);
  assert.equal(outcome.releaseGate7Accepted,false);
 }finally{db.close();}
});
test('disposable memory restore refuses identity high-water and schema truncation',async()=>{
 const db=initialize();
 try{
  const source=await captureLegacySitesReviewReadOnly(adapt(db));
  const lostIndex={...source,schemaObjects:source.schemaObjects.filter(x=>x.type!=='index')};
  // Missing a declared SQL index must be caught by the local self-check.
  // This checksum catches accidental changes; it is NOT a provider signature.
  assert.throws(()=>rehearseLegacySitesReviewToDisposableMemory(lostIndex),/BLOCKED/);
  const changed={...source,sourceTables:source.sourceTables.slice(1)};
  assert.throws(()=>rehearseLegacySitesReviewToDisposableMemory(changed),/BLOCKED/);
  const autoincrement={...source,schemaObjects:source.schemaObjects.map(x=>
    x.type==='table'&&x.name==='customers'?{...x,sql:'CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT)'}:x)};
  assert.throws(()=>rehearseLegacySitesReviewToDisposableMemory(autoincrement),/BLOCKED/);
  const changedRows={...source,tables:{...source.tables,payments:[{id:'synthetic-payment'}]}};
  assert.throws(()=>rehearseLegacySitesReviewToDisposableMemory(changedRows),/BLOCKED/);
 }finally{db.close();}
});
