/** QA runtime verification must NOT demand a paid Cloudflare R2 bucket.
 * Test the real CLI against synthetic compiled manifest files, no provider.
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
 const negative=[
  ['unexpected R2 bucket',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'production-photos'}];}],
  ['unexpected second bucket',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'fire-fullapp-qa-photos-20261023'},
   {binding:'OTHER',bucket_name:'extra'}];}],
  ['malformed R2 binding',x=>{x.r2_buckets={binding:'BUCKET'};}],
  ['null R2 list',x=>{x.r2_buckets=null;}],
  ['wrong physical QA D1',x=>{x.d1_databases[0].database_id='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';}],
  ['plaintext owner password',x=>{x.vars.FIRE_QA_PASSWORD_HASH='bad';}],
  ['unknown custom route',x=>{x.routes=['bad.example.com/*'];}],
  ['unexpected R2-like var',x=>{x.vars.R2_BUCKET_NAME='bad';}]
 ];
 for(const [label,mutation] of negative){
  const obj=initial();mutation(obj);deny(obj,label);
 }
 console.log('PASS '+n+'/'+n+
  ' QA runtime R2-free, exact legacy placeholder/no-R2 and resource denial checks. SOURCE ONLY; NO PROVIDER.');
}finally{rmSync(temp,{recursive:true,force:true});}
