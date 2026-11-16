/** New-source only tests: future hosted exact-version proof after authorized
 * existing DARK Worker update. No Cloudflare network and no new deploy. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {TARGETS} from './owner_existing_dark_code_update_once_approved.mjs';
import {verifyExistingDarkPostUpdate} from './owner_existing_dark_code_update_postdeploy_readonly.mjs';
const newVersion='76f843d3-3e7d-4bee-9111-6fd701faf995';
const old=TARGETS.dr.previousVersion;
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const json=o=>({code:0,stdout:JSON.stringify(o),stderr:''});
let total=0;
const pass=(condition,why)=>{assert.ok(condition,why);total++};
const refuse=(fn,why)=>{assert.throws(fn,/FIRE EXISTING DARK POSTUPDATE READBACK STOP|FIRE CURRENT DARK HOSTED READBACK STOP|FIRE OWNER FIRST-CREATE EVIDENCE BLOCKED/,why);total++};
function fixture(target,modify=()=>{}){
 const spec=TARGETS[target];
 const vars={FIRE_ENV:spec.env,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip',
  SITE_ORIGIN:'https://'+spec.name+'.kyle-bfc.workers.dev',[spec.auth]:'blocked'};
 const payload={
  whoami:{loggedIn:true,accounts:[{id:ACCOUNT}]},
  d1Info:{name:spec.db,uuid:spec.uuid},
  versionsList:{versions:[{id:spec.previousVersion},{id:newVersion}]},
  deploymentStatus:{name:spec.name,versions:[{version_id:newVersion,percentage:100}]},
  versionDetail:{id:newVersion,name:spec.name,
   resources:{bindings:[{name:'DB',type:'d1',id:spec.uuid},
    ...Object.entries(vars).map(([name,text])=>({name,type:'plain_text',text}))]}},
  d1List:[{name:spec.db,uuid:spec.uuid}]
 };
 modify(payload);
 return Object.fromEntries(Object.entries(payload).map(([k,v])=>[k,json(v)]));
}
for(const target of ['dr','new-live']){
 const good=verifyExistingDarkPostUpdate(target,newVersion,fixture(target));
 pass(good.newServingVersion===newVersion&&good.oldPredecessorVersion===TARGETS[target].previousVersion&&
  good.physicalD1Uuid===TARGETS[target].uuid&&good.hostedDarkAuthenticationVariablesVerified&&
  good.hostedNoR2OrExtraResourceBindingsVerified,
  target+' new 100-percent serving version correct independent D1 and dark bindings');
 pass(good.hostedSourceBytesVerified===false&&good.actualWorkerSourceShaVerified===false&&
  good.productionReady===false&&good.releaseOrGate4Accepted===false&&
  good.providerWritePerformedByVerifier===false,
  target+' metadata readback NEVER claims immutable code-byte proof, release or writes');
 refuse(()=>verifyExistingDarkPostUpdate(target,TARGETS[target].previousVersion,
   fixture(target)),target+' old predecessor is never accepted as new source');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.deploymentStatus.versions[0].version_id=TARGETS[target].previousVersion;
 })),target+' old hosted version still serving');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.versionDetail.resources.bindings[0].id=
   TARGETS[target==='dr'?'new-live':'dr'].uuid;
 })),target+' wrong target D1 refused');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.versionDetail.resources.bindings.push({name:'BUCKET',type:'r2_bucket'});
 })),target+' unapproved R2 refused');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.versionDetail.resources.bindings.find(b=>b.name===TARGETS[target].auth).text='owner-approved';
 })),target+' login unexpectedly activated refused');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.deploymentStatus.versions.push({version_id:TARGETS[target].previousVersion,percentage:0});
 })),target+' multi-version rollout refused');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.versionDetail.id=TARGETS[target].previousVersion;
 })),target+' inspected version differs from exact serving version');
 refuse(()=>verifyExistingDarkPostUpdate(target,newVersion,fixture(target,p=>{
  p.whoami.accounts=[{id:'bfc00939cfb2f8dfd8581a7a7f5f1308'}];
 })),target+' wrong Cloudflare account rejected');
}
refuse(()=>verifyExistingDarkPostUpdate('qa',newVersion,fixture('dr')),
 'QA environment cannot be used for dark release');
refuse(()=>verifyExistingDarkPostUpdate('dr','invalid',fixture('dr')),
 'unrecognized version rejected before parsing');
const script=fileURLToPath(new URL('./owner_existing_dark_code_update_postdeploy_readonly.mjs',import.meta.url));
const source=readFileSync(script,'utf8');
pass(!source.includes("['deploy'")&&!source.includes("['d1','execute'")&&
  source.includes("['deployments','status'")&&source.includes("'--no-install','wrangler@4.162.0'"),
 'only named metadata calls and installed pinned Wrangler; no upload, SQL or auto-install');
const unsafe=spawnSync(process.execPath,[script,'--capture','dr',newVersion],{
 encoding:'utf8',env:{...process.env,CI:'true',GITHUB_ACTIONS:'true'}
});
pass(unsafe.status!==0&&/owner Acer authenticated interactive session/.test(unsafe.stderr),
 'no CI/non-Windows capture, credentials or provider contact');
const preview=spawnSync(process.execPath,[script,'inspect','dr',newVersion],{
 encoding:'utf8',env:{...process.env,CI:'true'}
});
pass(preview.status===0&&JSON.parse(preview.stdout).providerContacted===false,
 'local inspect is read-only and never claims remote evidence');
console.log('PASS '+total+'/'+total+' focused NEW-VERSION dark Worker post-update metadata safety (synthetic, offline, NO provider).');
