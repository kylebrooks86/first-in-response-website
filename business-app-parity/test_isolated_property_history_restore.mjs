/** FIRE actual disposable SQLite property archival/estimate link recovery.
 * Uses real candidate service-address/property SQL triggers, not a mocked
 * checksum or a table-only preflight. No owner records, D1, R2 or providers.
 * Run: node --experimental-sqlite business-app-parity/test_isolated_property_history_restore.mjs
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,copyFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES}
 from './shared/lib/numbered-records-v2-preflight.mjs';
import {exportCompleteIsolatedSqliteSnapshot}
 from './export_complete_isolated_sqlite_snapshot.mjs';
import {restoreNumberedRecordsToIsolatedSqlite}
 from './restore_numbered_records_to_isolated_sqlite.mjs';

const folder=await mkdtemp(join(tmpdir(),'fire-property-history-'));
const template=join(folder,'empty-migrated.sqlite'),source=join(folder,'synthetic-source.sqlite');
const corePath=join(folder,'core.json'),extraPath=join(folder,'extra.json');
const output=join(folder,'recovered.sqlite'),cid='customer-synthetic',eid='estimate-synthetic',
 pid='property-synthetic',when='2026-11-15T17:00:00.000Z',born='2026-11-14T17:00:00.000Z';
let checks=0;
const check=(value,description)=>{assert.ok(value,description);checks++};
const rejected=async(file,mutate,name)=>{
 const original=JSON.parse(await readFile(extraPath,'utf8'));
 const changed=structuredClone(original);mutate(changed);
 await writeFile(file,JSON.stringify(changed));
 const destination=file+'.sqlite';
 await assert.rejects(
  restoreNumberedRecordsToIsolatedSqlite(corePath,template,destination,file),
  /BLOCKED|property history|customer|service-address|incomplete|inventory/i,
  name);
 await assert.rejects(readFile(destination),undefined,
  'Rejected property recovery must leave NO partial destination: '+name);
 checks+=2;
};
try{
 const db=new DatabaseSync(template);
 for(const table of [...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]){
  if(table==='customers')
   db.exec('CREATE TABLE customers(id TEXT PRIMARY KEY,created_at TEXT NOT NULL)');
  else if(table==='estimates')
   db.exec('CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),created_at TEXT NOT NULL)');
  else if(table==='fire_customer_numbers')
   db.exec('CREATE TABLE fire_customer_numbers(customer_number INTEGER PRIMARY KEY AUTOINCREMENT,customer_id TEXT UNIQUE NOT NULL REFERENCES customers(id),created_at TEXT NOT NULL)');
  else if(table==='fire_job_numbers')
   db.exec('CREATE TABLE fire_job_numbers(job_number INTEGER PRIMARY KEY AUTOINCREMENT,root_estimate_id TEXT UNIQUE NOT NULL REFERENCES estimates(id),created_at TEXT NOT NULL)');
  else if(table==='fire_job_estimate_links')
   db.exec('CREATE TABLE fire_job_estimate_links(estimate_id TEXT PRIMARY KEY REFERENCES estimates(id),job_number INTEGER NOT NULL REFERENCES fire_job_numbers(job_number))');
  else {
   const column=table==='message_templates'?'key':
    table==='deposit_agreement_snapshots'?'event_id':'id';
   db.exec('CREATE TABLE "'+table+'"("'+column+'" TEXT PRIMARY KEY)');
  }
 }
 db.exec(await readFile('business-app-parity/shared/db/candidate-service-locations.sql','utf8'));
 db.exec(await readFile('business-app-parity/shared/db/candidate-customer-properties.sql','utf8'));
 db.close();
 await copyFile(template,source);
 const src=new DatabaseSync(source);
 src.exec('PRAGMA foreign_keys=ON');
 src.prepare('INSERT INTO customers(id,created_at) VALUES (?,?)').run(cid,born);
 src.prepare('INSERT INTO estimates(id,customer_id,created_at) VALUES (?,?,?)').run(eid,cid,when);
 src.prepare('INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES (?,?)').run(cid,born);
 src.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)').run(eid,when);
 src.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)').run(eid,1);
 src.prepare('INSERT INTO customer_properties(id,customer_id,address,designation,active,revision,created_at) VALUES (?,?,?,?,?,?,?)')
  .run(pid,cid,'123 Example Road','Rear gate',1,1,born);
 src.prepare('INSERT INTO estimate_service_locations(estimate_id,customer_id,address,captured_at) VALUES (?,?,?,?)')
  .run(eid,cid,'123 Example Road · Rear gate',when);
 src.prepare('INSERT INTO estimate_property_links(estimate_id,customer_id,property_id,property_revision,selection_mode,captured_at) VALUES (?,?,?,?,?,?)')
  .run(eid,cid,pid,1,'explicit',when);
 // Historical archive is a legitimate real property lifecycle event.
 src.prepare('UPDATE customer_properties SET active=0,revision=2 WHERE id=?').run(pid);
 check(src.prepare('SELECT active,revision FROM customer_properties').get().active===0,
  'Source property archived after immutable estimate link was captured');
 check(src.prepare('SELECT COUNT(*) AS n FROM property_recovery_guard').get().n===0,
  'Original saved migration guard is empty');
 src.close();
 const exported=await exportCompleteIsolatedSqliteSnapshot(source,corePath,extraPath);
 check(exported.coreAndSupplementalArchivesWritten,
  'Real SQL exporter accepts correctly owned archived historical property');
 const extra=JSON.parse(await readFile(extraPath,'utf8'));
 check(extra.rowCounts.customer_properties===1&&extra.rowCounts.estimate_property_links===1&&
  extra.rowCounts.estimate_service_locations===1&&extra.rowCounts.property_recovery_guard===0,
  'All three property tables + empty guard are included in supplemental snapshot');
 await rejected(join(folder,'lost-guard.json'),x=>delete x.tables.property_recovery_guard,
  'Missing guarded recovery table is never trusted');
 await rejected(join(folder,'retained-guard.json'),x=>{
  x.tables.property_recovery_guard=[{id:1}];x.rowCounts.property_recovery_guard=1;
 },'Occupied recovery guard must fail before copying template');
 await rejected(join(folder,'wrong-property-customer.json'),x=>{
  x.tables.customer_properties[0].customer_id='other-customer';
 },'Wrong-customer historical property is blocked before output creation');
 await rejected(join(folder,'changed-job-address.json'),x=>{
  x.tables.estimate_service_locations[0].address='Forged replacement address';
 },'Changed immutable captured service address is blocked');
 await rejected(join(folder,'invalid-link-revision.json'),x=>{
  x.tables.estimate_property_links[0].property_revision=3;
 },'Archived property link cannot invent historical revision');
 const result=await restoreNumberedRecordsToIsolatedSqlite(corePath,template,output,extraPath);
 check(result.sqliteRestoreVerified===true,'Actual isolated SQLite recovery now succeeds');
 check(result.supplementalRowsRestored===3,
  'All historic property, service-address and link rows restored');
 const done=new DatabaseSync(output,{readOnly:true});
 check(done.prepare('SELECT COUNT(*) AS n FROM property_recovery_guard').get().n===0,
  'Temporary one-shot bypass guard was atomically removed before commit');
 const property=done.prepare('SELECT * FROM customer_properties WHERE id=?').get(pid);
 const location=done.prepare('SELECT * FROM estimate_service_locations WHERE estimate_id=?').get(eid);
 const link=done.prepare('SELECT * FROM estimate_property_links WHERE estimate_id=?').get(eid);
 check(property.active===0&&property.revision===2&&
  link.property_revision===1&&link.property_id===pid,
  'Recovered archived historical property retains the immutable original selection revision');
 check(location.address==='123 Example Road · Rear gate'&&
  location.customer_id===cid&&link.captured_at===location.captured_at,
  'Original historical service-address bytes and captured job time are retained');
 check(done.prepare('PRAGMA foreign_key_check').all().length===0&&
  done.prepare('PRAGMA integrity_check').get().integrity_check==='ok',
  'Restored SQLite satisfies real foreign keys and integrity checks');
 done.close();
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(corePath,template,output,extraPath));
 checks++;
 console.log('PASS '+checks+'/'+checks+
  ' real SQLite archived property+service-address recovery; atomic empty native guard, no provider or photo claim.');
}finally{await rm(folder,{recursive:true,force:true});}
