/** Contract tests: actual double-gated owner deposit POST, native disposable SQLite, no remote resources. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
let user={email:'kylebrooks8605@gmail.com'},beforeBatch=null,lostResponse=false,checks=0;
const env={FIRE_DEPOSIT_POLICY_CANDIDATE:'synthetic-tests-only',FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE:'synthetic-contract-tests-only',
 DB:{prepare(sql){return {sql,values:[],bind(...values){return {...this,values};},async first(){return db.prepare(sql).get(...this.values)??null;},
 async all(){return {results:db.prepare(sql).all(...this.values)};}}},
 async batch(statements){
  if(beforeBatch){const f=beforeBatch;beforeBatch=null;f();}
  db.exec('BEGIN');
  try{
   const result=statements.map(s=>({meta:{changes:Number(db.prepare(s.sql).run(...s.values).changes)}}));
   db.exec('COMMIT');
   if(lostResponse){lostResponse=false;throw Error('Synthetic committed acknowledgement lost');}
   return result;
  }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
 }}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>user);
const route=load('app/api/estimates/[id]/deposit-policy/route.ts');
const edit=load('app/api/estimates/[id]/route.ts');
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
let seq=1;const uuid=()=>('00000000-0000-4000-8000-'+String(seq++).padStart(12,'0'));
function seed(id,{status='sent',signed=false,total=18001,deposit=9001}={}){
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,'2026-10-19')").run('c-'+id,'Synthetic '+id);
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,'2026-10-19')").run(id,'c-'+id,status,total,0,total,deposit,signed?'2026-10-19T12:00:00Z':null,signed?'2026-10-19T12:00:00Z':null);
}
function row(id){return db.prepare("SELECT * FROM estimates WHERE id=?").get(id);}
function events(id){return db.prepare("SELECT * FROM deposit_policy_events WHERE estimate_id=? ORDER BY created_at,id").all(id);}
function request(id,mode='waive',extra={},headers={}){
 const r=row(id);
 const state={mode,confirmed:true,expectedStatus:r.status,expectedTotalCents:r.total_cents,
 expectedDepositCents:r.deposit_cents,expectedPaidCents:0,expectedSignedAt:r.signed_at,
 expectedContractVersion:r.contract_version,expectedLastEventId:events(id).at(-1)?.id??null,
 confirmationId:uuid(),...extra};
 return [new Request('https://synthetic.invalid/api/estimates/'+id+'/deposit-policy',
  {method:'POST',headers:{Origin:'https://synthetic.invalid','content-type':'application/json',...headers},body:JSON.stringify(state)}),state];
}
const post=(id,req)=>route.POST(req,{params:Promise.resolve({id})});
const counts=()=>({events:db.prepare('SELECT COUNT(*) n FROM deposit_policy_events').get().n,
 payments:db.prepare('SELECT COUNT(*) n FROM payments').get().n});
const snapshot=id=>JSON.stringify([row(id),events(id),counts()]);
try{
 seed('disabled');const [disabled]=request('disabled');delete env.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE;
 eq((await post('disabled',disabled)).status,404);
 eq(events('disabled').length,0);env.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE='synthetic-contract-tests-only';
 let [auth]=request('disabled');user=null;eq((await post('disabled',auth)).status,401);
 user={email:'impostor@example.invalid'};eq((await post('disabled',request('disabled')[0])).status,401);
 user={email:'kylebrooks8605@gmail.com'};eq(events('disabled').length,0);
 eq((await post('disabled',request('disabled')[0],)).status,201);eq(row('disabled').deposit_cents,0);
 seed('headers');
 eq((await post('headers',request('headers')[0],)).status,201);
 seed('origin');
 eq((await post('origin',request('origin')[0],)).status,201);
 seed('attacks');
 eq((await post('attacks',request('attacks')[0],)).status,201);
 // Each invalid request is independently generated and audited for NO mutations.
 seed('invalid');const untouched=snapshot('invalid');
 let [cross]=request('invalid','waive',{}, {Origin:'https://other.invalid'});
 eq((await post('invalid',cross)).status,403);
 let [missingOrigin]=request('invalid');missingOrigin=new Request(missingOrigin,{headers:{'content-type':'application/json'}});
 eq((await post('invalid',missingOrigin)).status,403);
 let [badType]=request('invalid','waive',{}, {'content-type':'text/plain'});
 eq((await post('invalid',badType)).status,415);
 for(const extra of [{confirmed:false},{actorEmail:'outsider@example.invalid'},{confirmationId:'not-a-uuid'},{expectedTotalCents:1},{expectedDepositCents:1},{expectedLastEventId:uuid()},{percentBasisPoints:10}]){
  const [req]=request('invalid','waive',extra);eq((await post('invalid',req)).status===201,false);
 }
 eq(snapshot('invalid'),untouched);
 const cases=[
  ['waive',{},0,0],['percentage',{percentBasisPoints:2500},4500,0],
  ['fixed',{fixedCents:7000},7000,0],
  ['schedule-before-deposit',{},9001,1],['standard',{},9001,0],['restore-standard',{},9001,0]
 ];
 for(const [mode,extra,amount,defer] of cases){
  const id='mode-'+mode;seed(id);const [req,body]=request(id,mode,{reason:' Owner tested ',...extra});
  const original=row(id),res=await post(id,req);eq(res.status,201);
  const payload=await res.json();eq([payload.recorded,payload.canSchedule,payload.requiredDepositCents],[true,false,amount]);
  const e=events(id)[0];eq([e.mode,e.new_deposit_cents,e.schedule_before_collection,e.reason],[mode,amount,defer,'Owner tested']);
  eq([e.previous_total_cents,e.previous_deposit_cents,e.actor_email],[18001,9001,'kylebrooks8605@gmail.com']);
  eq([row(id).total_cents,row(id).deposit_cents,row(id).signed_at],[original.total_cents,amount,null]);
  eq(counts().payments,0);
  const repeatBody=new Request('https://synthetic.invalid/api/estimates/'+id+'/deposit-policy',{method:'POST',
   headers:{Origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify(body)});
  eq((await post(id,repeatBody)).status,200);eq(events(id).length,1);
  const conflicting=new Request('https://synthetic.invalid/api/estimates/'+id+'/deposit-policy',{method:'POST',
   headers:{Origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify({...body,mode:'waive'})});
  eq((await post(id,conflicting)).status,409);eq(events(id).length,1);
 }
 seed('sequence');const [w]=request('sequence');eq((await post('sequence',w)).status,201);
 const [restore]=request('sequence','restore-standard');eq((await post('sequence',restore)).status,201);
 eq([row('sequence').deposit_cents,events('sequence').length],[9001,2]);
 seed('signed',{status:'approved',signed:true});eq((await post('signed',request('signed')[0])).status,409);
 seed('scheduled',{status:'scheduled',signed:true});eq((await post('scheduled',request('scheduled')[0])).status,409);
 seed('paid');db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('paid1','paid','Cash',5000,'paid','2026-10-19')").run();
 eq((await post('paid',request('paid',{expectedPaidCents:5000})[0])).status!==201,true);eq(events('paid').length,0);
 seed('pending');db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('pending1','pending','Cash',5000,'pending','2026-10-19')").run();
 eq((await post('pending',request('pending')[0])).status,409);eq(events('pending').length,0);
 for(const kind of ['terms','signature','payment','checkout','billing','audit']){
  const id='race-'+kind;seed(id);const [req]=request(id);
  beforeBatch=()=>{
   if(kind==='terms')db.prepare('UPDATE estimates SET total_cents=24000 WHERE id=?').run(id);
   if(kind==='signature')db.prepare("UPDATE estimates SET signed_at='2026-10-19T17:00:00Z' WHERE id=?").run(id);
   if(kind==='payment')db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'Cash',1000,'paid','2026-10-19')").run('p-'+id,id);
   if(kind==='checkout')db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'deposit',9001,'open','2026-10-19')").run('cs-'+id,id);
   if(kind==='billing')db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents,created_at) VALUES(?,?,?,18001,'2026-10-19')").run('inv-'+id,id,'c-'+id);
   if(kind==='audit')db.prepare("INSERT INTO deposit_policy_events(id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,previous_deposit_cents,new_deposit_cents,paid_principal_cents,created_at) VALUES(?,?,?,'synthetic-owner','standard',18001,9001,9001,0,'2026-10-19T13:00:00Z')").run(uuid(),id,uuid());
  };
  const response=await post(id,req);eq(response.status,409);eq(events(id).length,kind==='audit'?1:0);eq(row(id).deposit_cents,9001);
 }
 seed('lost');const [first,requestBody]=request('lost','fixed',{fixedCents:1000});lostResponse=true;
 eq((await post('lost',first)).status,503);eq(events('lost').length,1);eq(row('lost').deposit_cents,1000);
 const retry=new Request('https://synthetic.invalid/api/estimates/lost/deposit-policy',{method:'POST',
  headers:{Origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify(requestBody)});
 eq((await post('lost',retry)).status,200);eq(events('lost').length,1);eq(counts().payments,2); // only the synthetic paid + pending fixtures
 // The regular estimate edit flow must not silently reset a recorded custom deposit.
 const before=JSON.stringify(events('lost'));
 const editing=await edit.PATCH(new Request('https://synthetic.invalid/api/estimates/lost',{method:'PATCH',headers:{'content-type':'application/json'},
  body:JSON.stringify({items:[{name:'Updated work',description:'Synthetic',quantity:1,unit:'job',totalCents:18001}]})}),{params:Promise.resolve({id:'lost'})});
 eq(editing.status,409);eq(JSON.stringify(events('lost')),before);eq(row('lost').deposit_cents,1000);
 console.log('PASS '+checks+'/'+checks+': synthetic double-gated owner deposit writes; all six modes, replay identity, audit CAS, before-batch races, signed and paid refusal, lost acknowledgement, and edit protection. No hosted resources or payments.');
}finally{db.close();}
