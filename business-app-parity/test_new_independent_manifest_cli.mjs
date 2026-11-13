/** Run the REAL local manifest CLI with synthetic files, no provider calls.
 * Prove approved Customer # schema input reaches BOTH DR and NEW LIVE. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./prepare_new_independent_release_manifest.mjs',import.meta.url));
const directory=mkdtempSync(join(tmpdir(),'fire-manifest-cli-'));
// DR ID is the previously owner-recorded database, not new authenticated evidence.
const specs=[
 {target:'independent-dr',name:'fire-fullapp-dr',db:'fire-fullapp-dr-db',
  env:'isolated-dr',prefix:'FIRE_DR',id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
  job:'owner-verified-independent-dr-job-numbers-v1',
  customer:'owner-verified-independent-dr-customer-numbers-v1'},
 {target:'independent-live',name:'fire-fullapp-new-live',db:'fire-fullapp-new-live-db',
  env:'new-live-prelaunch',prefix:'FIRE_NEW_LIVE',id:'54a5e470-2ae3-471b-a2db-ea8bdf092514',
  job:'owner-verified-independent-live-job-numbers-empty-v1',
  customer:'owner-verified-independent-live-customer-numbers-empty-v1'}
];
let checks=0,serial=0;
function check(value,reason){assert.ok(value,reason);checks++;}
function attempt(spec,settings={}){
 const input=join(directory,'input-'+(++serial)+'.json');
 const output=join(directory,'output-'+serial+'.json');
 writeFileSync(input,JSON.stringify({
  name:spec.name,workers_dev:true,
  vars:{FIRE_ENV:spec.env,SITE_ORIGIN:'https://'+spec.name+'.kyle-bfc.workers.dev',
   [spec.prefix+'_AUTH_ENABLED']:'blocked'},
  secrets:{required:[spec.prefix+'_PASSWORD_HASH',spec.prefix+'_SESSION_SECRET']},
  d1_databases:[{binding:'DB',database_name:spec.db,
   database_id:'00000000-0000-4000-8000-000000000000'}],
  r2_buckets:[]
 }));
 const env={
  PATH:process.env.PATH||'',HOME:process.env.HOME||'',TMPDIR:process.env.TMPDIR||'',
  FIRE_RELEASE_D1_UUID:spec.id,
  FIRE_RELEASE_PHOTO_STORAGE_MODE:'owner-device-zip',
  FIRE_RELEASE_RESOURCE_ATTESTATION:'owner-checked-'+spec.target,
  FIRE_RELEASE_ENABLE_AUTH:'yes',
  FIRE_RELEASE_AUTH_ATTESTATION:'owner-approved-'+spec.target+'-auth',
  FIRE_RELEASE_JOB_NUMBERS_ATTESTATION:spec.job,
  FIRE_RELEASE_CUSTOMER_NUMBERS_ATTESTATION:spec.customer,
  ...settings
 };
 for(const [key,value] of Object.entries(env))if(value===undefined)delete env[key];
 const result=spawnSync(process.execPath,[script,spec.target,input,output],
  {env,encoding:'utf8',timeout:15000});
 return {result,output,config:existsSync(output)?JSON.parse(readFileSync(output,'utf8')):null};
}
try{
 for(const spec of specs){
  const approved=attempt(spec);
  check(approved.result.status===0,'approved '+spec.target+' CLI failed: '+approved.result.stderr);
  check(approved.config?.vars?.[spec.prefix+'_AUTH_ENABLED']==='owner-approved',
   spec.target+' approved auth must be explicitly represented');
  check(approved.config?.vars?.FIRE_JOB_NUMBERS_CANDIDATE==='owner-approved-schema-v1',
   spec.target+' permanent Job # enabled');
  check(approved.config?.vars?.FIRE_CUSTOMER_NUMBERS_CANDIDATE==='owner-approved-schema-v1',
   spec.target+' permanent Customer # enabled');
  check(Array.isArray(approved.config?.r2_buckets)&&approved.config.r2_buckets.length===0,
   spec.target+' remains zero-R2');
  const missing=attempt(spec,{FIRE_RELEASE_CUSTOMER_NUMBERS_ATTESTATION:undefined});
  check(missing.result.status!==0&&!existsSync(missing.output),
   spec.target+' must not create an auth-ready manifest without Customer # attestation');
  const wrong=attempt(spec,{FIRE_RELEASE_CUSTOMER_NUMBERS_ATTESTATION:
   specs.find(s=>s.target!==spec.target).customer});
  check(wrong.result.status!==0&&!existsSync(wrong.output),
   spec.target+' wrong-target Customer # attestation must be blocked');
  const inert=attempt(spec,{FIRE_RELEASE_ENABLE_AUTH:'no',
   FIRE_RELEASE_CUSTOMER_NUMBERS_ATTESTATION:undefined,
   FIRE_RELEASE_JOB_NUMBERS_ATTESTATION:undefined,
   FIRE_RELEASE_AUTH_ATTESTATION:undefined});
  check(inert.result.status===0&&inert.config?.vars?.[spec.prefix+'_AUTH_ENABLED']==='blocked',
   spec.target+' remains inert by default');
  check(inert.config?.vars?.FIRE_CUSTOMER_NUMBERS_CANDIDATE===undefined,
   spec.target+' inert release cannot enable Customer #');
  const billed=attempt(spec,{FIRE_RELEASE_R2_BUCKET:'unapproved-bucket'});
  check(billed.result.status!==0&&!existsSync(billed.output),
   spec.target+' cannot create an R2-bound manifest');
 }
 console.log('PASS '+checks+'/'+checks+' actual DR/NEW LIVE manifest CLI source-only auth/customer identity tests; no provider calls.');
}finally{rmSync(directory,{recursive:true,force:true});}
