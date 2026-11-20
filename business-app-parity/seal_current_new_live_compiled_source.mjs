/** Seal CURRENT independently compiled NEW LIVE dist for review-only no-R2
 * Data-module first-create package. No Cloudflare/Stripe/D1 provider calls.
 * node seal_current_new_live_compiled_source.mjs DIST EXACT_SOURCE_SHA NEW_SEAL.json
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareReviewedIndependentManifest} from './prepare_new_independent_release_manifest.mjs';
const stop=why=>{throw Error('FIRE CURRENT NEW LIVE COMPILED SEAL BLOCKED: '+why)};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function sealCurrentNewLiveCompiledSource(dir,sourceSha,output){
 const root=resolve(dir),dest=resolve(output);
 if(!/^[a-f0-9]{40}$/.test(sourceSha)||existsSync(dest)||
    !existsSync(root)||lstatSync(root).isSymbolicLink()||
    !lstatSync(root).isDirectory())stop('exact source SHA, original built dist and new absent receipt required');
 const config=JSON.parse(readFileSync(join(root,'server/wrangler.json'),'utf8'));
 const checked=prepareReviewedIndependentManifest('independent-live',config,{
  databaseId:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',
  photoStorageMode:'owner-device-zip',
  resourceAttestation:'owner-checked-independent-live',enableAuth:false});
 if(checked.evidence.remoteOperationAttempted!==false||
    checked.evidence.ownerApprovedDeployment!==false||
    checked.config.vars.FIRE_NEW_LIVE_AUTH_ENABLED!=='blocked')
  stop('reviewed original compiled code accidentally claims production');
 const files=[];
 function walk(folder){
  for(const name of readdirSync(folder).sort()){
   const full=join(folder,name),meta=lstatSync(full);
   if(meta.isSymbolicLink())stop('symlink rejected in compiled source');
   if(meta.isDirectory()){walk(full);continue;}
   if(!meta.isFile()||meta.nlink!==1)stop('hardlinked or special compiled source rejected');
   const bytes=readFileSync(full);
   files.push({path:relative(root,full).split(sep).join('/'),bytes:bytes.length,sha256:sha(bytes)});
  }
 }
 walk(root);
 files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 if(files.length<40||!files.some(x=>x.path==='server/index.js')||
    !files.some(x=>x.path==='server/wrangler.json')||
    !files.some(x=>x.path==='client/fire-offline/app.js')||
    !files.some(x=>x.path.startsWith('client/_next/static/chunks/')))
  stop('source-only compiled client or SSR incomplete');
 const seal={
  kind:'FIRE_SOURCE_ONLY_INERT_NEW_LIVE_COMPILED_ARTIFACT_V1',
  reviewedPullRequest:264,reviewedSourceSha:sourceSha,
  target:'independent-live',liveWorker:'fire-fullapp-new-live',
  physicalDatabaseBindingAttempted:false,ownerAuthenticationEnabled:false,
  cloudflareUploaded:false,cloudflareDeployed:false,stripeActivated:false,
  ownerApprovedDeployment:false,
  reviewedFileCount:files.length,
  filesDigestSha256:sha(Buffer.from(JSON.stringify(files))),files
 };
 writeFileSync(dest,JSON.stringify(seal,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:'CURRENT_NEW_LIVE_COMPILED_SEAL_REVIEW_ONLY',
  compiledSourceSha:sourceSha,compiledFilesSealed:files.length,
  noProvider:true,noDeploy:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==5)stop('usage: BUILT_DIST EXACT_HEAD_SHA NEW_ABSENT_SEAL_JSON');
  console.log(JSON.stringify(sealCurrentNewLiveCompiledSource(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
