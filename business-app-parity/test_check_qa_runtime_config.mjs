/** QA runtime verifier uses only synthetic manifests; never a provider call.
 * Regressions: existing no-paid R2 placeholder, optional source-only Job #,
 * optional owner-approved PIN/Access names, and hard negative refusals.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL('./check_qa_runtime_config.mjs',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'fire-qa-runtime-no-r2-'));
const manifest=join(temp,'wrangler.json');
const initial=()=>({
 name:'fire-fullapp-qa-20261016',workers_dev:true,
 d1_databases:[{binding:'DB',database_name:'fire-fullapp-qa-db-20261016',
 database_id:'8ccfb1f8-1657-4074-b1b2-47de78f95003'}],
 secrets:{required:['FIRE_QA_PASSWORD_HASH','FIRE_QA_SESSION_SECRET']},
 vars:{FIRE_ENV:'synthetic-qa',FIRE_QA_SYNTHETIC_ONLY:'enabled',
 FIRE_LOCAL_CUSTOMERS_CANDIDATE:'synthetic-only',
 SITE_ORIGIN:'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'}
});
const numbered=c=>{c.vars.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';};
const quick=c=>{
  Object.assign(c.vars,{
    FIRE_QUICK_AUTH_MODE:'passkey-or-pin-v1',
    FIRE_ACCESS_TEAM_DOMAIN:'fire-owner.cloudflareaccess.com',
    FIRE_ACCESS_AUDIENCE:'0123456789abcdef0123456789abcdef',
    FIRE_ACCESS_OWNER_EMAIL:'owner@example.test'
  });
  c.secrets.required.push('FIRE_QA_PIN_HASH','FIRE_QA_PIN_PEPPER');
};
let n=0;
const pass=(c,msg)=>{assert.ok(c,msg);n++;};
const run=(obj)=>{
 writeFileSync(manifest,JSON.stringify(obj));
 return execFileSync(process.execPath,[file,manifest],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});
};
const deny=(obj,label)=>{
 writeFileSync(manifest,JSON.stringify(obj));
 let failed=false;
 try{execFileSync(process.execPath,[file,manifest],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});}
 catch(e){failed=true;pass(e.status!==0,label+' failed before accepting source');}
 pass(failed,label+' cannot be accepted');
};
try{
 for(const [label,mutate,placeholder] of [
  ['no R2 field',x=>{},false],
  ['explicit empty R2 list',x=>{x.r2_buckets=[];},false],
  ['reviewed legacy QA-only R2 placeholder',x=>{
   x.r2_buckets=[{binding:'BUCKET',bucket_name:'fire-fullapp-qa-photos-20261023'}];
  },true]
 ]){
  const obj=initial();mutate(obj);
  const out=JSON.parse(run(obj));
  pass(out.identityVerified===true&&out.dbId===initial().d1_databases[0].database_id,
   label+' preserves exact independent QA database');
  pass(out.r2Configured===false&&out.r2Required===false&&
   out.r2RemoteVerified===false&&out.r2BindingRemovedBeforeApprovedDeploy===true,
   label+' never claims remote R2 subscription required or present');
  pass(out.legacyCompiledR2PlaceholderPresent===placeholder,
   label+' reports historical compile placeholder accurately');
  pass(out.publicationAuthorized===false&&out.remoteD1WritesPerformed===false&&
   out.gateAcceptanceAsserted===false,
   label+' never asserts provider change or formal gate acceptance');
 }
 for(const [label,mutate,wantsNumbering,wantsQuick] of [
  ['reviewed numbering source',numbered,true,false],
  ['reviewed quick unlock source',quick,false,true],
  ['both optional source modes',x=>{numbered(x);quick(x);},true,true]
 ]){
  const obj=initial();mutate(obj);
  const proof=JSON.parse(run(obj));
  pass(proof.sourceJobNumberModeRequested===wantsNumbering &&
    proof.sourceQuickAuthModeRequested===wantsQuick,label+' optional flags correctly reported');
  pass(proof.quickAuthAccessAndOwnerApproved===false &&
    proof.jobNumbersPhysicalD1ProofVerified===false &&
    proof.publicationAuthorized===false,label+' cannot claim owner or physical hosted proof');
 }
 const negative=[
  ['unexpected R2 bucket',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'production-photos'}];}],
  ['unexpected second bucket',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'fire-fullapp-qa-photos-20261023'},
   {binding:'OTHER',bucket_name:'extra'}];}],
  ['malformed R2 binding',x=>{x.r2_buckets={binding:'BUCKET'};}],
  ['null R2 list',x=>{x.r2_buckets=null;}],
  ['wrong physical QA D1',x=>{x.d1_databases[0].database_id='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';}],
  ['plaintext owner password',x=>{x.vars.FIRE_QA_PASSWORD_HASH='bad';}],
  ['unknown custom route',x=>{x.routes=['bad.example.com/*'];}],
  ['unexpected R2-like var',x=>{x.vars.R2_BUCKET_NAME='bad';}],
  ['unexpected secret field',x=>{x.secrets.extras=['FOREIGN_KEY'];}],
  ['unapproved number mode',x=>{x.vars.FIRE_JOB_NUMBERS_CANDIDATE='true';}],
  ['empty number mode',x=>{x.vars.FIRE_JOB_NUMBERS_CANDIDATE='';}],
  ['unapproved quick auth mode',x=>{quick(x);x.vars.FIRE_QUICK_AUTH_MODE='on';}],
  ['quick auth without PIN PEPPER secret',x=>{quick(x);x.secrets.required.pop();}],
  ['plaintext PIN hash',x=>{quick(x);x.vars.FIRE_QA_PIN_HASH='bad';}],
  ['PIN secrets without Access settings',x=>{x.secrets.required.push('FIRE_QA_PIN_HASH','FIRE_QA_PIN_PEPPER');}],
  ['partial Access without quick mode',x=>{x.vars.FIRE_ACCESS_OWNER_EMAIL='owner@example.test';}],
  ['wrong Access team',x=>{quick(x);x.vars.FIRE_ACCESS_TEAM_DOMAIN='evil.cloudflareaccess.com.attacker.tld';}],
  ['wrong Access audience',x=>{quick(x);x.vars.FIRE_ACCESS_AUDIENCE='short';}],
  ['wrong owner email',x=>{quick(x);x.vars.FIRE_ACCESS_OWNER_EMAIL='not an email';}],
  ['unknown analytics binding',x=>{x.analytics_engine_datasets=[{binding:'LOGS'}];}],
  ['unknown external browser binding',x=>{x.browser={binding:'HEADLESS'};}],
  ['both modes with live mode var',x=>{numbered(x);quick(x);x.vars.STRIPE_LIVE='enabled';}]
 ];
 for(const [label,mutation] of negative){
  const obj=initial();mutation(obj);deny(obj,label);
 }
 console.log('PASS '+n+'/'+n+
  ' QA runtime optional source modes, exact no-R2 shape and fail-closed negatives; no provider/approval');
}finally{rmSync(temp,{recursive:true,force:true});}
