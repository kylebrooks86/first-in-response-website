/** SOURCE-ONLY experiment: package the EXISTING generated HMAC-first
 * Stripe TEST webhook route as one asset-free Worker ESM module.
 * No deployable Wrangler config, no remote Worker, no Stripe events, no D1.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
// Pinned esbuild dependency of the existing Vite 8/Cloudflare app.
const esbuild=require(resolve(here,'../../shared/node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild'));
const dir=process.env.FIRE_GATE9_GENERATED_TEST_APP;
assert.ok(dir&&dir.length>8,'Require fresh generated isolated TEST source, outside Git');
const app=resolve(dir);
const generated=resolve(app,'app/api/payments/webhook/route.ts');
const route=readFileSync(generated,'utf8');
const auth=readFileSync(resolve(app,'app/local-customer-deployment.ts'),'utf8');
assert.ok(auth.includes("'staging' as const"),'Must be isolated TEST/staging, never LIVE/QA');
const sig=route.indexOf('if (!await verifyStripeSignature(');
const mode=route.indexOf('  // TEST-only: validate Stripe HMAC before refusing disabled-mode delivery.');
const parsing=route.indexOf('  let event:StripeEvent;');
assert.ok(sig>=0&&mode>sig&&parsing>mode,'Signed HMAC check must precede 503 disabled TEST guard AND event parsing');
assert.ok(route.includes('FIRE_STRIPE_MODE !== "test"')&&route.includes('Stripe TEST is intentionally disabled.'),
 'Do not build a webhook module that can process money while Stripe is disabled');
const entry=resolve(app,'fire-gate9-webhook-only-proof.ts');
// The handler is imported from the real generated production code, not copied
// or handwritten. All other full-app routes deliberately return 404 here.
writeFileSync(entry,`
import {POST as verifiedStripeWebhook} from './app/api/payments/webhook/route';
export default {
 async fetch(request: Request): Promise<Response> {
  const path=new URL(request.url).pathname;
  if(path!=='/api/payments/webhook'||request.method!=='POST'){
   return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
  }
  return verifiedStripeWebhook(request);
 }
};
`);
const result=await esbuild.build({
 absWorkingDir:app,entryPoints:[entry],outfile:'GATE9_ONLY_OFFLINE_PROOF.mjs',
 bundle:true,platform:'neutral',format:'esm',target:'es2022',
 external:['cloudflare:workers'],write:false,metafile:true,logLevel:'silent'
});
assert.equal(result.outputFiles?.length,1,'Exactly one Worker JavaScript module; no emitted static files');
const js=result.outputFiles[0].text;
const inputs=Object.keys(result.metafile.inputs);
const outputs=Object.values(result.metafile.outputs);
assert.equal(outputs.length,1,'No static assets or HTML/CSS emitted');
assert.ok(inputs.some(p=>p.endsWith('app/api/payments/webhook/route.ts')),'Bundle MUST contain the real generated webhook route');
assert.ok(inputs.some(p=>p.endsWith('lib/stripe-payments.ts')),'Real checkout reconciliation source included, unchanged');
assert.ok(inputs.some(p=>p.endsWith('lib/stripe-refunds.ts')),'Real refund reconciliation source included, unchanged');
assert.ok(inputs.some(p=>p.endsWith('app/local-customer-deployment.ts')),'Exact staging deployment identity is included');
assert.ok(inputs.every(p=>!/\.css$|\.html$|\.(png|jpg|jpeg|webp|ico|woff2)$/.test(p)),'No UI asset inputs');
assert.ok(!/\bASSETS\b/.test(js),'Bundled webhook code does not bind the full Vite static assets namespace');
assert.ok(js.includes('Stripe TEST is intentionally disabled.')&&js.includes('Invalid Stripe signature.'),
 'Generated webhook still rejects invalid signature 400 and valid-but-disabled 503');
assert.ok(js.includes('/api/payments/webhook')&&js.includes('Not found'),'Only exact webhook POST route is exported');
assert.ok(outputs[0].imports.every(i=>i.path==='cloudflare:workers'&&i.external),
 'Any runtime import must be the known Cloudflare Worker environment, not a third-party service');
assert.ok(!/sourceMappingURL=data:/.test(js),'No embedded source map or private build assets');
console.log('PASS: One self-contained ESM Worker JS module from the actual TEST webhook route: no static assets, no UI routes, HMAC before Stripe-disabled 503. Source-only feasibility, NOT permission to replace TEST Worker. Size='+Buffer.byteLength(js)+' bytes.');

// Execute the SAME real generated route in an entirely synthetic local runtime.
// A virtual esbuild module substitutes ONLY the Cloudflare environment binding.
// No direct test rewrite of the handler, no real Stripe/API/network/D1 calls.
const secret='whsec_FIRE_GATE9_SYNTHETIC_ONLY_DO_NOT_USE';
let dbCalls=0, networkCalls=0;
globalThis.__FIRE_GATE9_SYNTHETIC_ENV={
  FIRE_ENV:'cloudflare-staging',
  FIRE_STRIPE_MODE:'disabled',
  STRIPE_WEBHOOK_SECRET:secret,
  DB:{prepare(){dbCalls++;throw Error('Forbidden D1 query in disabled Gate9 HMAC test');}}
};
const runnable=await esbuild.build({
 absWorkingDir:app,entryPoints:[entry],outfile:'GATE9_ONLY_SYNTHETIC_RUNTIME.mjs',
 bundle:true,platform:'neutral',format:'esm',target:'es2022',write:false,logLevel:'silent',
 plugins:[{name:'synthetic-cloudflare-env-only',setup(build){
  build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'synthetic-only'}));
  build.onLoad({filter:/.*/,namespace:'synthetic-only'},()=>({
   contents:'export const env=globalThis.__FIRE_GATE9_SYNTHETIC_ENV;',
   loader:'js'
  }));
 }}]
});
assert.equal(runnable.outputFiles?.length,1,'One runtime Worker script for offline HTTP tests');
const worker=(await import('data:text/javascript;charset=utf-8,'+
 encodeURIComponent(runnable.outputFiles[0].text))).default;
assert.equal(typeof worker?.fetch,'function','Real existing webhook handler is callable from Worker default export');
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{networkCalls++;throw Error('Synthetic Gate9 code must not fetch Stripe or external APIs');};
try{
 const url='https://synthetic.invalid/api/payments/webhook';
 const raw=JSON.stringify({id:'evt_FIRE_synthetic',type:'checkout.session.completed',livemode:false,
  data:{object:{id:'cs_test_synthetic',amount_total:44000,currency:'usd'}}});
 const stamp=Math.floor(Date.now()/1000);
 const hmac=createHmac('sha256',secret).update(String(stamp)+'.'+raw).digest('hex');
 const post=(body,signature,requestUrl=url,method='POST')=>
  worker.fetch(new Request(requestUrl,{method,body:method==='POST'?body:undefined,
   headers:signature?{'Stripe-Signature':signature}:undefined}));
 const absent=await post(raw,null);
 assert.equal(absent.status,400,'Missing Stripe HMAC cannot be acknowledged');
 const bad=await post(raw,'t='+stamp+',v1='+('0'.repeat(64)));
 assert.equal(bad.status,400,'Incorrect HMAC blocked before Stripe mode guard');
 const signed=await post(raw,'t='+stamp+',v1='+hmac);
 assert.equal(signed.status,503,'Validly signed TEST event stays 503 while Stripe mode disabled');
 assert.equal(signed.headers.get('cache-control'),'no-store','Disabled signature-authenticated response cannot be cached');
 const signedPayload=await signed.json();
 assert.equal(signedPayload.error,'Stripe TEST is intentionally disabled.');
 const noOtherPath=await post(raw,'t='+stamp+',v1='+hmac,'https://synthetic.invalid/api/payments/refund');
 assert.equal(noOtherPath.status,404,'No other Stripe money route exported by this minimal proof');
 const noGet=await post('',null,url,'GET');
 assert.equal(noGet.status,404,'Only POST requests to the webhook are routed');
 // Even if someone later enables TEST mode on this isolated Worker, a signed
 // LIVE event, a contradictory object envelope or a LIVE Checkout ID must
 // fail before touching D1. These are negative-control tests only: no valid
 // TEST money event is reconciled and no real Stripe request is ever sent.
 const testEnv=globalThis.__FIRE_GATE9_SYNTHETIC_ENV;
 const signedHeader=(body,when=stamp)=>'t='+when+',v1='+
  createHmac('sha256',secret).update(String(when)+'.'+body).digest('hex');
 const stale=await post(raw,signedHeader(raw,stamp-3600));
 assert.equal(stale.status,400,'Stale signed Stripe timestamp must be rejected');
 testEnv.FIRE_STRIPE_MODE='test';
 try{
  const event=JSON.parse(raw);
  const liveEnvelope=JSON.stringify({...event,livemode:true});
  const liveResponse=await post(liveEnvelope,signedHeader(liveEnvelope));
  assert.equal(liveResponse.status,400,'LIVE-mode event must not enter isolated TEST DB');

  const contradictoryObject=JSON.stringify({...event,
   data:{object:{...event.data.object,livemode:true}}});
  const objectResponse=await post(contradictoryObject,signedHeader(contradictoryObject));
  assert.equal(objectResponse.status,400,'LIVE-mode object inside TEST envelope must be refused');

  const liveSession=JSON.stringify({...event,
   data:{object:{...event.data.object,id:'cs_live_synthetic123'}}});
  const sessionResponse=await post(liveSession,signedHeader(liveSession));
  assert.equal(sessionResponse.status,400,'LIVE Checkout ID must never enter isolated TEST DB');
 }finally{
  testEnv.FIRE_STRIPE_MODE='disabled';
 }
 assert.equal(dbCalls,0,'TEST-mode negative controls and disabled webhook performed ZERO SQLite/D1 operations');
 assert.equal(networkCalls,0,'Disabled-mode webhook performed ZERO Stripe/provider requests');
 console.log('PASS: Actual asset-free TEST Worker route handles synthetic missing/bad HMAC=400; signed HMAC=503 with no-store; other routes=404; ZERO D1/network calls. No hosted interaction.');
} finally {
 globalThis.fetch=originalFetch;
 delete globalThis.__FIRE_GATE9_SYNTHETIC_ENV;
}

