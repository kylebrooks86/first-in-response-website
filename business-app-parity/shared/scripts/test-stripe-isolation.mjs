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
 const calls={db:0,network:0,reconciled:0,refunds:0,failures:0},env={FIRE_ENV:fireEnv,SITE_ORIGIN:'https://synthetic.invalid',STRIPE_RESTRICTED_KEY:key,STRIPE_WEBHOOK_SECRET:'whsec_synthetic-only',FIRE_STRIPE_MODE:'test',
  DB:{prepare(){calls.db++;return {bind(){return {async first(){return {id:'synthetic-payment',estimateId:'job-1',type:'deposit',status:'paid',amountCents:5000,providerId:'cs_fake',customerId:'customer-1'};}}}};}}};
 const exports={};
 const fn=new Function('require','exports','Response','Request','crypto','fetch','LOCAL_CUSTOMER_DEPLOYMENT','getChatGPTUser','env','reconcileStripeCheckout','recordStripeCheckoutFailure','recordRefundUpdate','refundLedgerObjectsPresent','refundLedgerNotReady',code);
 fn(id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);},exports,Response,Request,webcrypto,async()=>{calls.network++;throw Error('Network forbidden');},deployment,async()=>({email:'kylebrooks8605@gmail.com'}),env,
 async()=>{calls.reconciled++;return {ok:true,duplicate:false};},
 async()=>{calls.failures++;return {recorded:true,duplicate:false};},
 async()=>{calls.refunds++;return {ok:true};},
 async()=>true,()=>Response.json({error:'Synthetic refund schema missing'},{status:503}));
 return {POST:exports.POST,calls,env};
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
// Async-payment failures remain completely isolated from QA financial endpoints.
eq((await webhook(qaWebhook,{type:'checkout.session.async_payment_failed',livemode:false,
  data:{object:{id:'cs_test_failedqa123',livemode:false,status:'complete',payment_status:'unpaid'}}})).status,503,
  'QA denies signed asynchronous checkout failure before any provider/ledger action');
eq(qaWebhook.calls.reconciled,0,'QA failed-payment event cannot reconcile a paid charge');
eq(qaWebhook.calls.db,0,'QA failed-payment callback never touches D1');
eq(qaWebhook.calls.failures,0,'QA failed-payment callback cannot create owner alert');

const live=load('checkout','live','production','sk_live_fake-no-secrets');
eq((await live.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:JSON.stringify({shareToken:'synthetic',paymentType:'invalid'})}))).status,400,'legitimate live candidate follows normal input validation');
eq(live.calls.network,0,'invalid live request does not call Stripe');

const disabledCheckout=load('checkout','staging','staging','sk_test_fixture');
disabledCheckout.env.FIRE_STRIPE_MODE='disabled';
eq((await disabledCheckout.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:checkoutBody}))).status,503,
 'Disabled TEST checkout refuses even a synthetic key before data access');
eq(disabledCheckout.calls.db,0,'Disabled TEST checkout never reads D1');
eq(disabledCheckout.calls.network,0,'Disabled TEST checkout makes no provider requests');
const disabledRefund=load('refund','staging','staging','sk_test_fixture');
disabledRefund.env.FIRE_STRIPE_MODE='disabled';
eq((await disabledRefund.POST(new Request('https://synthetic.invalid/api/payments/refund',{method:'POST',body:refundBody}))).status,503,
 'Disabled TEST refund refuses before D1/payment operation');
eq(disabledRefund.calls.db,1,'Disabled TEST refund makes only a payment lookup, not a refund reservation');
eq(disabledRefund.calls.network,0,'Disabled TEST refund never contacts Stripe');
const stagingSigned=load('webhook','staging','staging','sk_test_fixture');
stagingSigned.env.FIRE_STRIPE_MODE='disabled';
eq((await webhook(stagingSigned,{type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_synthetic',payment_status:'paid'}}})).status,503,
 'Disabled staging webhook rejects correctly signed TEST checkout');
eq(stagingSigned.calls.reconciled,0,'Disabled staging webhook must not reconcile');
stagingSigned.env.FIRE_STRIPE_MODE='test';
// Signed sandbox requests on an unexpected Host / version preview cannot
// dispatch to the D1 ledger even after TEST mode is deliberately enabled.
const wrongHostEvent={type:'checkout.session.completed',livemode:false,
 data:{object:{id:'cs_test_wronghost123',livemode:false,payment_status:'paid'}}};
const wrongHostBody=JSON.stringify(wrongHostEvent),wrongHostTimestamp=Math.floor(Date.now()/1000);
const wrongHostSignature=createHmac('sha256','whsec_synthetic-only').update(
  wrongHostTimestamp+'.'+wrongHostBody).digest('hex');
const wrongHostResponse=await stagingSigned.POST(new Request(
 'https://version123-fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook',
 {method:'POST',headers:{'stripe-signature':`t=${wrongHostTimestamp},v1=${wrongHostSignature}`},
 body:wrongHostBody}));
eq(wrongHostResponse.status,404,'Signed TEST webhook on unpinned version host fails closed');
eq(stagingSigned.calls.reconciled,0,'Wrong TEST hostname cannot reconcile into bound D1');
stagingSigned.env.FIRE_STRIPE_MODE='test';
eq((await webhook(stagingSigned,{type:'checkout.session.completed',livemode:false,
  data:{object:{id:'cs_test_correct123',livemode:false,payment_status:'paid'}}})).status,200,
  'Signed test checkout reaches isolated staging reconciliation');
eq(stagingSigned.calls.reconciled,1,'Staging valid test event is dispatched exactly once');
// The failed asynchronous payment now dispatches only to an idempotent owner
// alert. It may NOT mark principal paid, release the checkout or issue refund.
// Actual Stripe sandbox integration remains an independent Gate 9 requirement.
const failedStagingEvent=await webhook(stagingSigned,{type:'checkout.session.async_payment_failed',livemode:false,
  data:{object:{id:'cs_test_failed123',livemode:false,status:'complete',payment_status:'unpaid'}}});
eq(failedStagingEvent.status,200,'Signed sandbox asynchronous failure receives acknowledged owner notification');
const failedStagingBody=await failedStagingEvent.json();
eq(failedStagingBody.received===true&&failedStagingBody.recorded===true&&failedStagingBody.ignored!==true,true,
  'Signed failed checkout uses the owner-alert path, not ignored-event acknowledgement');
eq(stagingSigned.calls.failures,1,'Staging failure notification dispatched once, no paid ledger write');
eq(stagingSigned.calls.reconciled,1,'Failed asynchronous payment must never be recorded as paid');
eq(stagingSigned.calls.refunds,0,'Failed asynchronous payment must never create a refund');
eq((await webhook(stagingSigned,{type:'checkout.session.async_payment_failed',livemode:true,
  data:{object:{id:'cs_live_failed123',livemode:true,status:'complete',payment_status:'unpaid'}}})).status,400,
  'Sandbox rejects signed live-mode asynchronous failure before dispatch');
eq(stagingSigned.calls.reconciled,1,'Wrong-mode failed event never reaches settlement');
eq(stagingSigned.calls.failures,1,'Wrong-mode failed event cannot generate an alert');
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
