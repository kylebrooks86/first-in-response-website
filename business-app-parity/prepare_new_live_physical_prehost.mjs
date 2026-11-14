/**
 * Prepare the first independently D1-bound NEW LIVE Worker-only QA-master
 * SOURCE package from the exact, already accepted PR267 archive.
 *
 * NO Cloudflare network, D1 schema write, deploy, auth, Stripe, or paid R2.
 * Actual NEW LIVE D1 remains physically UNMIGRATED in the retained evidence;
 * this only changes a new local Wrangler config, never app source/modules.
 * Refuse first creation, login and Job #0001 activation until the separately
 * owner-authorized exact 26-migration physical readback & release approvals.
 */
import {createHash} from 'node:crypto';
import {cpSync,existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ORIGINAL_SOURCE_SHA='3ee92374dca6322955fdd5f920a95e0864a9654f';
export const ORIGINAL_ARTIFACT_ID=14101058770;
export const ORIGINAL_ZIP_SHA256='7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3';
// Independent SHA of ALL 242 original extracted paths and their byte SHAs,
// separately computed from actual retained GitHub Actions ZIP (not source text).
export const ORIGINAL_EXTRACTED_FILES_SHA256='ebce69a7eabb00a30c128ca02bdfe99cba377afed916e58bd1b3175c5047453a';
const LIVE_NAME='fire-fullapp-new-live';
const LIVE_DB='fire-fullapp-new-live-db';
const LIVE_UUID='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const DR_UUID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const ORIGIN='https://fire-fullapp-new-live.kyle-bfc.workers.dev';
const fail=x=>{throw Error('FIRE NEW LIVE prehost BLOCKED: '+x);};
const sha=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const empty=x=>x===undefined||x===null||(Array.isArray(x)&&x.length===0)||
 (x&&typeof x==='object'&&!Array.isArray(x)&&Object.values(x).every(empty));
function allOrdinaryFiles(root){
 if(!existsSync(root)||lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())
  fail('input must be an existing, ordinary extracted ZIP folder');
 const list=[];
 function walk(folder){
  for(const name of readdirSync(folder).sort()){
   const p=join(folder,name),meta=lstatSync(p);
   if(meta.isSymbolicLink())fail('symlink in original source');
   if(meta.isDirectory()){walk(p);continue;}
   if(!meta.isFile()||meta.nlink!==1)fail('linked, special or unreviewed file in original archive');
   list.push({path:relative(root,p).replaceAll('\\','/'),sha256:sha(readFileSync(p))});
  }
 }
 walk(root);
 return list.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
const json=p=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch{fail('missing immutable original release receipt or Wrangler configuration');}};
export function reviewOriginalNewLiveWorker(input){
 const root=resolve(input),files=allOrdinaryFiles(root);
 if(files.length!==242||sha(Buffer.from(JSON.stringify(files)))!==ORIGINAL_EXTRACTED_FILES_SHA256)
  fail('original PR267 242-byte-file GitHub ZIP identity differs; no output');
 const cfg=json(join(root,'server','wrangler.json'));
 const receipt=json(join(root,'alternative-receipt.json'));
 if(receipt.kind!=='FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'||
    receipt.reviewedSourceSha!==ORIGINAL_SOURCE_SHA||
    receipt.sourceCompiledFiles!==242||receipt.assetFileCount!==41||
    receipt.assetBytes!==5233329||receipt.serverOriginalBytes!==4138880||
    receipt.originalFilesDigestSha256!=='bdaff8f0ad632e9a6e84f55431e68b8f38cf9aeb35d0ee8e9f6628091c69f4a4'||
    receipt.worker!==LIVE_NAME||receipt.sourceOnly!==true||
    receipt.cloudflareContacted!==false||receipt.cloudflareAssetsUploadSessionRequired!==false||
    receipt.externalStaticStorageRequired!==false||receipt.paidR2Required!==false||
    receipt.workerDeployed!==false||receipt.ownerApprovedDeployment!==false||
    receipt.physicalD1Bound!==false||receipt.ownerAuthenticationEnabled!==false||
    receipt.newLiveSchemaPhysicallyVerified!==false||
    receipt.firstJob0001CleanStartVerified!==false||receipt.liveActivationAuthorized!==false||
    !Array.isArray(receipt.clientAssets)||receipt.clientAssets.length!==41)
  fail('incorrect historic NEW LIVE origin/source, physical or release proof');
 if(cfg.name!==LIVE_NAME||cfg.topLevelName!==LIVE_NAME||
    cfg.main!=='fire-noassets-entry.mjs'||cfg.no_bundle!==true||
    cfg.find_additional_modules!==true||cfg.preserve_file_names!==true||
    cfg.workers_dev!==true||cfg.preview_urls!==undefined||
    cfg.assets!==undefined||cfg.legacy_env!==undefined||
    cfg.account_id!==undefined||cfg.zone_id!==undefined||
    cfg.route!==undefined||cfg.routes!==undefined||cfg.env!==undefined||
    !same(cfg.d1_databases,[{binding:'DB',database_name:LIVE_DB,database_id:PLACEHOLDER}])||
    !same(cfg.r2_buckets,[])||
    !same(cfg.vars,{
      FIRE_ENV:'new-live-prelaunch',SITE_ORIGIN:ORIGIN,FIRE_NEW_LIVE_AUTH_ENABLED:'blocked'
    })||
    !same(cfg.secrets?.required,['FIRE_NEW_LIVE_PASSWORD_HASH','FIRE_NEW_LIVE_SESSION_SECRET'])||
    !empty(cfg.kv_namespaces)||!empty(cfg.services)||!empty(cfg.durable_objects)||
    !empty(cfg.queues)||!empty(cfg.triggers)||!empty(cfg.unsafe)||
    !empty(cfg.workflows)||!empty(cfg.dispatch_namespaces)||
    !empty(cfg.analytics_engine_datasets)||!empty(cfg.hyperdrive)||
    !empty(cfg.send_email)||!empty(cfg.pipelines)||!empty(cfg.vectorize)||
    !empty(cfg.ai_search_namespaces)||!empty(cfg.secrets_store_secrets)||
    !empty(cfg.worker_loaders)||!empty(cfg.ratelimits)||!empty(cfg.artifacts))
  fail('source Worker has unreviewed account, route, database, login or paid/external binding');
 const knownPaths=new Set(),knownModules=new Set();
 let total=0;
 for(const asset of receipt.clientAssets){
  if(typeof asset?.path!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(asset.path)||
     asset.path.includes('..')||asset.path.includes('//')||
     typeof asset.module!=='string'||
     !/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(asset.module)||
     !Number.isSafeInteger(asset.bytes)||asset.bytes<=0||asset.bytes>16*1024*1024||
     !/^[a-f0-9]{64}$/.test(asset.sha256)||typeof asset.type!=='string'||
     knownPaths.has(asset.path)||knownModules.has(asset.module))
    fail('malformed or unreviewed original client asset');
  knownPaths.add(asset.path);knownModules.add(asset.module);
  const data=readFileSync(join(root,'server',asset.module));
  if(data.length!==asset.bytes||sha(data)!==asset.sha256)
    fail('client asset byte SHA differs from original accepted QA-master');
  total+=data.length;
 }
 if(total!==receipt.assetBytes||!knownPaths.has('/fire-offline/index.html')||
    !knownPaths.has('/fire-offline/app.js')||!knownPaths.has('/fire-offline/app.css')||
    ![...knownPaths].some(p=>p.startsWith('/_next/static/chunks/'))||
    ![...knownPaths].some(p=>p.startsWith('/_next/static/css/')))
  fail('original full QA-master client asset coverage lost');
 if(!files.some(f=>f.path==='server/index.js')||
    !files.some(f=>f.path==='server/fire-noassets-entry.mjs')||
    !files.some(f=>f.path==='server/fire-inline-assets/runtime.mjs')||
    !files.some(f=>f.path==='server/fire-inline-assets/manifest.mjs'))
  fail('original QA-master SSR or no-assets entry missing');
 return {root,cfg,receipt,files};
}
export function prepareNewLivePhysicalPrehost(original,destination){
 const reviewed=reviewOriginalNewLiveWorker(original),out=resolve(destination);
 if(existsSync(out)||out===reviewed.root||out.startsWith(reviewed.root+sep)||
    reviewed.root.startsWith(out+sep))
  fail('output must be a brand-new disjoint private folder');
 mkdirSync(out,{recursive:false,mode:0o700});
 cpSync(join(reviewed.root,'server'),join(out,'server'),
  {recursive:true,errorOnExist:true,force:false});
 const next=structuredClone(reviewed.cfg);
 // A provider-created NEW LIVE D1 UUID is known from previous owner receipt;
 // its 26 migration schema is NOT physically applied or verified yet.
 next.d1_databases=[{binding:'DB',database_name:LIVE_DB,database_id:LIVE_UUID}];
 next.vars={...next.vars,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'};
 // If independently approved later, first Worker creation would install an
 // active VERSION. Disable both public URL surfaces, do NOT enable login.
 next.workers_dev=false;
 next.preview_urls=false;
 if(next.vars.FIRE_NEW_LIVE_AUTH_ENABLED!=='blocked'||next.assets!==undefined||
    next.r2_buckets.length!==0||next.route||next.routes||LIVE_UUID===DR_UUID)
  fail('prohibited public route, owner auth, shared D1 or paid storage');
 const conf=join(out,'server','wrangler.json');
 writeFileSync(conf,JSON.stringify(next,null,2)+'\n');
 const originalModules=reviewed.files.filter(v=>v.path.startsWith('server/')&&v.path!=='server/wrangler.json');
 for(const file of originalModules){
  if(sha(readFileSync(join(out,file.path)))!==file.sha256)
   fail('compiled SSR or client asset changed while copying into NEW LIVE');
 }
 const proof={
  kind:'FIRE_NEW_LIVE_PHYSICAL_D1_SOURCE_ONLY_DARK_PREHOST_V1',
  sourceOriginalSha:ORIGINAL_SOURCE_SHA,
  originalGitHubArtifactId:ORIGINAL_ARTIFACT_ID,
  originalGitHubZipSha256:ORIGINAL_ZIP_SHA256,
  originalUnpacked242FilesSha256:ORIGINAL_EXTRACTED_FILES_SHA256,
  originalNoAssetsReceiptSha256:sha(readFileSync(join(reviewed.root,'alternative-receipt.json'))),
  originalWranglerConfigSha256:sha(readFileSync(join(reviewed.root,'server','wrangler.json'))),
  newWranglerConfigSha256:sha(readFileSync(conf)),
  workerName:LIVE_NAME,databaseName:LIVE_DB,databaseId:LIVE_UUID,
  verifiedSeparateFromDR:LIVE_UUID!==DR_UUID,
  ownerCreatedPhysicalD1PreviouslyConfirmed:true,
  originalQAClientAssetsSHA256Matched:41,originalServerModulesUnchanged:true,
  physicalNewLive26MigrationsAppliedOrVerified:false,
  remoteNewLiveSchemaCurrentlyVerified:false,
  firstRealJob0001PhysicallyVerified:false,ownerAuthenticationEnabled:false,
  publicWorkersDevEnabled:false,previewVersionUrlsEnabled:false,
  customRoutesEnabled:false,paidR2OrExternalStorageEnabled:false,
  workerAlreadyExistsVerified:false,firstWorkerCreationAuthorized:false,
  providerContacted:false,workerUploaded:false,workerDeployed:false,
  liveStripeEnabled:false,liveActivationAuthorized:false,
  gate4Accepted:false,gate5Accepted:false,gate6Accepted:false,
  gate7Accepted:false,gate9Accepted:false,gate10Accepted:false,
  requiresExactOwnerAuthorizedSchemaMigrationBeforeHostOrLogin:true,
  note:'SOURCE CONFIG ONLY. NO Cloudflare, migration or first deploy. Do not infer remote D1 schema or clean first Job #0001 from owner D1 creation.'
 };
 writeFileSync(join(out,'new-live-physical-prehost-source-receipt.json'),
  JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:'NEW_LIVE_PHYSICAL_D1_BOUND_LOCALLY_AND_PUBLIC_ROUTES_OFF__NEVER_DEPLOYED',
  sourceSha:ORIGINAL_SOURCE_SHA,workerName:LIVE_NAME,
  existingDatabaseUUID:LIVE_UUID,clientAssetsVerified:41,
  compiledModulesUnchanged:originalModules.length,
  remote26MigrationsApplied:false,firstRealJob0001Verified:false,
  publicRoutes:false,ownerAuthEnabled:false,providerContacted:false,
  deployed:false,ownerApprovalRequired:true,output:out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)fail('usage: VERIFIED_EXTRACTED_PR267_ZIP NEW_ABSENT_PRIVATE_FOLDER');
  console.log(JSON.stringify(prepareNewLivePhysicalPrehost(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
