/** FIRE numbered v2 restore: DISPOSABLE, IN-MEMORY SQLite LAB ONLY.
 *
 * This restores only the immutable Customer # / Job # and estimate-link tables
 * after ALL 20 legacy business-record tables have independently been populated
 * and match the verified v2 archive EXACTLY. Never call it on a hosted D1,
 * production database, persistent SQLite file, or before financial/document
 * audits and owner approval for a real recovery workflow.
 *
 * This is intentionally node:sqlite-only and NOT imported by any app route.
 * It never opens files, networks, or Cloudflare; accepts an existing
 * DatabaseSync(':memory:') supplied by an isolated offline caller.
 */
import {DatabaseSync} from 'node:sqlite';
import {inspectNumberedRecordsV2,FIRE_NUMBERED_RECORDS_TABLES}
  from '../shared/lib/numbered-records-v2.mjs';
import {validateNumberedIdentityArchive} from '../shared/lib/numbered-identity-archive.mjs';

const fail=(message)=>{throw new Error('FIRE DISPOSABLE numbered restore REFUSED: '+message);};
const NUMBER_TABLES=['fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'];
const REQUIRED_TRIGGERS=[
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete'
];

function exactRecordRows(actual,expected,label){
  if(!Array.isArray(actual)||!Array.isArray(expected)||actual.length!==expected.length)
    fail(label+' records/count mismatch');
  // Byte-for-byte logical record parity with independent JSON key order and
  // independent database scan order. No raw records, IDs or values in errors.
  const normalize=(row)=>{
    if(!row||typeof row!=='object'||Array.isArray(row))fail(label+' malformed row');
    return JSON.stringify(Object.keys(row).sort().map(key=>[key,row[key]]));
  };
  const left=actual.map(normalize).sort(),right=expected.map(normalize).sort();
  for(let i=0;i<left.length;i++)if(left[i]!==right[i])
    fail(label+' complete stored records differ from original archive');
}
function readAll(db,table){
  // The only source of table names is a constant reviewed allowlist.
  return db.prepare('SELECT * FROM "'+table+'"').all();
}
function checkDisposableDb(db){
  if(!(db instanceof DatabaseSync))fail('requires a native node:sqlite DatabaseSync');
  const files=db.prepare('PRAGMA database_list').all();
  if(files.length!==1||files[0].name!=='main'||files[0].file!=='')
    fail('only a single disposable in-memory database is permitted');
  db.exec('PRAGMA foreign_keys=ON');
  if(db.prepare('PRAGMA foreign_keys').get().foreign_keys!==1)
    fail('foreign key enforcement is not enabled');
  const required=new Map([
   ...FIRE_NUMBERED_RECORDS_TABLES.map(n=>[n,'table']),
   ...NUMBER_TABLES.map(n=>[n,'table']),
   ...REQUIRED_TRIGGERS.map(n=>[n,'trigger']),
   ['idx_fire_job_estimate_links_number','index']
  ]);
  const defs=db.prepare("SELECT name,type,sql FROM sqlite_master WHERE type IN ('table','trigger','index')").all();
  for(const [name,type] of required){
    const found=defs.filter(row=>row.name===name&&row.type===type);
    if(found.length!==1||!found[0].sql)fail('required immutable schema/table/trigger/index missing');
  }
  for(const table of ['fire_customer_numbers','fire_job_numbers']){
    const sql=defs.find(row=>row.name===table)?.sql??'';
    if(!/\bAUTOINCREMENT\b/i.test(sql))
      fail('permanent serials require SQLite AUTOINCREMENT');
  }
  const references={
   fire_customer_numbers:[['customer_id','customers','id']],
   fire_job_numbers:[['root_estimate_id','estimates','id']],
   fire_job_estimate_links:[['estimate_id','estimates','id'],['job_number','fire_job_numbers','job_number']]
  };
  for(const [table,expected] of Object.entries(references)){
    const fks=db.prepare('PRAGMA foreign_key_list("'+table+'")').all();
    if(fks.length!==expected.length||expected.some(([from,target,to])=>
      !fks.some(f=>f.from===from&&f.table===target&&f.to===to&&
        f.on_update==='RESTRICT'&&f.on_delete==='RESTRICT')))
      fail('immutable number relationship foreign keys differ from review');
  }
  for(const table of NUMBER_TABLES)
    if(db.prepare('SELECT COUNT(*) AS n FROM "'+table+'"').get().n!==0)
      fail('target has existing numbers; never reassign or merge implicitly');
  for(const table of ['fire_customer_numbers','fire_job_numbers']){
    const prior=db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table);
    if(prior&&prior.seq!==0)fail('previously consumed number sequence cannot be reused');
  }
}

function verifyNumbers(db,original){
  const persisted={
    ...original,
    fire_customer_numbers:readAll(db,'fire_customer_numbers'),
    fire_job_numbers:readAll(db,'fire_job_numbers'),
    fire_job_estimate_links:readAll(db,'fire_job_estimate_links'),
    highWater:{
      customer:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get()?.seq??0,
      job:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get()?.seq??0
    }
  };
  // Compare exact original numbers / estimate revisions / allocators,
  // in addition to the validator's relationship and coverage checks.
  for(const key of NUMBER_TABLES)exactRecordRows(persisted[key],original[key],key);
  if(persisted.highWater.customer!==original.highWater.customer||
     persisted.highWater.job!==original.highWater.job)
    fail('permanent sequence high-water was not restored exactly');
  validateNumberedIdentityArchive(persisted);
  if(db.prepare('PRAGMA foreign_key_check').all().length)
    fail('referential integrity after immutable numbering restore');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')
    fail('SQLite integrity after immutable numbering restore');
}

function setHighWater(db,table,value){
  // After explicitly restoring historical serial values, preserve the
  // ever-consumed SQLite AUTOINCREMENT counter even when rows were deleted.
  const existing=db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table);
  if(existing)db.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').run(value,table);
  else if(value>0)db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run(table,value);
}

/** Restore only NUMBERING into an ALREADY RECORD-COMPLETE disposable in-memory DB.
 * Entire set is one local SQLite transaction with rollback on any failure.
 * It does not populate or merge business records; all 20 record families
 * must match the original authenticated/financially reviewed source archive
 * before a single number is inserted.
 */
export async function restoreNumberedMappingsToDisposableMemory({db,archive}={}){
  if(!archive)fail('no archive');
  const inspected=await inspectNumberedRecordsV2(archive);
  checkDisposableDb(db);
  for(const table of FIRE_NUMBERED_RECORDS_TABLES)
    exactRecordRows(readAll(db,table),archive.records.tables[table],table);
  const original=archive.identities;
  const numbering=validateNumberedIdentityArchive(original);
  if(numbering.customers!==inspected.customers||
     numbering.estimates!==inspected.estimates)
    fail('inconsistent archive record and numbered identity counts');

  let begun=false;
  try{
    db.exec('BEGIN IMMEDIATE');begun=true;
    const customers=db.prepare(
      'INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)');
    for(const row of [...original.fire_customer_numbers].sort((a,b)=>a.customer_number-b.customer_number))
      customers.run(row.customer_number,row.customer_id,row.created_at);
    const jobs=db.prepare(
      'INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)');
    for(const row of [...original.fire_job_numbers].sort((a,b)=>a.job_number-b.job_number))
      jobs.run(row.job_number,row.root_estimate_id,row.created_at);
    const links=db.prepare(
      'INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)');
    for(const row of original.fire_job_estimate_links)
      links.run(row.estimate_id,row.job_number);
    setHighWater(db,'fire_customer_numbers',original.highWater.customer);
    setHighWater(db,'fire_job_numbers',original.highWater.job);
    verifyNumbers(db,original);
    // Recheck complete records within the transaction: no hidden changes to
    // invoices, payments, refunds, agreements, customers or other history.
    for(const table of FIRE_NUMBERED_RECORDS_TABLES)
      exactRecordRows(readAll(db,table),archive.records.tables[table],table);
    db.exec('COMMIT');begun=false;
  }catch{
    if(begun){try{db.exec('ROLLBACK');}catch{/* fail closed; don't retry */}}
    fail('transaction rejected and restore did not complete; no retry authorized');
  }
  return Object.freeze({
    restoredCustomerNumbers:numbering.customerNumbers,
    restoredJobNumbers:numbering.jobNumbers,
    restoredEstimateJobLinks:numbering.jobLinks,
    customerHighWater:numbering.customerHighWater,
    jobHighWater:numbering.jobHighWater,
    ordinaryRecordsChanged:false,
    disposableMemoryOnly:true,
    hostedWritesPerformed:false,
    deploymentPerformed:false,
    productionRestoreApproved:false
  });
}
