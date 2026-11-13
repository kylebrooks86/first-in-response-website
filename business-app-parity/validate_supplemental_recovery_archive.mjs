/** FIRE supplemental-table recovery contract for the OFFLINE isolated SQLite
 * rehearsal. Completes coverage beyond the 23 numbered-core/identity tables.
 * The inventory MUST enumerate every non-core table in the isolated schema;
 * never silently leave behind feature-specific records.
 */
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './shared/lib/numbered-records-v2-preflight.mjs';
const core=new Set([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
const fail=reason=>{throw Error('FIRE supplemental restore BLOCKED: '+reason);};
const ident=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x)&&x.length<=90;
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function validateSupplementalRecoveryArchive(snapshot,extraSchema){
 if(!record(snapshot)||snapshot.format!=='fire-isolated-supplemental-records'||
    snapshot.version!==1||snapshot.allTablesComplete!==true||
    snapshot.truncated!==false||!record(snapshot.tables)||!record(snapshot.rowCounts)||
    !Array.isArray(extraSchema)||!record(snapshot.sqliteSequence))
  fail('complete supplemental snapshot and schema inventory required');
 const extras=extraSchema.slice().sort();
 if(new Set(extras).size!==extras.length||extras.some(x=>!ident(x)||core.has(x))||
    Object.keys(snapshot.tables).sort().join('|')!==extras.join('|')||
    Object.keys(snapshot.rowCounts).sort().join('|')!==extras.join('|'))
  fail('supplemental inventory does not exactly match isolated schema');
 for(const [name,seq] of Object.entries(snapshot.sqliteSequence))
  if(!extras.includes(name)||!Number.isSafeInteger(seq)||seq<0)
   fail('invalid supplemental AUTOINCREMENT sequence');
 let total=0;
 for(const table of extras){
  const rows=snapshot.tables[table];
  if(!Array.isArray(rows)||!Number.isSafeInteger(snapshot.rowCounts[table])||
     snapshot.rowCounts[table]!==rows.length)fail('missing or truncated '+table);
  for(const row of rows){
   if(!record(row)||!Object.keys(row).length)fail('invalid supplemental row');
   for(const [column,value] of Object.entries(row)){
    if(!ident(column)||!(value===null||typeof value==='string'||
       typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))
     fail('unsupported supplemental field '+table+'.'+column);
   }
  }
  total+=rows.length;
 }
 return Object.freeze({tables:extras.length,rows:total});
}
