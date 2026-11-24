/**
 * Change-scoped Gate9 STAGING no-assets-source negative checks.
 * Must consume the actual freshly compiled package, never a mock substitute.
 * No hosted provider, account, token, deployment or real financial write.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {verifyStagingNoAssetsDarkSource} from './prepare_staging_noassets_dark_source.mjs';
const folder=process.argv[2];
if(!folder||process.argv.length!==3)throw Error('usage: SOURCE_ONLY_CURRENT_STAGING_PACKAGE');
const original=verifyStagingNoAssetsDarkSource(folder);
assert.equal(original.status,'STAGING_WORKER_ONLY_DARK_SOURCE_VERIFIED');
assert.equal(original.worker,'fire-app-independent-staging');
assert.equal(original.providerContacted,false);
assert.equal(original.deployed,false);
assert.equal(original.currentHostedPredecessorReplaced,false);
assert.equal(original.stripeMode,'disabled');
assert.ok(original.clientAssets>=30&&original.serverModules>=80);
const tmp=mkdtempSync(join(tmpdir(),'fire-test-gate9-noassets-'));
let checks=7;
const attack=(name,edit,message=/FIRE STAGING WORKER-ONLY SOURCE BLOCKED/)=>{
 const out=join(tmp,name);cpSync(folder,out,{recursive:true});
 edit(out);
 assert.throws(()=>verifyStagingNoAssetsDarkSource(out),message);checks++;
};
const j=(dir,rel,fn)=>{
 const path=join(dir,rel),v=JSON.parse(readFileSync(path,'utf8'));
 fn(v);writeFileSync(path,JSON.stringify(v,null,2)+'\n');
};
try{
 const configPath='server/wrangler.json';
 const receiptPath='staging-noassets-dark-source-receipt.json';
 const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
 const validConfig=JSON.parse(readFileSync(join(folder,configPath),'utf8'));
 assert.deepEqual(validConfig.observability,{
  enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}
 });
 checks++;
 for(const [name,mutate] of [
  ['missing-observability',config=>{delete config.observability;}],
  ['invocation-logs-enabled',config=>{config.observability.logs.invocation_logs=true;}],
  ['traces-enabled',config=>{config.observability.traces.enabled=true;}],
  ['activation-unblocked',config=>{config.vars.FIRE_STAGING_PRIVATE_ACTIVATION='owner-approved';}],
  ['wrong-worker',config=>{config.name='fire-fullapp-dr';}],
  ['wrong-db',config=>{config.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';}],
  ['wrong-mode',config=>{config.vars.FIRE_STRIPE_MODE='test';}],
  ['preview-enabled',config=>{config.preview_urls=true;}],
  ['payment-binding-lost',config=>{config.secrets.required.pop();}],
  ['r2-added',config=>{config.r2_buckets.push({binding:'BUCKET',bucket_name:'unapproved'});}],
 ]){
  const out=join(tmp,name);
  cpSync(folder,out,{recursive:true});
  j(out,configPath,mutate);
  // Recompute the internal inventory so the verifier must enforce the policy beyond hash checks.
  const configBytes=readFileSync(join(out,configPath));
  j(out,receiptPath,receipt=>{
   const row=receipt.savedInventory.find(row=>row.path===configPath);
   row.bytes=configBytes.length;
   row.sha256=sha256(configBytes);
   receipt.savedInventoryDigest=sha256(JSON.stringify(receipt.savedInventory));
  });
  assert.throws(()=>verifyStagingNoAssetsDarkSource(out),/STAGING review config differs/);
  checks++;
 }
 assert.equal(verifyStagingNoAssetsDarkSource(folder,original.receiptSha256).receiptPinVerified,true);
 checks++;
 const rewritten=join(tmp,'rewritten-source-receipt');
 cpSync(folder,rewritten,{recursive:true});
 j(rewritten,'staging-noassets-dark-source-receipt.json',r=>{r.sourceSha='1'.repeat(40)});
 assert.throws(()=>verifyStagingNoAssetsDarkSource(rewritten,original.receiptSha256),
  /receipt differs from independent SHA256 pin/);
 checks++;
 attack('receipt-path-escape',d=>j(d,'staging-noassets-dark-source-receipt.json',r=>{
  r.originalServerFiles[0].path='server/../original-compiled-wrangler.json';
 }),/bad original full STAGING server manifest/);
 attack('activate-test-auth',d=>j(d,'server/wrangler.json',x=>{x.vars.FIRE_STAGING_PRIVATE_ACTIVATION='owner-approved'}));
 attack('enable-stripe-test',d=>j(d,'server/wrangler.json',x=>{x.vars.FIRE_STRIPE_MODE='test'}));
 attack('inject-paid-r2',d=>j(d,'server/wrangler.json',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'unapproved'}]}));
 attack('wrong-d1',d=>j(d,'server/wrangler.json',x=>{x.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'}));
 attack('existing-workers-dev-disabled',d=>j(d,'server/wrangler.json',x=>{x.workers_dev=false}));
 attack('preview-version-url',d=>j(d,'server/wrangler.json',x=>{x.preview_urls=true}));
 attack('extra-secret-var',d=>j(d,'server/wrangler.json',x=>{x.vars.STRIPE_SECRET_KEY='fake'}));
 attack('change-server-byte',d=>{
  const p=join(d,'server/index.js');
  writeFileSync(p,Buffer.concat([readFileSync(p),Buffer.from('\n// unexpected STAGING SSR edit')]));
 });
 attack('change-asset-byte',d=>{
  const r=JSON.parse(readFileSync(join(d,'staging-noassets-dark-source-receipt.json'),'utf8'));
  const p=join(d,'server',r.originalClientAssets[0].module);
  writeFileSync(p,Buffer.concat([readFileSync(p),Buffer.from([0])]));
 });
 attack('remove-private-lock',d=>{
  const p=join(d,'server/fire-staging-noassets-entry.mjs');
  writeFileSync(p,readFileSync(p,'utf8').replace('"blocked"','"owner-approved"').replace('FIRE_STAGING_PRIVATE_ACTIVATION','NOT_THE_REVIEWED_LOCK'));
 });
 attack('unexpected-tool-cache-in-sealed-package',d=>{
  const cache=join(d,'server','.wrangler');
  mkdirSync(cache);
  writeFileSync(join(cache,'unexpected.txt'),'synthetic unwanted cache');
 });
 attack('extra-module',d=>writeFileSync(join(d,'server/unreviewed-extra.mjs'),'export default 1;\n'));
 attack('receipt-deployment-claim',d=>j(d,'staging-noassets-dark-source-receipt.json',x=>{x.deployed=true}));
 attack('other-target-receipt',d=>j(d,'staging-noassets-dark-source-receipt.json',x=>{x.worker='fire-fullapp-dr'}));
 attack('untrusted-asset-manifest',d=>{
  const p=join(d,'server/fire-inline-assets/manifest.mjs');
  writeFileSync(p,readFileSync(p,'utf8').replace('Object.freeze','Object.seal'));
 });
 console.log('PASS '+checks+'/'+checks+' actual compiled STAGING no-R2 Worker-only dark release source checks and deliberate unauthorized billing/asset/SSR/entry/scope tamper refusals. Zero provider calls.');
}finally{rmSync(tmp,{recursive:true,force:true})}
