/**
 * Exact SHA-pinned PR267 NEW LIVE Worker-only ZIP -> isolated DARK physically
 * D1-bound SOURCE candidate. No hosted Worker creation, D1 migration, login,
 * billing, Stripe or deployment. The original archive remains unchanged.
 */
import {createHash} from 'node:crypto';
import {cpSync,copyFileSync,existsSync,lstatSync,readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export const SOURCE_SHA='3ee92374dca6322955fdd5f920a95e0864a9654f';
export const SOURCE_ARTIFACT=14101058770;
export const ZIP_SHA='7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3';
export const TREE_SHA='95cd5b8deb9876ead746a18425501d3fc108a88d27ce7001b8e87fb69ba3167f';
const CONFIG_SHA='9236fb45c806ca10f8f5045bb95da38f0ca93de3503607a126a8091cba0816f9';
const RECEIPT_SHA='d59b25f1a1d99b16fb82aa27231936c6338b80d22220a54f19e6e51af0017b86';
const LIVE_UUID='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const DR_UUID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const stop=s=>{throw Error('FIRE NEW LIVE prehost BLOCKED: '+s);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const json=p=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch{stop('invalid source JSON');}};
function ordinaryFiles(root){
 if(!existsSync(root)||lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())
  stop('original archive extraction must be ordinary existing directory');
 const files=[];
 function walk(dir){
  for(const n of readdirSync(dir).sort()){
   const full=join(dir,n),st=lstatSync(full);
   if(st.isSymbolicLink())stop('original source symlink');
   if(st.isDirectory()){walk(full);continue;}
   if(!st.isFile()||st.nlink!==1)stop('hardlink/device/unreviewed original source');
   files.push(relative(root,full).split(sep).join('/'));
  }
 }
 walk(root);
 return files.sort();
}
export function reviewOriginalNewLive(source){
 const root=resolve(source),paths=ordinaryFiles(root);
 if(paths.length!==242||paths.filter(p=>p.startsWith('server/')).length!==241||
    paths.filter(p=>p.startsWith('server/fire-inline-assets/asset-')).length!==41||
    !paths.includes('alternative-receipt.json'))
  stop('expected exact original 242-file NEW LIVE worker tree');
 const digest=sha(Buffer.from(paths.map(p=>p+'\0'+sha(readFileSync(join(root,p)))+'\n').join('')));
 if(digest!==TREE_SHA)stop('original extracted archive differs from sealed PR267');
 const cfgFile=join(root,'server/wrangler.json'),receiptFile=join(root,'alternative-receipt.json');
 if(sha(readFileSync(cfgFile))!==CONFIG_SHA||sha(readFileSync(receiptFile))!==RECEIPT_SHA)
  stop('original immutable config/receipt digest mismatch');
 const config=json(cfgFile),receipt=json(receiptFile);
 if(receipt.kind!=='FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'||
    receipt.reviewedSourceSha!==SOURCE_SHA||receipt.sourceCompiledFiles!==242||
    receipt.worker!=='fire-fullapp-new-live'||receipt.assetFileCount!==41||
    receipt.assetBytes!==5233329||receipt.sourceOnly!==true||
    receipt.cloudflareContacted!==false||receipt.workerDeployed!==false||
    receipt.ownerApprovedDeployment!==false||receipt.ownerAuthenticationEnabled!==false||
    receipt.physicalD1Bound!==false||receipt.newLiveSchemaPhysicallyVerified!==false||
    receipt.firstJob0001CleanStartVerified!==false||receipt.liveActivationAuthorized!==false||
    receipt.cloudflareAssetsUploadSessionRequired!==false||receipt.paidR2Required!==false||
    !Array.isArray(receipt.clientAssets)||receipt.clientAssets.length!==41)
  stop('original NEW LIVE receipt prematurely claims release or is wrong target');
 if(config.name!=='fire-fullapp-new-live'||config.main!=='fire-noassets-entry.mjs'||
    config.no_bundle!==true||config.find_additional_modules!==true||
    config.preserve_file_names!==true||config.workers_dev!==true||
    config.preview_urls!==undefined||config.assets!==undefined||
    config.routes!==undefined||config.route!==undefined||
    config.account_id!==undefined||config.zone_id!==undefined||
    config.legacy_env!==undefined||
    !same(config.r2_buckets,[])||
    !same(config.d1_databases,[{binding:'DB',
      database_name:'fire-fullapp-new-live-db',database_id:PLACEHOLDER}])||
    !same(config.vars,{FIRE_ENV:'new-live-prelaunch',
      SITE_ORIGIN:'https://fire-fullapp-new-live.kyle-bfc.workers.dev',
      FIRE_NEW_LIVE_AUTH_ENABLED:'blocked'})||
    !same(config.secrets?.required,
     ['FIRE_NEW_LIVE_PASSWORD_HASH','FIRE_NEW_LIVE_SESSION_SECRET'])||
    config.kv_namespaces?.length||config.services?.length||config.migrations?.length||
    config.triggers?.crons?.length||config.durable_objects?.bindings?.length)
  stop('unexpected original Worker, storage, D1, auth, migration or route');
 const knownPath=new Set(),knownModule=new Set();
 let total=0;
 for(const a of receipt.clientAssets){
  if(typeof a?.path!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(a.path)||
     a.path.includes('..')||a.path.includes('//')||knownPath.has(a.path)||
     typeof a.module!=='string'||
     !/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(a.module)||
     knownModule.has(a.module)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||
     !/^[a-f0-9]{64}$/.test(a.sha256))
   stop('malformed duplicate source binary client asset');
  const p='server/'+a.module;
  if(!paths.includes(p))stop('client asset missing');
  const bytes=readFileSync(join(root,p));
  if(bytes.length!==a.bytes||sha(bytes)!==a.sha256)stop('original client data hash mismatch');
  knownPath.add(a.path);knownModule.add(a.module);
  total+=bytes.length;
 }
 if(total!==5233329||
    paths.some(p=>p.startsWith('server/fire-inline-assets/asset-')&&
      !knownModule.has(p.slice('server/'.length)))||
    !knownPath.has('/fire-offline/index.html')||
    !knownPath.has('/fire-offline/app.js')||
    !knownPath.has('/fire-offline/app.css')||
    ![...knownPath].some(p=>p.startsWith('/_next/static/chunks/')))
  stop('incomplete original QA-master client asset map');
 return {root,paths,config,receipt,digest};
}
export function prepareNewLiveBoundDarkWorker(source,destination){
 const before=reviewOriginalNewLive(source),out=resolve(destination);
 if(existsSync(out)||out===before.root||
    out.startsWith(before.root+sep)||before.root.startsWith(out+sep))
  stop('output must be new absent, not overlapping source');
 mkdirSync(out,{mode:0o700});
 cpSync(join(before.root,'server'),join(out,'server'),
   {recursive:true,errorOnExist:true,force:false});
 copyFileSync(join(before.root,'alternative-receipt.json'),join(out,'alternative-receipt.json'));
 // Original PR267 binary archive precedes the first-request security lock.
 // Refresh ONLY its tiny Worker adapter; never rewrite the compiled QA-master
 // SSR modules, embedded 41 client Data assets, or original saved receipt.
 const runtimeRel='server/fire-inline-assets/runtime.mjs';
 const originalRuntimeSha256=sha(readFileSync(join(before.root,runtimeRel)));
 const guardedRuntime=readFileSync(new URL('./dr_noassets_runtime.mjs',import.meta.url));
 const runtimeText=guardedRuntime.toString('utf8');
 if(!runtimeText.includes('if(!approvedDR&&!approvedLive)')||
    !runtimeText.includes("'Cache-Control':'private, no-store'")||
    !runtimeText.includes('status:404')||
    !runtimeText.includes('packaged environment identity missing')||
    !runtimeText.includes("expectedTarget==='new-live-prelaunch'"))
  stop('current source lacks reviewed first-request locked runtime');
 writeFileSync(join(out,runtimeRel),guardedRuntime);
 const guardedRuntimeSha256=sha(guardedRuntime);
 const entryRel='server/fire-noassets-entry.mjs';
 const priorEntry=readFileSync(join(before.root,entryRel),'utf8');
 const oldCall='wrapInertDRWorker(server,manifest);';
 if(!priorEntry.includes(oldCall)||priorEntry.split(oldCall).length!==2)
  stop('sealed original entry is not the reviewed unbound source');
 const nextEntry=priorEntry.replace(oldCall,
  'wrapInertDRWorker(server,manifest,"new-live-prelaunch");');
 writeFileSync(join(out,entryRel),nextEntry);
 const priorEntrySha256=sha(Buffer.from(priorEntry));
 const lockedEntrySha256=sha(Buffer.from(nextEntry));
 const config=structuredClone(before.config);
 config.d1_databases=[{binding:'DB',database_name:'fire-fullapp-new-live-db',
   database_id:LIVE_UUID}];
 config.vars={...config.vars,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'};
 config.workers_dev=false;
 config.preview_urls=false;
 if(config.assets!==undefined||config.route!==undefined||
    config.routes!==undefined||config.r2_buckets.length||
    config.vars.FIRE_NEW_LIVE_AUTH_ENABLED!=='blocked'||
    config.vars.FIRE_NEW_LIVE_CLEAN_START!==undefined)
  stop('candidate unexpectedly enables public route/auth/paid storage or release');
 const cfgFile=join(out,'server/wrangler.json');
 writeFileSync(cfgFile,JSON.stringify(config,null,2)+'\n');
 let sameFiles=0;
 for(const p of before.paths){
  if(p==='server/wrangler.json'||p===runtimeRel||p===entryRel)continue;
  if(sha(readFileSync(join(before.root,p)))!==sha(readFileSync(join(out,p))))
   stop('original SSR/static/receipt bytes unexpectedly changed');
  sameFiles++;
 }
 if(sameFiles!==239)stop('not every original non-adapter file preserved');
 if(sha(readFileSync(join(out,runtimeRel)))!==guardedRuntimeSha256||
    sha(readFileSync(join(out,entryRel)))!==lockedEntrySha256)
  stop('target-bound first-request release lock/entry was not saved exactly');
 const proof={
  kind:'FIRE_NEW_LIVE_PHYSICAL_D1_DARK_PREHOST_SOURCE_ONLY_V1',
  sourceSha:SOURCE_SHA,originalGitHubArtifactId:SOURCE_ARTIFACT,
  originalGitHubZipSha256:ZIP_SHA,originalCompleteFileTreeSha256:TREE_SHA,
  originalReceiptSha256:RECEIPT_SHA,originalConfigSha256:CONFIG_SHA,
  resultingConfigSha256:sha(readFileSync(cfgFile)),
  originalUnchangedFileCount:239,originalUnchangedClientAssets:41,
  originalArchiveRuntimeSha256:originalRuntimeSha256,
  refreshedFirstRequestRuntimeSha256:guardedRuntimeSha256,
  originalArchiveEntrySha256:priorEntrySha256,
  refreshedTargetBoundEntrySha256:lockedEntrySha256,
  immutableExpectedWorkerTarget:'new-live-prelaunch',
  firstRequestLockCopiedIntoFinalSource:true,
  originalSSRAnd41DataAssetsByteIdentical:true,
  worker:'fire-fullapp-new-live',existingPhysicalNewLiveD1:LIVE_UUID,
  distinctDRD1:DR_UUID,photoStorageMode:'owner-device-zip',
  workersDevPublicRoute:false,versionPreviewUrls:false,
  customRoutes:false,paidR2Required:false,ownerAuthEnabled:false,
  newLive26MigrationsPhysicallyVerified:false,
  firstJob0001CleanStartPhysicallyVerified:false,
  financialRefundJournalPhysicallyVerified:false,
  firstCloudflareWorkerCreationAuthorized:false,
  providerWorkerExistsVerified:false,providerAccountVerified:false,
  cloudflareProviderContacted:false,remoteD1OperationPerformed:false,
  workerUploaded:false,workerDeployed:false,hostedPrivacyVerified:false,
  releaseAuthorized:false,gate4Accepted:false,gate5Accepted:false,
  gate6Accepted:false,gate7Accepted:false,gate9Accepted:false,
  gate10Accepted:false,requiresFreshExactOwnerAuthorization:true
 };
 writeFileSync(join(out,'new-live-physical-dark-prehost-receipt.json'),
   JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:'NEW_LIVE_SOURCE_ONLY_PHYSICAL_D1_DARK_PREHOST',
   sourceSha:SOURCE_SHA,d1Id:LIVE_UUID,assetsPreserved:41,
   originalFilesPreserved:241,authBlocked:true,
   job0001PhysicallyVerified:false,providerContacted:false,
   deployed:false,output:out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)stop('usage: ORIGINAL_VERIFIED_PR267_EXTRACT NEW_ABSENT_OUTPUT');
  console.log(JSON.stringify(prepareNewLiveBoundDarkWorker(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
