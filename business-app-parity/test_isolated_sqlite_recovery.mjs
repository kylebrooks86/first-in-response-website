/** Synthetic-only executable isolated SQLite export/restore round-trip.
 * Tests the NEW recovery path, not previously accepted owner device QA.
 * Run: node business-app-parity/test_isolated_sqlite_recovery.mjs
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './shared/lib/numbered-records-v2-preflight.mjs';
import {exportCompleteIsolatedSqliteSnapshot} from './export_complete_isolated_sqlite_snapshot.mjs';
import {restoreNumberedRecordsToIsolatedSqlite} from './restore_numbered_records_to_isolated_sqlite.mjs';
const folder=await mkdtemp(join(tmpdir(),'fire-isolated-recovery-'));
const template=join(folder,'template.sqlite'),source=join(folder,'source.sqlite');
const core=join(folder,'core.json'),supp=join(folder,'supplemental.json'),restored=join(folder,'restored.sqlite');
try{
 const db=new DatabaseSync(template);
 for(const table of [...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]){
  if(table==='fire_customer_numbers'||table==='fire_job_numbers')
   db.exec('CREATE TABLE "'+table+'" (serial INTEGER PRIMARY KEY AUTOINCREMENT, '+
    (table==='fire_customer_numbers'?'customer_id':'root_estimate_id')+' TEXT UNIQUE)');
  else db.exec('CREATE TABLE "'+table+'" ("'+
   (table==='message_templates'?'key':table==='deposit_agreement_snapshots'?'event_id':
    table==='fire_job_estimate_links'?'estimate_id':'id')+'" TEXT PRIMARY KEY)');
 }
 db.exec('CREATE TABLE supplemental_synthetic (id TEXT PRIMARY KEY, value TEXT)');
 db.exec('CREATE TABLE supplemental_serial (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)');
 // The prefix sqliteX is NOT SQLite's reserved literal sqlite_ prefix.
 // SQL LIKE 'sqlite_%' wrongly ignores this entire business table.
 db.exec('CREATE TABLE sqlitex_customer_data (id TEXT PRIMARY KEY, private_value TEXT)');
 db.exec('CREATE INDEX idx_sqlitex_customer_data_value ON sqlitex_customer_data(private_value)');
 db.close();
 const {copyFile}=await import('node:fs/promises');
 await copyFile(template,source);
 const live=new DatabaseSync(source);
 live.prepare('INSERT INTO supplemental_synthetic(id,value) VALUES (?,?)').run('synthetic','owner-only');
 live.prepare('INSERT INTO sqlitex_customer_data(id,private_value) VALUES (?,?)').run('synthetic-x','must-recover');
 live.exec("INSERT INTO supplemental_serial(value) VALUES ('temporary'); DELETE FROM supplemental_serial;");
 live.close();
 const exported=await exportCompleteIsolatedSqliteSnapshot(source,core,supp);
 const originalSupplemental=JSON.parse(await readFile(supp,'utf8'));
 assert.equal(originalSupplemental.tables.supplemental_synthetic.length,1);
 assert.equal(originalSupplemental.tables.sqlitex_customer_data.length,1,
  'literal sqlite_ filter must not lose sqliteX table rows');
 assert.equal(originalSupplemental.tables.sqlitex_customer_data[0].private_value,'must-recover');
 assert.equal(originalSupplemental.rowCounts.sqlitex_customer_data,1);
 assert.equal(originalSupplemental.sqliteSequence.supplemental_serial,1);
 assert.equal(exported.coreAndSupplementalArchivesWritten,true);
 // A different schema, even with all the same required table names, must
 // not accept a source archive (index/trigger drift matters for FIRE).
 const driftTemplate=join(folder,'schema-drift.sqlite');
 await copyFile(template,driftTemplate);
 const driftDb=new DatabaseSync(driftTemplate);
 driftDb.exec('CREATE INDEX synthetic_drift_index ON supplemental_synthetic(value)');
 driftDb.close();
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(
  core,driftTemplate,join(folder,'rejected-schema-drift.sqlite'),supp),
  /schema differ/i);
 const result=await restoreNumberedRecordsToIsolatedSqlite(core,template,restored,supp);
 assert.equal(result.sqliteRestoreVerified,true);
 assert.equal(result.supplementalRowsRestored,2);
 assert.equal(result.supplementalTablesRestored,3,'all three supplemental tables including sqliteX restored');
 const restoredDb=new DatabaseSync(restored,{readOnly:true});
 assert.equal(restoredDb.prepare('SELECT value FROM supplemental_synthetic').get().value,'owner-only');
 assert.equal(restoredDb.prepare('SELECT private_value FROM sqlitex_customer_data WHERE id=?').get('synthetic-x').private_value,
  'must-recover','sqliteX business row must survive exact isolated restore');
 assert.equal(restoredDb.prepare("SELECT seq FROM sqlite_sequence WHERE name='supplemental_serial'").get().seq,1);
 restoredDb.close();
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(core,template,restored,supp));
 // Tampering the supplemental row-count manifest must fail closed and must
 // not leave a partially restored destination file.
 const invalid=join(folder,'invalid-supplemental.json');
 const invalidOutput=join(folder,'rejected.sqlite');
 const damaged=structuredClone(originalSupplemental);
 damaged.rowCounts.supplemental_synthetic=2;
 await writeFile(invalid,JSON.stringify(damaged));
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(core,template,invalidOutput,invalid),
  /row count|truncated|missing/i);
 await assert.rejects(readFile(invalidOutput));
 // A purportedly complete archive that omits any sqliteX application table
 // must never pass schema coverage or create a partially recovered file.
 const incomplete=structuredClone(originalSupplemental);
 delete incomplete.tables.sqlitex_customer_data;
 delete incomplete.rowCounts.sqlitex_customer_data;
 const omittedPath=join(folder,'omitted-sqlitex.json');
 const omittedOutput=join(folder,'rejected-omitted.sqlite');
 await writeFile(omittedPath,JSON.stringify(incomplete));
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(
  core,template,omittedOutput,omittedPath),/supplemental inventory/i);
 await assert.rejects(readFile(omittedOutput));
 // A nonempty destination schema template is not a valid restore target.
 const nonemptyTemplate=join(folder,'nonempty.sqlite');
 await copyFile(source,nonemptyTemplate);
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(
  core,nonemptyTemplate,join(folder,'rejected-nonempty.sqlite'),supp),
  /contains data|not empty/i);
 console.log('PASS synthetic isolated full-table SQLite export/restore and no-overwrite checks');
}finally{await rm(folder,{recursive:true,force:true});}
