import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
const root=resolve(process.argv[2]||'.'),ts=createRequire(root+'/package.json')('typescript');
// The route imports a fixed deployment adapter. This isolated data-URL import
// strips ESM imports, so hydrate that exact committed adapter value instead of
// leaving LOCAL_CUSTOMER_DEPLOYMENT undefined (or pretending this is QA).
const adapterSource=readFileSync(root+'/app/local-customer-deployment.ts','utf8');
const adapterMatch=adapterSource.match(/\bexport\s+const\s+LOCAL_CUSTOMER_DEPLOYMENT\s*=\s*(['"])(live|staging|doomsday|qa)\1/);
assert.ok(adapterMatch,'Expected explicit fixed FIRE deployment adapter for this offline route test');
const deploymentMode=adapterMatch[2];
const state={env:{FIRE_ENV:'staging',SITE_ORIGIN:'https://synthetic.invalid',FIRE_STRIPE_MODE:'test',STRIPE_WEBHOOK_SECRET:'synthetic-boundary-secret',DB:{}},checkoutCalls:0,refundCalls:0,failureCalls:0};
globalThis.__boundary=state;
let source=readFileSync(root+'/app/api/payments/webhook/route.ts','utf8').replace(/^import .*?;\n/gm,'');
source='const LOCAL_CUSTOMER_DEPLOYMENT='+JSON.stringify(deploymentMode)+'; const env=globalThis.__boundary.env; const reconcileStripeCheckout=async()=>{globalThis.__boundary.checkoutCalls++;return {ok:true};}; const recordRefundUpdate=async()=>{globalThis.__boundary.refundCalls++;return {ok:true};}; const recordStripeCheckoutFailure=async()=>{globalThis.__boundary.failureCalls++;return {recorded:true};};\n'+source;
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const route=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Math.floor(Date.now()/1000),body=JSON.stringify({livemode:false,type:'unhandled.synthetic.event',data:{object:{}}});
function header(raw,t=now,secret=state.env.STRIPE_WEBHOOK_SECRET){return `t=${t},v1=${createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex')}`;}
async function request(raw,signature=header(raw)){return route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{method:'POST',headers:signature?{'stripe-signature':signature}:{},body:raw}));}
assert.equal((await request(body,null)).status,400);
assert.equal((await request(body,header(body,now-600))).status,400);
assert.equal((await request(body,header(body,now+600))).status,400);
assert.equal((await request(body,header(body,now,'incorrect-secret'))).status,400);
assert.equal((await request(body+' ',header(body))).status,400);
assert.equal((await request(body,'t=invalid,v1=bad')).status,400);
const goodSigned=header(body);
const validLengthResponse=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{
   'stripe-signature':header(body),
   'content-length':String(Buffer.byteLength(body,'utf8'))
 },body
}));
assert.equal(validLengthResponse.status,200,
 'Legitimate Stripe webhook with numeric Content-Length must be accepted');
assert.equal((await validLengthResponse.json()).received,true,
 'Valid signed callback with Content-Length must be acknowledged');
assert.equal(state.checkoutCalls+state.refundCalls+state.failureCalls,0,
 'Unrecognized signed event must not touch financial records');
const paddedLengthResponse=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{
   'stripe-signature':header(body),
   'content-length':'000'+String(Buffer.byteLength(body,'utf8'))
 },body
}));
assert.equal(paddedLengthResponse.status,200,
 'Syntactically valid numeric Content-Length with leading zeros is allowed');
const badLengthResponse=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{'stripe-signature':header(body),'content-length':'12abc'},body
}));
assert.equal(badLengthResponse.status,413,
 'Non-numeric Content-Length must remain denied before financial logic');
// A future narrow public Cloudflare Access webhook exception must not allow
// oversized unauthenticated traffic to consume unlimited Worker memory, or
// malformed UTF-8 to reach payment reconciliation.
const oversize='x'.repeat(1_048_577);
const huge=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{'stripe-signature':header(body)},body:oversize
}));
assert.equal(huge.status,413,'Over-limit body fails before Stripe HMAC and D1');
assert.equal(huge.headers.get('cache-control'),'no-store');
const forgedLength=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{'stripe-signature':header(body),'content-length':'1048577'},body
}));
assert.equal(forgedLength.status,413,'Large declared length stops without reading body');
const hugeSignature=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{'stripe-signature':'t=123,v1='+('a'.repeat(1200))},body
}));
assert.equal(hugeSignature.status,400,'Excessive signature header rejected before HMAC');
const malformedUtf8=await route.POST(new Request('https://synthetic.invalid/api/payments/webhook',{
 method:'POST',headers:{'stripe-signature':header(body)},
 body:new Uint8Array([0xc3,0x28])
}));
assert.equal(malformedUtf8.status,413,'Malformed UTF-8 body refused without D1');
assert.equal(state.checkoutCalls+state.refundCalls+state.failureCalls,0,
 'Oversize/malformed webhook requests cause zero financial side effects');
const unexpectedHost=await route.POST(new Request('https://other-host.invalid/api/payments/webhook',
 {method:'POST',headers:{'stripe-signature':goodSigned},body}));
assert.equal(unexpectedHost.status,404,'HMAC-valid TEST event on wrong host must fail closed');
assert.equal(unexpectedHost.headers.get('cache-control'),'no-store');
assert.equal((await route.POST(new Request('https://synthetic.invalid/api/payments/webhook?debug=1',
 {method:'POST',headers:{'stripe-signature':goodSigned},body}))).status,404,
 'TEST endpoint forbids additional query parameters');
assert.equal((await route.POST(new Request('http://synthetic.invalid/api/payments/webhook',
 {method:'POST',headers:{'stripe-signature':goodSigned},body}))).status,404,
 'TEST webhook requires HTTPS');
assert.equal((await route.POST(new Request('https://synthetic.invalid/api/payments/checkout',
 {method:'POST',headers:{'stripe-signature':goodSigned},body}))).status,404,
 'TEST webhook rejects a non-webhook API path even when signed');
state.env.SITE_ORIGIN=undefined;
assert.equal((await request(body)).status,404,'Missing pinned TEST origin rejects before ledgers');
state.env.SITE_ORIGIN='https://synthetic.invalid';
assert.equal(state.checkoutCalls+state.refundCalls+state.failureCalls,0,
 'Invalid origins cause no payment or refund reconciliation');
// Existing isolated TEST Worker is disabled; no signed payload may be
// acknowledged or reconciled without explicit test-mode activation.
state.env.FIRE_STRIPE_MODE='disabled';
const blockedSigned=await request(body);
assert.equal(blockedSigned.status,503);
assert.equal(blockedSigned.headers.get('cache-control'),'no-store');
assert.equal((await request(body,header(body,now,'incorrect-secret'))).status,400,
 'Invalid HMAC must still fail before disabled-mode response');
state.env.FIRE_STRIPE_MODE=undefined;
assert.equal((await request(body)).status,503,
 'Missing TEST mode must fail closed too');
assert.equal(state.checkoutCalls+state.refundCalls+state.failureCalls,0);
state.env.FIRE_STRIPE_MODE='test';
assert.equal((await request(body,header(body)+',v1=old-rotation-signature')).status,200);
assert.equal((await request('{',header('{'))).status,400);
for(const raw of ['null','[]','"string"','123'])assert.equal((await request(raw)).status,400);
for(const eventType of ['refund.updated','refund.failed']){
  for(const livemode of [true,undefined])assert.equal((await request(JSON.stringify({livemode,type:eventType,data:{object:{}}}))).status,400);
  assert.equal((await request(JSON.stringify({livemode:false,type:eventType}))).status,400);
}
assert.equal((await request(JSON.stringify({livemode:false,type:'checkout.session.completed'}))).status,400);
assert.equal(state.checkoutCalls,0);assert.equal(state.refundCalls,0);assert.equal(state.failureCalls,0);
const signedRefundFailure=JSON.stringify({livemode:false,type:'refund.failed',data:{object:{id:'re_synthetic',status:'failed',amount:100,currency:'usd'}}});
assert.equal((await request(signedRefundFailure)).status,200);
assert.equal(state.refundCalls,1,'Signed refund.failed must enter the refund reconciler rather than be ignored');
assert.equal(state.checkoutCalls,0);
state.env.STRIPE_WEBHOOK_SECRET='';assert.equal((await request(body,'irrelevant')).status,503);
console.log('PASS: actual webhook signature/time/body checks, rotated signatures, malformed JSON/envelopes, strict staging live-event rejection, missing objects; signed refund.failed dispatch; zero reconciliation calls for rejected input. No network or credentials used.');
