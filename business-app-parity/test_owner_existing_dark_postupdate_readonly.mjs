/** Targeted OFFLINE tests — no provider, accounts, customer rows or real locks. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TARGETS} from './owner_existing_dark_code_update_once_approved.mjs';
import {verifyExistingDarkAttempt,verifyExistingDarkPostUpdate}
 from './owner_existing_dark_postupdate_readonly.mjs';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const NEW='e72d51f7-8ad7-4549-942f-f3751022145b';
const OTHER='6a713ebb-1fab-4d41-b0b1-5a4e4a55f168';
const json=o=>({code:0,stdout:JSON.stringify(o),stderr:''});
const lock=target=>({
 action:'EXISTING_DARK_WORKER_CODE_UPDATE_ONLY',target,
 worker:TARGETS[target].name,
 predecessorVersion:TARGETS[target].previousVersion,
 physicalD1:TARGETS[target].uuid,
 sourceSha:'15bd714c435a585f695ed7166cf06d2c31ea1a8e',
 reviewedZipSha256:TARGETS[target].sha,
 status:'UNKNOWN_IF_INTERRUPTED_NO_RETRY',
 timeUtc:'2026-11-16T17:00:00.000Z'
});
const replies=(target,version=NEW)=>{
 const s=TARGETS[target];
 const vars={FIRE_ENV:s.env,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip',
  SITE_ORIGIN:'https://'+s.name+'.kyle-bfc.workers.dev',[s.auth]:'blocked'};
 return {
  whoami:json({loggedIn:true,accounts:[{id:ACCOUNT}]}),
  d1Info:json({name:s.db,uuid:s.uuid}),
  versionsList:json({versions:[{id:s.previousVersion},{id:version}]}),
  deploymentStatus:json({name:s.name,versions:[{version_id:version,percentage:100}]}),
  versionDetail:json({id:version,name:s.name,resources:{bindings:[
   {name:'DB',type:'d1',id:s.uuid},
   ...Object.entries(vars).map(([name,text])=>({name,type:'plain_text',text}))
  ]}}),
  d1List:json([{name:s.db,uuid:s.uuid}])
 };
};
let total=0;
const good=(fn,label)=>{assert.ok(fn(),label);total++;};
const deny=(fn,label)=>{
 assert.throws(fn,/FIRE DARK POSTUPDATE READONLY STOP|FIRE CURRENT DARK HOSTED READBACK STOP|FIRE OWNER FIRST-CREATE EVIDENCE BLOCKED/,label);
 total++;
};
const changed=(target,modify)=>{
 const source=replies(target);
 const raw=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,JSON.parse(v.stdout)]));
 modify(raw);
 return Object.fromEntries(Object.entries(source).map(([k,v])=>
  [k,{...v,stdout:JSON.stringify(raw[k])}]));
};
for(const target of ['dr','new-live']){
 good(()=>verifyExistingDarkAttempt(target,lock(target)).validExistingWorkerAttempt,
  target+' exact original physical source/lock matches');
 const verified=verifyExistingDarkPostUpdate(target,lock(target),replies(target),NEW);
 good(()=>verified.actualHostedNewVersionObserved&&verified.expectedNewVersionMatched&&
  verified.physicalD1Uuid===TARGETS[target].uuid&&
  verified.productionReady===false&&verified.gate4Accepted===false&&
  verified.hostedCompiledSourceBytesCryptographicallyVerified===false,
  target+' source-attribution strictly limited even with expected provider version');
 const pending=verifyExistingDarkPostUpdate(target,lock(target),
  replies(target,TARGETS[target].previousVersion));
 good(()=>pending.result==='FIRE_DARK_POSTUPDATE_PREDECESSOR_STILL_SERVING'&&
  pending.actualHostedNewVersionObserved===false&&
  pending.gate4Accepted===false,
  target+' predecessor still serving is not claimed updated');
 const unattributed=verifyExistingDarkPostUpdate(target,lock(target),replies(target));
 good(()=>unattributed.result==='FIRE_DARK_POSTUPDATE_UNATTRIBUTED_VERSION_CHANGE'&&
  unattributed.expectedNewVersionMatched===false,
  target+' changed remote version without original CLI ID is not falsely attributed');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),replies(target),OTHER),
  target+' mismatched expected new version refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  replies(target),TARGETS[target].previousVersion),
  target+' old predecessor cannot be new target');
 deny(()=>verifyExistingDarkAttempt(target,{...lock(target),status:'DONE'}),
  target+' fabricated successful lock refused');
 deny(()=>verifyExistingDarkAttempt(target,{...lock(target),
  sourceSha:'0'.repeat(40)}),target+' wrong exact QA source refused');
 deny(()=>verifyExistingDarkAttempt(target,{...lock(target),
  physicalD1:TARGETS[target==='dr'?'new-live':'dr'].uuid}),
  target+' shared/opposite D1 refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  changed(target,x=>{x.versionDetail.resources.bindings.push({name:'BUCKET',type:'r2_bucket'});}),NEW),
  target+' unapproved R2 binding refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  changed(target,x=>{x.versionDetail.resources.bindings.find(b=>b.name===TARGETS[target].auth).text='owner-approved';}),NEW),
  target+' accidentally enabled login refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  changed(target,x=>{x.whoami.loggedIn=false;}),NEW),
  target+' unsigned account evidence refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  changed(target,x=>{x.deploymentStatus.versions[0].percentage=95;}),NEW),
  target+' partial traffic refused');
 deny(()=>verifyExistingDarkPostUpdate(target,lock(target),
  changed(target,x=>{x.d1List[0].uuid=TARGETS[target==='dr'?'new-live':'dr'].uuid;}),NEW),
  target+' wrong physical D1 inventory refused');
}
const script=fileURLToPath(new URL('./owner_existing_dark_postupdate_readonly.mjs',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,[script,...args],{
 encoding:'utf8',env:{...process.env,CI:'true',GITHUB_ACTIONS:'true'}
});
const safe=run('inspect','dr');
good(()=>safe.status===0&&JSON.parse(safe.stdout).providerContacted===false,
 'default inspection is offline, no Cloudflare calls');
const ci=run('--capture','dr',NEW);
good(()=>ci.status!==0&&/only existing authenticated owner Acer Windows/.test(ci.stderr),
 'CI cannot capture owner hosted provider evidence even with target version');
const reconcile=run('--reconcile','new-live');
good(()=>reconcile.status!==0&&/only existing authenticated owner Acer Windows/.test(reconcile.stderr),
 'CI cannot reconcile an uncertain upload or sidestep owner lock');
const invalid=run('--capture','dr','not-a-version');
good(()=>invalid.status!==0&&/usage:/.test(invalid.stderr),
 'malformed version IDs are rejected without provider calls');
console.log('PASS '+total+'/'+total+' new DARK postupdate read-only result/uncertainty/safety cases — no provider.');
