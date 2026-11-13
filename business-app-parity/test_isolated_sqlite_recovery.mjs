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
 db.close();
 const {copyFile}=await import('node:fs/promises');
 await copyFile(template,source);
 const live=new DatabaseSync(source);
 live.prepare('INSERT INTO supplemental_synthetic(id,value) VALUES (?,?)').run('synthetic','owner-only');
 live.close();
 const exported=await exportCompleteIsolatedSqliteSnapshot(source,core,supp);
 const originalSupplemental=JSON.parse(await readFile(supp,'utf8'));
 assert.equal(originalSupplemental.tables.supplemental_synthetic.length,1);
 assert.equal(exported.coreAndSupplementalArchivesWritten,true);
 const result=await restoreNumberedRecordsToIsolatedSqlite(core,template,restored,supp);
 assert.equal(result.sqliteRestoreVerified,true);
 assert.equal(result.supplementalRowsRestored,1);
 const restoredDb=new DatabaseSync(restored,{readOnly:true});
 assert.equal(restoredDb.prepare('SELECT value FROM supplemental_synthetic').get().value,'owner-only');
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
 // A nonempty destination schema template is not a valid restore target.
 const nonemptyTemplate=join(folder,'nonempty.sqlite');
 await copyFile(source,nonemptyTemplate);
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(
  core,nonemptyTemplate,join(folder,'rejected-nonempty.sqlite'),supp),
  /contains data|not empty/i);
 console.log('PASS synthetic isolated full-table SQLite export/restore and no-overwrite checks');
}finally{await rm(folder,{recursive:true,force:true});}
