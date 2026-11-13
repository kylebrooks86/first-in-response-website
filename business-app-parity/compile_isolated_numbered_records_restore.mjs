/** FIRE isolated D1 core-record recovery SQL compiler.
 * Produces a transaction for an EMPTY, separately provisioned destination.
 * Does not connect to D1, run SQL, deploy, or grant production approval.
 * The destination schema column inventory must come from the actual intended
 * isolated database; never guess columns or silently discard source fields.
 */
import {validateNumberedCoreRecordsV2,NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES}
 from './shared/lib/numbered-records-v2-preflight.mjs';
const fail=why=>{throw Error('FIRE isolated records restore BLOCKED: '+why);};
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x)&&x.length<=90;
const quote=x=>'"'+x+'"';
const literal=x=>{
 if(x===null)return 'NULL';
 if(typeof x==='string')return "'"+x.replaceAll("'","''")+"'";
 if(typeof x==='number'&&Number.isFinite(x))return String(x);
 if(typeof x==='boolean')return x?'1':'0';
 fail('unsupported SQLite record value');
};
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES];
/** schemaColumns: { table_name: ['column_a',...] } from isolated D1 PRAGMA table_info.
 * emptyTableCounts: independently queried counts from the SAME destination.
 * This intentionally never handles preexisting records or schema migrations.
 */
export function compileEmptyIsolatedNumberedRestore(snapshot,schemaColumns,emptyTableCounts){
 const summary=validateNumberedCoreRecordsV2(snapshot);
 if(!schemaColumns||!emptyTableCounts||
    Object.keys(schemaColumns).length!==tables.length||
    Object.keys(emptyTableCounts).length!==tables.length||
    tables.some(t=>!Object.hasOwn(schemaColumns,t)||!Object.hasOwn(emptyTableCounts,t)))
  fail('complete isolated schema inventory and destination emptiness required');
 const sql=['BEGIN IMMEDIATE;',
  'CREATE TEMP TABLE __fire_restore_assert(ok INTEGER NOT NULL CHECK(ok=1));'];
 let rows=0;
 for(const table of tables){
  const columns=schemaColumns[table],count=emptyTableCounts[table];
  if(!ident(table)||!Array.isArray(columns)||!columns.length||
     columns.some(c=>!ident(c))||new Set(columns).size!==columns.length)
   fail('invalid or duplicate destination column inventory for '+table);
  if(count!==0)fail('destination table '+table+' is not empty');
  const permitted=new Set(columns);
  for(const row of snapshot.tables[table]){
   const keys=Object.keys(row);
   if(!keys.length||keys.some(k=>!permitted.has(k))||
      keys.some(k=>!ident(k)))
    fail('source column missing from destination schema for '+table);
   const cols=keys.sort();
   sql.push('INSERT INTO '+quote(table)+' ('+cols.map(quote).join(',')+
    ') VALUES ('+cols.map(c=>literal(row[c])).join(',')+');');
   rows++;
  }
 }
 // Permanent AUTOINCREMENT serials are never regenerated from MAX(number).
 // The destination must have both dedicated SQLite sequence rows. Never
 // silently insert these into an unknown schema or reset existing counters.
 sql.push("UPDATE sqlite_sequence SET seq="+literal(snapshot.highWater.customer)+
  " WHERE name='fire_customer_numbers';");
 sql.push('INSERT INTO temp.__fire_restore_assert(ok) VALUES (CASE WHEN changes()=1 THEN 1 ELSE 0 END);');
 sql.push("UPDATE sqlite_sequence SET seq="+literal(snapshot.highWater.job)+
  " WHERE name='fire_job_numbers';");
 sql.push('INSERT INTO temp.__fire_restore_assert(ok) VALUES (CASE WHEN changes()=1 THEN 1 ELSE 0 END);');
 sql.push('DROP TABLE temp.__fire_restore_assert;');
 sql.push('COMMIT;');
 return Object.freeze({sql:sql.join('\n')+'\n',sourceRows:rows,
  customers:summary.customers,jobNumbers:summary.jobNumbers,
  requiresIsolatedOwnerApprovedExecution:true,
  supplementalTablesCovered:false,photoBytesRestored:false,
  providerWritesPerformed:false,gate7Accepted:false});
}
