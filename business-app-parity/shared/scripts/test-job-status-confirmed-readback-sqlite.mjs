/** Actual owner estimate PATCH status/schedule vs disposable D1/SQLite.
 * Synthetic rows, no external requests, no real work, payment or deployment.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+name,'utf8'));
let checks=0,owner={email:'kylebrooks8605@gmail.com'},behavior='normal',statusRead='normal',remote=0,batchWrites=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
const sqlStatement=(sql,args=[])=>({sql,args,bind(...a){return sqlStatement(sql,a)},
 async first(){
  const row=db.prepare(sql).get(...args)??null;
  if(sql.startsWith('SELECT id,status,scheduled_at AS scheduledAt FROM estimates WHERE id=?')){
   if(statusRead==='throw'){statusRead='normal';throw Error('Synthetic lost D1 SELECT');}
   if(statusRead==='missing'){statusRead='normal';return null;}
   if(statusRead==='wrong'&&row){statusRead='normal';return {...row,status:'draft',scheduledAt:null};}
  }
  return row;
 },
 async all(){return{results:db.prepare(sql).all(...args)}},
 async run(){batchWrites++;return{success:true,meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
});
const DB={prepare:sqlStatement,async batch(statements){
 if(behavior==='no-write'){behavior='normal';return statements.map(()=>({success:true,meta:{changes:0}}));}
 const was=behavior;behavior='normal';db.exec('BEGIN');
 try{const receipts=statements.map(s=>{batchWrites++;return{success:was==='false-receipt'?false:true,meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}}});db.exec('COMMIT');
  if(was==='lost-read')statusRead='throw';
  if(was==='wrong-read')statusRead='wrong';
  if(was==='missing-read')statusRead='missing';
  return receipts;
 }catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}
}};
const beforeFetch=globalThis.fetch;globalThis.fetch=async()=>{remote++;throw Error('External request forbidden')};
const load=createRouteFixtureLoader(process.cwd(),{DB},()=>owner),api=load('app/api/estimates/[id]/route.ts');
const seed=(id,kind='draft')=>{
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic status '+id,'2026-10-01T00:00:00Z');
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES(?,?,?,?,?,?,?,?,'2026-10-01T00:00:00Z')")
  .run('e-'+id,'c-'+id,kind,20000,20000,10000,kind==='approved'?'2026-10-02T00:00:00Z':null,kind==='approved'?'2026-10-02T00:00:00Z':null);
};
const patch=(id,body)=>api.PATCH(new Request('https://synthetic.invalid/api/estimates/e-'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'e-'+id})});
const state=id=>db.prepare('SELECT status,scheduled_at scheduledAt FROM estimates WHERE id=?').get('e-'+id);
try{
 seed('good');let response=await patch('good',{status:'sent'}),receipt=await response.json();
 eq(response.status,200,'Normal saved status returns confirmed 200');
 eq(receipt.estimate.id,'e-good','Response retains exact job id');
 eq(receipt.estimate.status,'sent','Response reflects actual saved status');
 eq(state('good').status,'sent','SQLite actually persisted sent');
 eq(response.headers.get('cache-control'),'no-store, private','Financial job workflow replies remain private');
 seed('no-write');behavior='no-write';response=await patch('no-write',{status:'sent'});receipt=await response.json();
 eq(response.status,503,'Nonthrowing D1 no-write cannot claim sent');
 eq(receipt.saveUncertain,true,'No-write is never a false success');
 eq(state('no-write').status,'draft','Original draft remains saved');
 seed('false');behavior='false-receipt';response=await patch('false',{status:'sent'});
 eq(response.status,503,'Explicit false receipt cannot claim success');
 eq(state('false').status,'sent','False acknowledgement can follow committed status');
 seed('lost-read');behavior='lost-read';response=await patch('lost-read',{status:'sent'});receipt=await response.json();
 eq(response.status,503,'Lost readback cannot claim success');
 eq(receipt.saveUncertain,true,'Lost readback asks for reconciliation');
 eq(state('lost-read').status,'sent','Status might really have committed');
 seed('wrong');behavior='wrong-read';response=await patch('wrong',{status:'sent'});receipt=await response.json();
 eq(response.status,503,'Mismatched saved status refuses 200');
 eq(state('wrong').status,'sent','Synthetic conflicting read is distinct from committed database');
 seed('missing');behavior='missing-read';response=await patch('missing',{status:'sent'});
 eq(response.status,503,'Missing saved job row refuses success');
 seed('scheduled','approved');
 const at='2026-11-06T15:30:00.000Z';response=await patch('scheduled',{scheduledAt:at});
 receipt=await response.json();
 eq(response.status,200,'Signed approved job can be scheduled after exact D1 confirmation');
 eq(receipt.estimate.status,'scheduled','Schedule response confirms saved scheduled status');
 eq(receipt.estimate.scheduledAt,at,'Schedule response uses exact stored UTC instant');
 eq(state('scheduled').scheduledAt,at,'Physical scheduled timestamp matches UTC');
 seed('unsafe');response=await patch('unsafe',{scheduledAt:at});
 eq(response.status,409,'Unsigned job cannot be scheduled even if date is valid');
 eq(state('unsafe').status,'draft','Unsanctioned schedule never writes');
 seed('invalid');const before=batchWrites;response=await patch('invalid',{status:'made-up'});
 eq(response.status,400,'Unknown state rejected before mutation');
 eq(batchWrites,before,'Invalid state sent zero writes');
 owner={email:'nonowner@example.invalid'};response=await patch('good',{status:'declined'});
 eq(response.status,401,'Nonowner cannot change job workflow');
 eq(remote,0,'No external Stripe, Cloudflare or other requests');
 console.log('PASS '+checks+'/'+checks+' actual owner status/schedule native SQLite: verified D1 reply, no-op/false ACK, lost/mismatched readback, signed scheduling, auth and no network.');
}finally{globalThis.fetch=beforeFetch;db.close();}
