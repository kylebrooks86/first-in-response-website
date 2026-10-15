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
 const calls={db:0,network:0},env={FIRE_ENV:fireEnv,STRIPE_RESTRICTED_KEY:key,STRIPE_WEBHOOK_SECRET:'whsec_synthetic-only',
  DB:{prepare(){calls.db++;return {bind(){return {async first(){return {id:'synthetic-payment',estimateId:'job-1',type:'deposit',status:'paid',amountCents:5000,providerId:'cs_fake',customerId:'customer-1'};}}}};}}};
 const exports={};
 const fn=new Function('require','exports','Response','Request','crypto','fetch','LOCAL_CUSTOMER_DEPLOYMENT','getChatGPTUser','env',code);
 fn(id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);},exports,Response,Request,webcrypto,async()=>{calls.network++;throw Error('Network forbidden');},deployment,async()=>({email:'kylebrooks8605@gmail.com'}),env);
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
const live=load('checkout','live','production','sk_live_fake-no-secrets');
eq((await live.POST(new Request('https://synthetic.invalid/api/payments/checkout',{method:'POST',body:JSON.stringify({shareToken:'synthetic',paymentType:'invalid'})}))).status,400,'legitimate live candidate follows normal input validation');
eq(live.calls.network,0,'invalid live request does not call Stripe');
console.log('PASS '+checks+'/'+checks+' isolated test-key and signed live-event safety checks against actual routes.');
