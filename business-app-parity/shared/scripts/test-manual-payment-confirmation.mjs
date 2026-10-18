/** Actual manual-payment routes and transactional native SQLite. Synthetic only. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {confirmedManualPayment} from '../lib/manual-payment-retry-state.ts';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let writes=0,failRead=false,failAfterCommit=false,owner={email:'kylebrooks8605@gmail.com'};
function statement(sql){return {sql,values:[],bind(...values){return {...this,values}},async first(){return db.prepare(sql).get(...this.values)??null},async all(){return {results:db.prepare(sql).all(...this.values)}},async run(){writes++;const changes=Number(db.prepare(sql).run(...this.values).changes);if(failAfterCommit&&sql.trim().startsWith('INSERT INTO payments')){failAfterCommit=false;throw Error('Synthetic lost acknowledgement after insert')}return {meta:{changes}}}};}
const env={DB:{prepare:statement,async batch(rows){if(failRead&&rows.every(r=>/^SELECT/.test(r.sql)))throw Error('Synthetic offline confirmation');db.exec('BEGIN');try{const result=rows.map(r=>/^SELECT/.test(r.sql)?{results:db.prepare(r.sql).all(...r.values)}:(writes++,{meta:{changes:Number(db.prepare(r.sql).run(...r.values).changes)}}));db.exec('COMMIT');if(failAfterCommit){failAfterCommit=false;throw Error('Synthetic lost acknowledgement after commit')}return result}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner),pay=load('app/api/payments/route.ts'),confirm=load('app/api/payments/confirmation/route.ts');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const get=(id,requestId)=>confirm.GET(new Request('https://synthetic.invalid/api/payments/confirmation?'+new URLSearchParams({estimateId:id,requestId})));
const post=(id,a)=>pay.POST(new Request('https://synthetic.invalid/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({estimateId:id,...a})}));
function seed(id,status='approved'){db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic Payment '+id,'2026-10-18');db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,20000,20000,10000,?)').run(id,'c-'+id,status,'2026-10-18');}
const attempt={requestId:randomUUID(),amountCents:10000,tipCents:0,method:'Cash',reference:'synthetic',processingFeeCents:null};
try{
 seed('a');seed('b');seed('tip','completed');
 owner=null;eq((await get('a',attempt.requestId)).status,401);owner={email:'customer@example.invalid'};eq((await get('a',attempt.requestId)).status,401);owner={email:'kylebrooks8605@gmail.com'};
 eq((await get('a','bad')).status,400);eq((await get('missing',attempt.requestId)).status,404);
 let response=await get('a',attempt.requestId);eq(response.status,200);eq(response.headers.get('cache-control'),'no-store, private');eq((await response.json()).confirmed,false);eq(writes,0);
 // A committed principal must be discoverable even when the write acknowledgement failed.
 failAfterCommit=true;eq((await post('a',attempt)).status,503);const receipt=await (await get('a',attempt.requestId)).json();eq(receipt.confirmed,true);eq(confirmedManualPayment(receipt,'a',attempt),10000);const savedWrites=writes;
 eq((await get('b',attempt.requestId)).status,409);eq(confirmedManualPayment(receipt,'b',attempt),null);
 for(const patch of [{amountCents:9999},{method:'Venmo'},{reference:'different'},{tipCents:100},{processingFeeCents:1},{requestId:randomUUID()}])eq(confirmedManualPayment(receipt,'a',{...attempt,...patch}),null);
 for(const patch of [{confirmed:false},{paidCents:'10000'},{paidCents:NaN},{paidCents:-1},{requestId:randomUUID()},{records:[]},{records:[...receipt.records,...receipt.records]}])eq(confirmedManualPayment({...receipt,...patch},'a',attempt),null);
 for(const patch of [{status:'pending'},{estimateId:'b'},{amountCents:10001},{processingFeeCents:3},{grossReceivedCents:1},{bundledTipCents:5},{processingMethod:'Other'}])eq(confirmedManualPayment({...receipt,records:[{...receipt.records[0],...patch}]},'a',attempt),null);
 eq(writes,savedWrites);failRead=true;eq((await get('a',attempt.requestId)).status,503);failRead=false;eq(writes,savedWrites);
 // Explicit same-ID replay never creates another payment, after deposit is already fully paid.
 eq((await post('a',attempt)).status,200);eq(db.prepare("SELECT COUNT(*) AS n FROM payments WHERE estimate_id='a'").get().n,1);
 const combined={...attempt,requestId:randomUUID(),amountCents:20000,tipCents:1200,method:'Venmo',processingFeeCents:450};eq((await post('tip',combined)).status,201);const bundle=await (await get('tip',combined.requestId)).json();eq(confirmedManualPayment(bundle,'tip',combined),20000);eq(bundle.records.length,2);eq(confirmedManualPayment({...bundle,records:bundle.records.slice(0,1)},'tip',combined),null);
 const only={...attempt,requestId:randomUUID(),amountCents:0,tipCents:500,method:'Cash App',processingFeeCents:25};eq((await post('tip',only)).status,201);const tip=await (await get('tip',only.requestId)).json();eq(confirmedManualPayment(tip,'tip',only),20000);eq(tip.records.length,1);
 eq(db.prepare("SELECT COUNT(*) AS n FROM payments WHERE estimate_id='b'").get().n,0);
 console.log(`PASS ${checks}/${checks}: scoped owner-only read confirmation, lost commit acknowledgement, exact principal/tip/fee receipts, malformed and conflicting receipt refusal, no extra financial writes and same-ID replay.`);
}finally{db.close()}
