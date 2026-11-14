/**
 * FIRE Gate7 CHANGE-SCOPED 26-migration independent NEW LIVE restore rehearsal.
 * This deliberately uses only disposable :memory: Node SQLite, never a hosted
 * D1, owner Acer, production/customer data, Wrangler or Cloudflare API.
 * The older QA-25 profile remains independently tested unchanged.
 *
 * Tests actual source SQL -> synthetic numbered/financial records ->
 * empty NEW LIVE 26-schema restore -> post-restore exact rows, financial
 * refund ledger, permanent Customer/Job # high-water and transaction abort.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 validateNumberedCoreRecordsV2,planNumberedCoreRecordsV2Restore
} from '../lib/numbered-records-v2-preflight.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from '../lib/new-live-migration-journal.mjs';
import {restoreNumberedCoreV2ToDisposableMemory}
 from '../lib/disposable-numbered-v2-restore.mjs';

const migrationDir=new URL('../../adapters/doomsday/drizzle/',import.meta.url);
const additive=new URL('../../adapters/independent-live/drizzle/0025_independent_permanent_numbers.sql',import.meta.url);
const baseline=readdirSync(migrationDir).filter(f=>/^\d{4}_[\w-]+\.sql$/.test(f)).sort();
assert.equal(baseline.length,25);
assert.deepEqual(EXPECTED_NEW_LIVE_D1_MIGRATIONS,
 [...baseline,'0025_independent_permanent_numbers.sql']);
const liveNumbers=readFileSync(additive,'utf8');
const now='2026-11-14T20:00:00Z';
const pass=(a,b,label)=>{assert.deepEqual(a,b,label);count++};
const stop=(f,reason)=>{assert.throws(f,reason);count++};
let count=2;
function fresh(profile=':memory:'){
 const db=new DatabaseSync(profile);
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)');
 for(let i=0;i<baseline.length;i++){
  db.exec(readFileSync(new URL(baseline[i],migrationDir),'utf8'));
  db.prepare('INSERT INTO d1_migrations(id,name) VALUES(?,?)').run(i+1,baseline[i]);
 }
 db.exec(liveNumbers);
 db.prepare('INSERT INTO d1_migrations(id,name) VALUES(26,?)')
   .run('0025_independent_permanent_numbers.sql');
 return db;
}
function syntheticSource(db){
 const insert=(sql,...binds)=>db.prepare(sql).run(...binds);
 insert('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)','synthetic-new-live-c1','Synthetic Homeowner 1',now);
 insert('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)','synthetic-new-live-c2','Synthetic Homeowner 2',now);
 insert("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',5000,0,5000,2500,?)",
  'synthetic-new-live-e1','synthetic-new-live-c1',now);
 insert("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'draft',3600,0,3600,1800,?)",
  'synthetic-new-live-e2','synthetic-new-live-c2',now);
 insert("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Balance',5000,'paid','manual:synthetic-new-live-p1',?)",
  'synthetic-new-live-p1','synthetic-new-live-e1',now);
 insert("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Refund',-800,'paid','refund:synthetic-new-live-p1:synthetic-new-live-r1',?)",
  'synthetic-new-live-p2','synthetic-new-live-e1',now);
 insert("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,800,'manual','succeeded',?)",
  'synthetic-new-live-r1','synthetic-new-live-p1','synthetic-new-live-e1',now);
 insert('INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)',
  'synthetic-note-26','synthetic-new-live-c1','Synthetic backup record',now);
 insert('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)',
  3,'synthetic-new-live-c1',now);
 insert('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)',
  6,'synthetic-new-live-c2',now);
 insert('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)',
  2,'synthetic-new-live-e1',now);
 insert('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)',
  9,'synthetic-new-live-e2',now);
 insert('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)','synthetic-new-live-e1',2);
 insert('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)','synthetic-new-live-e2',9);
 db.prepare("UPDATE sqlite_sequence SET seq=12 WHERE name='fire_customer_numbers'").run();
 db.prepare("UPDATE sqlite_sequence SET seq=17 WHERE name='fire_job_numbers'").run();
}
function snapshot(db){
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]
  .map(t=>[t,db.prepare('SELECT * FROM "'+t+'"').all()]));
 return {
  format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),
  highWater:{
   customer:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get()?.seq??0,
   job:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get()?.seq??0
  }
 };
}
const original=fresh(),restored=fresh();
let copy=null;
try{
 syntheticSource(original);
 const records=snapshot(original);
 pass(validateNumberedCoreRecordsV2(records).jobLinks,2,
  'Actual 26-migration source snapshot validates immutable two-job mapping');
 const result=restoreNumberedCoreV2ToDisposableMemory(restored,records,{
  schemaProfile:'independent-live-26'
 });
 pass(result.schemaProfile,'independent-live-26','exact 26-profile reported');
 pass(result.reviewed26MigrationJournalPreserved,true,'migration journal preserved, never restored from records file');
 pass(result.completedAtomicInMemoryRestore,true,'one in-memory transaction restored core records');
 pass(result.actualHostedRestorePerformed,false,'no Cloudflare D1 or owner records modified');
 pass(result.gate7Accepted,false,'core alone does not close backup/photo Gate7');
 pass(snapshot(restored),records,'all 23 core and permanent number records match originals');
 pass(restored.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
  'destination 26 journal remains unchanged after restoration');
 pass(planNumberedCoreRecordsV2Restore(records,snapshot(restored)).insertCoreRecords.payments,0,
  'no duplicate negative refund or original paid ledger');
 pass(restored.prepare('PRAGMA foreign_key_check').all(),[],
  'restored 26 source foreign keys all valid');
 pass(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok',
  'restored 26 schema SQLite integrity valid');
 // The original high-water, not merely the greatest existing row, governs
 // next generation. Preserve both job/customer number permanently.
 restored.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('synthetic-new-live-c3','Synthetic new customer',now);
 restored.prepare('INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES (?,?)')
  .run('synthetic-new-live-c3',now);
 pass(restored.prepare('SELECT customer_number AS n FROM fire_customer_numbers WHERE customer_id=?')
  .get('synthetic-new-live-c3').n,13,'customer number continues after saved #0012');
 restored.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'draft',1000,0,1000,500,?)")
  .run('synthetic-new-live-e3','synthetic-new-live-c3',now);
 restored.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)')
  .run('synthetic-new-live-e3',now);
 pass(restored.prepare('SELECT job_number AS n FROM fire_job_numbers WHERE root_estimate_id=?')
  .get('synthetic-new-live-e3').n,18,'job number resumes after saved #0017');
 const denied=(name,mutate,options={schemaProfile:'independent-live-26'})=>{
  const db=fresh();
  try{
   mutate(db);
   const before=db.prepare('SELECT COUNT(*) AS n FROM customers').get().n;
   stop(()=>restoreNumberedCoreV2ToDisposableMemory(db,records,options),
    /FIRE disposable numbered restore blocked|FIRE numbered records v2 blocked/);
   pass(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,before,
    name+' leaves preexisting synthetic records untouched');
  }finally{db.close();}
 };
 denied('wrong or forged journal',db=>db.prepare("UPDATE d1_migrations SET name='forged.sql' WHERE id=19").run());
 denied('missing last migration',db=>db.prepare('DELETE FROM d1_migrations WHERE id=26').run());
 denied('unknown stateful table',db=>db.exec('CREATE TABLE unreviewed_payment_details(id TEXT)'));
 denied('existing customer in target',db=>db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)')
  .run('must-keep-existing','Synthetic existing customer',now));
 denied('accidentally using old QA-25 profile',db=>{}, {schemaProfile:'qa-25'});
 denied('unknown schema profile',db=>{}, {schemaProfile:'production-anything'});
 // Create an actually altered empty on-memory table, then restore original
 // trigger/index names. This proves journal+index+trigger name checks ALONE
 // would miss weaker financial or permanent-number table constraints.
 const alterEmptyReviewedTable=(db,table,modify)=>{
  const ddl=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table)?.sql;
  assert.equal(typeof ddl,'string');
  const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL").all(table).map(r=>r.sql);
  const triggers=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name=?").all(table).map(r=>r.sql);
  const altered=modify(ddl);
  assert.notEqual(altered,ddl,'synthetic table tamper must change actual SQL');
  db.exec('DROP TABLE "'+table+'"');
  db.exec(altered);
  for(const sql of indexes)db.exec(sql);
  for(const sql of triggers)db.exec(sql);
 };
 // Journal names may match while critical DDL was modified.
 denied('refund cents type changed despite original indexes',db=>
  alterEmptyReviewedTable(db,'payment_refunds',ddl=>
   ddl.replace(/(amount_cents`?\s+)integer\b/i,'$1TEXT')));
 denied('refund payment foreign key silently removed',db=>
  alterEmptyReviewedTable(db,'payment_refunds',ddl=>
   ddl.replace(/,\s*FOREIGN KEY\s*\(`payment_id`\)\s+REFERENCES\s+`payments`\(`id`\)\s+ON UPDATE no action ON DELETE no action/i,'')));
 denied('permanent customer sequence loses AUTOINCREMENT',db=>
  alterEmptyReviewedTable(db,'fire_customer_numbers',ddl=>
   ddl.replace(/\bAUTOINCREMENT\b/i,'')));
 denied('same-name inert Job # trigger',db=>db.exec(
  'DROP TRIGGER fire_job_numbers_no_update; CREATE TRIGGER fire_job_numbers_no_update BEFORE UPDATE ON fire_job_numbers BEGIN SELECT 1; END;'));
 denied('same-name inert customer # trigger',db=>db.exec(
  'DROP TRIGGER fire_customer_numbers_no_delete; CREATE TRIGGER fire_customer_numbers_no_delete BEFORE DELETE ON fire_customer_numbers BEGIN SELECT 1; END;'));
 denied('same-name inert permanent job link',db=>db.exec(
  'DROP TRIGGER fire_job_estimate_links_no_update; CREATE TRIGGER fire_job_estimate_links_no_update BEFORE UPDATE ON fire_job_estimate_links BEGIN SELECT 1; END;'));
 denied('removed refund ledger unique index',db=>db.exec(
  'DROP INDEX idx_payments_unique_refund_provider'));
 denied('weakened partial refund uniqueness',db=>db.exec(
  "DROP INDEX idx_payments_unique_refund_provider; CREATE UNIQUE INDEX idx_payments_unique_refund_provider ON payments(provider_id) WHERE provider_id LIKE 'manual:%'"));
 denied('same name nonunique invoice index',db=>db.exec(
  'DROP INDEX idx_invoices_one_per_estimate; CREATE INDEX idx_invoices_one_per_estimate ON invoices(estimate_id)'));
 denied('missing provider refund index',db=>db.exec(
  'DROP INDEX idx_payment_refunds_provider'));
 denied('missing job link lookup index',db=>db.exec(
  'DROP INDEX idx_fire_job_estimate_links_number'));
 const interrupted=fresh();
 try{
  stop(()=>restoreNumberedCoreV2ToDisposableMemory(interrupted,records,{
   schemaProfile:'independent-live-26',testInterruptAfterRows:3
  }),/FIRE synthetic interrupted restore/);
  pass(interrupted.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0,
   'transaction interrupted; all source customer writes rolled back');
  pass(interrupted.prepare('SELECT COUNT(*) AS n FROM payment_refunds').get().n,0,
   'transaction interrupted; no refund journal persisted');
  pass(interrupted.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
   'interruption preserved original 26-migration journal');
 }finally{interrupted.close();}
 // A :memory: rehearsal API must not be repurposable to write any on-disk DB.
 const folder=mkdtempSync(join(tmpdir(),'fire-new-live-no-disk-'));
 const disk=fresh(join(folder,'unapproved-source-only.sqlite'));
 try{
  stop(()=>restoreNumberedCoreV2ToDisposableMemory(disk,records,{
   schemaProfile:'independent-live-26'
  }),/only an unattached in-memory SQLite database/);
 }finally{disk.close();rmSync(folder,{recursive:true,force:true});}
 console.log('PASS '+count+'/'+count+
 ' source-built NEW LIVE 26-migration disposable restore, immutable Job/Customer high-water, refund ledger, rollback, journal and disk refusal; 0 hosted/provider writes.');
}finally{original.close();restored.close();}
