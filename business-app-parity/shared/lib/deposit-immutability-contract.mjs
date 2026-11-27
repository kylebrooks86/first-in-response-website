/**
 * FIRE independent DR/NEW LIVE: verify real physical D1 immutable deposit
 * exception audit and customer-signed agreement triggers (migrations 0023/0024).
 * A matching d1_migrations journal or a trigger name alone cannot prove that
 * the saved deposit terms/signatures cannot be modified or removed.
 * SELECT-only; never changes D1, initiates a refund or asserts hosted readiness.
 */
const definitions=Object.freeze([
 Object.freeze(['deposit_policy_events_no_update','deposit_policy_events','UPDATE','Deposit audit is immutable']),
 Object.freeze(['deposit_policy_events_no_delete','deposit_policy_events','DELETE','Deposit audit is immutable']),
 Object.freeze(['deposit_agreement_snapshots_no_update','deposit_agreement_snapshots','UPDATE','Signed deposit agreement is immutable']),
 Object.freeze(['deposit_agreement_snapshots_no_delete','deposit_agreement_snapshots','DELETE','Signed deposit agreement is immutable'])
]);
export const REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES=Object.freeze(definitions.map(([name])=>name));
const deny=()=>{throw Error('FIRE deposit policy/agreement append-only SQL is not verified: BLOCKED');};
const canonical=sql=>typeof sql==='string'&&sql.length<4096
 ?sql.trim().replace(/\s+/g,' ').replace(/;\s*$/,'').toLowerCase():null;
const query="SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ("+
 REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES.map(name=>"'"+name+"'").join(',')+") ORDER BY name";

export async function immutableDepositHistoryTriggersReady(db){
 if(!db||typeof db.prepare!=='function')deny();
 let result;
 try{result=await db.prepare(query).all();}
 catch{deny();}
 const rows=result?.results;
 if(!Array.isArray(rows)||rows.length!==definitions.length)deny();
 const byName=new Map();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||
     typeof row.name!=='string'||byName.has(row.name)||
     !REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES.includes(row.name))
   deny();
  byName.set(row.name,row.sql);
 }
 for(const [name,table,operation,reason] of definitions){
  const expected=`CREATE TRIGGER ${name} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'${reason}'); END`;
  if(canonical(byName.get(name))!==canonical(expected))deny();
 }
 return true;
}
