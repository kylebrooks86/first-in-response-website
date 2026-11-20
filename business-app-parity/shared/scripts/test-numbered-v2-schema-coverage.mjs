/** SOURCE-ONLY completeness contract for the owner-verified 25-migration QA
 * baseline + 3 proposed immutable serial mapping tables.
 * Auth rate limiting and D1 migration journal are operational metadata, not
 * recoverable customer/finance records. Future stateful tables must be added
 * to a reviewed recovery format or this check fails closed.
 *
 * This does not inspect a live D1, other environments' migration lineages,
 * cloud image objects, device-local photo blobs, or additional gated schemas.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES}
 from '../lib/numbered-records-v2-preflight.mjs';

const folder='../adapters/doomsday/drizzle';
const scripts=readdirSync(folder).filter(name=>/^\d{4}_[\w-]+\.sql$/.test(name)).sort();
const found=new Map();
const ddlTables=sql=>[...sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([a-zA-Z_][\w]*)/ig)]
 .map(match=>match[1].toLowerCase());
for(const name of scripts){
 const tables=ddlTables(readFileSync(folder+'/'+name,'utf8'));
 for(const table of tables){
  assert.ok(!found.has(table),'QA schema table created twice: '+table);
  found.set(table,name);
 }
}
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
eq(scripts.length,25,'Current QA baseline has 25 exact source SQL migrations');
const operational=new Set(['auth_rate_limits']);
const expected=new Set(NUMBERED_CORE_TABLES);
const schemaBusiness=[...found.keys()].filter(t=>!operational.has(t)).sort();
eq(schemaBusiness,[...expected].sort(),
  'Every baseline customer, quote, payment, audit and photo METADATA table has v2 core recovery coverage');
eq(found.has('auth_rate_limits'),true,'Operational auth rate-limit cache is explicitly excluded');
const candidateFiles=[
 '../customer-numbering/customer_numbers_v1.sql',
 '../job-numbering/job_numbers_v1.sql'
];
const proposed=new Set(candidateFiles.flatMap(file=>ddlTables(readFileSync(file,'utf8'))));
eq([...proposed].sort(),[...NUMBERED_IDENTITY_TABLES].sort(),
  'Proposed permanent number prototype has exactly the 3 expected new durable tables');
const covered=new Set([...expected,...proposed]);
function checkCoverage(tables){
 const uncovered=tables.filter(t=>!operational.has(t)&&!covered.has(t));
 if(uncovered.length)throw Error('Unbacked durable QA schema table(s): '+uncovered.join(', '));
 return true;
}
eq(checkCoverage([...found.keys(),...proposed]),true,
  'Existing current-25 + hypothetical numbered schema leaves no uncovered durable tables');
assert.throws(()=>checkCoverage([...found.keys(),'new_customer_financial_table']),
 /Unbacked durable QA schema table/);checks++;
assert.throws(()=>checkCoverage(['auth_rate_limits','unknown_customer_notes_v2']),
 /Unbacked durable QA schema table/);checks++;
console.log('PASS '+checks+' source-only migration table coverage checks: '+schemaBusiness.length+
 ' durable baseline QA business tables, '+proposed.size+' permanent identity tables, 1 excluded auth cache. No D1 read or write.');
