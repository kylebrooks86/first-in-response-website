/**
 * FIRE physical-DR no-R2 Worker PRE-HOST candidate, never a deployment.
 *
 * Input is the already GitHub-ZIP-digest-verified/extracted exact PR266
 * Worker-only source artifact. The original SHA is permanently pinned below.
 * Copies the unchanged QA-master Worker modules and 41 client Data modules,
 * changing ONLY the independent DR D1 binding and the explicit owner-device
 * photo mode. AUTH ALWAYS BLOCKED; no route, secret, Stripe, network or D1 write.
 *
 * CLI: node prepare_dr_bound_noassets_worker.mjs VERIFIED_EXTRACTED_ALTERNATIVE NEW_ABSENT_OUTPUT
 * The owner previously accepted 26/26 physical DR schema proof and 242/242
 * original code/receipt; this does not re-run or newly re-attest those events.
 */
import {createHash} from 'node:crypto';
import {cpSync,existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,writeFileSync}
 from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE_SHA='37d94452772459334466e37010067395acafc696';
const PRIOR_GITHUB_ARTIFACT_ID=14101337096;
const PRIOR_ZIP_SHA256='f61b28b6b0f8e669f9863be995cf7d56d527a51d012ee9e77083fb260c059719';
const DR_UUID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const DR_NAME='fire-fullapp-dr', DR_D1_NAME='fire-fullapp-dr-db';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const ORIGIN='https://fire-fullapp-dr.kyle-bfc.workers.dev';
const sha=x=>createHash('sha256').update(x).digest('hex');
const stop=msg=>{throw Error('FIRE physical DR prehost BLOCKED: '+msg);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// The real accepted Wrangler output contains declared but EMPTY provider
// binding wrappers: e.g. queues:{producers:[],consumers:[]} and
// durable_objects:{bindings:[]}. Reject non-empty entries, not the wrappers.
const empty=x=>x===undefined||x===null||
 (Array.isArray(x)&&x.length===0)||
 (x&&typeof x==='object'&&!Array.isArray(x)&&Object.values(x).every(empty));
function assertOrdinaryTree(root){
 if(!existsSync(root)||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())
  stop('source must be existing plain unpacked, private release folder');
 const files=[];
 function visit(folder){
  for(const name of readdirSync(folder).sort()){
   const path=join(folder,name),meta=lstatSync(path);
   if(meta.isSymbolicLink())stop('source includes a symlink');
   if(meta.isDirectory()){visit(path);continue;}
   if(!meta.isFile()||meta.nlink!==1)stop('source includes unreviewed link or device');
   files.push(relative(root,path).replaceAll('\\','/'));
  }
 }
 visit(root);
 return files;
}
const json=path=>{try{return JSON.parse(readFileSync(path,'utf8'))}catch{stop('release JSON not readable');}};
export function reviewDRWorkerSource(source){
 const root=resolve(source),paths=assertOrdinaryTree(root);
 const cfg=json(join(root,'server','wrangler.json'));
 const receipt=json(join(root,'alternative-receipt.json'));
 if(receipt.kind!=='FIRE_SOURCE_ONLY_ALTERNATIVE_DR_NO_ASSETS_UPLOAD_V1'||
    receipt.reviewedSourceSha!==BASE_SHA||
    receipt.sourceCompiledFiles!==242||
    receipt.worker!==DR_NAME||
    receipt.sourceOnly!==true||
    receipt.cloudflareAssetsUploadSessionRequired!==false||
    receipt.paidR2Required!==false||
    receipt.externalStaticStorageRequired!==false||
    receipt.workerDeployed!==false||receipt.ownerApprovedDeployment!==false||
    receipt.ownerAuthenticationEnabled!==false||
    receipt.physicalD1Bound!==false||
    !Array.isArray(receipt.clientAssets)||receipt.assetFileCount!==41||
    receipt.clientAssets.length!==41)
  stop('not the exact previously accepted inert DR Worker-only source version');
 if(cfg.name!==DR_NAME||cfg.main!=='fire-noassets-entry.mjs'||
    cfg.no_bundle!==true||cfg.find_additional_modules!==true||
    cfg.preserve_file_names!==true||cfg.workers_dev!==true||
    cfg.legacy_env!==undefined||cfg.assets!==undefined||
    cfg.env!==undefined||cfg.account_id!==undefined||cfg.zone_id!==undefined||
    cfg.route!==undefined||cfg.routes!==undefined||
    cfg.vars?.FIRE_ENV!=='isolated-dr'||
    cfg.vars?.SITE_ORIGIN!==ORIGIN||
    cfg.vars?.FIRE_DR_AUTH_ENABLED!=='blocked'||
    !equal(Object.keys(cfg.vars||{}).sort(),
      ['FIRE_ENV','SITE_ORIGIN','FIRE_DR_AUTH_ENABLED'].sort())||
    !equal(cfg.secrets?.required,['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET'])||
    !equal(cfg.d1_databases,[{binding:'DB',database_name:DR_D1_NAME,database_id:PLACEHOLDER}])||
    !equal(cfg.r2_buckets,[])||
    !empty(cfg.kv_namespaces)||!empty(cfg.services)||
    !empty(cfg.durable_objects)||!empty(cfg.queues)||
    !empty(cfg.unsafe)||!empty(cfg.triggers)||
    !empty(cfg.workflows)||!empty(cfg.analytics_engine_datasets)||
    !empty(cfg.vectorize)||!empty(cfg.ai_search_namespaces)||
    !empty(cfg.ai_search)||!empty(cfg.hyperdrive)||
    !empty(cfg.dispatch_namespaces)||!empty(cfg.worker_loaders)||
    !empty(cfg.ratelimits)||!empty(cfg.send_email)||
    !empty(cfg.pipelines)||!empty(cfg.vpc_services)||
    !empty(cfg.vpc_networks)||!empty(cfg.mtls_certificates)||
    !empty(cfg.secrets_store_secrets)||!empty(cfg.artifacts)||
    !empty(cfg.cloudchamber)||!empty(cfg.logfwdr)||
    !empty(cfg.unsafe_hello_world)||!empty(cfg.flagship))
  stop('unapproved Worker binding, SSR entry, account, external route, paid storage or login');
 if(!paths.includes('server/index.js')||
    !paths.includes('server/fire-noassets-entry.mjs')||
    !paths.includes('server/fire-inline-assets/manifest.mjs')||
    !paths.includes('server/fire-inline-assets/runtime.mjs'))
  stop('original QA-master SSR, static module adapter or entry missing');
 const metaPaths=new Set(),modulePaths=new Set();
 let total=0;
 for(const asset of receipt.clientAssets){
  if(typeof asset?.path!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(asset.path)||
     asset.path.includes('..')||asset.path.includes('//')||
     typeof asset.module!=='string'||
     !/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(asset.module)||
     !Number.isSafeInteger(asset.bytes)||asset.bytes<=0||asset.bytes>16*1024*1024||
     !/^[a-f0-9]{64}$/.test(asset.sha256)||typeof asset.type!=='string'||
     metaPaths.has(asset.path)||modulePaths.has(asset.module))
   stop('malformed, overlapping, duplicate or unreviewed public client Data module');
  metaPaths.add(asset.path);modulePaths.add(asset.module);
  const path='server/'+asset.module;
  if(!paths.includes(path))stop('expected source asset module missing: '+asset.module);
  const bytes=readFileSync(join(root,path));
  if(bytes.length!==asset.bytes||sha(bytes)!==asset.sha256)
   stop('actual client Data module does not match original verified source');
  total+=bytes.length;
 }
 if(total!==receipt.assetBytes||paths.some(p=>
  p.startsWith('server/fire-inline-assets/asset-')&&!modulePaths.has(p.slice('server/'.length))))
  stop('client asset inventory differs from previously compiled QA-master');
 if(receipt.clientAssets.some(a=>a.path.startsWith('/.'))||
    !metaPaths.has('/fire-offline/index.html')||
    !metaPaths.has('/fire-offline/app.js')||
    !metaPaths.has('/fire-offline/app.css')||
    ![...metaPaths].some(p=>p.startsWith('/_next/static/chunks/'))||
    ![...metaPaths].some(p=>p.startsWith('/_next/static/css/')))
  stop('original field app or application static routes missing');
 return {config:cfg,receipt,source:root,paths};
}
export function prepareDRPhysicalBoundWorker(source,destination){
 const before=reviewDRWorkerSource(source),to=resolve(destination);
 if(existsSync(to)||to===before.source||
    to.startsWith(before.source+sep)||before.source.startsWith(to+sep))
  stop('output must be a NEW separate absent folder, without source overlap');
 // Preserve all original runtime modules and actual public file bytes.
 // Do NOT touch source or create a new Cloudflare Worker.
 mkdirSync(to,{recursive:false,mode:0o700});
 cpSync(join(before.source,'server'),join(to,'server'),{recursive:true,errorOnExist:true,force:false});
 const oldCfg=join(to,'server','wrangler.json');
 const cfg=structuredClone(before.config);
 cfg.d1_databases=[{binding:'DB',database_name:DR_D1_NAME,database_id:DR_UUID}];
 cfg.vars={...cfg.vars,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'};
 // Never enable login or add external routes in a physical binding artifact.
 if(cfg.vars.FIRE_DR_AUTH_ENABLED!=='blocked'||cfg.assets||cfg.r2_buckets.length)
  stop('no-assets / owner auth / no-R2 invariant violated after binding');
 writeFileSync(oldCfg,JSON.stringify(cfg,null,2)+'\n');
 // The original alternative receipt is retained unmodified and explicitly
 // refers to the prior UNBOUND input. A separate record describes this new
 // physical target WITHOUT claiming hosted provider/resource re-verification.
 const originalHashes=before.paths.filter(p=>p.startsWith('server/')&&
    p!=='server/wrangler.json').map(p=>({path:p,sha256:sha(readFileSync(join(before.source,p)))}));
 const outputHashes=originalHashes.map(p=>({path:p.path,
  sha256:sha(readFileSync(join(to,p.path)))}));
 if(!equal(outputHashes,originalHashes))
  stop('SSR or static module changed during physical binding preparation');
 const proof={
  kind:'FIRE_DR_PREHOST_EXISTING_PHYSICAL_D1_BINDING_SOURCE_ONLY_V1',
  fromSourceSha:BASE_SHA,priorGitHubArtifactId:PRIOR_GITHUB_ARTIFACT_ID,
  independentlyPinnedPriorArtifactZipSha256:PRIOR_ZIP_SHA256,
  originalPublicAssetCount:41,originalPublicAssetsSha256Verified:true,
  originalSourceServerModulesUnchanged:true,
  copiedServerModulesSha256:sha(Buffer.from(JSON.stringify(outputHashes))),
  oldNoAssetsSourceReceiptSha256:sha(readFileSync(join(before.source,'alternative-receipt.json'))),
  newConfigSha256:sha(readFileSync(oldCfg)),
  drWorkerName:DR_NAME,physicalDRDatabaseName:DR_D1_NAME,
  physicalDRDatabaseId:DR_UUID,
  originalDR26MigrationsPreviouslyOwnerAccepted:true,
  originalDR242CompiledPhysicalBridgePreviouslyOwnerAccepted:true,
  cloudflareWorkerExistsIndependentlyVerified:false,
  cloudflareFirstWorkerCreationAuthorized:false,
  cloudflareHostedRuntimeVerified:false,providerContacted:false,
  workerUploaded:false,workerDeployed:false,
  physicalD1BindingInConfigPrepared:true,
  physicalD1BindingDeployed:false,
  ownerLoginEnabled:false,paidStorageRequired:false,
  qaStagingAndLiveUntouched:true,
  gate4Accepted:false,gate5Accepted:false,gate6Accepted:false,
  gate7Accepted:false,gate9Accepted:false,gate10Accepted:false,
  separateExactOwnerAuthorizationRequired:true
 };
 writeFileSync(join(to,'dr-physical-prehost-source-receipt.json'),
  JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});
 return {
  status:'FIRE_EXISTING_DR_PHYSICAL_D1_PREHOST_PACKAGE_CREATED__NOT_DEPLOYED',
  sourceSha:BASE_SHA,worker:DR_NAME,d1DatabaseId:DR_UUID,
  modulesUnchanged:originalHashes.length,publicAssetsVerified:41,
  providerContacted:false,deployed:false,
  firstWorkerCreationAuthorized:false,ownerAuthEnabled:false,
  output:to
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)stop('usage: VERIFIED_EXTRACTED_NOASSETS_DR NEW_ABSENT_FOLDER');
  console.log(JSON.stringify(prepareDRPhysicalBoundWorker(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
