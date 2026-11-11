/**
 * Local-only Gate 7 rehearsal of a legacy records review into disposable
 * :memory: SQLite. There is NO destination path/host/URL, D1/Cloudflare/R2
 * capability, or way to promote this database to a live Site.
 *
 * Explicitly refuses AUTOINCREMENT sources because sqlite_sequence (system
 * high-water metadata) is not included in the legacy review envelope.
 */
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {LEGACY_REVIEW_FORMAT,LEGACY_REVIEW_VERSION} from '../lib/legacy-sites-readonly-export.mjs';

const blocked=()=>{throw Error('FIRE LEGACY DISPOSABLE RESTORE BLOCKED');};
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeName=x=>typeof x==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(x);
const canon=value=>{
 if(Array.isArray(value))return '['+value.map(canon).join(',')+']';
 if(isRecord(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canon(value[k])).join(',')+'}';
 if(value===null||typeof value==='string'||typeof value==='boolean'||
    typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 blocked();
};
const rowList=values=>{
 if(!Array.isArray(values)||values.length>30000)blocked();
 return values.map(x=>{if(!isRecord(x))blocked();return canon(x)}).sort();
};
const validateReview=data=>{
 if(!isRecord(data)||data.format!==LEGACY_REVIEW_FORMAT||data.version!==LEGACY_REVIEW_VERSION||
    data.completeBackup!==false||data.recoveryAuthorized!==false||
    data.repeatReadRowsMatch!==true||data.independentRowCountsMatch!==true||
    data.schemaCatalogStableAcrossReads!==true||
    data.sourceD1UuidVerified!==false||data.sameInstantProviderSnapshotVerified!==false||
    data.photoObjectBytesIncluded!==false||data.recordsSelfCheckIsProviderAttestation!==false||
    typeof data.recordsSelfCheckSHA256!=='string'||!/^[0-9a-f]{64}$/.test(data.recordsSelfCheckSHA256)||
    !Array.isArray(data.sourceTables)||
    !Array.isArray(data.schemaObjects)||!isRecord(data.rowCounts)||!isRecord(data.tables))blocked();
 const tables=data.sourceTables;
 if(tables.length<1||tables.length>23||new Set(tables).size!==tables.length||
    tables.some(t=>!safeName(t))||
    Object.keys(data.tables).length!==tables.length||
    Object.keys(data.rowCounts).length!==tables.length)blocked();
 const integrityMaterial=canon({
   sourceTables:tables,rowCounts:data.rowCounts,schemaObjects:data.schemaObjects,tables:data.tables
 });
 const localHash=createHash('sha256').update(integrityMaterial,'utf8').digest('hex');
 if(localHash!==data.recordsSelfCheckSHA256)blocked();
 for(const name of tables){
   if(!Object.hasOwn(data.tables,name)||!Object.hasOwn(data.rowCounts,name)||
      !Number.isSafeInteger(data.rowCounts[name])||data.rowCounts[name]<0||
      !Array.isArray(data.tables[name])||data.tables[name].length!==data.rowCounts[name])blocked();
   rowList(data.tables[name]);
 }
 const definitions=data.schemaObjects.filter(x=>x?.type==='table');
 if(definitions.length!==tables.length||definitions.some(x=>!tables.includes(x.name)))blocked();
 if(data.schemaObjects.some(x=>!['table','index','view','trigger'].includes(x.type)||
    !safeName(x.name)||!safeName(x.tbl_name)||
    typeof x.sql!=='string'||x.sql.length>100_000))blocked();
 // Cannot preserve original integer sequence high-water from this format.
 if(data.schemaObjects.some(x=>/\bAUTOINCREMENT\b/i.test(x.sql)))blocked();
 // Refuse numbered tables: separate v2 path restores their identity history.
 if(tables.some(x=>['fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'].includes(x)))blocked();
 return {tables,definitions};
};
const executeSchema=(db,object,kind)=>{
 const sql=object.sql.trim();
 const prefix=kind==='table'?/^CREATE\s+TABLE\b/i:
  kind==='index'?/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i:
  kind==='view'?/^CREATE\s+VIEW\b/i:/^CREATE\s+TRIGGER\b/i;
 if(!prefix.test(sql))blocked();
 // SQLite prepare() handles exactly ONE DDL statement. Do not execute a
 // supplied multi-statement script via db.exec().
 db.prepare(sql).run();
};
export function rehearseLegacySitesReviewToDisposableMemory(data){
 validateReview(data);
 const db=new DatabaseSync(':memory:');
 try{
  const memory=db.prepare('PRAGMA database_list').all();
  if(memory.length!==1||memory[0].name!=='main'||memory[0].file!=='')blocked();
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec('BEGIN');
  try{
   // Create base tables before rows so schema-level foreign-key references
   // exist, then recreate indexes/triggers/views AFTER inserts.
   for(const item of data.schemaObjects.filter(x=>x.type==='table'))executeSchema(db,item,'table');
   for(const table of data.sourceTables){
    const columns=db.prepare('PRAGMA table_info("'+table+'")').all().map(x=>x.name);
    if(columns.length===0||new Set(columns).size!==columns.length||
       columns.some(x=>!safeName(x)))blocked();
    for(const row of data.tables[table]){
     if(Object.keys(row).length!==columns.length||
        Object.keys(row).some(x=>!columns.includes(x)))blocked();
     const values=columns.map(x=>row[x]);
     if(values.some(x=>x!==null&&typeof x!=='string'&&
        !(typeof x==='number'&&Number.isFinite(x))))blocked();
     db.prepare('INSERT INTO "'+table+'" ('+columns.map(c=>'"'+c+'"').join(',')+
       ') VALUES ('+columns.map(()=>'?').join(',')+')').run(...values);
    }
   }
   // Integrity and uniqueness constraints must be reconstructed, not silently
   // discarded. Recreating triggers after rows prevents a replay side effect.
   for(const kind of ['index','trigger','view'])
    for(const item of data.schemaObjects.filter(x=>x.type===kind))executeSchema(db,item,kind);
   for(const table of data.sourceTables){
    const actual=db.prepare('SELECT * FROM "'+table+'"').all();
    const before=rowList(data.tables[table]),after=rowList(actual);
    if(before.length!==after.length||before.some((r,i)=>r!==after[i]))blocked();
   }
   const problems=db.prepare('PRAGMA foreign_key_check').all();
   if(problems.length!==0||db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')blocked();
   db.exec('COMMIT');
  }catch{db.exec('ROLLBACK');throw Error('FIRE LEGACY DISPOSABLE RESTORE BLOCKED');}
  return {
   disposableInMemoryRoundTripVerified:true,
   recreatedSchemaObjects:data.schemaObjects.length,
   recreatedTables:data.sourceTables.length,
   recoveredRecordCount:data.sourceTables.reduce((sum,t)=>sum+data.rowCounts[t],0),
   actualRemoteRestorePerformed:false,
   sourceD1UuidVerified:false,photoBytesRestored:false,
   ownerRecoveryAuthorized:false,releaseGate7Accepted:false
  };
 }finally{db.close();}
}
