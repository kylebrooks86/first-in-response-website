import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {createGuardedGate9Transport} from './gate9_cloudflare_guarded_transport.mjs';
import {runApprovedInactiveUpload,uploadApprovalDigest}
  from './gate9_inactive_upload_flow.mjs';
import {PREDECESSOR,DB_UUID,WORKER,ORIGIN,INHERITED,proposedInactivePlan}
  from './gate9_inactive_fullapp_contract.mjs';
const accountId='a'.repeat(32),sourceSha='e'.repeat(40);
const newId='11111111-2222-4333-8444-555555555555';
const vars={FIRE_ACCESS_REQUIRED:'enabled',FIRE_ENV:'cloudflare-staging',
  FIRE_STRIPE_MODE:'disabled',SITE_ORIGIN:ORIGIN};
const oldBindings=INHERITED.map(name=>name==='DB'?
  {name,type:'d1',database_id:DB_UUID}:Object.hasOwn(vars,name)?
  {name,type:'plain_text',text:vars[name]}:{name,type:'secret_text'});
function fixture({deny=false,alterBytes=false,forbiddenLive=false,nullErrors=false,providerError=false}={}){
 const temp=mkdtempSync(join(tmpdir(),'FIRE-GATE9-NO-NET-TRANSPORT-'));
 const clientDir=join(temp,'dist','client');
 mkdirSync(clientDir,{recursive:true});
 writeFileSync(join(clientDir,'index.js'),'export const test = true');
 writeFileSync(join(clientDir,'style.css'),'body { color: purple }');
 const manifest=createLocalAssetManifest(clientDir);
 const modules=[
  {name:'index.js',content_type:'application/javascript+module',
    content_base64:Buffer.from('export default {fetch() {return new Response("TEST_ONLY")}}').toString('base64')},
  {name:'_headers',content_type:'text/plain',
    content_base64:Buffer.from('/*\n  X-FIRE-Test: synthetic').toString('base64')}
 ].sort((a,b)=>a.name.localeCompare(b.name));
 const candidate={sourceSha,manifest,versionBody:{
   main_module:'index.js',compatibility_date:'2026-10-16',
   compatibility_flags:['nodejs_compat'],
   bindings:proposedInactivePlan().bindings,
   assets:{config:{run_worker_first:true}},modules
 }};
 const approval={
   worker:WORKER,predecessor:PREDECESSOR,dbUuid:DB_UUID,accountId,sourceSha,
   candidateDigest:uploadApprovalDigest(candidate),
   operations:'register-assets,upload-assets,create-inactive-version',
   expiresAt:100000
 };
 const events=[],perm=[];
 let uploadCount=0;
 function response(result,status=200){
   return new Response(JSON.stringify({success:true,errors:providerError?[{code:1}]:nullErrors?null:[],result}),{status});
 }
 const tokenProvider=async()=> 'SYNTHETIC_PRIVATE_AUTH_TOKEN_FOR_TESTS_ONLY';
 const fetchImpl=async(url,opts)=>{
   const path=url.replace('https://api.cloudflare.com/client/v4','');
   events.push({path,method:opts.method,contentType:opts.headers?.['Content-Type']??null,
     authType:opts.headers.Authorization==='Bearer SYNTHETIC_PRIVATE_AUTH_TOKEN_FOR_TESTS_ONLY'?'account':
       opts.headers.Authorization==='Bearer SYNTHETIC_ASSET_UPLOAD_JWT_FOR_TESTS_ONLY'?'session':'unknown'});
   assert(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/'));
   assert.equal(opts.redirect,'error');
   if(opts.method==='GET'){
     if(path.endsWith('/deployments'))return response({deployments:[
       {strategy:'percentage',versions:[{version_id:PREDECESSOR,percentage:100}]}]});
     if(path.endsWith('/versions/'+PREDECESSOR))return response({id:PREDECESSOR,bindings:oldBindings});
     if(path.endsWith('/versions/'+newId+'?include=modules')){
       return response({id:newId,bindings:[...oldBindings,{name:'ASSETS',type:'assets'}],
         main_module:'index.js',compatibility_date:'2026-10-16',
         compatibility_flags:['nodejs_compat'],
         assets:{config:{run_worker_first:true}},modules});
     }
     assert.fail('Unexpected GET endpoint');
   }
   if(opts.method!=='POST')assert.fail('Non GET/POST');
   if(path.endsWith('assets-upload-session')){
     assert.equal(events.at(-1).authType,'account');
     const manifestSent=JSON.parse(opts.body).manifest;
     assert.deepEqual(manifestSent,manifest);
     return response({jwt:'SYNTHETIC_ASSET_UPLOAD_JWT_FOR_TESTS_ONLY',
       buckets:Object.values(manifest).map(x=>[x.hash])});
   }
   if(path.endsWith('assets/upload?base64=true')){
     assert.equal(events.at(-1).authType,'session');
     assert.equal(opts.headers['Content-Type'],undefined);
     assert(opts.body instanceof FormData);
     uploadCount++;
     const fields=[...opts.body.entries()];
     assert.equal(fields.length,1);
     const [hash,part]=fields[0];
     const file=await part.text();
     const expectedHash=Object.values(manifest).find(x=>x.hash===hash);
     assert(expectedHash);
     assert(Buffer.from(file,'base64').length>0);
     if(uploadCount===2)return response({jwt:'SYNTHETIC_COMPLETION_JWT_FOR_TESTS_ONLY'},201);
     return response({},200);
   }
   if(path.endsWith('/versions?deploy=false')){
     assert.equal(events.at(-1).authType,'account');
     const body=JSON.parse(opts.body);
     assert.equal(body.modules.length,2);
     assert.equal(body.assets.jwt,'SYNTHETIC_COMPLETION_JWT_FOR_TESTS_ONLY');
     assert.equal(body.bindings.length,10);
     assert.equal(body.deploy,undefined);
     if(forbiddenLive)assert.fail('forbidden test');
     return response({id:newId},201);
   }
   assert.fail('Unapproved provider endpoint');
 };
 const transport=createGuardedGate9Transport({
   accountId,tokenProvider,fetchImpl,clientDir,approvedManifest:manifest,
   permissionGate:async info=>{perm.push(info);return !deny;}
 });
 const cleanup=()=>rmSync(temp,{recursive:true,force:true});
 return {candidate,approval,accountId,transport,perm,events,cleanup,now:()=>1000,clientDir};
}
test('actual GET+three PRIVATE POST types complete with independent READBACK, 100% predecessor',async()=>{
 const x=fixture();
 try{
  const result=await runApprovedInactiveUpload(x);
  assert.equal(result.versionId,newId);
  assert.equal(result.activePredecessor,PREDECESSOR);
  assert.equal(result.activePercentage,100);
  assert.equal(result.newVersionPercentage,0);
  assert.equal(result.assetDeliveryVerified,false);
  assert.equal(result.gate9Accepted,false);
  const writes=x.events.filter(e=>e.method==='POST');
  assert.equal(writes.length,4);
  assert.deepEqual(x.perm.map(p=>p.action),[
    'register-assets','upload-assets','upload-assets','create-inactive-version']);
  assert(x.events.some(e=>e.path.endsWith('?include=modules')));
  assert(!x.events.some(e=>/\/deployments\?/.test(e.path)&&e.method==='POST'));
  assert(!writes.some(e=>/\/(?:database|d1|secrets|deployments)(?:\/|\?|$)/.test(e.path)));
  assert(writes.every(e=>e.path.includes('/workers/')));
 }finally{x.cleanup();}
});
test('private permission refusal blocks ALL POSTs, including asset registration',async()=>{
 const x=fixture({deny:true});
 try{
  await assert.rejects(runApprovedInactiveUpload(x),/REQUEST_UNCERTAIN/);
  assert.equal(x.events.filter(e=>e.method==='POST').length,0);
 }finally{x.cleanup();}
});
test('documented errors:null success responses complete all phases without weakening error rejection',async()=>{
 const x=fixture({nullErrors:true});
 try{
  const result=await runApprovedInactiveUpload(x);
  assert.equal(result.versionId,newId);
  assert.equal(x.events.filter(e=>e.method==='POST').length,4);
 }finally{x.cleanup();}
 const bad=fixture({providerError:true});
 try{
  await assert.rejects(runApprovedInactiveUpload(bad),/STATE_READ_UNVERIFIED/);
  assert.equal(bad.events.filter(e=>e.method==='POST').length,0);
 }finally{bad.cleanup();}
});
test('fake adapter construction has no side effects, and missing approval makes no provider calls',async()=>{
 const x=fixture();
 try{
  const input={...x};delete input.approval;
  await assert.rejects(runApprovedInactiveUpload(input),/APPROVAL/);
  assert.equal(x.events.length,0);
 }finally{x.cleanup();}
});

