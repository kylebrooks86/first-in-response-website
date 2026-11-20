/** Focused offline CLI tests, synthetic D1 identifiers only. No provider calls. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const folder=mkdtempSync(join(tmpdir(),'fire-pair-'));
const script=resolve('business-app-parity/review_new_independent_release_pair.mjs');
const placeholder='00000000-0000-4000-8000-000000000000';
// Existing owner-recorded DR resource, NOT fresh provider verification.
const drId='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const liveId='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const source=(name,db,environment,prefix,origin)=>({
 name,workers_dev:true,
 vars:{FIRE_ENV:environment,SITE_ORIGIN:origin,[prefix+'_AUTH_ENABLED']:'blocked'},
 secrets:{required:[prefix+'_PASSWORD_HASH',prefix+'_SESSION_SECRET']},
 d1_databases:[{binding:'DB',database_name:db,database_id:placeholder}],
 r2_buckets:[]
});
const drSource=source('fire-fullapp-dr','fire-fullapp-dr-db','isolated-dr','FIRE_DR',
 'https://fire-fullapp-dr.kyle-bfc.workers.dev');
const liveSource=source('fire-fullapp-new-live','fire-fullapp-new-live-db','new-live-prelaunch',
 'FIRE_NEW_LIVE','https://fire-fullapp-new-live.kyle-bfc.workers.dev');
const drPath=join(folder,'dr.json'),livePath=join(folder,'live.json');
const normalEnv={
 FIRE_RELEASE_DR_D1_UUID:drId,FIRE_RELEASE_NEW_LIVE_D1_UUID:liveId,
 FIRE_RELEASE_PHOTO_STORAGE_MODE:'owner-device-zip',
 FIRE_RELEASE_DR_RESOURCE_ATTESTATION:'owner-checked-independent-dr',
 FIRE_RELEASE_NEW_LIVE_RESOURCE_ATTESTATION:'owner-checked-independent-live'
};
let count=0;
const expect=(ok,why)=>{assert(ok,why);count++;};
const call=(changes={},files=[drPath,livePath])=>{
 // Clear inherited optional controls first so unrelated CI env cannot
 // silently alter what this regression intends to test.
 const env={...process.env};
 for(const name of ['FIRE_RELEASE_R2_BUCKET','FIRE_RELEASE_ENABLE_AUTH',
   'FIRE_RELEASE_QUICK_AUTH_MODE',...Object.keys(normalEnv)])delete env[name];
 Object.assign(env,normalEnv,changes);
 for(const [key,value] of Object.entries(env))if(value===undefined)delete env[key];
 return spawnSync(process.execPath,[script,...files],{env,encoding:'utf8',timeout:15000});
};
try{
 writeFileSync(drPath,JSON.stringify(drSource));writeFileSync(livePath,JSON.stringify(liveSource));
 const pass=call();
 expect(pass.status===0,'valid offline pair should pass: '+pass.stderr);
 const summary=JSON.parse(pass.stdout);
 expect(summary.pairSourceChecked===true,'pair proof flag is explicit');
 expect(summary.providerResourcesIndependentlyVerified===false,'never imply provider-attested binding');
 expect(summary.isolatedRestoreVerified===false,'never imply physical restore');
 expect(summary.ownerApprovedDeployment===false,'never imply release consent');
 expect(call({FIRE_RELEASE_NEW_LIVE_D1_UUID:drId}).status!==0,'shared physical UUID rejected');
 expect(call({FIRE_RELEASE_NEW_LIVE_D1_UUID:placeholder}).status!==0,'placeholder rejected');
 expect(call({FIRE_RELEASE_NEW_LIVE_D1_UUID:'54a5e470-2ae3-471b-a2db-ea8bdf092514'}).status!==0,
  'unknown NEW LIVE D1 must not replace owner-created resource');
 expect(call({FIRE_RELEASE_DR_D1_UUID:'54a5e470-2ae3-471b-a2db-ea8bdf092513'}).status!==0,
  'unknown DR UUID must not replace existing DR resource');
 expect(call({FIRE_RELEASE_DR_D1_UUID:'8ccfb1f8-1657-4074-b1b2-47de78f95003'}).status!==0,
  'existing QA physical UUID rejected');
 expect(call({FIRE_RELEASE_PHOTO_STORAGE_MODE:'r2'}).status!==0,'R2 mode rejected');
 expect(call({FIRE_RELEASE_R2_BUCKET:'unapproved'}).status!==0,'R2 bucket rejected');
 expect(call({FIRE_RELEASE_R2_BUCKET:''}).status!==0,'even empty R2 subscription input rejected');
 expect(call({FIRE_RELEASE_ENABLE_AUTH:'yes'}).status!==0,'unreviewed auth activation rejected');
 expect(call({FIRE_RELEASE_NEW_LIVE_RESOURCE_ATTESTATION:''}).status!==0,
  'owner resource identity review cannot be skipped');
 expect(call({},[drPath,drPath]).status!==0,'one file cannot masquerade as independent pair');
 writeFileSync(livePath,JSON.stringify({...liveSource,kv_namespaces:[{binding:'PHOTOS',id:'unapproved'}]}));
 expect(call().status!==0,'hidden extra storage binding rejected');
 console.log('PASS '+count+'/'+count+' offline dual-environment pairing CLI tests; no provider writes');
}finally{rmSync(folder,{recursive:true,force:true});}
