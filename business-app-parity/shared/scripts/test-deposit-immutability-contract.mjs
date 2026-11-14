/** Exercise source-reviewed deposit exception/signed agreement immutability.
 * Native disposable SQLite only, no customer/provider data, no remote D1.
 * Uses 0023 and 0024 real migration SQL, not a hand-written fake schema.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {immutableDepositHistoryTriggersReady,REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES} from '../lib/deposit-immutability-contract.mjs';
const source=path=>readFileSync(new URL('../../adapters/doomsday/drizzle/'+path,import.meta.url),'utf8');
const sql23=source('0023_deposit_policy_events.sql'),sql24=source('0024_deposit_agreement_snapshots.sql');
const expected=[
 'deposit_policy_events_no_update','deposit_policy_events_no_delete',
 'deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete'
];
assert.deepEqual(REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES,expected);
let checks=1;
const makeDb=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON; CREATE TABLE estimates(id TEXT PRIMARY KEY);');
 db.exec(sql23);db.exec(sql24);return db;
};
const reader=db=>({prepare(sql){
 if(!/^\s*SELECT\b/i.test(sql))throw Error('Unexpected SQL write from contract');
 const stmt=db.prepare(sql);return {all:async()=>({results:stmt.all()})};
}});
const verify=async db=>immutableDepositHistoryTriggersReady(reader(db));
{
 const db=makeDb();
 try{
  assert.equal(await verify(db),true);checks++;
  db.prepare('INSERT INTO estimates(id) VALUES (?)').run('estimate-1');
  const id='11111111-1111-4111-8111-111111111111';
  db.prepare(`INSERT INTO deposit_policy_events
   (id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,
    previous_deposit_cents,new_deposit_cents,paid_principal_cents,created_at)
    VALUES (?, 'estimate-1','approval-1','owner@example.invalid','standard',20000,10000,10000,0,'2026-11-13')`).run(id);
  db.prepare(`INSERT INTO deposit_agreement_snapshots
   (event_id,estimate_id,document_version,document_digest,total_cents,
    deposit_cents,mode,scope_json,agreement_text,signed_name,
    photo_release,signed_at,accepted_at)
   VALUES (?,'estimate-1',?, ?,20000,10000,'standard','{}',?,
      'Synthetic Customer','no','2026-11-13','2026-11-13')`)
   .run(id,'deposit-exception-v1:'+id,'a'.repeat(64),'Synthetic test agreement text exceeding the minimum required length by many words.');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deposit_policy_events').get().n,1);checks++;
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deposit_agreement_snapshots').get().n,1);checks++;
  for(const table of ['deposit_policy_events','deposit_agreement_snapshots']){
   for(const operation of ['UPDATE','DELETE']){
    const sql=operation==='UPDATE'?
     `UPDATE ${table} SET estimate_id='other' WHERE ${table==='deposit_policy_events'?'id':'event_id'}=?`:
     `DELETE FROM ${table} WHERE ${table==='deposit_policy_events'?'id':'event_id'}=?`;
    assert.throws(()=>db.prepare(sql).run(id),/immutable/i,
      'Existing signed/audit row must remain append-only under actual source triggers');
    checks++;
   }
  }
  assert.equal(await verify(db),true);checks++;
 }finally{db.close();}
}
for(const name of expected){
 for(const mode of ['dropped','named-noop','after','wrong-reason']){
  const db=makeDb();
  try{
   const original=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(name).sql;
   db.exec('DROP TRIGGER "'+name+'"');
   if(mode!=='dropped'){
    let rewritten=original;
    if(mode==='named-noop')rewritten=rewritten.replace(/RAISE\s*\(\s*ABORT\s*,[^)]*\)/i,'1');
    if(mode==='after')rewritten=rewritten.replace(/BEFORE\s+(UPDATE|DELETE)/i,'AFTER $1');
    if(mode==='wrong-reason')rewritten=rewritten.replace(/is immutable/,'may be edited');
    assert.notEqual(rewritten,original,'negative mutation must change source');
    db.exec(rewritten);
   }
   await assert.rejects(()=>verify(db),/BLOCKED/,'altered '+name+' must fail closed');
   checks++;
  }finally{db.close();}
 }
}
{
 const db=makeDb();
 try{
  db.exec('CREATE TRIGGER deposit_unreviewed AFTER INSERT ON deposit_policy_events BEGIN SELECT 1; END;');
  // This lower-level contract checks the four required definitions; the
  // first-job *full inventory* independently excludes extra trigger names.
  assert.equal(await verify(db),true);checks++;
 }finally{db.close();}
}
await assert.rejects(()=>immutableDepositHistoryTriggersReady(null),/BLOCKED/);checks++;
const failDb={prepare(){throw Error('D1 unavailable')}};
await assert.rejects(()=>immutableDepositHistoryTriggersReady(failDb),/BLOCKED/);checks++;
console.log('PASS '+checks+'/'+checks+' source-reviewed deposit exception/signed agreement append-only SQL controls, including real row UPDATE/DELETE rejections and forged trigger negatives; disposable SQLite only.');
