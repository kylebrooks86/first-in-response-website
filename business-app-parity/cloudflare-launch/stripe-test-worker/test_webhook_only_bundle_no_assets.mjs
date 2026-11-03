/** SOURCE-ONLY experiment: package the EXISTING generated HMAC-first
 * Stripe TEST webhook route as one asset-free Worker ESM module.
 * No deployable Wrangler config, no remote Worker, no Stripe events, no D1.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

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
assert.ok(inputs.some(p=>p.endsWith('/app/api/payments/webhook/route.ts')),'Bundle MUST contain the real generated webhook route');
assert.ok(inputs.some(p=>p.endsWith('/lib/stripe-payments.ts')),'Real checkout reconciliation source included, unchanged');
assert.ok(inputs.some(p=>p.endsWith('/lib/stripe-refunds.ts')),'Real refund reconciliation source included, unchanged');
assert.ok(inputs.some(p=>p.endsWith('/app/local-customer-deployment.ts')),'Exact staging deployment identity is included');
assert.ok(inputs.every(p=>!/\.css$|\.html$|\.(png|jpg|jpeg|webp|ico|woff2)$/.test(p)),'No UI asset inputs');
assert.ok(!/\bASSETS\b/.test(js),'Bundled webhook code does not bind the full Vite static assets namespace');
assert.ok(js.includes('Stripe TEST is intentionally disabled.')&&js.includes('Invalid Stripe signature.'),
 'Generated webhook still rejects invalid signature 400 and valid-but-disabled 503');
assert.ok(js.includes('/api/payments/webhook')&&js.includes('Not found'),'Only exact webhook POST route is exported');
assert.ok(outputs[0].imports.every(i=>i.path==='cloudflare:workers'&&i.external),
 'Any runtime import must be the known Cloudflare Worker environment, not a third-party service');
assert.ok(!/sourceMappingURL=data:/.test(js),'No embedded source map or private build assets');
console.log('PASS: One self-contained ESM Worker JS module from the actual TEST webhook route: no static assets, no UI routes, HMAC before Stripe-disabled 503. Source-only feasibility, NOT permission to replace TEST Worker. Size='+Buffer.byteLength(js)+' bytes.');
