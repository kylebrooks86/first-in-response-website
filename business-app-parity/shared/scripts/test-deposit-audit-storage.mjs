/* Synthetic native SQLite audit migration and backup parity, no external resources. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateDepositAuditIntegrity,depositAuditRowsConflict,DEPOSIT_AUDIT_COLUMNS} from '../lib/deposit-audit-backup.mjs';
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};const fails=(fn,re)=>{assert.throws(fn,re);n++;};
const db=new DatabaseSync(':memory:');
try{
 db.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('customer','Synthetic Audit','2026-10-19');INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('estimate','customer','approved',18001,18001,9001,'2026-10-19');");
 const columns=DEPOSIT_AUDIT_COLUMNS;
 const base={id:'event1',estimate_id:'estimate',confirmation_id:'confirm1',actor_email:'owner@example.invalid',mode:'waive',previous_total_cents:18001,previous_deposit_cents:9001,new_deposit_cents:0,paid_principal_cents:3000,percent_basis_points:null,schedule_before_collection:0,previous_contract_version:'v1',updated_contract_version:null,previous_signed_at:'2026-10-18T12:00:00Z',requires_customer_reapproval:1,reason:'Owner request',created_at:'2026-10-19T12:00:00Z'};
 const insert=row=>db.prepare('INSERT INTO deposit_policy_events('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...columns.map(k=>row[k]));
 insert(base);eq(db.prepare('SELECT COUNT(*) c FROM deposit_policy_events').get().c,1);
 eq(validateDepositAuditIntegrity({estimates:[{id:'estimate'}],deposit_policy_events:[base]}),null);
 eq(depositAuditRowsConflict(base,{...base}),false);eq(depositAuditRowsConflict(base,{...base,reason:'other'}),true);
 fails(()=>db.exec("UPDATE deposit_policy_events SET reason='tampered' WHERE id='event1'"),/immutable/);
 fails(()=>db.exec("DELETE FROM deposit_policy_events WHERE id='event1'"),/immutable/);
 fails(()=>insert({...base,id:'event2',confirmation_id:'confirm1'}),/UNIQUE/);
 fails(()=>insert({...base,id:'event2',confirmation_id:'confirm2',estimate_id:'missing'}),/FOREIGN KEY/);
 fails(()=>insert({...base,id:'event2',confirmation_id:'confirm2',new_deposit_cents:18002}),/CHECK/);
 fails(()=>insert({...base,id:'event2',confirmation_id:'confirm2',requires_customer_reapproval:0}),/CHECK/);
 fails(()=>insert({...base,id:'event2',confirmation_id:'confirm2',mode:'schedule-before-deposit',new_deposit_cents:9001,schedule_before_collection:0}),/CHECK/);
 // Financial audit amounts near Number.MAX_SAFE_INTEGER are computed exactly,
 // with integer-only SQL (not imprecise floating point arithmetic).
 db.exec("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('large','customer','approved',9007199254740991,9007199254740991,4503599627370496,'2026-10-19');");
 const huge={...base,id:'huge',estimate_id:'large',confirmation_id:'confirm-huge',mode:'percentage',previous_total_cents:9007199254740991,previous_deposit_cents:4503599627370496,new_deposit_cents:2251799813685248,paid_principal_cents:0,percent_basis_points:2500,previous_signed_at:null,requires_customer_reapproval:0};
 insert(huge);eq(db.prepare("SELECT new_deposit_cents AS amount FROM deposit_policy_events WHERE id='huge'").get().amount,2251799813685248);
 const def={...base,id:'event2',confirmation_id:'confirm2',mode:'schedule-before-deposit',new_deposit_cents:9001,schedule_before_collection:1};
 insert(def);eq(db.prepare('SELECT COUNT(*) c FROM deposit_policy_events').get().c,3);
 const shape=()=>({estimates:[{id:'estimate'},{id:'large'}],deposit_policy_events:[structuredClone(base),structuredClone(def),structuredClone(huge)]});
 const corrupt=[
  t=>{t.deposit_policy_events[1].estimate_id='absent'},
  t=>{t.deposit_policy_events[1].confirmation_id='confirm1'},
  t=>{t.deposit_policy_events[1].new_deposit_cents=3000},
  t=>{t.deposit_policy_events[1].requires_customer_reapproval=0},
  t=>{t.deposit_policy_events[1].previous_total_cents=-1},
  t=>{t.deposit_policy_events[1].actor_email=''},
  t=>{delete t.deposit_policy_events[1].created_at},
  t=>{t.deposit_policy_events[1].reason='a'.repeat(501)}
 ];
 for(const change of corrupt){const t=shape();change(t);eq(Boolean(validateDepositAuditIntegrity(t)),true);}
 eq(validateDepositAuditIntegrity({estimates:[]}),null);
 eq(validateDepositAuditIntegrity({estimates:[]},true),'Missing declared deposit audit history.');
 eq(validateDepositAuditIntegrity({estimates:[],deposit_policy_events:{}}),'Deposit audit history must be an array.');
 eq(db.prepare("SELECT COUNT(*) c FROM deposit_policy_events").get().c,3);
 eq(db.prepare("SELECT deposit_cents d,total_cents t FROM estimates WHERE id='estimate'").get().d,9001);
 eq(db.prepare("SELECT COUNT(*) c FROM payments").get().c,0);
 console.log('PASS '+n+'/'+n+': additive audit schema, foreign keys, append-only triggers, confirmation uniqueness, restored-history validation, corruption refusal; untouched estimate and payment ledger.');
}finally{db.close();}
