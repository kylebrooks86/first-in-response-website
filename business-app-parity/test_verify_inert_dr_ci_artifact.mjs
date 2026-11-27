/** Source-real local DR compiled receipt integrity tests; NO provider. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,readdirSync,lstatSync,symlinkSync} from 'node:fs';
import {join,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyInertDRCIBundle} from './verify_inert_dr_ci_artifact.mjs';

const root=mkdtempSync(join(tmpdir(),'fire-inert-dr-ci-bundle-'));
const dist=join(root,'dist'),sealFile=join(root,'fire-dr-offline-seal.json');
const sha='a'.repeat(40),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const original={
 name:'fire-fullapp-dr',workers_dev:true,
 secrets:{required:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']},
 vars:{
  FIRE_ENV:'isolated-dr',
  SITE_ORIGIN:'https://fire-fullapp-dr.kyle-bfc.workers.dev',
  FIRE_DR_AUTH_ENABLED:'blocked'
 },
 d1_databases:[{binding:'DB',database_name:'fire-fullapp-dr-db',
  database_id:'00000000-0000-4000-8000-000000000000'}],
 r2_buckets:[]
};
let checks=0;
const files=folder=>{
 const all=[];
 const walk=dir=>{
  for(const name of readdirSync(dir).sort()){
   const path=join(dir,name),st=lstatSync(path);
   if(st.isDirectory())walk(path);
   else if(st.isFile()){
    const bytes=readFileSync(path);
    all.push({path:relative(folder,path).replaceAll('\\','/'),
     bytes:bytes.length,sha256:sha256(bytes)});
   }
  }
 };
 walk(folder);
 return all.sort((a,b)=>a.path.localeCompare(b.path,'en'));
};
function seed(config=original){
 rmSync(dist,{recursive:true,force:true});
 mkdirSync(join(dist,'server'),{recursive:true});
 writeFileSync(join(dist,'server','wrangler.json'),JSON.stringify(config));
 writeFileSync(join(dist,'server','index.js'),'export default {fetch(){return new Response("blocked")}};\n');
 const inventory=files(dist);
 const receipt={
  kind:'FIRE_SOURCE_ONLY_INERT_DR_COMPILED_ARTIFACT_V1',
  reviewedPullRequest:264,reviewedSourceSha:sha,
  target:'independent-dr',drWorker:'fire-fullapp-dr',
  physicalDatabaseBindingAttempted:false,ownerAuthenticationEnabled:false,
  cloudflareUploaded:false,cloudflareDeployed:false,
  stripeActivated:false,ownerApprovedDeployment:false,
  reviewedFileCount:inventory.length,
  filesDigestSha256:sha256(Buffer.from(JSON.stringify(inventory))),
  files:inventory
 };
 writeFileSync(sealFile,JSON.stringify(receipt));
 return receipt;
}
const pass=(ok,message)=>{assert.ok(ok,message);checks++;};
const reject=(action,label)=>{assert.throws(action,/BLOCKED/,'Reject '+label);checks++;};
try{
 let receipt=seed();
 let result=verifyInertDRCIBundle(dist,sealFile,sha);
 pass(result.status==='VERIFIED_INERT_DR_CI_BUILD'&&
      result.providerContacted===false&&result.ownerApprovedDeployment===false,
      'Exact source SHA + all compiled file bytes + inactive DR manifest pass');
 pass(result.compiledFileCount===2&&result.compiledFilesSha256===receipt.filesDigestSha256,
      'Sealed file count and aggregate digest returned without hosted verification');
 reject(()=>verifyInertDRCIBundle(dist,sealFile,'b'.repeat(40)),
       'wrong exact PR head');
 reject(()=>verifyInertDRCIBundle(dist,sealFile,'abc'),
       'short/ambiguous Git commit');
 writeFileSync(join(dist,'server','index.js'),'altered Worker code');
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'changed compiled Worker code even with unchanged Wrangler manifest');
 seed();
 writeFileSync(join(dist,'server','unreviewed.js'),'new module');
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'extra compiled module not in original artifact');
 seed();
 receipt=JSON.parse(readFileSync(sealFile,'utf8'));
 receipt.cloudflareDeployed=true;
 writeFileSync(sealFile,JSON.stringify(receipt));
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'forged source-only provider deployment claim');
 seed({...original,r2_buckets:[{binding:'PHOTOS',bucket_name:'paid-r2'}]});
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'paid Cloudflare R2 even when matching file inventory');
 seed({...original,vars:{...original.vars,FIRE_DR_AUTH_ENABLED:'owner-approved'}});
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'owner auth enabled in previously inert bundle');
 seed({...original,d1_databases:[{...original.d1_databases[0],
  database_id:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}]});
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'NEW LIVE database identity misbound as DR');
 seed({...original,name:'fire-fullapp-new-live'});
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'NEW LIVE Worker code labeled as DR');
 seed();
 symlinkSync(join(dist,'server','index.js'),join(dist,'server','linked.js'));
 reject(()=>verifyInertDRCIBundle(dist,sealFile,sha),
       'symlinked file cannot be accepted as source-identical');
 console.log('PASS '+checks+'/'+checks+
  ' exact-source inert DR compiled bundle immutable file digests/identity/R2/auth negatives; NO provider access.');
}finally{rmSync(root,{recursive:true,force:true});}
