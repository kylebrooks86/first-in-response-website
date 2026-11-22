import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ACCOUNT_ID,TARGETS} from './owner_g4_hosted_binding_names_readonly.mjs';
import {evaluateStagingServing,captureStagingServing} from './owner_staging_serving_version_readonly.mjs';

const id='15afb4d1-fa9b-4c76-9c5b-36a6ef94971f';
const deployId='b1b5cfef-091e-409d-a97c-cba26d53c105';
const secret='SYNTHETIC_NEVER_SHOW_SECRET_VALUES';
const token='SYNTHETIC_NEVER_SHOW_ACCESS_TOKEN';
const success=result=>({success:true,errors:[],result});
const deployment=()=>({...success({deployments:[{id:deployId,versions:[{version_id:id,percentage:100}]}]}),
 result_info:{count:1,page:1,per_page:1,total_count:4}});
const version=()=>success({id,resources:{bindings:[
 {name:'DB',type:'d1',database_id:TARGETS.staging.database},
 {name:'FIRE_ADMIN_PASSWORD_HASH',type:'secret_text',text:secret},
 {name:'FIRE_SESSION_SECRET',type:'secret_text',text:secret},
{name:'FIRE_ENV',type:'plain_text',text:'STAGING_SECRET_FREE_TEXT'}
]}});
const script=fileURLToPath(new URL('./owner_staging_serving_version_readonly.mjs',import.meta.url));
const dry=JSON.parse(execFileSync(process.execPath,[script],{
 encoding:'utf8',env:{...process.env,CI:'true',CLOUDFLARE_API_TOKEN:token}
}));
assert.equal(dry.providerContacted,false);
assert.equal(dry.gate4Accepted,false);
console.log('PASS default dry-run never contacts provider even with token in environment');

const calls=[];
const requester=async (key,path)=>{
 assert.equal(key,token);
 calls.push(path);
 if(path.includes('/deployments?'))return deployment();
 if(path.endsWith('/versions/'+id))return version();
 throw Error('unexpected GET path');
};
const receipt=await captureStagingServing({token,request:requester});
assert.deepEqual(calls,[
 '/client/v4/accounts/'+ACCOUNT_ID+'/workers/scripts/'+TARGETS.staging.worker+'/deployments?page=1&per_page=1',
 '/client/v4/accounts/'+ACCOUNT_ID+'/workers/scripts/'+TARGETS.staging.worker+'/versions/'+id
]);
assert.equal(receipt.getRequestCount,2);
assert.equal(receipt.directCloudflareReadOnlyApi,false);
assert.equal(receipt.activeVersionId,id);
assert.equal(receipt.versionScopedD1IdentityMatches,true);
assert.equal(receipt.versionScopedMissingAuthCount,0);
assert.equal(receipt.paymentModeExplicitlyDisabled,false);
assert.equal(receipt.paymentModeNotEnabled,true);
assert.equal(receipt.requiresConfigRemediation,false);
assert.equal(receipt.providerDataMutated,false);
assert.equal(receipt.gate4Accepted,false);
assert.equal(receipt.servingCodeBytesVerified,false);
assert.equal(receipt.accessEnforcementVerified,false);
assert.equal(receipt.stripeDependencyCleared,false);
const redacted=JSON.stringify(receipt);
for(const sensitive of [secret,token,TARGETS.staging.database,'STAGING_SECRET_FREE_TEXT'])
 assert.ok(!redacted.includes(sensitive));
console.log('PASS two exact read-only GETs, active 100% version, D1, auth, mode and zero sensitive output');

const bad=version();
bad.result.resources.bindings=bad.result.resources.bindings.filter(x=>x.name!=='FIRE_ADMIN_PASSWORD_HASH');
bad.result.resources.bindings.push({name:'STRIPE_SECRET_KEY',type:'secret_text',text:secret});
const warning=evaluateStagingServing(deployment(),bad);
assert.equal(warning.versionScopedMissingAuthCount,1);
assert.equal(warning.versionScopedUnexpectedPaymentBindingCount,1);
assert.equal(warning.requiresConfigRemediation,true);
assert.equal(warning.versionScopedD1IdentityMatches,true);
assert.ok(!JSON.stringify(warning).includes(secret));
console.log('PASS observed STAGING missing hash and unexpected Stripe binding detected without secret disclosure');

const wrongDb=version();
wrongDb.result.resources.bindings[0].database_id=TARGETS.qa.database;
assert.equal(evaluateStagingServing(deployment(),wrongDb).requiresConfigRemediation,true);
const r2=version();
r2.result.resources.bindings.push({name:'BUCKET',type:'r2_bucket',bucket_name:'private'});
assert.equal(evaluateStagingServing(deployment(),r2).versionScopedR2Count,1);
// A disabled Stripe mode is not itself a payment credential. Keep its
// value redacted, but do not incorrectly demand removal of a safe flag.
const disabledMode=version();
disabledMode.result.resources.bindings.push({name:'FIRE_STRIPE_MODE',type:'plain_text',text:'disabled'});
const disabledVerdict=evaluateStagingServing(deployment(),disabledMode);
assert.equal(disabledVerdict.paymentModeExplicitlyDisabled,true);
assert.equal(disabledVerdict.paymentModeNotEnabled,true);
assert.equal(disabledVerdict.versionScopedUnexpectedPaymentBindingCount,0);
assert.equal(disabledVerdict.requiresConfigRemediation,false);
assert.ok(!JSON.stringify(disabledVerdict).includes('"disabled"'));
const disabledWithSecret=version();
disabledWithSecret.result.resources.bindings.push(
 {name:'FIRE_STRIPE_MODE',type:'plain_text',text:'disabled'},
 {name:'STRIPE_SECRET_KEY',type:'secret_text',text:secret}
);
const credentialVerdict=evaluateStagingServing(deployment(),disabledWithSecret);
assert.equal(credentialVerdict.versionScopedUnexpectedPaymentBindingCount,1);
assert.equal(credentialVerdict.paymentModeExplicitlyDisabled,true);
assert.equal(credentialVerdict.requiresConfigRemediation,true);
const wrongMode=version();
wrongMode.result.resources.bindings.push({name:'FIRE_STRIPE_MODE',type:'plain_text',text:'live'});
const unsafeVerdict=evaluateStagingServing(deployment(),wrongMode);
assert.equal(unsafeVerdict.paymentModeExplicitlyDisabled,false);
assert.equal(unsafeVerdict.paymentModeNotEnabled,false);
assert.equal(unsafeVerdict.versionScopedUnexpectedPaymentBindingCount,0);
assert.equal(unsafeVerdict.requiresConfigRemediation,true);
assert.ok(!JSON.stringify(unsafeVerdict).includes('"live"'));
console.log('PASS wrong D1, R2, disabled-mode versus payment credential, unsafe mode fail closed');

for(const [d,v] of [
 [success({deployments:[]}),version()],
 [success({deployments:[{id:deployId,versions:[{version_id:id,percentage:90},{version_id:id,percentage:10}]}]}),version()],
 [success({deployments:[{id:deployId,versions:[{version_id:id,percentage:99}]}]}),version()],
 [success({deployments:[{id:'BAD',versions:[{version_id:id,percentage:100}]}]}),version()],
 [{...deployment(),result_info:{page:2,count:1,total_count:2}},version()],
 [deployment(),success({id:'00000000-0000-4000-8000-000000000000',resources:{bindings:version().result.resources.bindings}})],
 [deployment(),success({id,resources:{bindings:{}}})],
 [deployment(),{success:false,errors:[{message:secret}],result:version().result}],
 [deployment(),{success:true,errors:[{message:'provider error'}],result:version().result}]
])assert.throws(()=>evaluateStagingServing(d,v),/READ-ONLY STOP|incomplete provider/);
await assert.rejects(captureStagingServing({token:'short',request:requester}),/READ-ONLY STOP/);
await assert.rejects(captureStagingServing({token,request:async()=>{throw Error(secret)}}),/SYNTHETIC_NEVER_SHOW/);
// CLI deliberately hides thrown provider errors and never outputs them.
console.log('PASS split traffic, malformed API, missing binding array, identity drift and token guards STOP');
console.log('TOTAL STAGING serving-version READ-ONLY contract PASS (injected mocks only; no provider)');
