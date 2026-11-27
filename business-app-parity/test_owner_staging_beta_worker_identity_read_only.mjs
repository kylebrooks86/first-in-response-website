/** G4 STAGING Worker API name-to-ID fail-closed regressions; offline only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {captureStagingWorkerIdentity,verifyWorkerIdentityResponses}
 from './owner_staging_beta_worker_identity_read_only.mjs';
import {ACCOUNT_ID,TARGETS} from './owner_g4_hosted_binding_names_readonly.mjs';

const WORKER=TARGETS.staging.worker;
const ID='e8f70fdbc8b1fb0b8ddb1af166186758';
const TOKEN='TEST_ONLY_NOT_REAL_CREDENTIAL_0123456789';
const PREFIX='/client/v4/accounts/'+ACCOUNT_ID+'/workers/workers/';
const ok=(data)=>({success:true,errors:[],result:data});
const byName=ok({id:ID,name:WORKER}),byId=ok({id:ID,name:WORKER});
let checks=0;
const check=(f)=>{f();checks++};

check(()=>assert.deepEqual(verifyStagingOffline(),{result:'OFFLINE_NO_PROVIDER',worker:WORKER,
  instructions:'--capture uses an already-available private CLOUDFLARE_API_TOKEN on owner Windows TTY',
  providerContacted:false,gate4Accepted:false}));
function verifyStagingOffline(){
 const file=fileURLToPath(new URL('./owner_staging_beta_worker_identity_read_only.mjs',import.meta.url));
 return JSON.parse(execFileSync(process.execPath,[file],{encoding:'utf8',timeout:10000}));
}
const paths=[];
const capture=await captureStagingWorkerIdentity({token:TOKEN,request:async(_,path)=>{
 paths.push(path);
 return paths.length===1?byName:byId;
}});
check(()=>assert.deepEqual(paths,[PREFIX+WORKER,PREFIX+ID]));
check(()=>assert.equal(capture.worker,WORKER));
check(()=>assert.equal(capture.workerId,ID));
check(()=>assert.equal(capture.accountWorkerIdMappingVerified,true));
check(()=>assert.equal(capture.cloudflareGetRequests,2));
check(()=>assert.equal(capture.providerWrites,false));
check(()=>assert.equal(capture.gate4Accepted,false));
check(()=>assert.equal(capture.directProviderReadback,false));
check(()=>assert.equal(JSON.stringify(capture).includes(TOKEN),false));
const reject=async(a,b)=>{await assert.rejects(captureStagingWorkerIdentity({
 token:TOKEN,request:async(_,path)=>path===PREFIX+WORKER?a:b
}),/STAGING WORKER IDENTITY READ-ONLY STOP/);checks++};
await reject(ok({id:ID,name:'fire-fullapp-dr'}),byId);
await reject(ok({id:'not-id',name:WORKER}),byId);
await reject({success:false,errors:[],result:{id:ID,name:WORKER}},byId);
await reject(byName,ok({id:'f'.repeat(32),name:WORKER}));
await reject(byName,ok({id:ID,name:'fire-fullapp-qa-20261016'}));
await reject(byName,{success:true,errors:[{message:'secret should not print'}],result:{id:ID,name:WORKER}});
await assert.rejects(captureStagingWorkerIdentity({token:'bad',request:async()=>byName}),
  /STAGING WORKER IDENTITY READ-ONLY STOP/);checks++;
await assert.rejects(captureStagingWorkerIdentity({token:TOKEN+' \n',request:async()=>byName}),
  /STAGING WORKER IDENTITY READ-ONLY STOP/);checks++;
await assert.rejects(captureStagingWorkerIdentity({token:TOKEN,request:async()=>{throw Error('secret credentials')}}),
  /secret credentials/);checks++; // API injected request error is caught by CLI; no real provider request made.
check(()=>assert.equal(verifyWorkerIdentityResponses(byName,byId).accountWorkerIdMappingVerified,true));
console.log('PASS '+checks+'/'+checks+' G4 STAGING beta Worker ID mapping offline GET contract; no token/provider writes.');
