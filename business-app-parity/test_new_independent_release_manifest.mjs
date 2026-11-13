/** Exact NEW DR/LIVE local release-identity smoke: no provider traffic or writes. */
import assert from 'node:assert/strict';
import {prepareReviewedIndependentManifest} from './prepare_new_independent_release_manifest.mjs';
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
 const liveNumberApproval=target==='independent-live'?{jobNumbersSchemaAttestation:'owner-verified-independent-live-job-numbers-empty-v1'}:{};
 const allowed=prepareReviewedIndependentManifest(target,manifest,{...opts,enableAuth:true,authAttestation:'owner-approved-'+target+'-auth',...liveNumberApproval});
 check(()=>assert.equal(allowed.config.vars[prefix+'_AUTH_ENABLED'],'owner-approved'),'explicit independent auth approval');

 const quickOpts={...opts,enableAuth:true,
  authAttestation:'owner-approved-'+target+'-auth',
  quickAuthMode:'passkey-or-pin-v1',
  quickAuthAttestation:'owner-approved-'+target+'-quick-auth',
  accessTeamDomain:'fire-owner.cloudflareaccess.com',
  accessAudience:'pinned-app-audience-for-'+target,
  accessOwnerEmail:'owner@example.invalid',
  pinSecretNamesAttestation:'owner-checked-'+target+'-pin-secret-names',
  ...liveNumberApproval
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
  check(()=>assert.equal(allowed.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,undefined),
   'DR remains unnumbered by default');
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
check(()=>assert.throws(()=>prepareReviewedIndependentManifest('qa',{},{}),/BLOCKED/),'unreviewed target');
console.log('PASS '+checks+'/'+checks+' DR and NEW LIVE source-only independent Worker/D1/no-R2 device-ZIP/auth release config controls; no real resources or deployment.');
