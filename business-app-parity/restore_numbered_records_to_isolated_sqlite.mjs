/** FIRE real offline isolated SQLite restore rehearsal (Node 22.13+).
 * Creates a NEW local database by copying a separately prepared EMPTY schema
 * template; restores every numbered-core-record v2 table and verifies actual
 * rows, financial/identity integrity, FK integrity and serial high-water.
 * No remote access, D1 binding, Wrangler, payment or hosted changes.
 *
 * node restore_numbered_records_to_isolated_sqlite.mjs RECORDS.json EMPTY_SCHEMA.sqlite RECOVERED.sqlite
 * Recovered DB is sensitive unencrypted business data. Keep privately.
 */
import {DatabaseSync} from 'node:sqlite';
import {readFile,copyFile,chmod,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateNumberedCoreRecordsV2,NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './shared/lib/numbered-records-v2-preflight.mjs';

import {validateSupplementalRecoveryArchive} from './validate_supplemental_recovery_archive.mjs';
import {fingerprintIsolatedSqliteSchema,requireSameIsolatedSchema} from './fingerprint_isolated_sqlite_schema.mjs';
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES];
const stop=reason=>{throw Error('FIRE isolated SQLite restore BLOCKED: '+reason);};
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const q=x=>'"'+x+'"';
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':
 x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':
 JSON.stringify(x);
const keyOf=t=>t==='fire_customer_numbers'?'customer_id':
 t==='fire_job_numbers'?'root_estimate_id':
 t==='fire_job_estimate_links'?'estimate_id':
 t==='message_templates'?'key':t==='deposit_agreement_snapshots'?'event_id':'id';
const toSql=x=>{
 if(x===null||typeof x==='string'||typeof x==='number'&&Number.isFinite(x))return x;
 if(typeof x==='boolean')return Number(x);
 stop('unsupported SQL value in archive');
};
function inspectSchema(db){
 const found=new Map(db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all().map(x=>[x.name,x.sql]));
 for(const t of tables){
  if(!found.has(t))stop('schema missing required table '+t);
  const columns=db.prepare('PRAGMA table_info('+q(t)+')').all().map(x=>x.name);
  if(!columns.length||columns.some(c=>!ident(c)))stop('unsupported column name in '+t);
  if(db.prepare('SELECT COUNT(*) AS n FROM '+q(t)).get().n!==0)
   stop('schema template contains records in '+t);
 }
 const extras=[...found.keys()].filter(t=>!tables.includes(t)&&!t.startsWith('sqlite_'));
 for(const t of extras){
  if(!ident(t))stop('unsupported extra table in template');
  if(db.prepare('SELECT COUNT(*) AS n FROM '+q(t)).get().n!==0)
   stop('supplemental table contains data: '+t);
 }
 return {found,extras};
}
function restore(db,archive,supplemental){
 const {found,extras}=inspectSchema(db);
 const actualSchema=fingerprintIsolatedSqliteSchema(db);
 requireSameIsolatedSchema(archive.schemaIdentity,actualSchema);
 requireSameIsolatedSchema(supplemental.schemaIdentity,actualSchema);
 const supplementalState=validateSupplementalRecoveryArchive(supplemental,extras);
 // Restore requires AUTOINCREMENT number history to survive deleted rows.
 for(const t of ['fire_customer_numbers','fire_job_numbers'])
  if(!/\bAUTOINCREMENT\b/i.test(found.get(t)||''))
   stop('numbering schema is not AUTOINCREMENT for '+t);
 const fk=db.prepare('PRAGMA foreign_keys').get().foreign_keys;
 if(fk!==1)stop('SQLite foreign key enforcement unavailable');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec('PRAGMA defer_foreign_keys=ON');
  let restored=0;
  for(const t of tables){
   const allowed=new Set(db.prepare('PRAGMA table_info('+q(t)+')').all().map(c=>c.name));
   for(const row of archive.tables[t]){
    const keys=Object.keys(row).sort();
    if(!keys.length||keys.some(k=>!ident(k)||!allowed.has(k)))
     stop('unrecognized source column for '+t);
    const sql='INSERT INTO '+q(t)+' ('+keys.map(q).join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')';
    db.prepare(sql).run(...keys.map(k=>toSql(row[k])));
    restored++;
   }
  }
  // Restore all feature-specific tables in the same transaction. Their exact
  // schema inventory is required; no ignored or inferred supplemental tables.
  for(const t of extras){
   const allowed=new Set(db.prepare('PRAGMA table_info('+q(t)+')').all().map(c=>c.name));
   for(const row of supplemental.tables[t]){
    const keys=Object.keys(row).sort();
    if(keys.some(k=>!allowed.has(k)))stop('unknown supplemental column in '+t);
    db.prepare('INSERT INTO '+q(t)+' ('+keys.map(q).join(',')+') VALUES ('+
     keys.map(()=>'?').join(',')+')').run(...keys.map(k=>toSql(row[k])));
    restored++;
   }
  }
  // Preserve AUTOINCREMENT history for ALL supplemental feature tables too;
  // otherwise deleted high IDs could be silently reused after recovery.
  for(const [table,high] of Object.entries(supplemental.sqliteSequence)){
   if(!/\bAUTOINCREMENT\b/i.test(found.get(table)||''))
    stop('supplemental sequence references non-AUTOINCREMENT table '+table);
   const existing=db.prepare('SELECT COUNT(*) AS n FROM sqlite_sequence WHERE name=?').get(table).n;
   if(existing>1)stop('duplicate supplemental sequence entry');
   if(existing===0)db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES (?,?)').run(table,high);
   else db.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').run(high,table);
  }
  // sqlite_sequence can be absent for a newly provisioned empty AUTOINCREMENT
  // table. Restore exact historical high-water even if rows were deleted.
  for(const [t,high] of [['fire_customer_numbers',archive.highWater.customer],
                          ['fire_job_numbers',archive.highWater.job]]){
   if(!Number.isSafeInteger(high)||high<0)stop('invalid permanent serial high-water');
   const existing=db.prepare('SELECT COUNT(*) AS n FROM sqlite_sequence WHERE name=?').get(t).n;
   if(existing>1)stop('duplicate numbering sequence entries');
   if(existing===0)db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES (?,?)').run(t,high);
   else db.prepare('UPDATE sqlite_sequence SET seq=? WHERE name=?').run(high,t);
  }
  for(const [table,high] of Object.entries(supplemental.sqliteSequence))
   if(db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table)?.seq!==high)
    stop('supplemental serial high-water not preserved');
  const violations=db.prepare('PRAGMA foreign_key_check').all();
  if(violations.length)stop('foreign key violation after restore');
  // Compare ACTUAL SQLite rows to source, including each field, not just counts.
  for(const t of tables){
   const key=keyOf(t);
   const actual=db.prepare('SELECT * FROM '+q(t)).all();
   const source=archive.tables[t];
   if(actual.length!==source.length)stop('row count differs in '+t);
   const index=new Map(actual.map(row=>[String(row[key]),row]));
   for(const row of source){
    const restoredRow=index.get(String(row[key]));
    if(!restoredRow)stop('missing restored row in '+t);
    for(const [column,value] of Object.entries(row))
     if(stable(restoredRow[column])!==stable(toSql(value)))
      stop('restored field differs in '+t+'.'+column);
   }
  }
  for(const t of extras){
   const expected=supplemental.tables[t];
   const actual=db.prepare('SELECT * FROM '+q(t)).all();
   if(actual.length!==expected.length)stop('supplemental row count differs in '+t);
   // Row order is not guaranteed in SQLite; compare sorted complete row values.
   const normalize=rows=>rows.map(row=>stable(Object.fromEntries(
    Object.entries(row).filter(([k])=>Object.hasOwn(expected[0]||{},k))
   ))).sort();
   if(actual.some(row=>Object.keys(expected[0]||{}).some(k=>!Object.hasOwn(row,k)))||
      stable(normalize(actual))!==stable(normalize(expected)))
    stop('supplemental restored values differ in '+t);
  }
  for(const [t,high] of [['fire_customer_numbers',archive.highWater.customer],
                          ['fire_job_numbers',archive.highWater.job]]){
   if(db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(t)?.seq!==high)
    stop('permanent numbering high-water not preserved');
  }
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')
   stop('restored database integrity check failed before commit');
  db.exec('COMMIT');
  return {restoredRows:restored,customers:archive.tables.customers.length,
   jobNumbers:archive.tables.fire_job_numbers.length,
   supplementalTablesRestored:supplementalState.tables,
   supplementalRowsRestored:supplementalState.rows,sqliteRestoreVerified:true,
   providerD1Restored:false,photosRestored:false,gate7Accepted:false};
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
}
export async function restoreNumberedRecordsToIsolatedSqlite(recordsPath,templatePath,outputPath,supplementalPath){
 const paths=[recordsPath,templatePath,outputPath,supplementalPath];
 if(paths.some(x=>typeof x!=='string'||!x)||new Set(paths.map(p=>resolve(p))).size!==4)
  stop('four different records/template/output/supplemental files required');
 let archive,supplemental;
 try{
  archive=JSON.parse(await readFile(resolve(recordsPath),'utf8'));
  supplemental=JSON.parse(await readFile(resolve(supplementalPath),'utf8'));
 }
 catch{stop('records archive unreadable');}
 validateNumberedCoreRecordsV2(archive);
 // This local path cannot recover object-backed photo bytes; do not produce
 // a deceptively complete recovery database with orphaned cloud references.
 if(archive.tables.customer_photos.length)
  stop('object-backed customer photo rows require a separate full-byte restore');
 let db,created=false;
 try{
  const st=await stat(resolve(templatePath));
  if(!st.isFile()||st.size<100||st.size>100*1024*1024)
   stop('empty schema template is not a supported SQLite file');
  await copyFile(resolve(templatePath),resolve(outputPath),1);
  created=true;await chmod(resolve(outputPath),0o600);
  db=new DatabaseSync(resolve(outputPath));
  if(db.prepare('PRAGMA journal_mode').get().journal_mode==='wal')
   stop('template must be a checkpointed standalone SQLite database, not WAL mode');
  db.exec('PRAGMA foreign_keys=ON');
  const result=restore(db,archive,supplemental);
  db.close();db=undefined;
  return Object.freeze({...result,outputCreated:true,remoteWritesPerformed:false});
 }catch(e){
  if(db){try{db.close();}catch{}}
  if(created)await unlink(resolve(outputPath)).catch(()=>{});
  throw e;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==6)stop('usage: node restore_numbered_records_to_isolated_sqlite.mjs RECORDS.json EMPTY_SCHEMA.sqlite RECOVERED.sqlite SUPPLEMENTAL.json');
  console.log(JSON.stringify(await restoreNumberedRecordsToIsolatedSqlite(...process.argv.slice(2))));
 }catch(e){console.error(e instanceof Error?e.message:'restore failed');process.exitCode=1;}
}
