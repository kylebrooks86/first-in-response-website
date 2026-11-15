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
import {sealCompleteIsolatedSqliteSnapshot,inspectSavedProtectedCompleteRecords,
 restoreSavedProtectedCompleteRecords}
 from './protected_complete_isolated_sqlite_recovery.mjs';

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
 // Exercise the ACTUAL private encrypted complete-record owner file, not
 // only the intermediate plaintext snapshot. Save, REOPEN, authenticate,
 // then independently restore into a second empty isolated SQLite database.
 const phrase='Synthetic FIRE encrypted property disaster recovery secret 2026';
 const sealedPath=join(folder,'complete-property-history.firerecords');
 const sealed=await sealCompleteIsolatedSqliteSnapshot(source,sealedPath,phrase);
 check(sealed.savedEncryptedFileReadBack&&sealed.encryptedRecordsArchiveCreated&&
  sealed.offDeviceCustodyVerified===false&&sealed.gate7Accepted===false,
  'Complete protected records and property history were saved/read back with no hosted claims');
 const sealedBytes=await readFile(sealedPath);
 check(sealedBytes.subarray(0,8).toString('ascii')==='FIRERB01'&&
  !sealedBytes.includes(Buffer.from('123 Example Road'))&&
  !sealedBytes.includes(Buffer.from(cid)),
  'Protected .firerecords ciphertext does not expose saved customer address or ID');
 const opened=await inspectSavedProtectedCompleteRecords(sealedPath,phrase);
 check(opened.core.tables.customers.length===1&&
  opened.supplemental.tables.customer_properties[0].active===0&&
  opened.supplemental.tables.estimate_property_links[0].property_revision===1,
  'Authenticated encrypted file contains original archived property and estimate relationship');
 await assert.rejects(inspectSavedProtectedCompleteRecords(
  sealedPath,'Incorrect synthetic recovery phrase length 2026'));
 checks++;
 const tamperedBytes=Buffer.from(sealedBytes);tamperedBytes[50]^=1;
 const tamperedPath=join(folder,'tampered.firerecords');
 await writeFile(tamperedPath,tamperedBytes);
 await assert.rejects(inspectSavedProtectedCompleteRecords(tamperedPath,phrase));
 checks++;
 const sealedRestored=join(folder,'encrypted-restored.sqlite');
 const encryptedRecovery=await restoreSavedProtectedCompleteRecords(
  sealedPath,template,sealedRestored,phrase);
 check(encryptedRecovery.sqliteRestoreVerified&&
  encryptedRecovery.supplementalRowsRestored===3&&encryptedRecovery.gate7Accepted===false,
  'Encrypted saved complete snapshot restores all archived property rows without accepting Gate7');
 const sealedDb=new DatabaseSync(sealedRestored,{readOnly:true});
 const sealedProperty=sealedDb.prepare('SELECT active,revision FROM customer_properties WHERE id=?').get(pid);
 const sealedLink=sealedDb.prepare('SELECT property_id,property_revision FROM estimate_property_links WHERE estimate_id=?').get(eid);
 const sealedLocation=sealedDb.prepare('SELECT address FROM estimate_service_locations WHERE estimate_id=?').get(eid);
 check(sealedProperty.active===0&&sealedProperty.revision===2&&
  sealedLink.property_id===pid&&sealedLink.property_revision===1&&
  sealedLocation.address==='123 Example Road · Rear gate'&&
  sealedDb.prepare('SELECT COUNT(*) AS n FROM property_recovery_guard').get().n===0,
  'Independent restored encrypted SQLite retained historic location and cleared native guard');
 check(sealedDb.prepare('PRAGMA integrity_check').get().integrity_check==='ok'&&
  sealedDb.prepare('PRAGMA foreign_key_check').all().length===0,
  'Saved encrypted restore passes actual SQLite integrity and owner foreign keys');
 sealedDb.close();
 // A source whose native immutability trigger was maliciously removed and
 // whose service address no longer matches its historical property cannot
 // be encrypted as a plausible complete backup.
 const forgedSource=join(folder,'corrupted-history.sqlite');
 await copyFile(source,forgedSource);
 const forgedDb=new DatabaseSync(forgedSource);
 forgedDb.exec('DROP TRIGGER service_location_immutable_update');
 forgedDb.prepare('UPDATE estimate_service_locations SET address=? WHERE estimate_id=?')
  .run('Forged service address',eid);
 forgedDb.close();
 const forgedOutput=join(folder,'invalid-history.firerecords');
 await assert.rejects(sealCompleteIsolatedSqliteSnapshot(forgedSource,forgedOutput,phrase),
  /BLOCKED|property|address|backup/i,
  'Changed service address cannot be sealed as complete encrypted FIRE history');
 await assert.rejects(readFile(forgedOutput),undefined,
  'Failed encrypted seal must leave no misleading complete backup file');
 checks+=2;
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(corePath,template,output,extraPath));
 checks++;
 console.log('PASS '+checks+'/'+checks+
  ' real SQLite archived property+service-address recovery; atomic empty native guard, no provider or photo claim.');
}finally{await rm(folder,{recursive:true,force:true});}
