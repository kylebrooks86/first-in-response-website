/**
 * Change-scoped Gate9 TEST no-assets-source negative checks.
 * Must consume the actual freshly compiled package, never a mock substitute.
 * No hosted provider, account, token, deployment or real financial write.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {verifyGate9NoAssetsDarkSource} from './prepare_gate9_noassets_dark_source.mjs';
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
const attack=(name,edit,message=/FIRE GATE9 WORKER-ONLY SOURCE BLOCKED/)=>{
 const out=join(tmp,name);cpSync(folder,out,{recursive:true});
 edit(out);
 assert.throws(()=>verifyGate9NoAssetsDarkSource(out),message);checks++;
};
const j=(dir,rel,fn)=>{
 const path=join(dir,rel),v=JSON.parse(readFileSync(path,'utf8'));
 fn(v);writeFileSync(path,JSON.stringify(v,null,2)+'\n');
};
try{
 const configPath='server/wrangler.json';
 const receiptPath='gate9-noassets-dark-source-receipt.json';
 const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
 const sealTool=fileURLToPath(new URL('./seal_gate9_test_inactive_source.py',import.meta.url));
 const validConfig=JSON.parse(readFileSync(join(folder,configPath),'utf8'));
 assert.deepEqual(validConfig.observability,{
  enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}
 });
 checks++;
 for(const [name,mutate] of [
  ['missing-observability',config=>{delete config.observability;}],
  ['invocation-logs-enabled',config=>{config.observability.logs.invocation_logs=true;}],
  ['traces-enabled',config=>{config.observability.traces.enabled=true;}],
 ]){
  const out=join(tmp,name);
  cpSync(folder,out,{recursive:true});
  j(out,configPath,mutate);
  // Recompute the internal inventory so both verifiers must enforce the policy.
  const configBytes=readFileSync(join(out,configPath));
  j(out,receiptPath,receipt=>{
   const row=receipt.savedInventory.find(row=>row.path===configPath);
   row.bytes=configBytes.length;
   row.sha256=sha256(configBytes);
   receipt.savedInventoryDigest=sha256(JSON.stringify(receipt.savedInventory));
  });
  assert.throws(()=>verifyGate9NoAssetsDarkSource(out),/TEST review config differs/);
  const result=spawnSync('python3',[sealTool,'seal',out,
   JSON.parse(readFileSync(join(out,receiptPath),'utf8')).sourceSha,join(tmp,name+'.json')],
   {encoding:'utf8',timeout:10000});
  assert.ifError(result.error);
  assert.equal(result.status,1);
  assert.match(result.stderr,/logs, invocation logs and traces must be explicitly disabled/);
  checks+=2;
 }
 assert.equal(verifyGate9NoAssetsDarkSource(folder,original.receiptSha256).receiptPinVerified,true);
 checks++;
 const rewritten=join(tmp,'rewritten-source-receipt');
 cpSync(folder,rewritten,{recursive:true});
 j(rewritten,'gate9-noassets-dark-source-receipt.json',r=>{r.sourceSha='1'.repeat(40)});
 assert.throws(()=>verifyGate9NoAssetsDarkSource(rewritten,original.receiptSha256),
  /receipt differs from independent SHA256 pin/);
 checks++;
 attack('receipt-path-escape',d=>j(d,'gate9-noassets-dark-source-receipt.json',r=>{
  r.originalServerFiles[0].path='server/../original-compiled-wrangler.json';
 }),/bad original full TEST server manifest/);
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
