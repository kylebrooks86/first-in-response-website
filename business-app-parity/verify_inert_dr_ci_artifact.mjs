/**
 * FIRE independent DR: verify the saved CI-compiled Worker bytes without
 * trusting a filename, changing a provider or enabling any release feature.
 * Intended for the owner Acer after GitHub Actions artifact download.
 *
 * node verify_inert_dr_ci_artifact.mjs DIST_DIRECTORY OFFLINE_SEAL_JSON EXACT_PR_HEAD_SHA
 *
 * Strictly local read-only. NO Cloudflare, network, D1, Stripe, deployment,
 * secret read, payment, merge or subscription.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareReviewedIndependentManifest} from './prepare_new_independent_release_manifest.mjs';

const fail=reason=>{throw Error('FIRE INERT DR BUNDLE BLOCKED: '+reason);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const isSha=s=>typeof s==='string'&&/^[0-9a-f]{40}$/.test(s);
const digest=s=>sha256(Buffer.from(JSON.stringify(s)));
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function sourceFiles(root){
 const records=[];
 const visit=folder=>{
  for(const name of readdirSync(folder).sort()){
   const abs=join(folder,name),meta=lstatSync(abs);
   if(meta.isSymbolicLink())fail('bundle links cannot be verified');
   if(meta.isDirectory()){visit(abs);continue;}
   if(!meta.isFile())fail('unexpected nonfile in bundle');
   const bytes=readFileSync(abs),path=relative(root,abs).replaceAll('\\','/');
   records.push({path,bytes:bytes.length,sha256:sha256(bytes)});
  }
 };
 visit(root);
 records.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 return records;
}
export function verifyInertDRCIBundle(distDirectory,sealFile,expectedSha){
 if(!isSha(expectedSha))fail('exact full 40-character reviewed PR head SHA required');
 const root=resolve(distDirectory),sealPath=resolve(sealFile);
 if(!existsSync(root)||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())
  fail('compiled dist folder missing or redirected');
 if(!existsSync(sealPath)||!lstatSync(sealPath).isFile()||lstatSync(sealPath).isSymbolicLink())
  fail('separate offline seal file missing or redirected');
 let seal,compiled;
 try{
  seal=JSON.parse(readFileSync(sealPath,'utf8'));
  compiled=JSON.parse(readFileSync(join(root,'server','wrangler.json'),'utf8'));
 }catch{fail('offline receipt or actual compiled Worker manifest invalid');}
 if(!seal||typeof seal!=='object'||Array.isArray(seal)||
    seal.kind!=='FIRE_SOURCE_ONLY_INERT_DR_COMPILED_ARTIFACT_V1'||
    seal.reviewedPullRequest!==264||
    seal.reviewedSourceSha!==expectedSha||
    seal.target!=='independent-dr'||seal.drWorker!=='fire-fullapp-dr')
  fail('saved compiled release identity does not match exact reviewed DR source');
 for(const key of [
  'physicalDatabaseBindingAttempted','ownerAuthenticationEnabled',
  'cloudflareUploaded','cloudflareDeployed','stripeActivated',
  'ownerApprovedDeployment'
 ]){
  if(seal[key]!==false)fail('offline receipt falsely asserts deployment/approval');
 }
 const records=sourceFiles(root);
 if(!Number.isSafeInteger(seal.reviewedFileCount)||records.length===0||
    seal.reviewedFileCount!==records.length||
    typeof seal.filesDigestSha256!=='string'||!Array.isArray(seal.files)||
    !exact(seal.files,records)||seal.filesDigestSha256!==digest(records))
  fail('compiled Worker bytes disagree with saved per-file SHA-256 inventory');
 const prepared=prepareReviewedIndependentManifest('independent-dr',compiled,{
  databaseId:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
  photoStorageMode:'owner-device-zip',
  resourceAttestation:'owner-checked-independent-dr',enableAuth:false
 });
 if(prepared.config.vars.FIRE_DR_AUTH_ENABLED!=='blocked'||
    prepared.config.r2_buckets.length!==0||
    prepared.evidence.remoteOperationAttempted!==false||
    prepared.evidence.ownerApprovedDeployment!==false)
  fail('bundle contains unapproved auth, paid R2 or provider configuration');
 return Object.freeze({
  status:'VERIFIED_INERT_DR_CI_BUILD',
  reviewedSourceSha:expectedSha,
  compiledFileCount:records.length,
  compiledFilesSha256:seal.filesDigestSha256,
  providerContacted:false,cloudflareDeployed:false,
  ownerApprovedDeployment:false
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==5)
   fail('usage: node verify_inert_dr_ci_artifact.mjs DIST_DIRECTORY OFFLINE_SEAL_JSON EXACT_PR_HEAD_SHA');
  const result=verifyInertDRCIBundle(...process.argv.slice(2));
  console.log('FIRE DR compiled owner artifact: VERIFIED SOURCE-ONLY, NOT DEPLOYED');
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
