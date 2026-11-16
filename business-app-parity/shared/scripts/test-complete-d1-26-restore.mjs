/** Gate7 changed functionality ONLY: synthetic full 26-migration independent
 * NEW LIVE D1 -> reviewed transactional complete D1 -> browser AES-GCM
 * FIRERB01 .firerecords -> existing Node PRIVATE ISOLATED SQLite restore.
 * No remote D1, Stripe, owner files, credentials, Cloudflare, photos or deploy.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,copyFileSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureCompleteReviewedD1RecordsReadOnly}
 from '../lib/complete-d1-records-review.mjs';
import {prepareCompleteD1OwnerFile,verifySelectedSavedCompleteD1OwnerFile,
 protectCompleteReviewedD1Records}
 from '../lib/protected-complete-d1-records.mjs';
import {restoreSavedProtectedCompleteRecords}
 from '../../protected_complete_isolated_sqlite_recovery.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS}
 from '../lib/new-live-migration-journal.mjs';
const base='../adapters/doomsday/drizzle';
const migrationNames=readdirSync(base).filter(x=>/^[0-9]{4}_.+\.sql$/.test(x)).sort();
assert.equal(migrationNames.length,25);
assert.deepEqual(migrationNames,EXPECTED_NEW_LIVE_D1_MIGRATIONS.slice(0,25));
const fullSql=readFileSync('../adapters/independent-live/drizzle/0025_independent_permanent_numbers.sql','utf8');
const dir=mkdtempSync(join(tmpdir(),'fire-full-26-synthetic-'));
const template=join(dir,'empty_26.sqlite'),source=join(dir,'source_26.sqlite'),
 output=join(dir,'restored_26.sqlite'),protectedFile=join(dir,'browser_26.firerecords');
const date='2026-11-15T12:00:00.000Z';
const phrase='synthetic only FIRE complete 26 migration offline restore';
let checks=0;
const ok=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
try{
 const db=new DatabaseSync(template);
 for(const name of migrationNames)db.exec(readFileSync(base+'/'+name,'utf8'));
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE)');
 const insert=db.prepare('INSERT INTO d1_migrations(name) VALUES (?)');
 for(const name of migrationNames)insert.run(name);
 db.exec(fullSql);
 insert.run('0025_independent_permanent_numbers.sql');
 ok(db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
  'the actual source-frozen 26 reviewed migrations were applied ONLY in disposable SQLite');
 ok(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0,
  'independent NEW LIVE source template begins empty');
 ok(db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,0,
  'Job #0001 remains available before any synthetic data is inserted');
 db.close();
 copyFileSync(template,source);
 const src=new DatabaseSync(source);
 src.exec('PRAGMA foreign_keys=ON');
 src.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)').run(
  'synthetic-full-26-customer','Synthetic NEW LIVE Restore',date);
 src.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'draft',10000,10000,5000,?)").run(
  'synthetic-full-26-estimate','synthetic-full-26-customer',date);
 src.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES (?,?,?)').run(
  1,'synthetic-full-26-customer',date);
 src.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES (?,?,?)').run(
  1,'synthetic-full-26-estimate',date);
 src.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)').run(
  'synthetic-full-26-estimate',1);
 let reads=0,writes=0,batches=0;
 const d1={
  prepare(sql){
   if(!/^(SELECT\b|PRAGMA table_xinfo\()/i.test(sql)){writes++;throw Error('unsafe D1 source query');}
   reads++;return {sql,values:[],bind(...values){return{sql,values}}};
  },
  async batch(stmts){
   batches++;src.exec('BEGIN');let out;
   try{out=stmts.map(x=>({success:true,results:src.prepare(x.sql).all(...x.values)}));
    src.exec('COMMIT');return out;
   }catch(e){src.exec('ROLLBACK');throw e;}
  }
 };
 const review=await captureCompleteReviewedD1RecordsReadOnly(d1);
 ok(batches,1,'all 26 migration and app record data captured in one transactional D1 batch');
 assert.ok(reads>50,'complete Free-tier batch includes all supplemental tables');checks++;
 ok(writes,0,'source D1 queries never mutate financial or customer data');
 ok(review.supplemental.tables.d1_migrations.length,26,'full source review preserves 26 applied migrations');
 ok(review.core.highWater.job,1,'synthetic first job permanently numbered 0001');
 ok(review.photoBytesIncluded,false,'database-only backup never claims customer photo bytes');
 const prepared=await prepareCompleteD1OwnerFile(review,phrase,phrase);
 writeFileSync(protectedFile,Buffer.from(await prepared.blob.arrayBuffer()),{mode:0o600,flag:'wx'});
 const saved=new Blob([readFileSync(protectedFile)]);
 const confirmed=await verifySelectedSavedCompleteD1OwnerFile(prepared,saved,phrase);
 ok(confirmed.selectedCiphertextIdentical,true,'saved independent FIRECD browser encrypted file byte-identical');
 ok(confirmed.migrationCount,26,'browser decrypted saved file retains actual 26 migration journal');
 src.close();
 const restored=await restoreSavedProtectedCompleteRecords(protectedFile,template,output,phrase);
 ok(restored.sqliteRestoreVerified,true,'existing Node offline engine physically restored browser full-record file');
 ok(restored.existingD1MigrationRowsVerified,26,'recovery preserved existing destination 26-migration journal');
 ok(restored.photosRestored,false,'isolation restore never claims original customer photos restored');
 const recovered=new DatabaseSync(output,{readOnly:true});
 ok(recovered.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1,'original customer records physically recovered');
 ok(recovered.prepare('SELECT job_number AS n FROM fire_job_numbers').get().n,1,'future first job preserves number 0001');
 ok(recovered.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq,1,
  'next Job # allocation cannot reuse restored 0001');
 ok(recovered.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
  'restored physical D1 migration journal is exactly complete');
 recovered.close();
 const damaged=structuredClone(review);
 damaged.supplemental.tables.d1_migrations.pop();
 await assert.rejects(protectCompleteReviewedD1Records(damaged,phrase),/blocked/,
  'truncated 26 migration source cannot be offered as a protected complete file');
 checks++;
 console.log('PASS '+checks+'/'+checks+' exact independent 26-migration synthetic D1 browser AES-GCM -> existing FIRERB01 Node isolated SQLite restore; Job #0001, journal, no provider/real files.');
}finally{rmSync(dir,{recursive:true,force:true});}
