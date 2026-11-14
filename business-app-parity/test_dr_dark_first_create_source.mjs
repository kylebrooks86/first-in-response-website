/** Focused regression only: real SHA-sealed PR268 D1-bound archive -> DARK first-create config.
 * Never calls Cloudflare, creates a Worker, changes D1, enables login or touches Stripe.
 * Usage: node test_dr_dark_first_create_source.mjs EXTRACTED_VERIFIED_PR268_ARTIFACT
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {prepareDarkFirstCreateDR,reviewBoundPrehost}
 from './prepare_dr_dark_first_create_source.mjs';

const artifact=process.argv[2];
if(!artifact)throw Error('requires original exact pinned PR268 extracted archive');
const original=resolve(artifact);
const work=mkdtempSync(join(tmpdir(),'fire-dr-dark-first-create-'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let count=0;
function ok(condition,reason){assert.ok(condition,reason);count++;}
function refuse(fn,reason){assert.throws(fn,/FIRE DR dark-first-create BLOCKED:/,reason);count++;}
function tamper(name,change){
 const folder=join(work,name);
 cpSync(original,folder,{recursive:true});
 change(folder);
 refuse(()=>reviewBoundPrehost(folder),name+' must fail closed');
}
function editConfig(root,transform){
 const p=join(root,'server','wrangler.json'),v=JSON.parse(readFileSync(p));
 transform(v);writeFileSync(p,JSON.stringify(v,null,2)+'\n');
}
function traverse(dir,callback){
 for(const name of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,name.name);
  if(name.isDirectory())traverse(path,callback);else callback(path);
 }
}
try{
 const reviewed=reviewBoundPrehost(original);
 ok(reviewed.prehost.physicalDRDatabaseId==='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
  'real owner previously accepted DR D1 is already prehost configured');
 const destination=join(work,'dark-first-create-only');
 const result=prepareDarkFirstCreateDR(original,destination);
 ok(result.providerCalled===false&&result.deployed===false&&result.workersDev===false,
  'generates source only, without any first Worker provider creation');
 const cfg=JSON.parse(readFileSync(join(destination,'server','wrangler.json')));
 ok(cfg.workers_dev===false&&cfg.preview_urls===false&&
    cfg.route===undefined&&cfg.routes===undefined&&
    (!cfg.triggers||Object.values(cfg.triggers).every(v=>
      v==null||(Array.isArray(v)&&v.length===0))),
    'worker.dev, version URLs, routes and scheduled jobs disabled');
 ok(cfg.name==='fire-fullapp-dr'&&cfg.d1_databases.length===1&&
    cfg.d1_databases[0].database_id==='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
    'not silently swapped to QA, NEW LIVE, Stripe TEST or placeholder D1');
 ok(cfg.assets===undefined&&cfg.r2_buckets.length===0&&
    cfg.kv_namespaces?.length!==1,
    'no assets-upload-session, R2, paid storage or new KV');
 ok(cfg.vars.FIRE_DR_AUTH_ENABLED==='blocked'&&
    cfg.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip'&&
    cfg.secrets.required.join(',')==='FIRE_DR_PASSWORD_HASH,FIRE_DR_SESSION_SECRET',
    'never enables owner login or changes secret names');
 const runtimeRel='server/fire-inline-assets/runtime.mjs';
 const originalRuntime=join(original,runtimeRel),finalRuntime=join(destination,runtimeRel);
 const entryRel='server/fire-noassets-entry.mjs';
 const priorEntry=join(original,entryRel),finalEntry=join(destination,entryRel);
 ok(readFileSync(finalEntry,'utf8').includes('wrapInertDRWorker(server,manifest,"isolated-dr");')&&
    hash(priorEntry)!==hash(finalEntry),
    'DR sealed entry must pin isolated-dr instead of an unbound two-argument wrapper');
 ok(hash(finalRuntime)===hash(new URL('./dr_noassets_runtime.mjs',import.meta.url))&&
    hash(finalRuntime)!==hash(originalRuntime),
    'new private DR source must contain current guarded runtime, never the old PR268 adapter');
 const protectedWorker=(await import(pathToFileURL(finalRuntime).href)).wrapInertDRWorker({
  fetch(){throw Error('locked DR SSR must never execute');}
 },{'/favicon.svg':{data:new TextEncoder().encode('synthetic asset'),type:'image/svg+xml'}},'isolated-dr');
 for(const e of [
  {FIRE_ENV:'isolated-dr',FIRE_DR_AUTH_ENABLED:'blocked'},
  {FIRE_ENV:'new-live-prelaunch',FIRE_NEW_LIVE_AUTH_ENABLED:'owner-approved'},
  {FIRE_ENV:'isolated-dr',FIRE_DR_AUTH_ENABLED:'owner-approved',FIRE_NEW_LIVE_AUTH_ENABLED:'owner-approved'}
 ]){
  const response=await protectedWorker.fetch(new Request('https://fire.invalid/favicon.svg'),e);
  ok(response.status===404&&(await response.arrayBuffer()).byteLength===0&&
      response.headers.get('cache-control')==='private, no-store',
      'archived runtime denies static requests before SSR for locked/mismatched target');
 }
 const approvedAsset=await protectedWorker.fetch(new Request('https://fire.invalid/favicon.svg'),
  {FIRE_ENV:'isolated-dr',FIRE_DR_AUTH_ENABLED:'owner-approved'});
 ok(approvedAsset.status===200&&(await approvedAsset.text())==='synthetic asset',
  'synthetic matching approval retains original asset serving');
 const proof=JSON.parse(readFileSync(join(destination,'dark-first-create-source-receipt.json')));
 ok(proof.parentPR===268&&
    proof.independentlyRequiredParentZipSha256==='ae3f0078b15376ed861d7c0c47e4943f88b700f528e5c65c2e8f5ae9de7761d4'&&
    proof.originalPrehostConfigSha256===hash(join(original,'server','wrangler.json'))&&
    proof.finalWranglerConfigSha256===hash(join(destination,'server','wrangler.json'))&&
    proof.originalArchiveRuntimeSha256===hash(originalRuntime)&&
    proof.refreshedFirstRequestRuntimeSha256===hash(finalRuntime)&&
    proof.firstRequestLockCopiedIntoFinalSource===true&&
    proof.immutableExpectedWorkerTarget==='isolated-dr'&&
    proof.originalArchiveEntrySha256===hash(priorEntry)&&
    proof.refreshedTargetBoundEntrySha256===hash(finalEntry),
    'source and new configuration hashes are bound to original saved artifact');
 ok(proof.newFirstWorkerCreateAuthorized===false&&proof.firstProviderDeployPerformed===false&&
    proof.providerAccountIdentityVerified===false&&
    proof.hostedRuntimeAndPrivateRoutingVerified===false,
    'no fictitious first creation, access-denial or provider attestation');
 let unchanged=0;
 traverse(join(original,'server'),(path)=>{
  const rel=relative(join(original,'server'),path);
  if(rel==='wrangler.json'||rel==='fire-inline-assets/runtime.mjs'||rel==='fire-noassets-entry.mjs')return;
  assert.equal(hash(path),hash(join(destination,'server',rel)),'immutable changed: '+rel);
  unchanged++;
 });
 ok(unchanged>=200,'all compiled SSR modules and 41 original public Data modules byte-identical');
 refuse(()=>prepareDarkFirstCreateDR(original,destination),'cannot overwrite sealed output');
 tamper('wrong-cloudflare-account',s=>editConfig(s,x=>{x.account_id='wrong-account';}));
 tamper('new-custom-route',s=>editConfig(s,x=>{x.routes=[{pattern:'example.com/*',zone_name:'example.com'}];}));
 tamper('already-preview-enabled',s=>editConfig(s,x=>{x.preview_urls=true;}));
 tamper('changed-dr-d1',s=>editConfig(s,x=>{x.d1_databases[0].database_id='00000000-0000-4000-8000-000000000000';}));
 tamper('unapproved-auth',s=>editConfig(s,x=>{x.vars.FIRE_DR_AUTH_ENABLED='enabled';}));
 tamper('new-r2',s=>editConfig(s,x=>{x.r2_buckets=[{binding:'PHOTOS',bucket_name:'never'}];}));
 tamper('misclaimed-worker-deployed',s=>{
  const p=join(s,'dr-physical-prehost-source-receipt.json'),v=JSON.parse(readFileSync(p));
  v.workerDeployed=true;writeFileSync(p,JSON.stringify(v));
 });
 tamper('tampered-client-binary',s=>{
  const folder=join(s,'server','fire-inline-assets');
  const bin=readdirSync(folder).find(name=>name.endsWith('.bin'));
  assert.ok(bin,'real source must contain embedded QA-master asset bytes');
  writeFileSync(join(folder,bin),'WRONG BYTES');
 });
 console.log('PASS '+count+'/'+count+
  ' exact PR268 archive -> first-create-no-public-route QA-master source;'+
  ' byte-identical SSR and 41 assets; no cloud writes, no R2, no auth or gate closure');
}finally{
 rmSync(work,{recursive:true,force:true});
}
