/** Execute the ACTUAL checkout handler with concurrent requests and synthetic D1/Stripe; no network or deployed resources. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../app/api/payments/checkout/route.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let checks=0;
const check=(condition,description)=>{assert.ok(condition,description);checks++;console.log('PASS: '+description);};
const body=JSON.stringify({shareToken:'synthetic-share-token',paymentType:'deposit'});
function harness({twoReaders=false,stripeResponse='success',saveFailure=false}={}){
 const state={open:null,creates:0,expirations:0,locks:0};
 let readers=0,openReaders;
 const bothReaders=new Promise(resolve=>{openReaders=resolve;});
 const db={prepare(sql){
   return {bind(...params){
     return {
       async first(){
         if(sql.includes('WHERE e.share_token=? LIMIT 1'))return {id:'estimate-1',totalCents:10000,depositCents:5000,status:'approved',acceptedAt:'2026-01-01',customer:'Fixture',service:'House wash'};
         if(sql.includes('FROM payment_refunds WHERE estimate_id=?'))return null;
         if(sql.includes("FROM notifications WHERE estimate_id=? AND type='payment_overage'"))return null;
         if(sql.includes('AS amount FROM payments WHERE estimate_id=?'))return {amount:0};
         if(sql.includes('SELECT e.status,e.deposit_cents AS depositCents'))return {status:'approved',depositCents:5000,totalCents:10000,paidCents:0,paymentOverageOpen:0};
         throw Error('Unexpected first SQL: '+sql);
       },
       async all(){
         if(!sql.includes('SELECT id FROM payment_checkout_sessions'))throw Error('Unexpected all SQL: '+sql);
         const snapshot=state.open?[{id:state.open.id}]:[];
         if(twoReaders){readers++;if(readers===2)openReaders();await bothReaders;}
         return {results:snapshot};
       },
       async run(){
         if(sql.includes('INSERT INTO payment_checkout_sessions')){
           check(sql.includes('WHERE NOT EXISTS'),'Checkout lock uses database-side conditional reservation');
           state.locks++;
           if(state.open)return {meta:{changes:0}};
           state.open={id:params[0],estimateId:params[1],type:params[2],charge:params[3],status:'open'};
           return {meta:{changes:1}};
         }
         if(sql.includes('UPDATE payment_checkout_sessions SET id=?')){
           if(saveFailure)throw Error('Synthetic D1 acknowledgement unavailable');
           if(!state.open||state.open.id!==params[1])return {meta:{changes:0}};
           state.open.id=params[0];return {meta:{changes:1}};
         }
         if(sql.includes("SET status='expired',expired_at=?")){
           if(state.open?.id===params[1])state.open=null;
           return {meta:{changes:1}};
         }
         throw Error('Unexpected run SQL: '+sql);
       }
     };
   }};
 }};
 const env={DB:db,FIRE_ENV:'synthetic',STRIPE_SECRET_KEY:'sk_test_synthetic',SITE_ORIGIN:'https://synthetic.invalid'};
 async function fakeFetch(url,options){
   if(url==='https://api.stripe.com/v1/checkout/sessions'&&options.method==='POST'){
     state.creates++;
     check(options.headers['Idempotency-Key'].startsWith('fire-checkout-fire-creating:'),'Stripe create uses the reserved operation ID as idempotency key');
     if(stripeResponse==='rejection')return Response.json({error:{message:'Synthetic card setup rejected'}},{status:400});
     if(stripeResponse==='uncertain')throw Error('Lost Stripe acknowledgement');
     return Response.json({id:'cs_test_real_synthetic',url:'https://checkout.stripe.test/synthetic'});
   }
   if(String(url).endsWith('/expire')){
     state.expirations++;
     return Response.json({id:'cs_test_real_synthetic',status:'expired'});
   }
   if(String(url).includes('/checkout/sessions/')){
     return Response.json({status:'expired'});
   }
   throw Error('Unexpected Stripe API call '+url);
 }
 const exports={};
 new Function('require','exports','env','Response','Request','crypto','fetch','LOCAL_CUSTOMER_DEPLOYMENT',compiled)(
   id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);},exports,env,Response,Request,webcrypto,fakeFetch,'doomsday');
 const request=()=>new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',headers:{'content-type':'application/json'},body});
 return {post:()=>exports.POST(request()),state};
}
{
 const h=harness({twoReaders:true});
 const results=await Promise.all([h.post(),h.post()]);
 check(results.filter(r=>r.status===200).length===1&&results.filter(r=>r.status===409).length===1,'Racing customer clicks produce one checkout and one conflict');
 check(h.state.creates===1,'Exactly one Stripe checkout is created during a concurrent race');
 check(h.state.open?.id==='cs_test_real_synthetic','Atomic lock is promoted in place to real checkout session ID');
 check(h.state.locks===2,'Both racing requests reach the guarded database reservation');
}
{
 const h=harness({stripeResponse:'rejection'});
 const r=await h.post();
 check(r.status===502,'Definitive Stripe API rejection is reported');
 check(h.state.open===null,'Definitive Stripe rejection releases reservation so another checkout is possible');
}
{
 const h=harness({stripeResponse:'uncertain'});
 const r=await h.post();
 check(r.status===500&&h.state.creates===1,'Lost Stripe acknowledgement does not create an untracked second session');
 check(h.state.open?.id.startsWith('fire-creating:'),'Uncertain Stripe outcome retains fail-closed D1 reservation');
 check((await h.post()).status===409&&h.state.creates===1,'Further attempt cannot charge again after uncertain Stripe outcome');
}
{
 const h=harness({saveFailure:true});
 const r=await h.post();
 check(r.status===503,'Failed D1 checkout acknowledgement blocks returning a payable link');
 check(h.state.expirations===1,'The unmatched external Stripe session is explicitly expired');
 check(h.state.open===null,'Confirmed Stripe expiry releases the checkout lock');
}
console.log('PASS '+checks+' synthetic checkout race and recovery assertions against the actual FIRE route.');
