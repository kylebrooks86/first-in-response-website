/** FIRE exact immutable Customer # and Job # trigger contract.
 *
 * Trigger NAMES alone are not protection: a schema could contain a named
 * no-op trigger, allowing permanent identities to be edited or reused.
 * Inspect the actual bound D1 sqlite_master.sql before enabling owner login.
 * No writes, migrations, remote provider calls, secrets or customer rows.
 *
 * These canonical v1 definitions match the approved source SQL under
 * business-app-parity/{customer-numbering,job-numbering}/*.sql. A changed
 * trigger definition requires a separately reviewed schema contract.
 */
const definitions=Object.freeze([
 ['fire_customer_numbers_no_update','fire_customer_numbers','UPDATE','FIRE customer numbers are permanent'],
 ['fire_customer_numbers_no_delete','fire_customer_numbers','DELETE','FIRE customer numbers cannot be reused'],
 ['fire_job_numbers_no_update','fire_job_numbers','UPDATE','FIRE Job numbers cannot be renumbered'],
 ['fire_job_numbers_no_delete','fire_job_numbers','DELETE','FIRE Job numbers cannot be reused'],
 ['fire_job_estimate_links_no_update','fire_job_estimate_links','UPDATE','FIRE Job links cannot be reassigned'],
 ['fire_job_estimate_links_no_delete','fire_job_estimate_links','DELETE','FIRE Job links are permanent']
]);
const fail=()=>{throw Error('FIRE immutable Customer # / Job # trigger definitions are not verified');};
const canonical=value=>typeof value==='string'
 ?value.trim().replace(/\s+/g,' ').replace(/;\s*$/,'').toLowerCase():null;
const names=definitions.map(([name])=>name);
const query='SELECT name,sql FROM sqlite_master WHERE type=\'trigger\' AND name IN ('+
 names.map(name=>"'"+name+"'").join(',')+')';

/** True only when all six bound-D1 triggers implement their v1 ABORT
 * operation, target and error contract, not merely the expected names.
 * Unknown/no-op/AFTER/redirected definitions fail closed. */
export async function immutableNumberingTriggersReady(db){
 if(!db||typeof db.prepare!=='function')fail();
 const result=await db.prepare(query).all();
 const rows=result?.results;
 if(!Array.isArray(rows)||rows.length!==definitions.length)fail();
 const found=new Map();
 for(const row of rows){
  if(!row||typeof row.name!=='string'||found.has(row.name)||!names.includes(row.name))
   fail();
  found.set(row.name,row.sql);
 }
 for(const [name,table,event,message] of definitions){
  const expected=`CREATE TRIGGER ${name} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'${message}'); END`;
  if(canonical(found.get(name))!==canonical(expected))fail();
 }
 return true;
}
