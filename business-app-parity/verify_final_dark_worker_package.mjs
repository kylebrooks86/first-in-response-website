/**
 * Independent LOCAL verifier of the FINAL DR/NEW LIVE dark first-create
 * Worker-only source archive. Rebuilds original SHA commitments from the
 * saved output and the pinned original archive ancestry. No credentials,
 * provider APIs, uploads, migrations, Stripe, or Worker creation.
 *
 * node business-app-parity/verify_final_dark_worker_package.mjs dr DIR
 * node business-app-parity/verify_final_dark_worker_package.mjs new-live DIR
 *
 * This proves source-custody integrity, NOT Cloudflare hosting, owner
 * authorization, auth/Access enforcement, remote D1 or Gate acceptance.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PARENT_SHA,PARENT_ARTIFACT_ID,PARENT_ZIP_SHA256}
 from './prepare_dr_dark_first_create_source.mjs';
import {SOURCE_SHA,SOURCE_ARTIFACT,ZIP_SHA,TREE_SHA}
 from './prepare_new_live_bound_dark_worker.mjs';

const BLOCK='FIRE final dark package BLOCKED: ';
const stop=s=>{throw Error(BLOCK+s);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashFile=p=>sha(readFileSync(p));
const currentRuntimeHash=()=>hashFile(fileURLToPath(new URL('./dr_noassets_runtime.mjs',import.meta.url)));
const drId='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const liveId='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const isHex64=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function filesIn(root){
 if(!existsSync(root))stop('saved package folder not found');
 const st=lstatSync(root);
 if(!st.isDirectory()||st.isSymbolicLink())stop('saved package root must be a real directory');
 const paths=[];
 function walk(dir){
  for(const name of readdirSync(dir).sort()){
   const abs=join(dir,name),stat=lstatSync(abs);
   if(stat.isSymbolicLink()||(!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1)))
    stop('symlink/hardlink/special file refused: '+relative(root,abs));
   if(stat.isDirectory())walk(abs);
   else paths.push(relative(root,abs).split(sep).join('/'));
  }
 }
 walk(root);
 return paths;
}
function readJson(p){
 try{const result=JSON.parse(readFileSync(p,'utf8'));if(!result||typeof result!=='object')throw Error();return result;}
 catch{stop('unreadable receipt/config: '+p);}
}
function strictConfig(config,target){
 const dr=target==='dr';
 const worker=dr?'fire-fullapp-dr':'fire-fullapp-new-live';
 const envName=dr?'isolated-dr':'new-live-prelaunch';
 const authName=dr?'FIRE_DR_AUTH_ENABLED':'FIRE_NEW_LIVE_AUTH_ENABLED';
 const opposite=dr?'FIRE_NEW_LIVE_AUTH_ENABLED':'FIRE_DR_AUTH_ENABLED';
 const dbName=dr?'fire-fullapp-dr-db':'fire-fullapp-new-live-db';
 const dbId=dr?drId:liveId;
 const secrets=dr?['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']:
  ['FIRE_NEW_LIVE_PASSWORD_HASH','FIRE_NEW_LIVE_SESSION_SECRET'];
 if(config.name!==worker||config.main!=='fire-noassets-entry.mjs'||
    config.no_bundle!==true||config.find_additional_modules!==true||
    config.preserve_file_names!==true||
    config.workers_dev!==false||config.preview_urls!==false||
    config.assets!==undefined||config.account_id!==undefined||
    config.zone_id!==undefined||config.legacy_env!==undefined||
    config.route!==undefined||config.routes!==undefined||
    !equal(config.d1_databases,[{binding:'DB',database_name:dbName,database_id:dbId}])||
    !equal(config.r2_buckets,[])||
    !equal(config.secrets?.required,secrets)||
    config.vars?.FIRE_ENV!==envName||
    config.vars?.[authName]!=='blocked'||
    config.vars?.[opposite]!==undefined||
    config.vars?.FIRE_PHOTO_STORAGE_MODE!=='owner-device-zip'||
    config.vars?.FIRE_NEW_LIVE_CLEAN_START!==undefined||
    config.vars?.SITE_ORIGIN!=='https://'+worker+'.kyle-bfc.workers.dev')
   stop('wrong D1, auth, route, static, photo mode or private Worker config');
 for(const key of ['kv_namespaces','services','durable_objects','triggers','queues',
                   'workflows','dispatch_namespaces','analytics_engine_datasets',
                   'hyperdrive','send_email','tail_consumers']){
  const v=config[key];
  if(v!==undefined&&v!==null&&
      (Array.isArray(v)?v.length!==0:Object.keys(v).length!==0))
   stop('unapproved hosted resource or trigger: '+key);
 }
 return {worker,envName,dbId};
}
function verifyEntry(root,expected){
 const rel='server/fire-noassets-entry.mjs';
 const bytes=readFileSync(join(root,rel),'utf8');
 const expectedText=[
  'import server from "./index.js";',
  'import manifest from "./fire-inline-assets/manifest.mjs";',
  'import {wrapInertDRWorker} from "./fire-inline-assets/runtime.mjs";',
  'export default wrapInertDRWorker(server,manifest,"'+expected+'");',''
 ].join('\n');
 if(bytes!==expectedText)stop('first-entry code is not the exact reviewed immutable target');
}
function verifyReceiptHashes(root,receipt){
 const runtimeRel='server/fire-inline-assets/runtime.mjs';
 const entryRel='server/fire-noassets-entry.mjs';
 const runtimeHash=hashFile(join(root,runtimeRel));
 if(runtimeHash!==currentRuntimeHash()||
    runtimeHash!==receipt.refreshedFirstRequestRuntimeSha256)
  stop('runtime does not match current reviewed first-request lock');
 if(hashFile(join(root,entryRel))!==receipt.refreshedTargetBoundEntrySha256||
    hashFile(join(root,'server/wrangler.json'))!==
      (receipt.resultingConfigSha256||receipt.finalWranglerConfigSha256)||
    receipt.firstRequestLockCopiedIntoFinalSource!==true||
    receipt.originalSSRAnd41DataAssetsByteIdentical!==true)
  stop('saved runtime/entry/config hash receipt mismatch');
 for(const k of ['originalArchiveRuntimeSha256','originalArchiveEntrySha256']){
  if(!isHex64(receipt[k]))stop('missing original archived module SHA: '+k);
 }
 if(receipt.originalArchiveRuntimeSha256===runtimeHash||
    receipt.originalArchiveEntrySha256===receipt.refreshedTargetBoundEntrySha256)
  stop('unreviewed old unlocked entry/runtime masquerades as updated package');
}
function verifyDR(root,paths,r){
 if(paths.filter(p=>p.startsWith('server/')).length<200||
    paths.some(p=>!p.startsWith('server/')&&p!=='dark-first-create-source-receipt.json')||
    !paths.includes('dark-first-create-source-receipt.json'))
  stop('DR source package is incomplete or contains unknown extra files');
 if(r.kind!=='FIRE_DR_FIRST_CREATE_DARK_ROUTES_DISABLED_SOURCE_ONLY_V1'||
    r.parentPR!==268||r.parentSourceSha!==PARENT_SHA||
    r.requiredParentArtifactId!==PARENT_ARTIFACT_ID||
    r.independentlyRequiredParentZipSha256!==PARENT_ZIP_SHA256||
    r.worker!=='fire-fullapp-dr'||r.drPhysicalD1!==drId||
    r.immutableExpectedWorkerTarget!=='isolated-dr'||
    r.newFirstWorkerCreateAuthorized!==false||
    r.firstProviderDeployPerformed!==false||r.ownerAuthEnabled!==false||
    r.cloudflareWorkersDevRoute!==false||r.cloudflareVersionPreviewUrls!==false||
    r.providerAccountIdentityVerified!==false||r.d1BindingPhysicallyHostedVerified!==false||
    !isHex64(r.originalCompiledServerModulesSha256))
  stop('DR final receipt claims unreviewed release, identity or source');
 // This exactly reproduces the accepted original PR268 server-file ordering.
 // Only the two explicitly reviewed first-request modules may differ.
 const oldHashes=paths.filter(p=>p.startsWith('server/')&&p!=='server/wrangler.json').map(p=>({
  path:p,
  sha256:p==='server/fire-inline-assets/runtime.mjs'?r.originalArchiveRuntimeSha256:
   p==='server/fire-noassets-entry.mjs'?r.originalArchiveEntrySha256:hashFile(join(root,p))
 }));
 if(sha(Buffer.from(JSON.stringify(oldHashes)))!==r.originalCompiledServerModulesSha256)
  stop('DR archived QA-master SSR or 41 client module bytes differ from pinned source');
 const bin=paths.filter(p=>/^server\/fire-inline-assets\/asset-[0-9]{3}-[0-9a-f]{16}\.bin$/.test(p));
 if(bin.length!==41)stop('DR 41 real QA-master Data assets not complete');
 return bin.length;
}
function verifyLive(root,paths,r){
 if(paths.length!==243||paths.filter(p=>p.startsWith('server/')).length!==241||
    !paths.includes('alternative-receipt.json')||
    !paths.includes('new-live-physical-dark-prehost-receipt.json')||
    paths.some(p=>!p.startsWith('server/')&&p!=='alternative-receipt.json'&&
             p!=='new-live-physical-dark-prehost-receipt.json'))
  stop('NEW LIVE 243-file saved package is incomplete or contains extra files');
 if(r.kind!=='FIRE_NEW_LIVE_PHYSICAL_D1_DARK_PREHOST_SOURCE_ONLY_V1'||
    r.sourceSha!==SOURCE_SHA||r.originalGitHubArtifactId!==SOURCE_ARTIFACT||
    r.originalGitHubZipSha256!==ZIP_SHA||
    r.originalCompleteFileTreeSha256!==TREE_SHA||
    r.originalUnchangedFileCount!==239||r.originalUnchangedClientAssets!==41||
    r.worker!=='fire-fullapp-new-live'||r.existingPhysicalNewLiveD1!==liveId||
    r.distinctDRD1!==drId||r.immutableExpectedWorkerTarget!=='new-live-prelaunch'||
    r.newLive26MigrationsPhysicallyVerified!==false||
    r.firstJob0001CleanStartPhysicallyVerified!==false||
    r.firstCloudflareWorkerCreationAuthorized!==false||
    r.remoteD1OperationPerformed!==false||r.workerUploaded!==false||
    r.workerDeployed!==false||r.releaseAuthorized!==false)
  stop('NEW LIVE final receipt has unsafe identity, origin or premature release claims');
 if(hashFile(join(root,'alternative-receipt.json'))!==r.originalReceiptSha256)
  stop('NEW LIVE original immutable alternative receipt is changed');
 const original=readJson(join(root,'alternative-receipt.json'));
 if(original.kind!=='FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'||
    original.reviewedSourceSha!==SOURCE_SHA||
    original.workerDeployed!==false||original.assetFileCount!==41||
    !Array.isArray(original.clientAssets)||original.clientAssets.length!==41)
  stop('NEW LIVE original asset manifest not the accepted source');
 const assetPaths=new Set();
 for(const item of original.clientAssets){
  if(typeof item.path!=='string'||assetPaths.has(item.path)||
     !/^fire-inline-assets\/asset-[0-9]{3}-[0-9a-f]{16}\.bin$/.test(item.module)||
     !isHex64(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<1)
   stop('NEW LIVE binary Data manifest invalid/duplicate');
  const p='server/'+item.module;
  if(!paths.includes(p))stop('NEW LIVE missing original client Data module');
  const bytes=readFileSync(join(root,p));
  if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)
   stop('NEW LIVE changed original QA-master client Data asset');
  assetPaths.add(item.path);
 }
 // Reconstruct every original source file's Git-artifact-independent tree SHA.
 const base=paths.filter(p=>p!=='new-live-physical-dark-prehost-receipt.json');
 const entries=base.map(p=>{
  let h=hashFile(join(root,p));
  if(p==='server/wrangler.json')h=r.originalConfigSha256;
  if(p==='server/fire-inline-assets/runtime.mjs')h=r.originalArchiveRuntimeSha256;
  if(p==='server/fire-noassets-entry.mjs')h=r.originalArchiveEntrySha256;
  return p+'\0'+h+'\n';
 });
 if(sha(Buffer.from(entries.join('')))!==TREE_SHA)
  stop('NEW LIVE archived QA-master source/SSR/asset tree differs from sealed PR267');
 return assetPaths.size;
}
export function verifyFinalDarkWorkerPackage(target,folder){
 if(target!=='dr'&&target!=='new-live')stop('choose exact target dr or new-live');
 const root=resolve(folder);
 const paths=filesIn(root);
 const dr=target==='dr';
 const receiptRel=dr?'dark-first-create-source-receipt.json':
  'new-live-physical-dark-prehost-receipt.json';
 const receipt=readJson(join(root,receiptRel));
 strictConfig(readJson(join(root,'server/wrangler.json')),target);
 verifyEntry(root,dr?'isolated-dr':'new-live-prelaunch');
 verifyReceiptHashes(root,receipt);
 const assetCount=dr?verifyDR(root,paths,receipt):verifyLive(root,paths,receipt);
 return Object.freeze({target,worker:dr?'fire-fullapp-dr':'fire-fullapp-new-live',
  filesVerified:paths.length,compiledAssetsVerified:assetCount,
  darkFirstRequestTargetPinned:true,sourceOnly:true,providerContacted:false,
  deployed:false,remoteMigrationApplied:false,readyForProduction:false});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)stop('usage: dr|new-live ABSOLUTE_SAVED_EXTRACTED_PACKAGE_DIR');
  console.log(JSON.stringify(verifyFinalDarkWorkerPackage(process.argv[2],process.argv[3]),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
