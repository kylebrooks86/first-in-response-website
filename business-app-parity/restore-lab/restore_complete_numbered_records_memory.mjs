/** FIRE COMPLETE v2 DB-record RESTORE REHEARSAL — DISPOSABLE SQLITE ONLY.
 *
 * Restores the reviewed 20 legacy ordinary record tables and immutable
 * Customer#/Job#/revision-link maps as ONE local SQLite transaction into an
 * EMPTY, existing-schema DatabaseSync(':memory:'). This cannot run on hosted
 * D1, a file-backed database, or a reused/historic database.
 *
 * It does not authorize production restoration. No app route imports this
 * module. Photo FILES are external. Full finance/agreement integrity audit,
 * owner authorization, source snapshot and private recovery custody remain
 * required before any hosted design may be considered.
 */
import {DatabaseSync} from 'node:sqlite';
import {inspectNumberedRecordsV2,FIRE_NUMBERED_RECORDS_TABLES}
  from '../shared/lib/numbered-records-v2.mjs';
import {
  assertDisposableNumberedScratchDb,assertExactArchiveTableRows,
  assertRestoredNumberedRows
} from './restore_numbered_mappings_memory.mjs';

const fail=reason=>{throw new Error('FIRE DISPOSABLE FULL RESTORE REFUSED: '+reason);};
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const NUMBER_TABLES=['fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'];
function checkEmpty(db){
  for(const table of FIRE_NUMBERED_RECORDS_TABLES)
    if(db.prepare('SELECT COUNT(*) AS n FROM '+quote(table)).get().n!==0)
      fail('pre-existing ordinary records: never overwrite or merge into a nonempty target');
}
function insertTable(db,table,rows){
  if(!rows.length)return;
  const columns=db.prepare('PRAGMA table_info('+quote(table)+')').all().map(x=>x.name);
  const expected=[...columns].sort().join('|');
  // The archive source is a SELECT * snapshot. Every column must exist,
  // including nullable fields and defaults, or it may silently lose history.
  for(const row of rows){
    const keys=Object.keys(row);
    if(keys.length!==columns.length||[...keys].sort().join('|')!==expected)
      fail('incomplete or unexpected stored columns for '+table);
    for(const value of Object.values(row))
      if(value!==null&&typeof value!=='string'&&
        !(typeof value==='number'&&Number.isFinite(value)))
        fail('unsupported SQLite cell type for '+table);
  }
  const statement='INSERT INTO '+quote(table)+' ('+
    columns.map(quote).join(',')+') VALUES ('+
    columns.map(()=>'?').join(',')+')';
  const insert=db.prepare(statement);
  for(const row of rows)insert.run(...columns.map(column=>row[column]));
}
function setSequence(db,name,highWater){
  const existing=db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(name);
  if(existing)db.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').run(highWater,name);
  else if(highWater>0)db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run(name,highWater);
}
function applyNumberTables(db,identities){
  const insertCustomers=db.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)');
  for(const row of [...identities.fire_customer_numbers].sort((a,b)=>a.customer_number-b.customer_number))
    insertCustomers.run(row.customer_number,row.customer_id,row.created_at);
  const insertJobs=db.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)');
  for(const row of [...identities.fire_job_numbers].sort((a,b)=>a.job_number-b.job_number))
    insertJobs.run(row.job_number,row.root_estimate_id,row.created_at);
  const insertLinks=db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)');
  for(const row of identities.fire_job_estimate_links)
    insertLinks.run(row.estimate_id,row.job_number);
  setSequence(db,'fire_customer_numbers',identities.highWater.customer);
  setSequence(db,'fire_job_numbers',identities.highWater.job);
}
/** Atomic scratch restore of all 20 DB-record families and permanent mapping.
 * No photo file bytes, external files, named databases, or provider actions.
 */
export async function restoreCompleteNumberedRecordsToDisposableMemory({db,archive}={}){
  if(!(db instanceof DatabaseSync))fail('native in-memory DatabaseSync required');
  if(!archive)fail('missing signed/custodied archive input');
  const proof=await inspectNumberedRecordsV2(archive);
  assertDisposableNumberedScratchDb(db);
  checkEmpty(db);
  let begun=false;
  try{
    db.exec('BEGIN IMMEDIATE');begun=true;
    // Defers immediate relationship checks until the full consistent table
    // set has arrived, then PRAGMA foreign_key_check is enforced before COMMIT.
    db.exec('PRAGMA defer_foreign_keys=ON');
    for(const table of FIRE_NUMBERED_RECORDS_TABLES)
      insertTable(db,table,archive.records.tables[table]);
    applyNumberTables(db,archive.identities);
    for(const table of FIRE_NUMBERED_RECORDS_TABLES)
      assertExactArchiveTableRows(db.prepare('SELECT * FROM '+quote(table)).all(),
        archive.records.tables[table],table);
    assertRestoredNumberedRows(db,archive.identities);
    if(db.prepare('PRAGMA foreign_key_check').all().length)
      fail('cross-record relational constraints have orphaned records');
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')
      fail('SQLite restored integrity is not ok');
    db.exec('COMMIT');begun=false;
  }catch{
    if(begun){try{db.exec('ROLLBACK');}catch{/* never retry blindly */}}
    fail('atomic restore did not fully pass; transaction rolled back or stopped');
  }
  return Object.freeze({
    ordinaryRecordTables:FIRE_NUMBERED_RECORDS_TABLES.length,
    ordinaryRecordRows:proof.recordRows,
    restoredCustomerNumbers:proof.customerNumbers,
    restoredJobNumbers:proof.jobNumbers,
    restoredRevisionLinks:proof.jobLinks,
    customerHighWater:proof.customerHighWater,
    jobHighWater:proof.jobHighWater,
    disposableMemoryOnly:true,
    hostedWritesPerformed:false,
    photoFileBytesRestored:false,
    productionRestoreApproved:false
  });
}
