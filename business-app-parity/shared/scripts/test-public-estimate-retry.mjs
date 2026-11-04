/** Actual routes, real SQLite transactions, synthetic data, no network. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+name,'utf8'));
let beforeBatch=null,failBeforeCommit=false,failAfterCommit=false;
const env={DB:{prepare(sql){return {sql,values:[],bind(...values){return {...this,values};},async first(){return db.prepare(sql).get(...this.values)??null;},async all(){return {results:db.prepare(sql).all(...this.values)};}};},async batch(rows){
 if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}
 db.exec('BEGIN');let result;
 try{result=rows.map(row=>{const r=db.prepare(row.sql).run(...row.values);return {results:[],meta:{changes:Number(r.changes)}};});if(failBeforeCommit){failBeforeCommit=false;throw Error('synthetic rollback');}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 if(failAfterCommit){failAfterCommit=false;throw Error('synthetic lost acknowledgement');}return result;
}}};
const loader=createRouteFixtureLoader(process.cwd(),env,()=>({email:'kylebrooks8605@gmail.com'})),change=loader('app/api/public/estimates/[token]/change-request/route.ts'),accept=loader('app/api/public/estimates/[token]/accept/route.ts');
let checks=0;const eq=(a,b)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),b);checks++;};
function seed(id='e'){db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic Retry '+id,'2026-10-18T12:00:00Z');db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,share_token,created_at) VALUES(?,?,'sent',20000,20000,10000,?,'2026-10-18T12:00:00Z')").run(id,'c-'+id,'token-'+id);db.prepare("INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,'Synthetic service','Fixture',1,'job',20000)").run('i-'+id,id);}
const call=(route,body,id='e')=>route.POST(new Request('https://synthetic.invalid/api/public/estimates/token-'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({token:'token-'+id})});
const counts=id=>[db.prepare('SELECT COUNT(*) AS n FROM estimate_change_requests WHERE estimate_id=?').get(id).n,db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE estimate_id=? AND type='estimate_change_requested'").get(id).n];
try{
 seed();seed('other');
 for(const body of [{message:'bad'},{message:'x'.repeat(4001)},{message:'Valid change',requestId:'bad'},{message:42}])eq((await call(change,body)).status,400);
 eq(counts('e'),[0,0]);eq((await call(change,{message:'A valid request'},'missing')).status,404);
 const first={requestId:randomUUID(),message:'Please include the front gutters.'};let response=await call(change,first);eq(response.status,200);eq(response.headers.get('cache-control'),'no-store');const receipt=(await response.json()).request;eq(receipt.id,first.requestId);eq(receipt.message,first.message);eq(counts('e'),[1,1]);
 response=await call(change,first);eq((await response.json()).request,receipt);eq(counts('e'),[1,1]);
 response=await call(change,{...first,requestId:randomUUID()});eq((await response.json()).request.id,first.requestId);eq(counts('e'),[1,1]);
 response=await call(change,{message:first.message});eq((await response.json()).request.id,first.requestId);eq(counts('e'),[1,1]);
 eq((await call(change,{...first,message:'A different request'})).status,409);eq((await call(change,first,'other')).status,409);eq(counts('other'),[0,0]);
 const approved=await call(accept,{signedName:'Original Synthetic Signer',photoRelease:'no',acceptedTerms:true});eq(approved.status,200);const approvedReceipt=await approved.json();eq(approvedReceipt.signedName,'Original Synthetic Signer');eq(approvedReceipt.photoRelease,'no');assert.ok(approvedReceipt.signedAt);checks++;
 const replay=await (await call(accept,{signedName:'Different Replay Signer',photoRelease:'yes',acceptedTerms:true})).json();eq(replay,approvedReceipt);eq(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,0);eq(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type='estimate_accepted'").get().n,1);
 eq((await (await call(change,first)).json()).request,receipt);eq((await call(change,{requestId:randomUUID(),message:'A newly requested change after approval'})).status,409);eq(counts('e'),[1,1]);
 seed('rollback');const retry={requestId:randomUUID(),message:'Please include this synthetic fixture.'};failBeforeCommit=true;eq((await call(change,retry,'rollback')).status,500);eq(counts('rollback'),[0,0]);eq((await call(change,retry,'rollback')).status,200);eq(counts('rollback'),[1,1]);
 seed('lost');failAfterCommit=true;eq((await call(change,retry,'lost')).status,409); // A UUID cannot cross estimates.
 const lost={...retry,requestId:randomUUID()};eq((await call(change,lost,'lost')).status,500);eq(counts('lost'),[1,1]);eq((await call(change,lost,'lost')).status,200);eq(counts('lost'),[1,1]);
 seed('racing');const raceMessage='Identical concurrent synthetic change';const responses=await Promise.all(Array.from({length:8},()=>call(change,{requestId:randomUUID(),message:raceMessage},'racing')));eq(responses.map(r=>r.status),Array(8).fill(200));eq(counts('racing'),[1,1]);
 seed('workflow');beforeBatch=()=>db.exec("UPDATE estimates SET status='approved',accepted_at='2026-10-18T12:00:01Z',signed_at='2026-10-18T12:00:01Z',signed_name='Synthetic' WHERE id='workflow'");eq((await call(change,{requestId:randomUUID(),message:'Race with signed approval'},'workflow')).status,409);eq(counts('workflow'),[0,0]);
 seed('notifyfail');db.exec("CREATE TRIGGER synthetic_notification_failure BEFORE INSERT ON notifications WHEN NEW.estimate_id='notifyfail' BEGIN SELECT RAISE(ABORT,'synthetic'); END;");eq((await call(change,{requestId:randomUUID(),message:'Atomic notification failure'},'notifyfail')).status,500);eq(counts('notifyfail'),[0,0]);db.exec('DROP TRIGGER synthetic_notification_failure');
 eq(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n,0);eq(db.prepare('SELECT total_cents AS total,deposit_cents AS deposit FROM estimates WHERE id=?').get('e'),{total:20000,deposit:10000});
 console.log(`PASS ${checks}/${checks}: actual public change/approval routes preserve one request/notification, scoped immutable receipts, concurrent and legacy dedupe, rollback, lost acknowledgement, workflow race, signatures, photo permission and empty payments. Native synthetic SQLite only.`);
}finally{db.close();}
