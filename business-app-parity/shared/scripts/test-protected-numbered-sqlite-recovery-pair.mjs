/** Gate 7 NEW integrated no-R2 path: REAL FIRE ZIP -> protected file ->
 * decoded FIRE ZIP -> separate disposable 25-migration SQLite restore ->
 * independently regenerated record + photo SHA-256 pair seal.
 *
 * SYNTHETIC ONLY. No provider, installed browser, local user vault, remote
 * storage, persistent database, credential or customer communication. The
 * exercise proves no hosted or off-device custody and never accepts Gate 7.
 */
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION}
 from '../lib/numbered-records-v2-preflight.mjs';
import {restoreNumberedCoreV2ToDisposableMemory}
 from '../lib/disposable-numbered-v2-restore.mjs';
import {sealNumberedRecordAndPhotoRecoveryPair,
 compareNumberedRecordAndPhotoPairSeals}
 from '../lib/numbered-photo-recovery-pair.mjs';
import {protectOfflinePhotoZip,recoverProtectedOfflinePhotoZip}
 from '../lib/protected-offline-photo-archive.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const require=createRequire(import.meta.url),ts=require('typescript');
const parent=dirname(fileURLToPath(import.meta.url));
const shared=join(parent,'..');
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
const compile=(path,deps)=>{
 const source=readFileSync(join(shared,'lib',path),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions}).outputText;
 const exports={};
 new Function('exports','require',compiled)(exports,name=>{
  if(!Object.hasOwn(deps,name))throw Error('Undeclared offline ZIP dependency: '+name);
  return deps[name];
 });
 return exports;
};
const zipper=compile('photo-storage-zip.ts',{});
const offline=compile('offline-photo-backup.ts',{'./photo-storage-zip':zipper});
const sourceParityRoot=process.env.FIRE_TEST_SCHEMA_ROOT||join(shared,'..');
const dir=join(sourceParityRoot,'adapters','doomsday','drizzle');
const migrations=readdirSync(dir).filter(x=>/^\d{4}_[\w-]+\.sql$/.test(x)).sort();
assert.equal(migrations.length,25,'exact existing reviewed 25-schema SQL');
const schema=migrations.map(x=>readFileSync(join(dir,x),'utf8')).join('\n')+
 '\n'+readFileSync(join(sourceParityRoot,'customer-numbering','customer_numbers_v1.sql'),'utf8')+
 '\n'+readFileSync(join(sourceParityRoot,'job-numbering','job_numbers_v1.sql'),'utf8');
const DB=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(schema);db.exec('PRAGMA foreign_keys=ON');
 return db;
};
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES];
const snapshot=db=>{
 const data=Object.fromEntries(tables.map(t=>[t,db.prepare('SELECT * FROM "'+t+'"').all()]));
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables:data,
  rowCounts:Object.fromEntries(tables.map(t=>[t,data[t].length])),
  highWater:{customer:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get()?.seq??0,
   job:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get()?.seq??0}};
};
let checks=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const equal=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const blocked=async(p,regex,msg)=>{await assert.rejects(p,regex,msg);checks++;};
const now='2026-11-13T00:00:00Z';
const password='FIRE synthetic device backup recovery 2026 #not-a-secret';
const source=DB(),restored=DB(),neverChanged=DB();
try{
 source.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)')
  .run('synthetic-c1','NO REAL CUSTOMER',now);
 source.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',3500,0,3500,1750,?)")
  .run('synthetic-e1','synthetic-c1',now);
 source.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Balance',3500,'paid',?,?)")
  .run('synthetic-payment','synthetic-e1','manual:synthetic-payment',now);
 source.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Refund',-500,'paid',?,?)")
  .run('synthetic-negative-refund','synthetic-e1','refund:synthetic-payment:synthetic-refund',now);
 source.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,500,'manual','succeeded',?)")
  .run('synthetic-refund','synthetic-payment','synthetic-e1',now);
 source.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)')
  .run(7,'synthetic-c1',now);
 source.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)')
  .run(11,'synthetic-e1',now);
 source.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)')
  .run('synthetic-e1',11);
 source.prepare("UPDATE sqlite_sequence SET seq=13 WHERE name='fire_customer_numbers'").run();
 source.prepare("UPDATE sqlite_sequence SET seq=18 WHERE name='fire_job_numbers'").run();
 const before=snapshot(source),empty=snapshot(restored);
 const photo=[{id:'synthetic-photo1',customerId:'synthetic-c1',
  category:'before',caption:'Synthetic exterior only',filename:'example.jpg',
  contentType:'image/jpeg',sizeBytes:5,createdAt:now,
  blob:new Blob([Uint8Array.from([15,42,96,1,72])],{type:'image/jpeg'})}];
 const initial=await sealNumberedRecordAndPhotoRecoveryPair(before,photo);
 equal(initial.jobHighWater,18,'original high-water records consumed Job #s beyond existing 11');
 ok(initial.gate7Accepted===false,'pair seal never claims provider or off-device proof');
 const genuineFireZip=await offline.exportOfflinePhotoBackup(photo);
 const protectedFile=await protectOfflinePhotoZip(genuineFireZip,password);
 ok(protectedFile.size>genuineFireZip.size,'real FIRE ZIP protected under authenticated encryption');
 const plaintext=await recoverProtectedOfflinePhotoZip(protectedFile,password);
 const recoveredPhotos=await offline.readOfflinePhotoBackup(plaintext);
 equal(recoveredPhotos.length,1,'existing FIRE SHA-256 ZIP parser accepts fully decrypted archive');
 equal(await recoveredPhotos[0].blob.arrayBuffer(),await photo[0].blob.arrayBuffer(),
  'actual binary photo bytes survive protected export + verified archive import');
 await blocked(recoverProtectedOfflinePhotoZip(protectedFile,'incorrect phrase but still long enough'),
  /wrong passphrase|damaged protected/i,'wrong recovery key cannot release bytes');
 const corrupt=new Uint8Array(await protectedFile.arrayBuffer());
 corrupt[corrupt.length-19]^=16;
 await blocked(recoverProtectedOfflinePhotoZip(new Blob([corrupt]),password),
  /wrong passphrase|damaged protected/i,'later corrupted encrypted bytes prevent recovery');
 equal(snapshot(neverChanged),empty,'wrong-key/corrupted archive leaves separate disposable DB untouched');
 // Full core v2 SQL restore is atomic in the destination. No remote connection,
 // disk file, D1 binding or paid service is ever given to this restore API.
 const receipt=restoreNumberedCoreV2ToDisposableMemory(restored,before);
 ok(receipt.completedAtomicInMemoryRestore===true&&!receipt.hostedWritesPerformed,
  'same 25-migration SQL and real permanent-numbering triggers restored atomically');
 const after=snapshot(restored);
 equal(after,before,'all 23 core+identity tables, refunds, source serial values and columns restored');
 const recoveredSeal=await sealNumberedRecordAndPhotoRecoveryPair(after,recoveredPhotos);
 ok(compareNumberedRecordAndPhotoPairSeals(initial,recoveredSeal).sourceAndDestinationMatch,
  'actual encrypted photo ZIP and independently recovered SQL content match paired hashes');
 ok(recoveredSeal.gate7Accepted===false&&receipt.completeAppAndPhotoRecoveryVerified===false,
  'synthetic success does not close hosted recovery gate');
 const wrongPhoto=[{...recoveredPhotos[0],blob:new Blob([Uint8Array.from([15,42,96,1,73])],{type:'image/jpeg'})}];
 const differentPhotoSeal=await sealNumberedRecordAndPhotoRecoveryPair(after,wrongPhoto);
 await blocked(Promise.resolve().then(()=>compareNumberedRecordAndPhotoPairSeals(initial,differentPhotoSeal)),
  /blocked/i,'one changed photo byte cannot pass full recovery pair');
 const missingPhotoSeal=await sealNumberedRecordAndPhotoRecoveryPair(after,[]);
 await blocked(Promise.resolve().then(()=>compareNumberedRecordAndPhotoPairSeals(initial,missingPhotoSeal)),
  /blocked/i,'records-only recovery with missing owner photo cannot claim complete pair');
 const changedRefund=structuredClone(after);
 changedRefund.tables.payment_refunds[0].amount_cents=400;
 await blocked(sealNumberedRecordAndPhotoRecoveryPair(changedRefund,recoveredPhotos),
  /blocked/i,'financial-refund ledger tamper prevents a recovery seal');
 equal(snapshot(neverChanged),empty,'all adversarial cases leave separate destination empty');
 console.log('PASS '+checks+'/'+checks+' integrated protected FIRE photo ZIP + actual 25-migration in-memory numbered SQLite/refund recovery + paired hash verification. SYNTHETIC ONLY. No provider/remote writes or Gate7 acceptance.');
}finally{source.close();restored.close();neverChanged.close();}
