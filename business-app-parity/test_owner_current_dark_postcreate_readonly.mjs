/** Focused offline proofs for CURRENT DR + NEW LIVE hosted attestation.
 * All Wrangler outputs are SYNTHETIC; no provider, login, filesystem or SQL.
 */
import assert from 'node:assert/strict';
import {verifyCurrentDarkHostedEvidence,TARGETS}
 from './owner_current_dark_postcreate_readonly.mjs';

const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const VERSION='b7c42773-5a93-4c6c-91d2-83cdb8e857d9';
const OTHER='e72d51f7-8ad7-4549-942f-f3751022145b';
const json=o=>({code:0,stdout:JSON.stringify(o),stderr:''});
const fixture=(target='dr')=>{
 const s=TARGETS[target];
 const vars={FIRE_ENV:s.env,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip',
  SITE_ORIGIN:'https://'+s.worker+'.kyle-bfc.workers.dev',[s.auth]:'blocked'};
 const bindings=[
  {name:'DB',type:'d1',id:s.uuid},
  ...Object.entries(vars).map(([name,text])=>({name,type:'plain_text',text}))
 ];
 return {
  whoami:json({loggedIn:true,accounts:[{id:ACCOUNT}]}),
  d1Info:json({name:s.db,uuid:s.uuid}),
  versionsList:json({versions:[{id:VERSION}]}),
  deploymentStatus:json({name:s.worker,versions:[{version_id:VERSION,percentage:100}]}),
  versionDetail:json({id:VERSION,name:s.worker,resources:{bindings}}),
  d1List:json([{name:s.db,uuid:s.uuid}])
 };
};
let count=0;
const good=(target,replies,label)=>{
 const result=verifyCurrentDarkHostedEvidence(target,replies);
 assert.equal(result.identityAndPhysicalBindingProviderReadbackVerified,true,label);
 assert.equal(result.productionReady,false,label);
 assert.equal(result.gate4Accepted,false,label);
 assert.equal(result.hostedSourceBytesVerified,false,label);
 count++;
};
const blocked=(target,replies,label)=>{
 assert.throws(()=>verifyCurrentDarkHostedEvidence(target,replies),
  /FIRE CURRENT DARK HOSTED READBACK STOP|FIRE OWNER FIRST-CREATE EVIDENCE BLOCKED/,label);
 count++;
};
const change=(target,fn)=>{
 const f=fixture(target),raw=Object.fromEntries(Object.entries(f)
  .map(([k,v])=>[k,JSON.parse(v.stdout)]));
 fn(raw);
 return Object.fromEntries(Object.entries(f).map(([k,v])=>[k,{...v,stdout:JSON.stringify(raw[k])}]));
};
good('dr',fixture('dr'),'DR actual hosted identity and bound D1');
good('new-live',fixture('new-live'),'NEW LIVE hosted identity and bound D1');
good('dr',change('dr',x=>{x.versionDetail.bindings=x.versionDetail.resources.bindings;
 delete x.versionDetail.resources;}),'root binding form also supported');
good('dr',change('dr',x=>{x.versionDetail.resources.bindings[0].type='d1_database';}),
 'D1 provider type variant');
good('dr',change('dr',x=>{x.versionDetail.resources.bindings[0].database_id=TARGETS.dr.uuid;}),
 'consistent D1 binding aliases');
blocked('unexpected',fixture('dr'),'unreviewed target');
blocked('dr',null,'missing provider replies');
blocked('dr',change('dr',x=>{x.whoami.loggedIn=false;}),'signed-out is not proof');
blocked('dr',change('dr',x=>{x.whoami.accounts=[{id:'bfc00939cfb2f8dfd8581a7a7f5f1308'}];}),'wrong account');
blocked('dr',change('dr',x=>{x.d1Info.uuid=TARGETS['new-live'].uuid;}),'opposite D1 info');
blocked('dr',change('dr',x=>{x.d1Info.id=TARGETS['new-live'].uuid;}),'contradictory D1 alias');
blocked('dr',change('dr',x=>{x.versionsList.versions=[];}),'missing version list');
blocked('dr',change('dr',x=>{x.versionsList.versions=[{id:OTHER}];}),'deployment missing from list');
blocked('dr',change('dr',x=>{x.versionsList.versions.push({id:VERSION});}),'duplicate version identity');
blocked('dr',change('dr',x=>{x.deploymentStatus.versions=[];}),'no serving deployment');
blocked('dr',change('dr',x=>{x.deploymentStatus.versions.push({version_id:OTHER,percentage:0});}),'multi-version rollout');
blocked('dr',change('dr',x=>{x.deploymentStatus.versions[0].percentage=90;}),'partially deployed');
blocked('dr',change('dr',x=>{x.deploymentStatus.versions[0].version_id=OTHER;}),'unlisted active deployment');
blocked('dr',change('dr',x=>{x.deploymentStatus.name='other-worker';}),'wrong deployed Worker');
blocked('dr',change('dr',x=>{x.versionDetail.id=OTHER;}),'wrong version detail identity');
blocked('dr',change('dr',x=>{x.versionDetail.version_id=OTHER;}),'contradictory version detail ID');
blocked('dr',change('dr',x=>{x.versionDetail.name='wrong';}),'version detail wrong Worker');
blocked('dr',change('dr',x=>{x.versionDetail.bindings=x.versionDetail.resources.bindings;}),'ambiguous two binding locations');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings.pop();}),'missing target runtime flag');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[0].id=TARGETS['new-live'].uuid;}),'cross-target hosted D1');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[0].database_id=TARGETS['new-live'].uuid;}),'contradictory hosted D1');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[0].type='kv_namespace';}),'unauthorized KV instead of D1');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[1].text='new-live-prelaunch';}),'incorrect target runtime');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[4].text='enabled';}),'owner login enabled unexpectedly');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[2].type='secret_text';}),'secret in dark version');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[4].name='FIRE_STRIPE_MODE';}),'unreviewed Stripe binding');
blocked('dr',change('dr',x=>{x.versionDetail.resources.bindings[4].name='DB';}),'duplicate binding');
blocked('dr',change('dr',x=>{x.d1List=[];}),'missing mapped physical DB inventory');
blocked('dr',change('dr',x=>{x.d1List[0].uuid=TARGETS['new-live'].uuid;}),'wrong inventory UUID');
blocked('dr',change('dr',x=>{x.d1List.push({name:TARGETS.dr.db,uuid:TARGETS.dr.uuid});}),'duplicate D1 name');
blocked('dr',change('dr',x=>{x.d1List.push({name:'alias',uuid:TARGETS.dr.uuid});}),'duplicate D1 UUID');
blocked('dr',change('dr',x=>{x.d1List[0].id=TARGETS['new-live'].uuid;}),'contradictory D1 inventory alias');
const malformed=fixture('dr');malformed.versionDetail.stdout='NOT JSON';
blocked('dr',malformed,'diagnostic text cannot prove version metadata');
const failed=fixture('dr');failed.deploymentStatus.code=1;
blocked('dr',failed,'failed status command not accepted');
const stdErr=fixture('dr');stdErr.versionDetail.stdout='{}';
stdErr.versionDetail.stderr=JSON.stringify(fixture('dr').versionDetail);
blocked('dr',stdErr,'version only in stderr ignored');
console.log('PASS '+count+'/'+count+' current DR + NEW LIVE hosted Worker identity, dark variable and D1 readback tests (synthetic; no provider).');
