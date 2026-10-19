/** Synthetic revised deposit signing route: transaction and exact-document contract tests. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
import {agreementDigest,agreementScope} from '../lib/deposit-agreement-commitment.mjs';
import {SERVICE_AGREEMENT} from '../lib/fire-templates.ts';
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
let race=null,lost=false,n=0;
const eq=(a,b)=>{assert.deepEqual(a,b);n++;};
const env={FIRE_DEPOSIT_POLICY_CANDIDATE:'synthetic-tests-only',FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE:'synthetic-contract-tests-only',
 FIRE_DEPOSIT_AGREEMENT_CANDIDATE:'synthetic-signature-tests-only',
 DB:{prepare(sql){return{sql,values:[],bind(...values){return {...this,values};},async first(){return db.prepare(sql).get(...this.values)??null;},async all(){return{results:db.prepare(sql).all(...this.values)};}};},
 async batch(statements){
  if(race){const fn=race;race=null;fn();}
  db.exec('BEGIN');try{
   const result=statements.map(x=>({meta:{changes:Number(db.prepare(x.sql).run(...x.values).changes)}}));
   db.exec('COMMIT');if(lost){lost=false;throw Error('Acknowledgement unavailable after commit');}
   return result;
  }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
 }}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>null);
const route=load('app/api/public/estimates/[token]/revised-accept/route.ts');
let serial=1;const key=()=>('00000000-0000-4000-8000-'+String(serial++).padStart(12,'0'));
const get=id=>db.prepare('SELECT * FROM estimates WHERE id=?').get(id);
const notice=id=>db.prepare("SELECT * FROM notifications WHERE estimate_id=? AND type='estimate_accepted'").all(id);
const ledger=()=>Number(db.prepare('SELECT COUNT(*) n FROM payments').get().n);
function seed(id,mode='waive'){
 const total=18001,dep=mode==='waive'?0:mode==='fixed'?7000:mode==='percentage'?4500:9001;
 const eventId=key(),confirmationId=key();
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,'2026-10-19')").run('c-'+id,'Synthetic '+id);
 db.prepare("INSERT INTO estimates(id,customer_id,share_token,status,subtotal_cents,discount_cents,total_cents,deposit_cents,first_viewed_at,created_at) VALUES(?,? ,?,'sent',?,0,?,?,'2026-10-19T12:00:00Z','2026-10-19')").run(id,'c-'+id,'share-'+id,total,total,dep);
 db.prepare("INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,'Cleaning','Exterior services',1,'job',?)").run('item-'+id,id,total);
 db.prepare("INSERT INTO deposit_policy_events(id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,previous_deposit_cents,new_deposit_cents,paid_principal_cents,percent_basis_points,schedule_before_collection,requires_customer_reapproval,created_at) VALUES(?,?,?,'synthetic-owner',?, ?,9001,?,0,?,?,0,'2026-10-19T11:00:00Z')")
 .run(eventId,id,confirmationId,mode,total,dep,mode==='percentage'?2500:null,mode==='schedule-before-deposit'?1:0);
 return {id,mode,total,deposit:dep,eventId};
}
async function payload(s){
 const items=db.prepare('SELECT id,name,description,quantity,unit,total_cents FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(s.id);
 const documentDigest=await agreementDigest({eventId:s.eventId,totalCents:s.total,depositCents:s.deposit,mode:s.mode,scope:agreementScope(items),terms:SERVICE_AGREEMENT});
 return {version:'deposit-exception-v1:'+s.eventId,documentDigest,signedName:'Synthetic Customer',photoRelease:'no',acceptedTerms:true};
}
function make(s,p,headers={},token='share-'+s.id){
 return new Request('https://synthetic.invalid/api/public/estimates/'+token+'/revised-accept',{method:'POST',headers:{Origin:'https://synthetic.invalid','content-type':'application/json',...headers},body:JSON.stringify(p)});
}
const post=(s,p,headers,token)=>route.POST(make(s,p,headers,token),{params:Promise.resolve({token:token||'share-'+s.id})});
try{
 const disabled=seed('disabled');const d=await payload(disabled);delete env.FIRE_DEPOSIT_AGREEMENT_CANDIDATE;
 eq((await post(disabled,d)).status,404);eq(get(disabled.id).accepted_at,null);
 env.FIRE_DEPOSIT_AGREEMENT_CANDIDATE='synthetic-signature-tests-only';
 const [s1,s2,s3,s4,s5,s6]=['waive','fixed','percentage','schedule-before-deposit','standard','restore-standard'].map(mode=>seed(mode,mode));
 for(const s of [s1,s2,s3,s4,s5,s6]){
  const p=await payload(s),res=await post(s,p);eq(res.status,201);
  const receipt=await res.json();eq([receipt.ok,receipt.canSchedule,receipt.automaticPayment],[true,false,false]);
  eq([get(s.id).status,get(s.id).deposit_cents,get(s.id).total_cents],['approved',s.deposit,18001]);
  eq([get(s.id).contract_version,get(s.id).signed_name,get(s.id).photo_release],[p.version+':sha256:'+p.documentDigest,'Synthetic Customer','no']);
  eq(notice(s.id).length,1);
  const repeat=await post(s,p);eq(repeat.status,200);eq((await repeat.json()).replayed,true);
  eq(notice(s.id).length,1);
  eq((await post(s,{...p,signedName:'A Different Signature'})).status,409);
 }
 eq(ledger(),0);
 const untouched=seed('untouched'),ok=await payload(untouched);
 for(const [bad,code] of [
 [{...ok,documentDigest:'0'.repeat(64)},409],[{...ok,version:'deposit-exception-v1:'+key()},409],
 [{...ok,acceptedTerms:false},400],[{...ok,photoRelease:'maybe'},400],[{...ok,actorEmail:'forged'},400],
 [{...ok,signedName:'X'},400]
 ])eq((await post(untouched,bad)).status,code);
 eq((await post(untouched,ok,{Origin:'https://different.invalid'})).status,403);
 eq((await post(untouched,ok,{'content-type':'text/plain'})).status,415);
 eq(get(untouched.id).accepted_at,null);
 eq((await post(untouched,ok,{},'wrong-token')).status,404);
 const races=['scope','price','deposit','signature','refund','checkout','payment','invoice','audit'];
 for(const kind of races){
  const s=seed('race-'+kind),p=await payload(s);
  race=()=>{
   if(kind==='scope')db.prepare("UPDATE estimate_items SET name='Changed service' WHERE estimate_id=?").run(s.id);
   if(kind==='price')db.prepare('UPDATE estimates SET total_cents=20000 WHERE id=?').run(s.id);
   if(kind==='deposit')db.prepare('UPDATE estimates SET deposit_cents=1 WHERE id=?').run(s.id);
   if(kind==='signature')db.prepare("UPDATE estimates SET signed_at='2026-10-19T13:00:00Z' WHERE id=?").run(s.id);
   if(kind==='refund'){const paymentId=key();db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'Cash',100,'paid','2026-10-19')").run(paymentId,s.id);db.prepare("INSERT INTO payment_refunds(id,estimate_id,payment_id,amount_cents,mode,status,created_at) VALUES(?,?,?,1,'manual','pending','2026-10-19')").run(key(),s.id,paymentId);}
   if(kind==='checkout')db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'deposit',9001,'open','2026-10-19')").run(key(),s.id);
   if(kind==='payment')db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'Cash',100,'paid','2026-10-19')").run(key(),s.id);
   if(kind==='invoice')db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents,created_at) VALUES(?,?,?,18001,'2026-10-19')").run(key(),s.id,'c-'+s.id);
   if(kind==='audit')db.prepare("INSERT INTO deposit_policy_events(id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,previous_deposit_cents,new_deposit_cents,paid_principal_cents,created_at) VALUES(?,?,?,'synthetic-owner','standard',18001,9001,9001,0,'2026-10-19T18:00:00Z')").run(key(),s.id,key());
  };
  const res=await post(s,p);eq(res.status,409);eq(get(s.id).accepted_at,null);eq(notice(s.id).length,0);
 }
 const lostCase=seed('lost'),lostBody=await payload(lostCase);lost=true;
 eq((await post(lostCase,lostBody)).status,503);
 eq(get(lostCase.id).status,'approved');eq(notice(lostCase.id).length,1);
 eq((await post(lostCase,lostBody)).status,200);eq(notice(lostCase.id).length,1);
 eq(ledger(),2); // injected payment and refund-race linked payment only; signing creates no payments
 console.log('PASS '+n+'/'+n+': six exact customer agreement signatures, SHA256 commitment, atomic scope/payment/audit races, source-only receipt replay and lost acknowledgements; no writer payments or scheduling.');
}finally{db.close();}
