/** Test real candidate routes with synthetic environment identities and NO Stripe network. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHmac,webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
let checks=0;
function eq(actual,expected,message){assert.equal(actual,expected,message);checks++;}
function load(route,deployment,fireEnv,key){
 const file=new URL('../app/api/payments/'+route+'/route.ts',import.meta.url);
 const source=readFileSync(file,'utf8').replace(/^import .*?;\n/gm,'');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const calls={db:0,network:0,reconciled:0,refunds:0},env={FIRE_ENV:fireEnv,STRIPE_RESTRICTED_KEY:key,STRIPE_WEBHOOK_SECRET:'whsec_synthetic-only',
  DB:{prepare(){calls.db++;return {bind(){return {async first(){return {id:'synthetic-payment',estimateId:'job-1',type:'deposit',status:'paid',amountCents:5000,providerId:'cs_fake',customerId:'customer-1'};}}}};}}};
 const exports={};
 const fn=new Function('require','exports','Response','Request','crypto','fetch','LOCAL_CUSTOMER_DEPLOYMENT','getChatGPTUser','env','reconcileStripeCheckout','recordRefundUpdate','refundLedgerObjectsPresent','refundLedgerNotReady',code);
 fn(id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);},exports,Response,Request,webcrypto,async()=>{calls.network++;throw Error('Network forbidden');},deployment,async()=>({email:'kylebrooks8605@gmail.com'}),env,
 async()=>{calls.reconciled++;return {ok:true,duplicate:false};},
 async()=>{calls.refunds++;return {ok:true};},
 async()=>true,()=>Response.json({error:'Synthetic refund schema missing'},{status:503}));
 return {POST:exports.POST,calls};
}
const checkoutBody=JSON.stringify({shareToken:'synthetic',paymentType:'deposit'});
const refundBody=JSON.stringify({paymentId:'synthetic-payment',requestId:'synthetic-refund',amountCents:1000});
async function webhook(route,event){
 const body=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256','whsec_synthetic-only').update(timestamp+'.'+body).digest('hex');
 return route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body}));
}
for(const target of ['doomsday','staging']){
 const c=load('checkout',target,undefined,'sk_live_fake-no-secrets');
 eq((await c.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:checkoutBody}))).status,503,target+' rejects live checkout key');
 eq(c.calls.db,0,target+' rejects before DB');eq(c.calls.network,0,target+' no Stripe call');
 const r=load('refund',target,undefined,'sk_live_fake-no-secrets');
 eq((await r.POST(new Request('https://synthetic.invalid/api/payments/refund',{method:'POST',body:refundBody}))).status,503,target+' rejects live refund key before reservation');
 eq(r.calls.db,1,target+' reads original payment but does not reserve refund');eq(r.calls.network,0,target+' no Stripe refund');
 const w=load('webhook',target,undefined,'sk_test_fixture');
 eq((await webhook(w,{type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_fake'}}})).status,400,target+' rejects signed live event');
 eq(w.calls.db,0,target+' no live ledger write');
}
for(const env of ['independent-dr-staging','refund-staging','synthetic-tests']){
 const c=load('checkout','live',env,'sk_live_fake-no-secrets');
 eq((await c.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:checkoutBody}))).status,503,env+' rejects live key despite live-labelled adapter');
 eq(c.calls.network,0,env+' no Stripe network');
}
// A fully separate QA target never reaches Stripe, D1 or signed webhooks,
// even when someone accidentally supplies a live-looking credential.
const qaCheckout=load('checkout','qa','synthetic-qa','sk_live_fake-no-secrets');
eq((await qaCheckout.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:checkoutBody}))).status,503,'QA denies checkout regardless of key');
eq(qaCheckout.calls.network,0,'QA checkout no provider call');
eq(qaCheckout.calls.db,0,'QA checkout no database call');
const qaRefund=load('refund','qa','synthetic-qa','sk_live_fake-no-secrets');
eq((await qaRefund.POST(new Request('https://synthetic.invalid/api/payments/refund',{method:'POST',body:refundBody}))).status,503,'QA denies refund regardless of key');
eq(qaRefund.calls.network,0,'QA refund no provider call');
eq(qaRefund.calls.db,0,'QA refund no database call');
const qaWebhook=load('webhook','qa','synthetic-qa','sk_test_fake-no-secrets');
eq((await webhook(qaWebhook,{type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_synthetic'}}})).status,503,'QA rejects signed event before decoding or reconciling');
eq(qaWebhook.calls.reconciled,0,'QA webhook never reconciles');
eq(qaWebhook.calls.db,0,'QA webhook no database access');

const live=load('checkout','live','production','sk_live_fake-no-secrets');
eq((await live.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:JSON.stringify({shareToken:'synthetic',paymentType:'invalid'})}))).status,400,'legitimate live candidate follows normal input validation');
eq(live.calls.network,0,'invalid live request does not call Stripe');

const stagingSigned=load('webhook','staging','staging','sk_test_fixture');
eq((await webhook(stagingSigned,{type:'checkout.session.completed',livemode:false,
  data:{object:{id:'cs_test_correct123',livemode:false,payment_status:'paid'}}})).status,200,
  'Signed test checkout reaches isolated staging reconciliation');
eq(stagingSigned.calls.reconciled,1,'Staging valid test event is dispatched exactly once');
eq((await webhook(stagingSigned,{type:'checkout.session.completed',livemode:false,
  data:{object:{id:'cs_live_wrong123',livemode:false,payment_status:'paid'}}})).status,400,
  'Staging rejects live session ID even in an otherwise signed test envelope');
eq((await webhook(stagingSigned,{type:'refund.updated',livemode:false,
  data:{object:{id:'re_synthetic123',livemode:true}}})).status,400,
  'Staging rejects contradictory refund object/envelope modes');
eq(stagingSigned.calls.refunds,0,'Mismatched staged refund never touches the financial ledger');

const liveWebhook=load('webhook','live','production','sk_live_fixture');
eq((await webhook(liveWebhook,{type:'checkout.session.completed',livemode:false,
  data:{object:{id:'cs_test_signed123',livemode:false,payment_status:'paid'}}})).status,400,
  'LIVE rejects correctly signed test-mode payment webhook');
eq(liveWebhook.calls.reconciled,0,'LIVE test-mode webhook fails before financial reconciliation');
eq(liveWebhook.calls.db,0,'LIVE test-mode webhook causes zero D1 reads/writes');
eq((await webhook(liveWebhook,{type:'refund.updated',livemode:false,
  data:{object:{id:'re_synthetic123',livemode:false}}})).status,400,
  'LIVE rejects test-mode refund webhook before any ledger change');
eq(liveWebhook.calls.refunds,0,'LIVE refuses test refund reconciliation');
eq((await webhook(liveWebhook,{type:'checkout.session.completed',livemode:true,
  data:{object:{id:'cs_test_misrouted123',livemode:true,payment_status:'paid'}}})).status,400,
  'LIVE rejects test session ID inside a signed live envelope');
eq((await webhook(liveWebhook,{type:'checkout.session.completed',livemode:true,
  data:{object:{id:'cs_live_synthetic123',livemode:true,payment_status:'paid'}}})).status,200,
  'Correctly signed LIVE-mode session reaches LIVE reconciliation');
eq(liveWebhook.calls.reconciled,1,'LIVE valid event is reconciled only once');
eq((await webhook(liveWebhook,{type:'refund.updated',livemode:true,
  data:{object:{id:'re_synthetic123',livemode:true}}})).status,200,
  'Correctly signed LIVE-mode refund still reaches normal reconciliation');
eq(liveWebhook.calls.refunds,1,'LIVE valid refund handler remains operational');
console.log('PASS '+checks+'/'+checks+' isolated test-key and signed live-event safety checks against actual routes.');
