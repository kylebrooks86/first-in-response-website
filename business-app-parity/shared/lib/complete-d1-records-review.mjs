/** FIRE Gate7: reviewed, SOURCE-ONLY transactional complete D1 RECORDS capture.
 * The old numbered-v2 route exports just the 23 core tables and is NOT full.
 * This captures those records PLUS named supplemental tables in ONE D1.batch.
 * Cloudflare's Oct-2026 D1 limit documentation counts a batch as ONE Worker
 * query invocation, NOT its individual SELECT/PRAGMA statements.
 * No HTTP endpoint, credentials, mutation, photo bytes or release is enabled.
 *
 * The snapshot is still PRIVATE REVIEW DATA, NOT a valid off-device encrypted
 * backup, a recoverable photo ZIP, a physical provider source identity or
 * Gate7 acceptance. Unknown tables and schemas fail closed.
 */
import {
 NUMBERED_CORE_TABLES, NUMBERED_IDENTITY_TABLES,
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 validateNumberedCoreRecordsV2
} from './numbered-records-v2-preflight.mjs';
import {verifySignedAgreementDigests} from './deposit-agreement-backup.mjs';

const coreTables=Object.freeze([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
const mandatorySupplemental=Object.freeze(['auth_rate_limits','d1_migrations']);
const propertyTables=Object.freeze(['customer_properties','estimate_property_links','property_recovery_guard']);
const locationTables=Object.freeze(['estimate_service_locations']);
const providerTables=new Set(['_cf_KV','_cf_METADATA']);
const maxReviewBytes=5_000_000;
const stop=why=>{throw Error('FIRE full D1 review BLOCKED: '+why);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const quote=x=>'"'+x+'"';
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const resultRows=(x,label)=>{
 if(!x||x.success===false||!Array.isArray(x.results))stop('incomplete '+label+' result');
 return x.results;
};
const providerKV=/^CREATE\s+TABLE\s+(?:_cf_KV|"_cf_KV"|\u0060_cf_KV\u0060|\[_cf_KV\])\s*\(\s*(?:key|"key"|\u0060key\u0060|\[key\])\s+TEXT\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|\u0060value\u0060|\[value\])\s+BLOB\s*\)\s+WITHOUT\s+ROWID\s*;?$/i;
const providerMetadata=/^CREATE\s+TABLE\s+(?:_cf_METADATA|"_cf_METADATA"|\u0060_cf_METADATA\u0060|\[_cf_METADATA\])\s*\(\s*(?:key|"key"|\u0060key\u0060|\[key\])\s+INTEGER\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|\u0060value\u0060|\[value\])\s+BLOB\s*\)\s*;?$/i;
const validValue=x=>x===null||typeof x==='string'||typeof x==='boolean'||
 typeof x==='number'&&Number.isFinite(x);
const legalRows=(data,columns,table)=>{
 if(!Array.isArray(columns)||!columns.length||columns.some(c=>!ident(c.name))||
    new Set(columns.map(c=>c.name)).size!==columns.length)
  stop('unknown or incomplete columns for '+table);
 const keys=new Set(columns.map(c=>c.name));
 for(const row of data){
  if(!record(row)||Object.keys(row).length!==keys.size||
     Object.entries(row).some(([k,v])=>!keys.has(k)||!validValue(v)))
   stop('nonlossless D1 fields in '+table);
 }
};
/** options are SOURCE REVIEW inventory selectors, not auth or release flags.
 * An OPTIONAL physical table without its selector is deliberately refused.
 */
export async function captureCompleteReviewedD1RecordsReadOnly(db,
 {customerProperties=false,serviceLocations=false}={}){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
  stop('transactional D1 read capability required');
 if(typeof customerProperties!=='boolean'||typeof serviceLocations!=='boolean'||
    (customerProperties&&!serviceLocations))
  stop('explicit compatible optional schema selectors required');
 if(coreTables.length!==23||new Set(coreTables).size!==23)
  stop('numbered-core contract changed');
 const supplemental=[...mandatorySupplemental,
  ...(customerProperties?propertyTables:[]),
  ...(serviceLocations?locationTables:[])];
 const tables=[...coreTables,...supplemental];
 if(new Set(tables).size!==tables.length)stop('ambiguous table inventory');
 const countSql=tables.map(x=>"SELECT '"+x+"' AS table_name, COUNT(*) AS count FROM "+quote(x)).join(' UNION ALL ');
 const statements=[
  db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND lower(substr(name,1,7)) <> 'sqlite_' ORDER BY type,name"),
  db.prepare("SELECT name,seq FROM sqlite_sequence ORDER BY name"),
  db.prepare(countSql)
 ];
 for(const table of tables){
  statements.push(db.prepare('SELECT * FROM '+quote(table)));
  statements.push(db.prepare('PRAGMA table_xinfo('+quote(table)+')'));
 }
 // A SINGLE D1.batch is a transaction and counts as ONE D1 invocation query.
 // Do not replace it with per-table calls; those lose snapshot consistency.
 let returned;
 try{returned=await db.batch(statements);}
 catch{stop('reviewed transactional source tables are missing or unreadable');}
 if(!Array.isArray(returned)||returned.length!==statements.length)
  stop('truncated transactional D1 batch');
 const objects=resultRows(returned[0],'schema objects');
 if(!objects.length||objects.some(x=>!record(x)||
    Object.keys(x).sort().join(',')!=='name,sql,tbl_name,type'||
    !['table','index','trigger','view'].includes(x.type)||
    typeof x.name!=='string'||typeof x.tbl_name!=='string'||
    !(x.sql===null||typeof x.sql==='string')))
  stop('invalid complete D1 schema objects');
 const names=objects.filter(x=>x.type==='table').map(x=>x.name);
 if(new Set(names).size!==names.length)stop('duplicate D1 schema table');
 for(const name of names){
  if(providerTables.has(name)){
   const item=objects.find(x=>x.name===name&&x.type==='table');
   if(!(name==='_cf_KV'?providerKV:providerMetadata).test(item.sql))
    stop('unreviewed provider table definition');
  }else if(!tables.includes(name))stop('unreviewed durable table '+name);
 }
 if(tables.some(x=>!names.includes(x)))stop('missing source table in reviewed inventory');
 // Preserve the full SQL object identity, but exclude ONLY strictly checked
 // Cloudflare-owned internal definitions from customer backup evidence.
 const ownedObjects=objects.filter(x=>!providerTables.has(x.tbl_name)&&
  !providerTables.has(x.name));
 if(ownedObjects.some(x=>!ident(x.name)||!ident(x.tbl_name)))
  stop('unreviewed schema object identity');
 const sequenceRows=resultRows(returned[1],'original serials');
 const seqs=new Map();
 for(const row of sequenceRows){
  if(!record(row)||typeof row.name!=='string'||!Number.isSafeInteger(row.seq)||
     row.seq<0||seqs.has(row.name)||!tables.includes(row.name))
   stop('missing or unreviewed AUTOINCREMENT history');
  seqs.set(row.name,row.seq);
 }
 const counts=resultRows(returned[2],'independent counts'),countMap=new Map();
 for(const row of counts){
  if(!record(row)||!tables.includes(row.table_name)||countMap.has(row.table_name)||
     !Number.isSafeInteger(row.count)||row.count<0)
   stop('ambiguous or invalid per-table independent count');
  countMap.set(row.table_name,row.count);
 }
 if(countMap.size!==tables.length)stop('incomplete per-table counts');
 const data={},rowCounts={},columns={};
 for(let i=0;i<tables.length;i++){
  const name=tables[i],index=3+i*2;
  const all=resultRows(returned[index],name+' rows');
  const xinfos=resultRows(returned[index+1],name+' columns');
  if(all.length!==countMap.get(name))stop('truncated '+name+' data');
  legalRows(all,xinfos,name);
  data[name]=all;rowCounts[name]=all.length;
  columns[name]=xinfos.map(x=>({name:x.name,type:x.type,
   notnull:x.notnull,pk:x.pk,hidden:x.hidden,dflt_value:x.dflt_value}));
 }
 // This is the exact canonical object/column payload format used by the
 // existing private isolated-SQLite schema fingerprint. Provider-only
 // metadata is intentionally excluded; its DDL was independently checked.
 const orderedColumns=Object.fromEntries(ownedObjects.filter(x=>x.type==='table')
  .map(x=>[x.name,columns[x.name]]));
 const payload=JSON.stringify({objects:ownedObjects,columns:orderedColumns});
 const schemaSha256=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)));
 const schemaIdentity=Object.freeze({format:'fire-isolated-sqlite-schema',version:1,
  sha256:schemaSha256,tables:tables.length,objects:ownedObjects.length});
 const core={format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,schemaIdentity,
  tables:Object.fromEntries(coreTables.map(t=>[t,data[t]])),
  rowCounts:Object.fromEntries(coreTables.map(t=>[t,rowCounts[t]])),
  highWater:{customer:seqs.get('fire_customer_numbers')??0,job:seqs.get('fire_job_numbers')??0}};
 const extra={format:'fire-isolated-supplemental-records',version:1,
  allTablesComplete:true,truncated:false,schemaIdentity,
  tables:Object.fromEntries(supplemental.map(t=>[t,data[t]])),
  rowCounts:Object.fromEntries(supplemental.map(t=>[t,rowCounts[t]])),
  sqliteSequence:Object.fromEntries(supplemental.filter(t=>seqs.has(t)).map(t=>[t,seqs.get(t)]))};
 validateNumberedCoreRecordsV2(core);
 // Property/service history belongs to the exact numbered customers and
 // estimates. A logically mismatched archive must not be labelled complete.
 const customers=new Set(core.tables.customers.map(x=>x.id));
 const estimates=new Map(core.tables.estimates.map(x=>[x.id,x]));
 if(serviceLocations){
  for(const loc of data.estimate_service_locations){
   const estimate=estimates.get(loc.estimate_id);
   if(!estimate||loc.customer_id!==estimate.customer_id||
      !customers.has(loc.customer_id)||typeof loc.address!=='string'||
      loc.address.trim()==='')stop('service-address relationship or value mismatch');
  }
 }
 if(customerProperties){
  const properties=new Map();
  for(const p of data.customer_properties){
   if(properties.has(p.id)||!customers.has(p.customer_id)||
      typeof p.address!=='string'||p.address.trim()==='')
    stop('property owner or identity mismatch');
   properties.set(p.id,p);
  }
  const locations=new Map(data.estimate_service_locations.map(x=>[x.estimate_id,x]));
  for(const link of data.estimate_property_links){
   const p=properties.get(link.property_id);
   const e=estimates.get(link.estimate_id);
   const l=locations.get(link.estimate_id);
   if(!p||!e||!l||e.customer_id!==link.customer_id||
      p.customer_id!==link.customer_id||l.customer_id!==link.customer_id||
      link.property_revision!==p.revision||l.captured_at!==link.captured_at||
      l.address!==p.address+(p.designation?' · '+p.designation:''))
    stop('property selection or immutable service-location mismatch');
  }
 }
 if(await verifySignedAgreementDigests(core.tables))
  stop('original signed agreement digests do not verify');
 const packed=JSON.stringify({core,supplemental:extra});
 if(new TextEncoder().encode(packed).byteLength>maxReviewBytes)
  stop('complete source records exceed bounded review size');
 return Object.freeze({
  format:'fire-full-d1-records-review',version:1,
  schemaIdentity,core,supplemental:extra,
  allReviewedRecordTablesIncluded:true,sourceTables:tables.length,
  sourceRowCount:Object.values(rowCounts).reduce((n,v)=>n+v,0),
  isEncrypted:false,completeBackup:false,
  actualProviderSourceIdentityVerified:false,
  offDeviceCustodyVerified:false,photoBytesIncluded:false,
  isolatedPhysicalRestoreVerified:false,gate7Accepted:false,
  cloudflareWritesPerformed:false
 });
}
