/**
 * FIRE current-source DR/NEW LIVE FIRST-CREATE DARK REVIEW PACKAGE.
 *
 * Unlike the historical PR267/268 archive wrappers, this prepares the
 * physically named but deliberately unactivated Worker from the CURRENT
 * immutable QA-master compiled release and its exact build-time SHA seal.
 * Inputs are existing, source-only no-assets Worker Data modules; NO provider
 * calls, Cloudflare login, Stripe, migration, upload or subscription.
 *
 * node prepare_current_dark_worker_package.mjs dr|new-live ALTERNATIVE_DIR COMPILED_SEAL_JSON EXACT_COMMIT_SHA NEW_ABSENT_OUTPUT
 * node prepare_current_dark_worker_package.mjs verify dr|new-live SAVED_OUTPUT
 *
 * First Worker creation is a provider WRITE and needs separate exact owner
 * approval. This tool never executes wrangler deploy.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,cpSync,copyFileSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assetContentType} from './dr_noassets_runtime.mjs';

const stop=why=>{throw Error('FIRE CURRENT DARK SOURCE BLOCKED: '+why)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const digestFile=p=>hash(readFileSync(p));
const identical=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const SHA=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const HASH=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const DR_DB='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const LIVE_DB='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const TARGETS=Object.freeze({
 dr:{worker:'fire-fullapp-dr',env:'isolated-dr',db:'fire-fullapp-dr-db',uuid:DR_DB,prefix:'FIRE_DR',sealKind:'FIRE_SOURCE_ONLY_INERT_DR_COMPILED_ARTIFACT_V1',sealTarget:'independent-dr',receiptKind:'FIRE_SOURCE_ONLY_ALTERNATIVE_DR_NO_ASSETS_UPLOAD_V1'},
 'new-live':{worker:'fire-fullapp-new-live',env:'new-live-prelaunch',db:'fire-fullapp-new-live-db',uuid:LIVE_DB,prefix:'FIRE_NEW_LIVE',sealKind:'FIRE_SOURCE_ONLY_INERT_NEW_LIVE_COMPILED_ARTIFACT_V1',sealTarget:'independent-live',receiptKind:'FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'}
});
const inert=v=>v===undefined||v===null||(Array.isArray(v)&&v.every(inert))||
 (typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(inert));
const json=p=>{try{return JSON.parse(readFileSync(p,'utf8'))}catch{stop('missing or invalid JSON '+p)}};

function ordinaryFiles(root){
 if(!existsSync(root))stop('source directory missing');
 const st=lstatSync(root);
 if(!st.isDirectory()||st.isSymbolicLink())stop('source must be an ordinary directory');
 const paths=[];
 function walk(dir){
  for(const name of readdirSync(dir).sort()){
   const p=join(dir,name),meta=lstatSync(p);
   if(meta.isSymbolicLink())stop('symlink source refused');
   if(meta.isDirectory()){walk(p);continue;}
   if(!meta.isFile()||meta.nlink!==1)stop('hardlink/special file refused');
   paths.push(relative(root,p).split(sep).join('/'));
  }
 }
 walk(root);
 return paths.sort();
}
const record=(root,p)=>({path:p,bytes:readFileSync(join(root,p)).length,sha256:digestFile(join(root,p))});
function checkSeal(spec,seal,sha){
 if(!SHA(sha)||seal.kind!==spec.sealKind||seal.reviewedSourceSha!==sha||
    seal.reviewedPullRequest!==264||seal.target!==spec.sealTarget||
    seal[spec.sealTarget==='independent-dr'?'drWorker':'liveWorker']!==spec.worker||
    !Array.isArray(seal.files)||seal.files.length<10||
    seal.reviewedFileCount!==seal.files.length||
    !HASH(seal.filesDigestSha256)||
    hash(Buffer.from(JSON.stringify(seal.files)))!==seal.filesDigestSha256||
    seal.physicalDatabaseBindingAttempted!==false||
    seal.ownerAuthenticationEnabled!==false||
    seal.cloudflareUploaded!==false||seal.cloudflareDeployed!==false||
    seal.stripeActivated!==false||seal.ownerApprovedDeployment!==false)
  stop('compiled QA-master build seal wrong source/target/approval');
 const known=new Set();
 for(const item of seal.files){
  if(typeof item?.path!=='string'||!item.path.startsWith('server/')&&
      !item.path.startsWith('client/')||item.path.includes('..')||
      item.path.includes('//')||!HASH(item.sha256)||
      !Number.isSafeInteger(item.bytes)||item.bytes<1||known.has(item.path))
   stop('invalid, duplicate or unreviewed original build file');
  known.add(item.path);
 }
 if(!known.has('server/index.js')||!known.has('server/wrangler.json'))
  stop('original compiled QA-master server missing');
}

function checkConfig(cfg,spec,bound){
 const auth=spec.prefix+'_AUTH_ENABLED';
 const vars={FIRE_ENV:spec.env,SITE_ORIGIN:'https://'+spec.worker+'.kyle-bfc.workers.dev',
   [auth]:'blocked',...(bound?{FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'}:{})};
 const exactVars=a=>Object.entries(a||{}).sort(([x],[y])=>x.localeCompare(y));
 if(cfg.name!==spec.worker||cfg.main!=='fire-noassets-entry.mjs'||
    cfg.no_bundle!==true||cfg.find_additional_modules!==true||
    cfg.preserve_file_names!==true||cfg.workers_dev!==!bound||
    cfg.preview_urls!==(bound?false:undefined)||
    // The two sealed DARK private prelaunch packages must not inherit
    // compiler-default observability. Source-only archive still has no
    // provider contact; future deployment requires separate owner approval.
    (bound&&!identical(cfg.observability,{enabled:false}))||
    cfg.assets!==undefined||cfg.legacy_env!==undefined||
    cfg.build!==undefined||cfg.account_id!==undefined||
    cfg.zone_id!==undefined||cfg.env!==undefined||
    cfg.routes!==undefined||cfg.route!==undefined||
    !identical(cfg.rules,[{type:'ESModule',globs:['**/*.js','**/*.mjs']}])||
    !identical(exactVars(cfg.vars),exactVars(vars))||
    !identical(cfg.r2_buckets,[])||
    !identical(cfg.d1_databases,[{binding:'DB',database_name:spec.db,
       database_id:bound?spec.uuid:PLACEHOLDER}])||
    !identical(cfg.secrets?.required,[spec.prefix+'_PASSWORD_HASH',spec.prefix+'_SESSION_SECRET']))
  stop('wrong Worker, physical D1, R2, routes, auth, variables or source module rule');
 for(const key of ['kv_namespaces','services','durable_objects','triggers','queues','workflows',
    'dispatch_namespaces','analytics_engine_datasets','hyperdrive','send_email',
    'tail_consumers','unsafe','vectorize','migrations']){
  if(!inert(cfg[key]))stop('unapproved binding/trigger/other resource '+key);
 }
 if(DR_DB===LIVE_DB||spec.uuid===PLACEHOLDER)
  stop('DR and NEW LIVE must have distinct physical owner-recorded D1');
}

function exactEntry(target){
 const expected=target==='dr'?'isolated-dr':'new-live-prelaunch';
 return ['import server from "./index.js";',
 'import manifest from "./fire-inline-assets/manifest.mjs";',
 'import {wrapInertDRWorker} from "./fire-inline-assets/runtime.mjs";',
 'export default wrapInertDRWorker(server,manifest,"'+expected+'");',''].join('\n');
}
function exactAssetManifest(meta){
 const lines=[];
 for(let i=0;i<meta.length;i++)lines.push('import b'+i+' from "./'+meta[i].module.split('/').at(-1)+'";');
 lines.push('export default Object.freeze({');
 for(let i=0;i<meta.length;i++)lines.push('  '+JSON.stringify(meta[i].path)+':Object.freeze({data:b'+i+',type:'+JSON.stringify(meta[i].type)+'}),');
 lines.push('});');
 return lines.join('\n')+'\n';
}
function review(target,folder,seal,sha,bound){
 const spec=TARGETS[target];if(!spec)stop('choose dr or new-live');
 checkSeal(spec,seal,sha);
 const root=resolve(folder),paths=ordinaryFiles(root);
 const cfg=json(join(root,'server/wrangler.json'));
 checkConfig(cfg,spec,bound);
 const originalReceipt=json(join(root,'alternative-receipt.json'));
 if(originalReceipt.kind!==spec.receiptKind||
    originalReceipt.reviewedSourceSha!==sha||
    originalReceipt.originalFilesDigestSha256!==seal.filesDigestSha256||
    originalReceipt.sourceOnly!==true||originalReceipt.cloudflareContacted!==false||
    originalReceipt.workerDeployed!==false||
    originalReceipt.ownerApprovedDeployment!==false||
    originalReceipt.ownerAuthenticationEnabled!==false||
    originalReceipt.physicalD1Bound!==false||
    originalReceipt.paidR2Required!==false||
    originalReceipt.cloudflareAssetsUploadSessionRequired!==false||
    !Array.isArray(originalReceipt.clientAssets)||
    originalReceipt.assetFileCount!==originalReceipt.clientAssets.length||
    originalReceipt.assetFileCount<35||originalReceipt.assetFileCount>200||
    !Number.isSafeInteger(originalReceipt.assetBytes))
  stop('no-assets source receipt not proven inert and exact-current');
 const originalServer=seal.files.filter(f=>f.path.startsWith('server/')&&f.path!=='server/wrangler.json');
 const expected=new Set(['server/wrangler.json','server/fire-noassets-entry.mjs',
    'server/fire-inline-assets/runtime.mjs','server/fire-inline-assets/manifest.mjs',
    'alternative-receipt.json',...(bound?['reviewed-compiled-dist-seal.json',
       'current-dark-source-receipt.json']:[])]);
 for(const f of originalServer){
  if(expected.has(f.path))stop('compiled source unexpectedly aliases Worker adapter');
  expected.add(f.path);
  const path=join(root,f.path);
  if(!existsSync(path)||digestFile(path)!==f.sha256||readFileSync(path).length!==f.bytes)
   stop('compiled SSR source differs from exact build SHA: '+f.path);
 }
 const allOriginalAssets=new Map(seal.files.filter(f=>f.path.startsWith('client/')).map(f=>[f.path,f]));
 const seen=new Set();
 let total=0;
 for(const item of originalReceipt.clientAssets){
  if(typeof item?.path!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(item.path)||
     item.path.includes('..')||item.path.includes('//')||seen.has(item.path)||
     !/^fire-inline-assets\/asset-[0-9]{3}-[0-9a-f]{16}\.bin$/.test(item.module)||
     !HASH(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<1||
     item.type!==assetContentType(item.path))
   stop('bad duplicated or unknown QA-master client Data module');
  const original=allOriginalAssets.get('client'+item.path);
  if(!original||original.bytes!==item.bytes||original.sha256!==item.sha256)
   stop('embedded client asset differs from exact QA-master compiled dist');
  expected.add('server/'+item.module);seen.add(item.path);
  const path=join(root,'server',item.module);
  if(!existsSync(path)||readFileSync(path).length!==item.bytes||digestFile(path)!==item.sha256)
   stop('missing or altered client Data module');
  total+=item.bytes;
 }
 if(total!==originalReceipt.assetBytes||
    !seen.has('/fire-offline/index.html')||
    !seen.has('/fire-offline/app.js')||!seen.has('/fire-offline/app.css')||
    ![...seen].some(x=>x.startsWith('/_next/static/chunks/'))||
    ![...seen].some(x=>x.startsWith('/_next/static/css/')))
  stop('incomplete current QA-master local or browser client assets');
 const manifest=readFileSync(join(root,'server/fire-inline-assets/manifest.mjs'),'utf8');
 if(manifest!==exactAssetManifest(originalReceipt.clientAssets))
  stop('asset module import routes differ from reviewed manifest');
 if(readFileSync(join(root,'server/fire-noassets-entry.mjs'),'utf8')!==exactEntry(target))
  stop('Worker entry is not immutable target-pinned dark entry');
 const runtimeFile=fileURLToPath(new URL('./dr_noassets_runtime.mjs',import.meta.url));
 if(digestFile(join(root,'server/fire-inline-assets/runtime.mjs'))!==digestFile(runtimeFile))
  stop('guarded first-request runtime is not exact current reviewed code');
 if(!identical(paths,[...expected].sort()))stop('unknown/missing/linked file in complete Worker-only source package');
 return {spec,root,paths,config:cfg,receipt:originalReceipt,assetCount:seen.size,
  originalServerCount:originalServer.length};
}
export function verifyCurrentDarkWorkerPackage(target,folder){
 const root=resolve(folder),receipt=json(join(root,'current-dark-source-receipt.json'));
 const seal=json(join(root,'reviewed-compiled-dist-seal.json'));
 if(receipt.kind!=='FIRE_CURRENT_QA_MASTER_DARK_FIRST_CREATE_SOURCE_ONLY_V1'||
    receipt.target!==target||!SHA(receipt.compiledSourceSha)||
    receipt.providerContacted!==false||receipt.workerDeployed!==false||
    receipt.workerCreated!==false||receipt.remoteD1MigrationsApplied!==false||
    receipt.ownerAuthenticationEnabled!==false||receipt.newLiveJob0001PhysicallyVerified!==false||
    receipt.firstCreateAuthorized!==false||receipt.releaseAuthorized!==false)
  stop('saved final dark receipt claims unapproved hosted release');
 if(digestFile(join(root,'reviewed-compiled-dist-seal.json'))!==receipt.compiledSourceSealSha256||
    digestFile(join(root,'alternative-receipt.json'))!==receipt.originalNoAssetsReceiptSha256)
  stop('original current-source build seal/receipt changed');
 const checked=review(target,root,seal,receipt.compiledSourceSha,true);
 if(receipt.originalCompiledDistDigestSha256!==seal.filesDigestSha256||
    receipt.actualClientAssetCount!==checked.assetCount||
    receipt.actualOriginalSSRFileCount!==checked.originalServerCount||
    receipt.worker!==checked.spec.worker||receipt.ownerRecordedPhysicalD1!==checked.spec.uuid)
  stop('compiled source, SSR, photo mode or D1 provenance mismatch');
 const filtered=checked.paths.filter(x=>x!=='current-dark-source-receipt.json');
 const records=filtered.map(p=>record(root,p));
 if(!identical(records,receipt.packageFileInventory)||
    hash(Buffer.from(JSON.stringify(records)))!==receipt.packageFilesDigestSha256)
  stop('saved final dark package files/bytes differ from reviewed receipt');
 return {status:'CURRENT_QA_MASTER_DARK_SOURCE_ONLY_VERIFIED',target,
  compiledSourceSha:receipt.compiledSourceSha,compiledSSRFiles:checked.originalServerCount,
  clientDataAssets:checked.assetCount,filesVerified:checked.paths.length,
  firstRequestAuthBlocked:true,workersDev:false,previewUrls:false,
  physicalD1NameRecordedNotAttested:true,sourceOnly:true,providerContacted:false,
  workerDeployed:false,readyForProduction:false};
}
export function prepareCurrentDarkWorkerPackage(target,alternativeFolder,sealFile,sha,outFolder){
 const spec=TARGETS[target];if(!spec)stop('choose exact dr or new-live target');
 if(!SHA(sha))stop('exact current 40-character reviewed source SHA required');
 const seal=json(resolve(sealFile));
 const source=review(target,alternativeFolder,seal,sha,false);
 const output=resolve(outFolder);
 if(existsSync(output)||output===source.root||
    output.startsWith(source.root+sep)||source.root.startsWith(output+sep))
  stop('new disjoint output directory is required; original source is immutable');
 mkdirSync(output,{mode:0o700});
 cpSync(join(source.root,'server'),join(output,'server'),{recursive:true,force:false,errorOnExist:true});
 copyFileSync(join(source.root,'alternative-receipt.json'),join(output,'alternative-receipt.json'));
 copyFileSync(resolve(sealFile),join(output,'reviewed-compiled-dist-seal.json'));
 const config=structuredClone(source.config);
 config.workers_dev=false;
 config.preview_urls=false;
 // A disabled-login source candidate must not emit request/invocation
 // logs when the owner later authorizes its private first deployment.
 config.observability={enabled:false};
 config.d1_databases=[{binding:'DB',database_name:spec.db,database_id:spec.uuid}];
 config.vars={...config.vars,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'};
 writeFileSync(join(output,'server/wrangler.json'),JSON.stringify(config,null,2)+'\n');
 checkConfig(config,spec,true);
 const records=ordinaryFiles(output).map(p=>record(output,p));
 const receipt={
  kind:'FIRE_CURRENT_QA_MASTER_DARK_FIRST_CREATE_SOURCE_ONLY_V1',
  target,worker:spec.worker,compiledSourceSha:sha,
  compiledSourceSealSha256:digestFile(join(output,'reviewed-compiled-dist-seal.json')),
  originalCompiledDistDigestSha256:seal.filesDigestSha256,
  originalNoAssetsReceiptSha256:digestFile(join(output,'alternative-receipt.json')),
  actualClientAssetCount:source.assetCount,
  actualOriginalSSRFileCount:source.originalServerCount,
  ownerRecordedPhysicalD1:spec.uuid,distinctOtherPhysicalD1:target==='dr'?LIVE_DB:DR_DB,
  photos:'owner-device-zip',automaticPhotoSyncAvailable:false,
  publicWorkersDevRoute:false,publicVersionPreviewUrls:false,
  packageFileInventory:records,packageFilesDigestSha256:hash(Buffer.from(JSON.stringify(records))),
  providerContacted:false,workerDeployed:false,workerCreated:false,
  remoteD1MigrationsApplied:false,ownerAuthenticationEnabled:false,
  newLiveJob0001PhysicallyVerified:false,firstCreateAuthorized:false,
  releaseAuthorized:false,requiresExactOwnerAuthorization:true,
  note:'Current QA-master built-source package, never an authorized deploy or provider-verified version. No assets-upload API, R2, paid subscription, Stripe or remote D1 migrations.'
 };
 writeFileSync(join(output,'current-dark-source-receipt.json'),
  JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 return verifyCurrentDarkWorkerPackage(target,output);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv[2]==='verify'){
   if(process.argv.length!==5)stop('usage: verify dr|new-live EXTRACTED_OUTPUT');
   console.log(JSON.stringify(verifyCurrentDarkWorkerPackage(process.argv[3],process.argv[4]),null,2));
  }else{
   if(process.argv.length!==7)stop('usage: dr|new-live ALTERNATIVE_DIR COMPILED_SEAL_JSON EXACT_SOURCE_SHA ABSENT_OUTPUT');
   console.log(JSON.stringify(prepareCurrentDarkWorkerPackage(...process.argv.slice(2)),null,2));
  }
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
