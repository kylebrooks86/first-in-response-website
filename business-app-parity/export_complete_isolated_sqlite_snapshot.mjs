/** FIRE OFFLINE SQLite source exporter for the isolated restore workflow.
 * Exports ALL business tables (core, identity, supplemental) from a local
 * standalone SQLite snapshot into complete, versioned private JSON archives.
 * Does not connect to a Cloudflare D1 binding or create a hosted backup.
 *
 * node export_complete_isolated_sqlite_snapshot.mjs SOURCE.sqlite CORE.json SUPPLEMENTAL.json
 */
import {DatabaseSync} from 'node:sqlite';
import {open,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,validateNumberedCoreRecordsV2,
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION}
 from './shared/lib/numbered-records-v2-preflight.mjs';
import {validateSupplementalRecoveryArchive} from './validate_supplemental_recovery_archive.mjs';
import {fingerprintIsolatedSqliteSchema} from './fingerprint_isolated_sqlite_schema.mjs';
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES];
const stop=why=>{throw Error('FIRE offline snapshot export BLOCKED: '+why);};
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const q=x=>'"'+x+'"';
const normalized=v=>{
 if(v===null||typeof v==='string'||typeof v==='number'&&Number.isFinite(v))return v;
 if(typeof v==='bigint'&&v<=BigInt(Number.MAX_SAFE_INTEGER)&&v>=BigInt(Number.MIN_SAFE_INTEGER))
  return Number(v);
 stop('SQLite binary, unsafe integer or unsupported field cannot be exported losslessly');
};
function capture(db){
 // Match SQLite's LITERAL reserved sqlite_ prefix, never SQL LIKE 'sqlite_%'.
 // LIKE treats '_' as a wildcard and can silently omit sqliteX business tables.
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND lower(substr(name,1,7)) <> 'sqlite_'").all().map(x=>x.name);
 if(names.some(x=>!ident(x)))stop('unrecognized database table name');
 if(tables.some(x=>!names.includes(x)))stop('missing numbered-core or identity table');
 const extras=names.filter(x=>!tables.includes(x)).sort();
 const schemaIdentity=fingerprintIsolatedSqliteSchema(db);
 const result={},counts={};
 // A read transaction ensures all table snapshots and sqlite_sequence
 // high-water values belong to the SAME logical database instant.
 db.exec('BEGIN');
 try{
  for(const table of names){
   const rows=db.prepare('SELECT * FROM '+q(table)).all().map(row=>
    Object.fromEntries(Object.entries(row).map(([k,v])=>[k,normalized(v)])));
   result[table]=rows;counts[table]=rows.length;
  }
  const sequences=db.prepare("SELECT name,seq FROM sqlite_sequence WHERE name IN ('fire_customer_numbers','fire_job_numbers')").all();
  const sequenceMap=new Map(sequences.map(x=>[x.name,x.seq]));
  if(sequenceMap.size!==sequences.length)stop('duplicate permanent number sequence names');
  const highWater={
   customer:sequenceMap.get('fire_customer_numbers')??0,
   job:sequenceMap.get('fire_job_numbers')??0
  };
  const core={
   format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
   allTablesComplete:true,truncated:false,highWater,schemaIdentity,
   tables:Object.fromEntries(tables.map(t=>[t,result[t]])),
   rowCounts:Object.fromEntries(tables.map(t=>[t,counts[t]]))
  };
  const supplementalSequence=Object.fromEntries(db.prepare('SELECT name,seq FROM sqlite_sequence').all().filter(x=>extras.includes(x.name)).map(x=>[x.name,x.seq]));
  const supplemental={
   format:'fire-isolated-supplemental-records',version:1,
   allTablesComplete:true,truncated:false,schemaIdentity,
   sqliteSequence:supplementalSequence,
   tables:Object.fromEntries(extras.map(t=>[t,result[t]])),
   rowCounts:Object.fromEntries(extras.map(t=>[t,counts[t]]))
  };
  validateNumberedCoreRecordsV2(core);
  validateSupplementalRecoveryArchive(supplemental,extras);
  db.exec('COMMIT');
  return {core,supplemental,tableCount:names.length,
   rowCount:Object.values(counts).reduce((a,b)=>a+b,0)};
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
}
export async function exportCompleteIsolatedSqliteSnapshot(sourcePath,corePath,supplementalPath){
 const paths=[sourcePath,corePath,supplementalPath];
 if(paths.some(x=>typeof x!=='string'||!x)||new Set(paths.map(p=>resolve(p))).size!==3)
  stop('three distinct paths required');
 const st=await stat(resolve(sourcePath));
 if(!st.isFile()||st.size<100)stop('source must be an existing standalone SQLite snapshot');
 let db,coreFile,suppFile,createdCore=false,createdSupplemental=false;
 try{
  db=new DatabaseSync(resolve(sourcePath),{readOnly:true});
  if(db.prepare('PRAGMA journal_mode').get().journal_mode==='wal')
   stop('WAL-backed source must first be checkpointed to a standalone snapshot');
  const captured=capture(db);
  db.close();db=undefined;
  coreFile=await open(resolve(corePath),'wx',0o600);createdCore=true;
  await coreFile.writeFile(JSON.stringify(captured.core),'utf8');
  await coreFile.sync();await coreFile.close();coreFile=undefined;
  suppFile=await open(resolve(supplementalPath),'wx',0o600);createdSupplemental=true;
  await suppFile.writeFile(JSON.stringify(captured.supplemental),'utf8');
  await suppFile.sync();await suppFile.close();suppFile=undefined;
  return Object.freeze({coreAndSupplementalArchivesWritten:true,
   sourceTables:captureTableCount(captured),sourceRows:captured.rowCount,
   providerBackupCreated:false,remoteWritesPerformed:false,gate7Accepted:false});
 }catch(e){
  if(db)try{db.close();}catch{}
  if(coreFile)try{await coreFile.close();}catch{}
  if(suppFile)try{await suppFile.close();}catch{}
  if(createdCore)await unlink(resolve(corePath)).catch(()=>{});
  if(createdSupplemental)await unlink(resolve(supplementalPath)).catch(()=>{});
  throw e;
 }
}
const captureTableCount=x=>x.tableCount;
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==5)stop('usage: node export_complete_isolated_sqlite_snapshot.mjs SOURCE.sqlite CORE.json SUPPLEMENTAL.json');
  console.log(JSON.stringify(await exportCompleteIsolatedSqliteSnapshot(...process.argv.slice(2))));
 }catch(e){console.error(e instanceof Error?e.message:'offline export failed');process.exitCode=1;}
}
