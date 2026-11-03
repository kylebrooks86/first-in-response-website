/** Actual generated FIRE Stripe TEST webhook: unsigned/invalid signed HTTP 400,
 * valid synthetic signed HTTP 503 while TEST is OFF, and NO DB/provider calls.
 * No hosted Worker/Stripe access, real signing secret, production credential,
 * real event delivery or payment is used. Run only on disposable materialized
 * TEST source produced by materialize-stripe-test.py.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const dir=process.env.FIRE_GATE9_TEST_DIR;
assert.ok(dir&&dir.startsWith('/'),'An absolute disposable generated TEST path is mandatory');
const path=resolve(dir,'app/api/payments/webhook/route.ts');
assert.equal(path,join(resolve(dir),'app/api/payments/webhook/route.ts'),
  'Generated route must come from the exact disposable TEST root');
const source=readFileSync(path,'utf8');
assert.ok(source.includes('TEST-only: validate Stripe HMAC before refusing disabled-mode delivery.'),
 'Must test the materialized TEST webhook, not the shared or LIVE handler');
const secret='whsec_SYNTHETIC_OFFLINE_ONLY_DO_NOT_USE';
let providerCalls=0,dbCalls=0;
const forbidProvider=()=>{providerCalls++;throw Error('OFFLINE TEST: Provider reconciliation must not be called');};
const db=new Proxy({}, {get(){dbCalls++;throw Error('OFFLINE TEST: D1 must not be accessed');}});
const environment={
 FIRE_ENV:'cloudflare-staging',FIRE_STRIPE_MODE:'disabled',STRIPE_WEBHOOK_SECRET:secret,DB:db,
};
const mocks=(name)=>{
 if(name==='cloudflare:workers')return {env:environment};
 if(name.endsWith('/local-customer-deployment'))return {LOCAL_CUSTOMER_DEPLOYMENT:'staging'};
 if(name.endsWith('/stripe-payments'))return {
  reconcileStripeCheckout:forbidProvider,recordStripeCheckoutFailure:forbidProvider,
 };
 if(name.endsWith('/stripe-refunds'))return {recordRefundUpdate:forbidProvider};
 throw Error('Unexpected webhook dependency in generated TEST source: '+name);
};
const script=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true,
});
assert.equal((script.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,
 'Generated webhook transpilation must be error free');
const exported={};
vm.runInNewContext(script.outputText,{
 exports:exported,require:mocks,crypto:webcrypto,TextEncoder,Request,Response,Date,console,
}, {filename:'offline-generated-test-webhook.cjs',timeout:5000});
assert.equal(typeof exported.POST,'function','Generated route must export POST');
let checks=0;
const raw=JSON.stringify({
 id:'evt_SYNTHETIC_NO_STRIPE_EVENT',type:'checkout.session.completed',livemode:false,
 data:{object:{id:'cs_test_synthetic123',livemode:false}},
});
const now=()=>Math.floor(Date.now()/1000);
const header=(body,ts,signingKey=secret)=>
  't='+ts+',v1='+createHmac('sha256',signingKey).update(ts+'.'+body).digest('hex');
const send=async(body,signature,expected,needle)=>{
 const headers={'content-type':'application/json'};
 if(signature!==null)headers['stripe-signature']=signature;
 const response=await exported.POST(new Request('https://test.invalid/api/payments/webhook',
  {method:'POST',headers,body}));
 assert.equal(response.status,expected,'Unexpected generated HTTP status: '+needle);
 const json=await response.json();
 assert.ok(typeof json.error==='string'&&json.error.includes(needle),'Expected safe error: '+needle);
 if(expected===503)assert.equal(response.headers.get('cache-control'),'no-store',
   'Signed disabled-mode response must not be cached');
 checks++;
};
await send(raw,null,400,'Missing Stripe signature');
await send(raw,'t='+now()+',v1=deadbeef',400,'Invalid Stripe signature');
await send(raw,header(raw,now(),'whsec_WRONG_SYNTHETIC_KEY'),400,'Invalid Stripe signature');
await send(raw,header(raw,now()-360),400,'Invalid Stripe signature');
await send(raw,header(raw,now()+360),400,'Invalid Stripe signature');
await send(raw,'t=not-a-time,v1=abcdef',400,'Invalid Stripe signature');
await send(raw,'t='+now()+',v0=fake',400,'Invalid Stripe signature');
await send(raw,header(raw,now()),503,'Stripe TEST is intentionally disabled');
await send(raw,'t='+now()+',v1=not-correct,v1='+createHmac('sha256',secret)
 .update(now()+'.'+raw).digest('hex'),503,'Stripe TEST is intentionally disabled');
const refund=JSON.stringify({id:'evt_REFUND_SYNTHETIC',type:'refund.updated',livemode:false,
 data:{object:{id:'re_synthetic',livemode:false}}});
await send(refund,header(refund,now()),503,'Stripe TEST is intentionally disabled');
// A valid signature on MALFORMED JSON must still return the disabled 503:
// no parsing, refund/checkout processing or success acknowledgment is reached.
await send('{ definitely not json',header('{ definitely not json',now()),503,
 'Stripe TEST is intentionally disabled');
assert.equal(dbCalls,0,'No D1 access for any valid/invalid TEST webhook when disabled');
assert.equal(providerCalls,0,'No Stripe, checkout or refund reconciliation when disabled');
console.log('PASS '+checks+' actual generated TEST webhook HTTP/HMAC cases, 0 D1 calls, 0 Stripe calls; sandbox payments still OFF.');
