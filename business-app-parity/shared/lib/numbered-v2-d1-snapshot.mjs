/** FIRE v2 numbered records — read-only, SOURCE-ONLY D1 snapshot builder.
 *
 * This is NOT an HTTP endpoint, deployment, approved full backup, or restore.
 * Retain the existing /api/backup HTTP 409 numbering protection.
 * An actual release archive still needs separately verified R2/object bytes,
 * iPhone-local photo ZIP custody, optional-feature schema inventory, provider
 * source/DB identity, off-device storage and owner-authorized recovery tests.
 *
 * D1.batch must give a single transactional view of ALL metadata and rows.
 * Every statement below is SELECT or read-only PRAGMA; no D1 mutations.
 * 49 D1 queries in one batch, within current Free 50-query/request limit.
 * Host/route authorization must not perform other D1 reads in this request.
 */
import {
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,validateNumberedCoreRecordsV2
} from './numbered-records-v2-preflight.mjs';
import {verifySignedAgreementDigests} from './deposit-agreement-backup.mjs';

const ARCHIVE_LIMIT_BYTES=5_000_000;
const businessTables=Object.freeze([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
const known=new Set(businessTables);
const operational=new Set(['auth_rate_limits','d1_migrations']);
// Cloudflare D1 may install its documented internal _cf_KV table. It contains
// provider metadata, not application records; never copy it into a customer
// backup. Accept ONLY the exact documented definition, never arbitrary
// _cf_* tables or an application table masquerading as provider storage.
const CLOUDFLARE_INTERNAL_KV_DDL=/^CREATE\s+TABLE\s+(?:_cf_KV|"_cf_KV"|`_cf_KV`|\[_cf_KV\])\s*\(\s*(?:key|"key"|`key`|\[key\])\s+TEXT\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|`value`|\[value\])\s+BLOB\s*\)\s+WITHOUT\s+ROWID\s*;?$/i;
const denied=reason=>{throw new Error('FIRE numbered v2 read-only snapshot BLOCKED: '+reason);};
const isRow=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const quoteTable=name=>'"'+name+'"'; // names are a frozen, reviewed source allowlist
const rows=(result,label)=>{
 if(!result||result.success===false||!Array.isArray(result.results))denied(label+' returned incomplete D1 rows');
 return result.results;
};
const sequence=(entries,name)=>{
 const matched=entries.filter(row=>row.name===name);
 if(matched.length>1)denied('ambiguous original permanent number high-water');
 if(!matched.length)return 0;
 const value=matched[0].seq;
 if(!Number.isSafeInteger(value)||value<0)denied('unsafe original serial high-water');
 return value;
};

/** The only supported input is a D1-style read-only transactional batch.
 * No env global, authorization bypass, HTTP response or provider operation
 * is introduced. Caller MUST verify source/target identity independently.
 */
export async function captureNumberedCoreV2ReadOnly(db){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
  denied('transactional D1 read capability is required');
 if(known.size!==23||businessTables.length!==23)denied('reviewed source table list changed');
 // D1 Free allows only 50 queries per Worker invocation. Bundle all 23
 // independent COUNT(*) queries as ONE read-only SQL UNION ALL statement.
 // The complete 49-query batch still preserves a single transactional view.
 const countSql=businessTables.map(table=>
   "SELECT '"+table+"' AS table_name,COUNT(*) AS count FROM "+quoteTable(table)
 ).join(' UNION ALL ');
 const statements=[
   db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
   db.prepare("SELECT name,seq FROM sqlite_sequence WHERE name IN ('fire_customer_numbers','fire_job_numbers') ORDER BY name"),
   db.prepare(countSql)
 ];
 for(const table of businessTables){
   statements.push(db.prepare('SELECT * FROM '+quoteTable(table)));
   statements.push(db.prepare('PRAGMA table_info('+quoteTable(table)+')'));
 }
 if(statements.length!==49)denied('D1 read quota budget exceeds reviewed Free-tier safety limit');
 // A single D1.batch is needed: separate batch/read calls could combine
 // an earlier financial ledger with later number mappings or timestamps.
 const result=await db.batch(statements);
 if(!Array.isArray(result)||result.length!==statements.length)
  denied('a complete transactional metadata/records read was not returned');
 const schemaRows=rows(result[0],'schema');
 // Require the actual sqlite_master DDL so a same-named but incompatible
 // internal table can never be silently excluded from the backup.
 if(schemaRows.some(row=>!isRow(row)||Object.keys(row).length!==2||
    typeof row.name!=='string'||typeof row.sql!=='string'))
  denied('invalid or incomplete database schema metadata');
 const schema=schemaRows.map(row=>row.name);
 if(schemaRows.some(row=>row.name==='_cf_KV'&&!CLOUDFLARE_INTERNAL_KV_DDL.test(row.sql))||
    schema.some(name=>!known.has(name)&&!operational.has(name)&&name!=='_cf_KV')||
    new Set(schema).size!==schema.length||
    businessTables.some(name=>!schema.includes(name)))
  denied('missing or unreviewed durable table; archive would omit state');
 const sequenceRows=rows(result[1],'sqlite_sequence');
 if(sequenceRows.some(row=>!['fire_customer_numbers','fire_job_numbers'].includes(row.name)))
  denied('unexpected original serial sequence');
 const countEntries=rows(result[2],'combined table counts');
 const countMap=new Map();
 for(const row of countEntries){
   if(!known.has(row?.table_name)||countMap.has(row.table_name)||
      !Number.isSafeInteger(row.count)||row.count<0)
     denied('ambiguous/missing or unsafe independent table count');
   countMap.set(row.table_name,row.count);
 }
 if(countMap.size!==businessTables.length)
   denied('independent count proof omits a durable table');
 const tables={},rowCounts={};
 for(let i=0;i<businessTables.length;i++){
   const table=businessTables[i],index=3+i*2;
   const data=rows(result[index],table+' rows');
   const declaredCount=countMap.get(table);
   const columns=rows(result[index+1],table+' columns').map(row=>row?.name);
   if(columns.length===0||new Set(columns).size!==columns.length||
      columns.some(column=>typeof column!=='string'||!/^[a-z_][a-z_0-9]*$/.test(column)))
     denied('invalid or missing SQL columns for '+table);
   if(declaredCount!==data.length)
     denied('nonmatching independent D1 row count for '+table);
   const requiredColumns=new Set(columns);
   for(const row of data){
     if(!isRow(row)||Object.keys(row).length!==columns.length||
        Object.keys(row).some(key=>!requiredColumns.has(key)))
       denied('incomplete SQL row/column representation for '+table);
   }
   tables[table]=data;
   rowCounts[table]=declaredCount;
 }
 const snapshot={
   format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
   allTablesComplete:true,truncated:false,tables,rowCounts,
   highWater:{
     customer:sequence(sequenceRows,'fire_customer_numbers'),
     job:sequence(sequenceRows,'fire_job_numbers')
   }
 };
 validateNumberedCoreRecordsV2(snapshot);
 const digestError=await verifySignedAgreementDigests(snapshot.tables);
 if(digestError)denied('signed agreement document digest verification failed');
 const serialized=JSON.stringify(snapshot);
 if(!serialized||new TextEncoder().encode(serialized).byteLength>ARCHIVE_LIMIT_BYTES)
   denied('records exceed bounded snapshot export; use an approved managed export');
 // No side effects: return a plain archive with lossless original values.
 // It is NOT a full photo or independently held backup.
 return Object.freeze(snapshot);
}
