/**
 * Change-scoped Gate9 TEST no-assets-source negative checks.
 * Must consume the actual freshly compiled package, never a mock substitute.
 * No hosted provider, account, token, deployment or real financial write.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyGate9NoAssetsDarkSource} from './prepare_gate9_noassets_dark_source.mjs';
const fail=fn=>assert.throws(fn,/FIRE GATE9 WORKER-ONLY SOURCE BLOCKED/);
const folder=process.argv[2];
if(!folder||process.argv.length!==3)throw Error('usage: SOURCE_ONLY_CURRENT_TEST_PACKAGE');
const original=verifyGate9NoAssetsDarkSource(folder);
assert.equal(original.status,'GATE9_WORKER_ONLY_DARK_SOURCE_VERIFIED');
assert.equal(original.worker,'fire-stripe-test-20261101');
assert.equal(original.providerContacted,false);
assert.equal(original.deployed,false);
assert.equal(original.currentHostedPredecessorReplaced,false);
assert.equal(original.stripeMode,'disabled');
assert.ok(original.clientAssets>=30&&original.serverModules>=80);
const tmp=mkdtempSync(join(tmpdir(),'fire-test-gate9-noassets-'));
let checks=7;
const attack=(name,edit)=>{
 const out=join(tmp,name);cpSync(folder,out,{recursive:true});
 edit(out);
 fail(()=>verifyGate9NoAssetsDarkSource(out));checks++;
};
const j=(dir,rel,fn)=>{
 const path=join(dir,rel),v=JSON.parse(readFileSync(path,'utf8'));
 fn(v);writeFileSync(path,JSON.stringify(v,null,2)+'\n');
};
try{
 attack('activate-test-auth',d=>j(d,'server/wrangler.json',x=>{x.vars.FIRE_GATE9_PRIVATE_ACTIVATION='owner-approved'}));
 attack('enable-stripe-test',d=>j(d,'server/wrangler.json',x=>{x.vars.FIRE_STRIPE_MODE='test'}));
 attack('inject-paid-r2',d=>j(d,'server/wrangler.json',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'unapproved'}]}));
 attack('wrong-d1',d=>j(d,'server/wrangler.json',x=>{x.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'}));
 attack('public-worker',d=>j(d,'server/wrangler.json',x=>{x.workers_dev=true}));
 attack('preview-version-url',d=>j(d,'server/wrangler.json',x=>{x.preview_urls=true}));
 attack('extra-secret-var',d=>j(d,'server/wrangler.json',x=>{x.vars.STRIPE_SECRET_KEY='fake'}));
 attack('change-server-byte',d=>{
  const p=join(d,'server/index.js');
  writeFileSync(p,Buffer.concat([readFileSync(p),Buffer.from('\n// unexpected TEST SSR edit')]));
 });
 attack('change-asset-byte',d=>{
  const r=JSON.parse(readFileSync(join(d,'gate9-noassets-dark-source-receipt.json'),'utf8'));
  const p=join(d,'server',r.originalClientAssets[0].module);
  writeFileSync(p,Buffer.concat([readFileSync(p),Buffer.from([0])]));
 });
 attack('remove-private-lock',d=>{
  const p=join(d,'server/fire-gate9-noassets-entry.mjs');
  writeFileSync(p,readFileSync(p,'utf8').replace('"blocked"','"owner-approved"').replace('FIRE_GATE9_PRIVATE_ACTIVATION','NOT_THE_REVIEWED_LOCK'));
 });
 attack('extra-module',d=>writeFileSync(join(d,'server/unreviewed-extra.mjs'),'export default 1;\n'));
 attack('receipt-deployment-claim',d=>j(d,'gate9-noassets-dark-source-receipt.json',x=>{x.deployed=true}));
 attack('other-target-receipt',d=>j(d,'gate9-noassets-dark-source-receipt.json',x=>{x.worker='fire-fullapp-dr'}));
 attack('untrusted-asset-manifest',d=>{
  const p=join(d,'server/fire-inline-assets/manifest.mjs');
  writeFileSync(p,readFileSync(p,'utf8').replace('Object.freeze','Object.seal'));
 });
 console.log('PASS '+checks+'/'+checks+' actual compiled TEST no-R2 Worker-only dark release source checks and deliberate unauthorized billing/asset/SSR/entry/scope tamper refusals. Zero provider calls.');
}finally{rmSync(tmp,{recursive:true,force:true})}
