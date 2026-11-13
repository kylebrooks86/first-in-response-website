/** FIRE NEW DR / NEW LIVE: local-only review of independently provisioned bindings.
 * Never calls Cloudflare or Stripe and never creates/deploys/migrates resources.
 * INPUT is the exact SOURCE-ONLY built candidate manifest with inert placeholder.
 * OUTPUT is a separate, private manifest for a later authorized review; this
 * script does NOT attest that the named UUID, R2 bucket, or secrets exist.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const RESERVED_D1=new Set([
 PLACEHOLDER,
 '8ccfb1f8-1657-4074-b1b2-47de78f95003', // NEW QA
 'afb2c05a-d794-4a9a-b580-924ce01c26ad', // independent STAGING
 'dba421ba-fc66-4cf8-9c31-51616f8249ba'  // Stripe TEST
]);
const TARGETS=Object.freeze({
 'independent-dr':{
  name:'fire-fullapp-dr',db:'fire-fullapp-dr-db',bucket:'fire-fullapp-dr-photos',
  origin:'https://fire-fullapp-dr.kyle-bfc.workers.dev',
  fireEnv:'isolated-dr',prefix:'FIRE_DR'
 },
 'independent-live':{
  name:'fire-fullapp-new-live',db:'fire-fullapp-new-live-db',
  bucket:'fire-fullapp-new-live-photos',
  origin:'https://fire-fullapp-new-live.kyle-bfc.workers.dev',
  fireEnv:'new-live-prelaunch',prefix:'FIRE_NEW_LIVE'
 }
});

const fail=reason=>{throw Error('Independent FIRE release manifest BLOCKED: '+reason)};
const empty=v=>v===undefined||v===null||v===''||
 (Array.isArray(v)&&v.length===0)||
 (v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(empty));
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validUuid=value=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

/** Pure source-only preflight; no network, fs, remote state or authorization. */
export function prepareReviewedIndependentManifest(target,original,options={}){
 const spec=TARGETS[target];
 if(!spec)fail('unrecognized NEW DR/LIVE target');
 if(!original||typeof original!=='object'||Array.isArray(original))fail('missing compiled Worker config');
 if(original.name!==spec.name||original.workers_dev!==true||
    original.env||original.zone_id||original.account_id||
    !empty(original.routes)||!empty(original.route)||!empty(original.triggers)||
    !empty(original.kv_namespaces)||!empty(original.queues)||
    !empty(original.services)||!empty(original.unsafe)||
    !empty(original.dispatch_namespaces)||!empty(original.durable_objects))
  fail('unexpected Worker identity, route, environment or other connected service');
 const secretNames=[spec.prefix+'_PASSWORD_HASH',spec.prefix+'_SESSION_SECRET'];
 if(!exact(original.secrets?.required,secretNames))fail('missing/reused owner authentication secret names');
 const initialVars={FIRE_ENV:spec.fireEnv,SITE_ORIGIN:spec.origin,
  [spec.prefix+'_AUTH_ENABLED']:'blocked'};
 if(!exact(original.vars,initialVars))fail('source must be the inert release candidate');
 if(!exact(original.d1_databases,[{binding:'DB',database_name:spec.db,database_id:PLACEHOLDER}])||
   !empty(original.r2_buckets))fail('source has non-placeholder database or unexpected R2 binding');
 const uuid=options.databaseId;
 if(!validUuid(uuid)||RESERVED_D1.has(uuid)||
    (options.otherReleaseDatabaseId&&uuid===options.otherReleaseDatabaseId))
  fail('database must be a new independent, owner-verified physical D1 UUID');
 if(options.bucketName!==spec.bucket)fail('new independent R2 bucket name must match target');
 if(options.resourceAttestation!=='owner-checked-'+target)
  fail('owner-controlled resource identity review missing');
 const enabled=options.enableAuth===true;
 if(enabled&&options.authAttestation!=='owner-approved-'+target+'-auth')
  fail('separate owner approval for login enablement missing');
 if(options.enableAuth!==false&&options.enableAuth!==true&&options.enableAuth!==undefined)
  fail('ambiguous login-enable instruction');
 // Never issue a usable NEW LIVE manifest while job numbering is off.
 // This attestation must come from a separate, owner-reviewed physical D1
 // schema/index/trigger/empty-high-water check, NOT CI or this local script.
 if(target==='independent-live'&&enabled&&
   options.jobNumbersSchemaAttestation!=='owner-verified-independent-live-job-numbers-empty-v1')
  fail('NEW LIVE login requires verified permanent Job # schema and clean #0001 start');
 const drNumbers=target==='independent-dr'&&
   options.jobNumbersSchemaAttestation==='owner-verified-independent-dr-job-numbers-v1';
 if(target==='independent-dr'&&options.jobNumbersSchemaAttestation!==undefined&&
   (!drNumbers||!enabled))
  fail('DR Job # mode requires enabled owner authentication and verified DR numbering schema');
 const jobNumbersPrepared=enabled&&(target==='independent-live'||drNumbers);
 // Optional passkey / 4-digit PIN mode needs a provider-verified Access
 // application for THIS Worker, separate owner consent and per-target
 // secret-name custody. Source may never silently enable this mode.
 const quick=options.quickAuthMode==='passkey-or-pin-v1';
 if(options.quickAuthMode!==undefined&&!quick)fail('unsupported quick login mode');
 if(quick){
  if(!enabled||options.quickAuthAttestation!=='owner-approved-'+target+'-quick-auth')
   fail('quick sign-in requires separate owner approval and enabled owner authentication');
  if(typeof options.accessTeamDomain!=='string'||
     !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(options.accessTeamDomain)||
     typeof options.accessAudience!=='string'||options.accessAudience.length<12||
     options.accessAudience.length>256||
     typeof options.accessOwnerEmail!=='string'||
     !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(options.accessOwnerEmail)||
     options.accessOwnerEmail.length>254)
   fail('explicit protected Access team, audience and owner identity are required');
  if(options.pinSecretNamesAttestation!=='owner-checked-'+target+'-pin-secret-names')
   fail('per-environment PIN hash/pepper secret-name review missing');
 }
 const updated=structuredClone(original);
 updated.d1_databases=[{binding:'DB',database_name:spec.db,database_id:uuid}];
 updated.r2_buckets=[{binding:'BUCKET',bucket_name:spec.bucket}];
 updated.vars={...initialVars,[spec.prefix+'_AUTH_ENABLED']:enabled?'owner-approved':'blocked'};
 if(jobNumbersPrepared)
  updated.vars.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 if(quick){
  updated.vars.FIRE_QUICK_AUTH_MODE='passkey-or-pin-v1';
  updated.vars.FIRE_ACCESS_TEAM_DOMAIN=options.accessTeamDomain;
  updated.vars.FIRE_ACCESS_AUDIENCE=options.accessAudience;
  updated.vars.FIRE_ACCESS_OWNER_EMAIL=options.accessOwnerEmail;
  updated.secrets.required=[
   ...secretNames,spec.prefix+'_PIN_HASH',spec.prefix+'_PIN_PEPPER'
  ];
 }

 // Does NOT verify that credentials, bound R2 bytes, provider versions or
 // migration journal actually exist. Gate4, Gate5, Gate7 remain OPEN.
 return {config:updated,evidence:{
  target,worker:spec.name,d1:spec.db,r2:spec.bucket,authEnabled:enabled,
  quickAuthPrepared:quick,accessProviderIndependentlyVerified:false,
  jobNumberSchemaPhysicallyVerified:false,jobNumberSourceFlagPrepared:jobNumbersPrepared,
  localManifestPrepared:true,remoteOperationAttempted:false,
  providerResourcesIndependentlyVerified:false,remoteSchemaVerified:false,
  hostedR2Verified:false,ownerApprovedDeployment:false,gate4Accepted:false,
  gate5Accepted:false,gate7Accepted:false,gate10Accepted:false
 }};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  if(process.argv.length!==5)fail('usage: node prepare_new_independent_release_manifest.mjs TARGET BUILT_JSON OUTPUT_JSON');
  const [, ,target,input,output]=process.argv;
  if(resolve(input)===resolve(output))fail('review output must not overwrite build source');
  const reviewed=prepareReviewedIndependentManifest(target,
   JSON.parse(readFileSync(input,'utf8')),{databaseId:process.env.FIRE_RELEASE_D1_UUID,
    bucketName:process.env.FIRE_RELEASE_R2_BUCKET,
    otherReleaseDatabaseId:process.env.FIRE_OTHER_RELEASE_D1_UUID,
    resourceAttestation:process.env.FIRE_RELEASE_RESOURCE_ATTESTATION,
    enableAuth:process.env.FIRE_RELEASE_ENABLE_AUTH==='yes',
    authAttestation:process.env.FIRE_RELEASE_AUTH_ATTESTATION,
    quickAuthMode:process.env.FIRE_RELEASE_QUICK_AUTH_MODE||undefined,
    quickAuthAttestation:process.env.FIRE_RELEASE_QUICK_AUTH_ATTESTATION,
    accessTeamDomain:process.env.FIRE_ACCESS_TEAM_DOMAIN,
    accessAudience:process.env.FIRE_ACCESS_AUDIENCE,
    accessOwnerEmail:process.env.FIRE_ACCESS_OWNER_EMAIL,
    pinSecretNamesAttestation:process.env.FIRE_RELEASE_PIN_SECRET_NAMES_ATTESTATION,
    jobNumbersSchemaAttestation:process.env.FIRE_RELEASE_JOB_NUMBERS_ATTESTATION||undefined});
  writeFileSync(output,JSON.stringify(reviewed.config,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({...reviewed.evidence,outputFileWritten:true}));
 }catch(error){
  console.error(error instanceof Error?error.message:'FIRE private manifest preparation failed');
  process.exitCode=1;
 }
}
