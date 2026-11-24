/**
 * FIRE STAGING existing-Worker FULL APP alternative: no assets upload API.
 *
 * SAFE SOURCE-ONLY. This constructs an explicitly AUTH-BLOCKED review folder
 * from the existing previously verified isolated STAGING full-app dist. It does not
 * call Cloudflare, Stripe, D1, create a Worker, or modify any predecessor.
 * NEVER run 'wrangler deploy' with this review folder: an existing Worker
 * deploy may replace the currently serving version despite disabled URLs.
 *
 * node prepare_staging_noassets_dark_source.mjs build DIST EXACT_GIT_SHA NEW_FOLDER
 * node prepare_staging_noassets_dark_source.mjs verify SAVED_FOLDER [PINNED_RECEIPT_SHA256]
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,relative,resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventoryCompiledModules} from './gate9_offline_server_modules.mjs';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {verify as verifyStaging} from '../../check_independent_staging_runtime_config.mjs';
import {assetContentType} from '../../dr_noassets_runtime.mjs';

const WORKER='fire-app-independent-staging';
const D1='afb2c05a-d794-4a9a-b580-924ce01c26ad';
const ORIGIN='https://fire-app-independent-staging.kyle-bfc.workers.dev';
const TYPE='FIRE_STAGING_FULLAPP_WORKER_ONLY_PRIVATE_SOURCE_REVIEW_V1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const stop=s=>{throw Error('FIRE STAGING WORKER-ONLY SOURCE BLOCKED: '+s)};
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sourceSha=s=>s==='4d1c4a74587c8145d6cbae14daf193865b976c47';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const configVars={
 FIRE_ENV:'staging',SITE_ORIGIN:ORIGIN,
 FIRE_STRIPE_MODE:'disabled',
 FIRE_STAGING_PRIVATE_ACTIVATION:'blocked'
};
const requiredSecrets=[
 'FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET','STRIPE_SECRET_KEY'
];
const file=(p)=>readFileSync(p);
const utf=(p)=>readFileSync(p,'utf8');
function tree(root,{ignoreCompiledToolCache=false}={}){
 if(!existsSync(root)||lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())
  stop('source/review folder missing or symlink');
 const paths=[];
 function walk(folder){
  for(const n of readdirSync(folder).sort()){
   const p=join(folder,n),m=lstatSync(p);
   if(m.isSymbolicLink())stop('symlink refused');
   if(m.isDirectory()){
    // Local Wrangler CLI state is neither compiled app code nor upload input.
    // Exclude only this exact root-level source cache, never review package files.
    if(ignoreCompiledToolCache && relative(root,p).split(sep).join('/')==='server/.wrangler')continue;
    walk(p);continue;
   }
   if(!m.isFile()||m.nlink!==1)stop('hardlink or non-file refused');
   paths.push(relative(root,p).split(sep).join('/'));
  }
 }
 walk(root);return paths.sort();
}
const row=(root,p)=>({path:p,bytes:file(join(root,p)).length,sha256:sha(file(join(root,p)))});
const readJSON=p=>{try{return JSON.parse(utf(p))}catch{stop('invalid source/review JSON')}};
function checkStaging(original){
 const guard=verifyStaging(original);
 if(!guard.candidateBuildIdentityVerified||guard.sourceJobNumberModeRequested||guard.sourceQuickAuthModeRequested||
  Object.hasOwn(original,'legacy_env')||!Array.isArray(original.compatibility_flags)||
  typeof original.compatibility_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(original.compatibility_date))
  stop('unexpected STAGING source feature or compatibility config');
 return original;
}
function expectedConfig(original){
 return {
  name:WORKER,main:'fire-staging-noassets-entry.mjs',
  no_bundle:true,find_additional_modules:true,preserve_file_names:true,
  compatibility_date:original.compatibility_date,
  compatibility_flags:original.compatibility_flags,
  workers_dev:true,preview_urls:false,routes:[],
  // Estimate and invoice links can carry tokens in their paths.
  observability:{enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}},
  d1_databases:[{binding:'DB',database_name:'fire-app-staging-db',database_id:D1}],
  r2_buckets:[],kv_namespaces:[],services:[],
  secrets:{required:requiredSecrets},vars:configVars,
  rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]
 };
}
const entries=assets=>{
 const lines=assets.map((a,i)=>'import b'+i+' from "./'+a.module.split('/').at(-1)+'";');
 lines.push('export default Object.freeze({');
 assets.forEach((a,i)=>lines.push('  '+JSON.stringify(a.path)+':Object.freeze({data:b'+i+',type:'+JSON.stringify(a.type)+'}),'));
 lines.push('});');return lines.join('\n')+'\n';
};
const entry=[
 'import server from "./index.js";',
 'import manifest from "./fire-inline-assets/manifest.mjs";',
 'import {serveBundledAsset} from "./fire-inline-assets/runtime.mjs";',
 'export default Object.freeze({async fetch(request,env,ctx){',
 '  // PRIVATE REVIEW default: deny every request before SSR, files, DB or Stripe.',
 '  if(env?.FIRE_STAGING_PRIVATE_ACTIVATION!=="owner-approved"||',
 '     env.FIRE_ENV!=="staging"||env.FIRE_STRIPE_MODE!=="disabled")',
 '    return new Response(null,{status:404,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});',
 '  if(env.ASSETS!==undefined)return new Response(null,{status:503});',
 '  const direct=serveBundledAsset(request,manifest);',
 '  if(direct)return direct;',
 '  return server.fetch(request,{...env,ASSETS:{fetch(input){',
 '    const req=input instanceof Request?input:new Request(input);',
 '    return Promise.resolve(serveBundledAsset(req,manifest)||new Response(null,{status:404}));',
 '  }}},ctx);',
 '}});',''
].join('\n');

function validateReview(folder,pinnedReceiptSha256){
 const root=resolve(folder),paths=tree(root),pathSet=new Set(paths);
 const receiptPath='staging-noassets-dark-source-receipt.json';
 if(!pathSet.has(receiptPath))stop('saved STAGING source receipt missing');
 const receiptBytes=file(join(root,receiptPath)),receiptSha256=sha(receiptBytes);
 if(pinnedReceiptSha256!==undefined&&(!hex(pinnedReceiptSha256)||pinnedReceiptSha256!==receiptSha256))
  stop('saved STAGING source receipt differs from independent SHA256 pin');
 let r;
 try{r=JSON.parse(receiptBytes)}catch{stop('invalid saved STAGING source receipt')}
 if(r.kind!==TYPE||!sourceSha(r.sourceSha)||r.worker!==WORKER||
    r.predecessorPreserved!==true||r.providerContacted!==false||
    r.workerUploaded!==false||r.deployed!==false||
    r.firstProviderChangeAuthorized!==false||r.stripeModeEnabled!==false||
    r.ownerAuthenticationEnabled!==false||r.r2Required!==false||
    r.cloudAssetsUploadSessionRequired!==false||r.newProviderVersionCreated!==false||
    !Array.isArray(r.originalServerFiles)||r.originalServerFiles.length<80||
    !Array.isArray(r.originalClientAssets)||r.originalClientAssets.length<30||
    !Array.isArray(r.savedInventory)||!hex(r.savedInventoryDigest))
  stop('wrong saved inactive STAGING source receipt or premature approval claim');
 if(!same(r.savedInventory,paths.filter(p=>p!=='staging-noassets-dark-source-receipt.json').map(p=>row(root,p)))||
    sha(JSON.stringify(r.savedInventory))!==r.savedInventoryDigest)
  stop('review package file inventory modified');
 const generated=readJSON(join(root,'original-compiled-wrangler.json'));
 // Revalidate the original exact-target STAGING manifest, never a TEST or LIVE mapping.
 const original=checkStaging(generated);
 if(original.name!==WORKER||original.vars.FIRE_STRIPE_MODE!=='disabled'||
    original.d1_databases[0]?.database_id!==D1)stop('STAGING source not exactly isolated');
 const c=readJSON(join(root,'server/wrangler.json'));
 if(!same(c,expectedConfig(original)))stop('STAGING review config differs from private exact source');
 if(utf(join(root,'server/fire-staging-noassets-entry.mjs'))!==entry)
  stop('STAGING first-request lock/asset adapter modified');
 const runtime=join(root,'server/fire-inline-assets/runtime.mjs');
 if(sha(file(runtime))!==sha(file(new URL('../../dr_noassets_runtime.mjs',import.meta.url))))
  stop('Worker-only asset routing logic modified');
 if(utf(join(root,'server/fire-inline-assets/manifest.mjs'))!==entries(r.originalClientAssets))
  stop('compiled client asset routing modified');
 const allowed=new Set(['server/wrangler.json','server/fire-staging-noassets-entry.mjs',
  'server/fire-inline-assets/runtime.mjs','server/fire-inline-assets/manifest.mjs',
  'original-compiled-wrangler.json','staging-noassets-dark-source-receipt.json']);
 for(const originalFile of r.originalServerFiles){
  if(typeof originalFile?.path!=='string'||!originalFile.path.startsWith('server/')||
     !pathSet.has(originalFile.path)||
     allowed.has(originalFile.path)||!hex(originalFile.sha256)||
     originalFile.bytes<1||!Number.isSafeInteger(originalFile.bytes))
   stop('bad original full STAGING server manifest');
  allowed.add(originalFile.path);
  const v=row(root,originalFile.path);
  if(v.sha256!==originalFile.sha256||v.bytes!==originalFile.bytes)
   stop('original STAGING server module not bit-identical');
 }
 const seen=new Set();let assetBytes=0;
 for(const a of r.originalClientAssets){
  if(typeof a?.path!=='string'||!/^[A-Za-z0-9_./-]+$/.test(a.path.slice(1))||
     !a.path.startsWith('/')||a.path.includes('..')||a.path.includes('//')||
     seen.has(a.path)||!/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(a.module)||
     a.type!==assetContentType(a.path)||!hex(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1)
   stop('unreviewed STAGING client Data member');
  seen.add(a.path);
  const p='server/'+a.module;
  if(!pathSet.has(p)||allowed.has(p)||!a.module.endsWith('-'+a.sha256.slice(0,16)+'.bin'))
   stop('missing, repeated or mislabeled STAGING client Data module');
  const v=row(root,p);
  if(v.bytes!==a.bytes||v.sha256!==a.sha256)stop('original STAGING client byte changed');
  assetBytes+=a.bytes;allowed.add(p);
 }
 if(seen.size!==r.clientCount||assetBytes!==r.clientBytes||
    !seen.has('/fire-offline/index.html')||
    !seen.has('/fire-offline/app.js')||!seen.has('/fire-offline/app.css')||
    ![...seen].some(x=>x.startsWith('/_next/static/chunks/')))
  stop('STAGING client/UI scope incomplete or changed');
 if(!same(paths,[...allowed].sort()))stop('unexpected/missing source and client files');
 return {status:'STAGING_WORKER_ONLY_DARK_SOURCE_VERIFIED',sourceSha:r.sourceSha,
  worker:WORKER,receiptSha256,receiptPinVerified:pinnedReceiptSha256!==undefined,
  serverModules:r.originalServerFiles.length,clientAssets:seen.size,
  filesVerified:paths.length,providerContacted:false,deployed:false,
  stripeMode:'disabled',currentHostedPredecessorReplaced:false,gate4Accepted:false};
}
export function prepareStagingNoAssetsDarkSource(distFolder,headSHA,outFolder){
 if(!sourceSha(headSHA))stop('exact previously verified STAGING commit SHA required');
 const dist=resolve(distFolder),out=resolve(outFolder),source=tree(dist,{ignoreCompiledToolCache:true});
 if(existsSync(out)||out===dist||out.startsWith(dist+sep)||dist.startsWith(out+sep))
  stop('new disjoint output folder required');
 if(!source.includes('server/index.js')||
    !source.includes('server/wrangler.json')||
    !source.includes('client/fire-offline/app.js'))
  stop('real full STAGING compiled server and field assets missing');
 const local=readJSON(join(dist,'server/wrangler.json'));
 const review=checkStaging(local);
 const proof=inventoryCompiledModules(join(dist,'server'),local.main);
 if(local.main!=='index.js'&&local.main!=='./index.js')stop('unexpected compiled main');
 for(const p of ['_headers','_redirects'])if(existsSync(join(dist,'client',p)))stop('special asset routing control requires separate review');
 const localAssets=createLocalAssetManifest(join(dist,'client'));
 const allAssets=Object.keys(localAssets).sort();
 if(proof.moduleCount<80||proof.totalBytes>=60*1024*1024||
    allAssets.length<30||allAssets.length>200||allAssets.some(p=>p.includes('%')))
  stop('unexpected STAGING source/module/asset count or size');
 const originalServer=source.filter(p=>p.startsWith('server/')&&
   !p.startsWith('server/.vite/')&&!p.endsWith('.map')&&
   !['server/wrangler.json','server/BUILD_ID','server/wrangler.FIRE_TEST_REVIEW_ONLY.json'].includes(p));
 if(originalServer.length<80)stop('compiled STAGING SSR modules absent');
 const assets=[];let total=0;
 for(let i=0;i<allAssets.length;i++){
  const p=allAssets[i],bytes=file(join(dist,'client'+p)),h=sha(bytes);
  if(bytes.length!==localAssets[p].size||bytes.length>16*1024*1024||
     total+bytes.length>32*1024*1024)
   stop('compiled STAGING public client oversized or changed');
  const module='fire-inline-assets/asset-'+String(i).padStart(3,'0')+'-'+h.slice(0,16)+'.bin';
  assets.push({path:p,module,bytes:bytes.length,sha256:h,type:assetContentType(p)});
  total+=bytes.length;
 }
 mkdirSync(out,{mode:0o700});
 const dir=join(out,'server');mkdirSync(dir);
 for(const p of originalServer){
  const destination=join(out,p);
  mkdirSync(dirname(destination),{recursive:true});
  copyFileSync(join(dist,p),destination);
 }
 const moduleRoot=join(dir,'fire-inline-assets');mkdirSync(moduleRoot,{recursive:true});
 for(const a of assets)writeFileSync(join(dir,a.module),file(join(dist,'client'+a.path)),{flag:'wx'});
 writeFileSync(join(moduleRoot,'manifest.mjs'),entries(assets),{flag:'wx'});
 writeFileSync(join(moduleRoot,'runtime.mjs'),
  file(new URL('../../dr_noassets_runtime.mjs',import.meta.url)),{flag:'wx'});
 writeFileSync(join(dir,'fire-staging-noassets-entry.mjs'),entry,{flag:'wx'});
 writeFileSync(join(dir,'wrangler.json'),JSON.stringify(expectedConfig(review),null,2)+'\n',{flag:'wx'});
 writeFileSync(join(out,'original-compiled-wrangler.json'),JSON.stringify(local,null,2)+'\n',{flag:'wx'});
 const inventory=tree(out).map(p=>row(out,p));
 const r={kind:TYPE,worker:WORKER,sourceSha:headSHA,
  predecessorPreserved:true,providerContacted:false,workerUploaded:false,
  deployed:false,newProviderVersionCreated:false,firstProviderChangeAuthorized:false,
  stripeModeEnabled:false,ownerAuthenticationEnabled:false,r2Required:false,
  cloudAssetsUploadSessionRequired:false,
  originalServerFiles:originalServer.map(p=>row(dist,p)),
  originalClientAssets:assets,clientCount:assets.length,clientBytes:total,
  savedInventory:inventory,savedInventoryDigest:sha(JSON.stringify(inventory)),
  note:'REVIEW SOURCE ONLY. Existing STAGING immutable serving predecessor untouched. No authorization to deploy/replace a Worker, alter Access/D1/Stripe, create version or publish.'
 };
 writeFileSync(join(out,'staging-noassets-dark-source-receipt.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 return validateReview(out);
}
export const verifyStagingNoAssetsDarkSource=validateReview;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv[2]==='verify'){
   if(process.argv.length<4||process.argv.length>5)
    stop('usage: verify SOURCE_ONLY_SAVED_FOLDER [PINNED_RECEIPT_SHA256]');
   console.log(JSON.stringify(validateReview(process.argv[3],process.argv[4]),null,2));
  }else{
   if(process.argv[2]!=='build'||process.argv.length!==6)
    stop('usage: build BUILT_STAGING_DIST EXACT_SOURCE_SHA NEW_ABSENT_FOLDER');
   console.log(JSON.stringify(prepareStagingNoAssetsDarkSource(...process.argv.slice(3)),null,2));
  }
 }catch(e){console.error('STAGING WORKER-ONLY REVIEW STOP; NO PROVIDER CONTACT');process.exitCode=1;}
}
