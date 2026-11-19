/** Real v1 migration SQL => exact bound-D1 trigger definition verifier.
 * Synthetic SELECT-only tests. No provider, schema or data writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {immutableNumberingTriggersReady} from '../lib/numbered-immutable-trigger-contract.mjs';

const sources=[
 new URL('../../customer-numbering/customer_numbers_v1.sql',import.meta.url),
 new URL('../../job-numbering/job_numbers_v1.sql',import.meta.url)
];
const rows=sources.flatMap(url=>[...readFileSync(url,'utf8').matchAll(
 /CREATE TRIGGER\s+([a-z_]+)[\s\S]*?\bEND\s*;/gi
)].map(match=>({name:match[1],sql:match[0]})));
assert.equal(rows.length,6,'real approved prototype migrations contain all six immutable triggers');
let count=0;
const dbFor=provided=>({
 prepare(sql){
  assert.match(sql,/^SELECT\b/i,'actual bound-D1 check must issue SELECT only');
  assert.match(sql,/sqlite_master/);
  assert.match(sql,/type='trigger'/);
  return {all:async()=>({results:provided})};
 }
});
async function accepted(value,why){
 assert.equal(await immutableNumberingTriggersReady(dbFor(value)),true,why);
 count++;
}
async function blocked(value,why){
 await assert.rejects(immutableNumberingTriggersReady(dbFor(value)),/definitions are not verified/,why);
 count++;
}
const modify=(name,fn)=>rows.map(row=>row.name===name?{...row,sql:fn(row.sql)}:row);
await accepted(rows,'real migration trigger DDL accepted');
await accepted([...rows].reverse(),'order-independent physical inventory');
await accepted(rows.map(row=>({...row,sql:row.sql.toLowerCase()})),
 'harmless SQL case differences accepted');
await blocked(rows.slice(1),'missing Customer # update guard must fail closed');
await blocked(rows.slice(0,5),'missing Job # link delete guard must fail closed');
await blocked([...rows,rows[0]],'duplicate trigger result must fail closed');
await blocked(modify('fire_job_numbers_no_update',sql=>
 sql.replace(/SELECT RAISE\(ABORT,'FIRE Job numbers cannot be renumbered'\);/,
  'SELECT 1;')),'named no-op UPDATE trigger cannot masquerade as immutability');
await blocked(modify('fire_customer_numbers_no_update',sql=>
 sql.replace('BEFORE UPDATE','AFTER UPDATE')),'AFTER UPDATE is too late');
await blocked(modify('fire_job_estimate_links_no_delete',sql=>
 sql.replace('ON fire_job_estimate_links','ON customers')),
 'trigger acting on a different table does not count');
await blocked(modify('fire_job_numbers_no_delete',sql=>
 sql.replace('BEFORE DELETE','BEFORE INSERT')),'wrong event cannot protect deletion');
await blocked(modify('fire_customer_numbers_no_delete',sql=>
 sql.replace('FIRE customer numbers cannot be reused','not an abort error')),
 'unreviewed changed trigger body cannot receive silent acceptance');
await blocked(rows.map((row,i)=>i?row:{name:row.name,sql:null}),
 'sqlite_master without trigger SQL cannot be trusted');
await assert.rejects(immutableNumberingTriggersReady({
 prepare(){throw Error('Synthetic D1 reader unavailable');}
}),/Synthetic D1 reader unavailable/);
count++;
console.log('PASS '+count+'/'+count+
 ' approved immutable Customer # and Job # trigger SQL/negative cases; read-only offline.');
