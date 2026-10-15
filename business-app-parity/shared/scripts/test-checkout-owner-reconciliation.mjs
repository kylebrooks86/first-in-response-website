/** Exercise real owner-only checkout recovery and real Stripe ledger reconciliation. No network/real DB. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=resolve(process.argv[2]||'.');
const sql=new DatabaseSync(':memory:');
for(const file of readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(root+'/drizzle/'+file,'utf8'));
const DB={prepare(query){return {query,args:[],bind(...args){this.args=args;return this;},
 async first(){return sql.prepare(query).get(...this.args)||null;},
 async all(){return {results:sql.prepare(query).all(...this.args)};},
 async run(){return {meta:{changes:Number(sql.prepare(query).run(...this.args).changes)}}}
};},async batch(stmts){sql.exec('BEGIN');try{const results=[];for(const s of stmts)results.push({meta:{changes:Number(sql.prepare(s.query).run(...s.args).changes)}});sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let network=0,owner=true,remote=null,allowedKey='sk_test_fake-fixture';
const env={DB,FIRE_ENV:'staging',get STRIPE_SECRET_KEY(){return allowedKey;}};
const load=(path,extra={})=>{
 const source=readFileSync(resolve(root,path),'utf8').replace(/^import .*?;\n/gm,'');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};const req=id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);};
 new Function('exports','require','env','crypto','Response','Request','fetch','getChatGPTUser','LOCAL_CUSTOMER_DEPLOYMENT','reconcileStripeCheckout',output)(exports,req,env,webcrypto,Response,Request,async(url)=>{
   network++;
   assert.equal(url,'https://api.stripe.com/v1/checkout/sessions/cs_test_ownerfix');
   return remote?Response.json(remote):Response.json({error:'missing'},{status:404});
 },async()=>owner?{email:'kylebrooks8605@gmail.com'}:null,'doomsday',extra.reconcileStripeCheckout);
 return exports;
};
const stripe=load('lib/stripe-payments.ts');
const api=load('app/api/payments/checkout/reconcile/route.ts',{reconcileStripeCheckout:stripe.reconcileStripeCheckout});
let checks=0;
function check(value,msg){assert.ok(value,msg);checks++;console.log('PASS: '+msg);}
const reserve='fire-creating:11111111-2222-4333-8444-555555555555',sessionId='cs_test_ownerfix';
function fixture(){
 sql.prepare("INSERT INTO customers(id,name,created_at) VALUES ('cust-owner','Synthetic QA','now')").run();
 sql.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES ('job-owner','cust-owner','completed',10000,10000,5000,'now')").run();
 sql.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents,status,created_at) VALUES ('inv-owner','job-owner','cust-owner',10000,'sent','now')").run();
 sql.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES (?,'job-owner','balance',10000,'open','now')").run(reserve);
}
fixture();
function session(status='complete',payment_status='paid'){return {
 id:sessionId,livemode:false,status,payment_status,amount_total:10000,client_reference_id:'job-owner',
 metadata:{estimate_id:'job-owner',payment_type:'balance',expected_amount_cents:'10000',tip_amount_cents:'0',expected_charge_cents:'10000',fire_checkout_reservation_id:reserve}
};}
const call=(rid=reserve,sid=sessionId)=>api.POST(new Request('https://synthetic.invalid/api/payments/checkout/reconcile',{method:'POST',body:JSON.stringify({reservationId:rid,sessionId:sid})}));
const status=()=>sql.prepare("SELECT status FROM payment_checkout_sessions WHERE id=?").get(reserve)?.status;
const paymentCount=()=>sql.prepare("SELECT COUNT(*) n FROM payments").get().n;
owner=false;let net=network;check((await call()).status===401,'Non-owner blocked before Stripe lookup');check(network===net,'Non-owner cannot retrieve Stripe sessions');
owner=true;check((await call('bad','cs_test_ownerfix')).status===400,'Malformed reservation rejected');
remote=session();remote.metadata.estimate_id='wrong-job';
check((await call()).status===409,'Cross-job Stripe session rejected');check(status()==='open'&&paymentCount()===0,'Cross-job rejection does not change the D1 reservation or ledger');
remote=session();remote.metadata.fire_checkout_reservation_id='fire-creating:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
check((await call()).status===409,'Different Stripe reservation ID rejected');
remote=session();remote.amount_total=5000;check((await call()).status===409,'Different Stripe amount rejected');
remote=session();remote.livemode=true;check((await call()).status===409,'Isolated candidate rejects live-mode session');
remote=session('open','unpaid');const pending=await call();
check(pending.status===202&&(await pending.json()).action==='pending','Open unpaid checkout remains pending, no forced close');
check(status()==='open'&&paymentCount()===0,'Pending state preserves block and financial history');
remote=null;check((await call()).status===503&&status()==='open','Stripe verification failure leaves reservation untouched');
remote=session('expired','unpaid');const expired=await call();
check(expired.status===200&&(await expired.json()).action==='expired','Verified expired checkout releases reservation');
check(status()==='expired'&&paymentCount()===0,'Expired session creates no payment or extra charge');
check((await call()).status===409,'Repeat attempt cannot reuse resolved expiration');
sql.prepare("DELETE FROM payment_checkout_sessions WHERE id=?").run(reserve);
sql.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES (?,'job-owner','balance',10000,'open','now')").run(reserve);
remote=session();const paid=await call();let result=await paid.json();
check(paid.status===200&&result.action==='paid','Verified paid Stripe session reconciles original reservation');
check(sql.prepare('SELECT COUNT(*) n FROM payments WHERE provider_id=?').get(sessionId).n===1,'Exactly one principal Stripe payment enters ledger');
check(sql.prepare('SELECT status FROM payment_checkout_sessions WHERE id=?').get(sessionId).status==='paid','Paid session replaces reservation and is finalized');
check(sql.prepare('SELECT status FROM invoices WHERE id=?').get('inv-owner').status==='paid','Paid recovery updates actual invoice status');
check((await call()).status===409,'Resolved payment cannot be reconciled again through provisional owner route');
check((await stripe.reconcileStripeCheckout(DB,remote)).ok===true,'Duplicate signed webhook is idempotent after owner reconciliation');
check(sql.prepare('SELECT COUNT(*) n FROM payments WHERE provider_id=?').get(sessionId).n===1,'Replay does not duplicate payment');
console.log('PASS '+checks+' owner checkout recovery assertions on actual route, actual financial reconciler and disposable SQLite.');
