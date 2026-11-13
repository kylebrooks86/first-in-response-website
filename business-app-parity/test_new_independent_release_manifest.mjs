/** Exact NEW DR/LIVE local release-identity smoke: no provider traffic or writes. */
import assert from 'node:assert/strict';
import {prepareReviewedIndependentManifest,reviewIndependentReleasePair} from './prepare_new_independent_release_manifest.mjs';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const TARGETS=[
 ['independent-dr','fire-fullapp-dr','fire-fullapp-dr-db','fire-fullapp-dr-photos',
  'isolated-dr','FIRE_DR','https://fire-fullapp-dr.kyle-bfc.workers.dev'],
 ['independent-live','fire-fullapp-new-live','fire-fullapp-new-live-db','fire-fullapp-new-live-photos',
  'new-live-prelaunch','FIRE_NEW_LIVE','https://fire-fullapp-new-live.kyle-bfc.workers.dev']
];
let checks=0;
function check(fn,description){fn();checks++;}
const v=(target,name,db,bucket,env,prefix,origin)=>({
 name,workers_dev:true,
 secrets:{required:[prefix+'_PASSWORD_HASH',prefix+'_SESSION_SECRET']},
 vars:{FIRE_ENV:env,SITE_ORIGIN:origin,[prefix+'_AUTH_ENABLED']:'blocked'},
 d1_databases:[{binding:'DB',database_name:db,database_id:PLACEHOLDER}],
 r2_buckets:[]
});
for(const [target,name,db,bucket,env,prefix,origin] of TARGETS){
 const manifest=v(target,name,db,bucket,env,prefix,origin);
 const uuid=target==='independent-dr'?'54a5e470-2ae3-471b-a2db-ea8bdf092513':'54a5e470-2ae3-471b-a2db-ea8bdf092514';
 const opts={databaseId:uuid,photoStorageMode:'owner-device-zip',resourceAttestation:'owner-checked-'+target,enableAuth:false};
 const pass=prepareReviewedIndependentManifest(target,manifest,opts);
 check(()=>assert.equal(pass.config.name,name),'exact name');
 check(()=>assert.equal(pass.config.d1_databases[0].database_id,uuid),'new D1 bound');
 check(()=>assert.deepEqual(pass.config.r2_buckets,[]),'no R2 binding or subscription');
 check(()=>assert.equal(pass.config.vars.FIRE_PHOTO_STORAGE_MODE,'owner-device-zip'),'explicit local-photo candidate');
 check(()=>assert.equal(pass.evidence.remotePhotoSyncAvailable,false),'no false cloud photo claim');
 check(()=>assert.equal(pass.evidence.offDeviceZipVerified,false),'no false off-device backup claim');
 check(()=>assert.equal(pass.evidence.isolatedPhotoRestoreVerified,false),'no false photo restore claim');
 check(()=>assert.equal(pass.config.vars[prefix+'_AUTH_ENABLED'],'blocked'),'sign-in blocked by default');
 check(()=>assert.equal(pass.evidence.gate4Accepted,false),'no false gate acceptance');
 check(()=>assert.equal(pass.evidence.remoteOperationAttempted,false),'pure source');
 check(()=>assert.equal(manifest.d1_databases[0].database_id,PLACEHOLDER),'source never mutated');
 const numberApproval=target==='independent-live'
  ?{jobNumbersSchemaAttestation:'owner-verified-independent-live-job-numbers-empty-v1'}
  :{jobNumbersSchemaAttestation:'owner-verified-independent-dr-job-numbers-v1'};
 const allowed=prepareReviewedIndependentManifest(target,manifest,{...opts,enableAuth:true,authAttestation:'owner-approved-'+target+'-auth',...numberApproval});
 check(()=>assert.equal(allowed.config.vars[prefix+'_AUTH_ENABLED'],'owner-approved'),'explicit independent auth approval');

 const quickOpts={...opts,enableAuth:true,
  authAttestation:'owner-approved-'+target+'-auth',
  quickAuthMode:'passkey-or-pin-v1',
  quickAuthAttestation:'owner-approved-'+target+'-quick-auth',
  accessTeamDomain:'fire-owner.cloudflareaccess.com',
  accessAudience:'pinned-app-audience-for-'+target,
  accessOwnerEmail:'owner@example.invalid',
  pinSecretNamesAttestation:'owner-checked-'+target+'-pin-secret-names',
  ...numberApproval
 };
 const quick=prepareReviewedIndependentManifest(target,manifest,quickOpts);
 check(()=>assert.equal(quick.config.vars.FIRE_QUICK_AUTH_MODE,'passkey-or-pin-v1'),'pin/passkey gate');
 check(()=>assert.equal(quick.config.vars.FIRE_ACCESS_TEAM_DOMAIN,'fire-owner.cloudflareaccess.com'),'pinned Access issuer');
 check(()=>assert.equal(quick.config.vars.FIRE_ACCESS_AUDIENCE,quickOpts.accessAudience),'pinned Access audience');
 check(()=>assert.equal(quick.config.secrets.required.includes(
  (target==='independent-dr'?'FIRE_DR':'FIRE_NEW_LIVE')+'_PIN_PEPPER'),true),'PIN secret names required');
 check(()=>assert.equal(quick.evidence.accessProviderIndependentlyVerified,false),'no false provider evidence');
 const reject=(bad,options=opts,why)=>check(()=>assert.throws(
  ()=>prepareReviewedIndependentManifest(target,bad,options),
  /BLOCKED/,why||target),'invalid release must refuse');
 reject({...manifest,name:'fire-fullapp-qa-20261016'});
 reject({...manifest,vars:{...manifest.vars,SITE_ORIGIN:'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'}});
 reject({...manifest,vars:{...manifest.vars,[prefix+'_AUTH_ENABLED']:'owner-approved'}});
 reject({...manifest,vars:{...manifest.vars,FIRE_ENV:'synthetic-qa'}});
 reject({...manifest,d1_databases:[{...manifest.d1_databases[0],database_id:uuid}]});
 reject({...manifest,d1_databases:[...manifest.d1_databases,{...manifest.d1_databases[0]}]});
 reject({...manifest,r2_buckets:[{binding:'BUCKET',bucket_name:'some-bucket'}]});
 reject({...manifest,routes:[{pattern:'example.com/*'}]});
 reject({...manifest,secrets:{required:['FIRE_SESSION_SECRET','FIRE_ADMIN_PASSWORD_HASH']}});
 reject(manifest,{...opts,databaseId:PLACEHOLDER});
 reject(manifest,{...opts,databaseId:'8ccfb1f8-1657-4074-b1b2-47de78f95003'});
 reject(manifest,{...opts,databaseId:'afb2c05a-d794-4a9a-b580-924ce01c26ad'});
 reject(manifest,{...opts,databaseId:'dba421ba-fc66-4cf8-9c31-51616f8249ba'});
 if(target==='independent-live')
  reject(manifest,{...opts,databaseId:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'});
 reject(manifest,{...opts,databaseId:uuid,otherReleaseDatabaseId:uuid});
 reject(manifest,{...opts,bucketName:'fire-fullapp-qa-photos-20261023'});
 reject(manifest,{...opts,bucketName:bucket});
 reject(manifest,{...opts,photoStorageMode:undefined});
 reject(manifest,{...opts,photoStorageMode:'r2'});
 reject(manifest,{...opts,resourceAttestation:null});
 reject(manifest,{...opts,enableAuth:true,authAttestation:null});
 reject(manifest,{...opts,enableAuth:'yes'});
 reject(manifest,{...quickOpts,quickAuthAttestation:null});
 reject(manifest,{...quickOpts,accessTeamDomain:'fake.example.invalid'});
 reject(manifest,{...quickOpts,accessTeamDomain:'fire-owner.cloudflareaccess.com.attacker.invalid'});
 reject(manifest,{...quickOpts,accessAudience:''});
 reject(manifest,{...quickOpts,accessOwnerEmail:'not-email'});
 reject(manifest,{...quickOpts,enableAuth:false});
 reject(manifest,{...quickOpts,pinSecretNamesAttestation:null});
 if(target==='independent-dr'){
  const drNumbers={...quickOpts,
   jobNumbersSchemaAttestation:'owner-verified-independent-dr-job-numbers-v1'};
  const numbered=prepareReviewedIndependentManifest(target,manifest,drNumbers);
  check(()=>assert.equal(numbered.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,'owner-approved-schema-v1'),
   'reviewed DR schema enables permanent numbering');
  check(()=>assert.equal(pass.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,undefined),
   'disabled DR remains unnumbered by default');
  check(()=>assert.equal(allowed.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,'owner-approved-schema-v1'),
   'enabled DR requires permanent Job # parity');
  reject(manifest,{...opts,enableAuth:true,authAttestation:'owner-approved-independent-dr-auth'});
  check(()=>assert.equal(numbered.evidence.jobNumberSchemaPhysicallyVerified,false),
   'DR manifest preparation does not attest a physical schema');
  reject(manifest,{...opts,jobNumbersSchemaAttestation:drNumbers.jobNumbersSchemaAttestation});
  reject(manifest,{...drNumbers,jobNumbersSchemaAttestation:'owner-verified-independent-live-job-numbers-empty-v1'});
 }
 if(target==='independent-live'){
  // No actual provider attestation is created by this test: these strings are
  // synthetic only, and the source manifest remains blocked.
  reject(manifest,{...opts,enableAuth:true,authAttestation:'owner-approved-independent-live-auth'});
  reject(manifest,{...quickOpts,jobNumbersSchemaAttestation:null});
  check(()=>assert.equal(allowed.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,'owner-approved-schema-v1'),
   'approved NEW LIVE numbered schema flag prepared');
  check(()=>assert.equal(pass.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,undefined),
   'unapproved NEW LIVE never enables Job #s');
  check(()=>assert.equal(allowed.evidence.jobNumberSchemaPhysicallyVerified,false),
   'local manifest never asserts a real database check');
 }

}

// Critically, an individually valid manifest can still reuse the *other*
// release's D1. The independent candidate pair must be reviewed together.
// All UUIDs and approvals below are synthetic test inputs, NOT provider proof.
const sample=(target,id)=> {
 const item=TARGETS.find(x=>x[0]===target);
 return prepareReviewedIndependentManifest(target,v(...item),{
  databaseId:id,photoStorageMode:'owner-device-zip',
  resourceAttestation:'owner-checked-'+target,enableAuth:false
 });
};
// The owner-recorded DR UUID is eligible only for an inert DR review,
// never for a NEW LIVE candidate. This is source validation, not D1 attestation.
const ownerDr=sample('independent-dr','5e55c5b7-cd67-4c8f-a52e-40f71b5d3145');
check(()=>assert.equal(ownerDr.config.d1_databases[0].database_name,'fire-fullapp-dr-db'),
 'owner DR UUID remains bound to the DR database name');
check(()=>assert.equal(ownerDr.config.vars.FIRE_DR_AUTH_ENABLED,'blocked'),
 'owner DR UUID review cannot activate DR login');
const simulatedDr=sample('independent-dr','54a5e470-2ae3-471b-a2db-ea8bdf092513');
const simulatedLive=sample('independent-live','54a5e470-2ae3-471b-a2db-ea8bdf092514');
const pair=reviewIndependentReleasePair(simulatedDr,simulatedLive);
check(()=>assert.equal(pair.d1IdsDistinct,true),'source-only DR and NEW LIVE D1 IDs must differ');
check(()=>assert.equal(pair.noR2OrOtherStorageBound,true),'pair contains no cloud photo subscription');
check(()=>assert.equal(pair.isolatedRestoreVerified,false),'pair proof never claims physical recovery');
check(()=>assert.equal(pair.providerResourcesIndependentlyVerified,false),'pair proof never claims provider identity');
check(()=>assert.equal(pair.ownerApprovedDeployment,false),'pair proof is not provider write authorization');
const pairReject=(dr,live,description)=>check(()=>assert.throws(
 ()=>reviewIndependentReleasePair(dr,live),/BLOCKED/,description),description);
pairReject(simulatedDr,sample('independent-live','54a5e470-2ae3-471b-a2db-ea8bdf092513'),
 'two valid target manifests sharing one D1 must STOP');
pairReject(ownerDr,{...simulatedLive,config:{...simulatedLive.config,
 d1_databases:[{...simulatedLive.config.d1_databases[0],
 database_id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'}]}},
 'pair review must reject owner DR D1 forged into NEW LIVE even when identities match');
pairReject(simulatedLive,simulatedDr,'swapped target manifests must STOP');
pairReject(simulatedDr,undefined,'missing NEW LIVE manifest must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 r2_buckets:[{binding:'BUCKET',bucket_name:'unapproved'}]}},'R2 addition must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 kv_namespaces:[{binding:'PHOTOS',id:'paid-or-unreviewed'}]}},'unknown KV storage must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 services:[{binding:'PROXY',service:'some-other-app'}]}},'extra service must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 secrets:{required:simulatedDr.config.secrets.required}}},'reused DR secret names must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 vars:{...simulatedLive.config.vars,FIRE_NEW_LIVE_AUTH_ENABLED:'owner-approved'}}},
 'auth enabled without permanent Job schema must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 routes:[{pattern:'*/*'}]}},'forged Worker route must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 vars:{...simulatedLive.config.vars,FIRE_QUICK_AUTH_MODE:'passkey-or-pin-v1'}}},
 'unapproved quick authentication flag must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 vars:{...simulatedLive.config.vars,FIRE_BYPASS_AUTH:'true'}}},
 'unexpected authentication override variable must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 secrets:{...simulatedLive.config.secrets,extra:['unreviewed']}}},
 'unexpected secret metadata must STOP');
pairReject(simulatedDr,{...simulatedLive,config:{...simulatedLive.config,
 account_id:'unreviewed-cloudflare-account'}},
 'unreviewed Cloudflare account binding must STOP');
pairReject(simulatedDr,{...simulatedLive,evidence:{...simulatedLive.evidence,
 isolatedPhotoRestoreVerified:true}},'fabricated photo restore acceptance must STOP');
pairReject(simulatedDr,{...simulatedLive,evidence:{...simulatedLive.evidence,
 ownerApprovedDeployment:true}},'fabricated approval must STOP');

check(()=>assert.throws(()=>prepareReviewedIndependentManifest('qa',{},{}),/BLOCKED/),'unreviewed target');
console.log('PASS '+checks+'/'+checks+' DR and NEW LIVE source-only independent Worker/D1/no-R2 device-ZIP/auth release config controls; no real resources or deployment.');
