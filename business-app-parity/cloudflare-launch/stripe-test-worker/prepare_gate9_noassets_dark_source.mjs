/**
 * FIRE Gate9 TEST existing-Worker FULL APP alternative: no assets upload API.
 *
 * SAFE SOURCE-ONLY. This constructs an explicitly AUTH-BLOCKED review folder
 * from a real freshly compiled isolated TEST full-app dist. It does not
 * call Cloudflare, Stripe, D1, create a Worker, or modify any predecessor.
 * NEVER run 'wrangler deploy' with this review folder: an existing Worker
 * deploy may replace the currently serving version despite disabled URLs.
 *
 * node prepare_gate9_noassets_dark_source.mjs build DIST EXACT_GIT_SHA NEW_FOLDER
 * node prepare_gate9_noassets_dark_source.mjs verify SAVED_FOLDER [PINNED_RECEIPT_SHA256]
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,relative,resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectCompiledServer} from './gate9_offline_server_modules.mjs';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {prepareStripeTestManifest} from './prepare-stripe-test-manifest.mjs';
import {assetContentType} from '../../dr_noassets_runtime.mjs';

const WORKER='fire-stripe-test-20261101';
const D1='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const TYPE='FIRE_GATE9_TEST_FULLAPP_WORKER_ONLY_PRIVATE_SOURCE_REVIEW_V1';
const sha=x=>createHash('sha256').update(x).digest('hex');
const stop=s=>{throw Error('FIRE GATE9 WORKER-ONLY SOURCE BLOCKED: '+s)};
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sourceSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s)&&!/^0+$/.test(s);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const configVars={
 FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:ORIGIN,
 FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'disabled',
 FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'
};
const requiredSecrets=[
 'FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL',
 'FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'
];
const exempt=new Set(['.assetsignore','_headers','_redirects']);
const file=(p)=>readFileSync(p);
const utf=(p)=>readFileSync(p,'utf8');
function tree(root){
 if(!existsSync(root)||lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())
  stop('source/review folder missing or symlink');
 const paths=[];
 function walk(folder){
  for(const n of readdirSync(folder).sort()){
   const p=join(folder,n),m=lstatSync(p);
   if(m.isSymbolicLink())stop('symlink refused');
   if(m.isDirectory()){walk(p);continue;}
   if(!m.isFile()||m.nlink!==1)stop('hardlink or non-file refused');
   paths.push(relative(root,p).split(sep).join('/'));
  }
 }
 walk(root);return paths.sort();
}
const row=(root,p)=>({path:p,bytes:file(join(root,p)).length,sha256:sha(file(join(root,p)))});
const readJSON=p=>{try{return JSON.parse(utf(p))}catch{stop('invalid source/review JSON')}};
function expectedConfig(original){
 return {
  name:WORKER,main:'fire-gate9-noassets-entry.mjs',
  no_bundle:true,find_additional_modules:true,preserve_file_names:true,
  compatibility_date:original.compatibility_date,
  compatibility_flags:original.compatibility_flags,
  workers_dev:false,preview_urls:false,routes:[],
  // Estimate and invoice links can carry tokens in their paths.
  observability:{enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}},
  d1_databases:[{binding:'DB',database_name:'fire-stripe-test-db-20261101',database_id:D1}],
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
 '  if(env?.FIRE_GATE9_PRIVATE_ACTIVATION!=="owner-approved"||',
 '     env.FIRE_ENV!=="cloudflare-staging"||env.FIRE_STRIPE_MODE!=="disabled"||',
 '     env.FIRE_ACCESS_REQUIRED!=="enabled")',
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
 const receiptPath='gate9-noassets-dark-source-receipt.json';
 if(!pathSet.has(receiptPath))stop('saved TEST source receipt missing');
 const receiptBytes=file(join(root,receiptPath)),receiptSha256=sha(receiptBytes);
 if(pinnedReceiptSha256!==undefined&&(!hex(pinnedReceiptSha256)||pinnedReceiptSha256!==receiptSha256))
  stop('saved TEST source receipt differs from independent SHA256 pin');
 let r;
 try{r=JSON.parse(receiptBytes)}catch{stop('invalid saved TEST source receipt')}
 if(r.kind!==TYPE||!sourceSha(r.sourceSha)||r.worker!==WORKER||
    r.predecessorPreserved!==true||r.providerContacted!==false||
    r.workerUploaded!==false||r.deployed!==false||
    r.firstProviderChangeAuthorized!==false||r.stripeModeEnabled!==false||
    r.ownerAuthenticationEnabled!==false||r.r2Required!==false||
    r.cloudAssetsUploadSessionRequired!==false||r.newProviderVersionCreated!==false||
    !Array.isArray(r.originalServerFiles)||r.originalServerFiles.length<80||
    !Array.isArray(r.originalClientAssets)||r.originalClientAssets.length<30||
    !Array.isArray(r.savedInventory)||!hex(r.savedInventoryDigest))
  stop('wrong saved inactive TEST source receipt or premature approval claim');
 if(!same(r.savedInventory,paths.filter(p=>p!=='gate9-noassets-dark-source-receipt.json').map(p=>row(root,p)))||
    sha(JSON.stringify(r.savedInventory))!==r.savedInventoryDigest)
  stop('review package file inventory modified');
 const generated=readJSON(join(root,'original-compiled-wrangler.json'));
 // Full independent generated-source review: includes FAKE D1 + local bucket.
 const original=prepareStripeTestManifest(generated);
 if(original.name!==WORKER||original.vars.FIRE_STRIPE_MODE!=='disabled'||
    original.d1_databases[0]?.database_id!==D1)stop('TEST source not exactly isolated');
 const c=readJSON(join(root,'server/wrangler.json'));
 if(!same(c,expectedConfig(original)))stop('TEST review config differs from private exact source');
 if(utf(join(root,'server/fire-gate9-noassets-entry.mjs'))!==entry)
  stop('TEST first-request lock/asset adapter modified');
 const runtime=join(root,'server/fire-inline-assets/runtime.mjs');
 if(sha(file(runtime))!==sha(file(new URL('../../dr_noassets_runtime.mjs',import.meta.url))))
  stop('Worker-only asset routing logic modified');
 if(utf(join(root,'server/fire-inline-assets/manifest.mjs'))!==entries(r.originalClientAssets))
  stop('compiled client asset routing modified');
 const allowed=new Set(['server/wrangler.json','server/fire-gate9-noassets-entry.mjs',
  'server/fire-inline-assets/runtime.mjs','server/fire-inline-assets/manifest.mjs',
  'original-compiled-wrangler.json','gate9-noassets-dark-source-receipt.json']);
 for(const originalFile of r.originalServerFiles){
  if(typeof originalFile?.path!=='string'||!originalFile.path.startsWith('server/')||
     !pathSet.has(originalFile.path)||
     allowed.has(originalFile.path)||!hex(originalFile.sha256)||
     originalFile.bytes<1||!Number.isSafeInteger(originalFile.bytes))
   stop('bad original full TEST server manifest');
  allowed.add(originalFile.path);
  const v=row(root,originalFile.path);
  if(v.sha256!==originalFile.sha256||v.bytes!==originalFile.bytes)
   stop('original TEST server module not bit-identical');
 }
 const seen=new Set();let assetBytes=0;
 for(const a of r.originalClientAssets){
  if(typeof a?.path!=='string'||!/^[A-Za-z0-9_./-]+$/.test(a.path.slice(1))||
     !a.path.startsWith('/')||a.path.includes('..')||a.path.includes('//')||
     seen.has(a.path)||!/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(a.module)||
     a.type!==assetContentType(a.path)||!hex(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1)
   stop('unreviewed TEST client Data member');
  seen.add(a.path);
  const p='server/'+a.module;
  if(!pathSet.has(p)||allowed.has(p)||!a.module.endsWith('-'+a.sha256.slice(0,16)+'.bin'))
   stop('missing, repeated or mislabeled TEST client Data module');
  const v=row(root,p);
  if(v.bytes!==a.bytes||v.sha256!==a.sha256)stop('original TEST client byte changed');
  assetBytes+=a.bytes;allowed.add(p);
 }
 if(seen.size!==r.clientCount||assetBytes!==r.clientBytes||
    !seen.has('/fire-offline/index.html')||
    !seen.has('/fire-offline/app.js')||!seen.has('/fire-offline/app.css')||
    ![...seen].some(x=>x.startsWith('/_next/static/chunks/')))
  stop('TEST client/UI scope incomplete or changed');
 if(!same(paths,[...allowed].sort()))stop('unexpected/missing source and client files');
 return {status:'GATE9_WORKER_ONLY_DARK_SOURCE_VERIFIED',sourceSha:r.sourceSha,
  worker:WORKER,receiptSha256,receiptPinVerified:pinnedReceiptSha256!==undefined,
  serverModules:r.originalServerFiles.length,clientAssets:seen.size,
  filesVerified:paths.length,providerContacted:false,deployed:false,
  stripeMode:'disabled',currentHostedPredecessorReplaced:false,gate9Accepted:false};
}
export function prepareGate9NoAssetsDarkSource(distFolder,headSHA,outFolder){
 if(!sourceSha(headSHA))stop('exact reviewed commit SHA required');
 const dist=resolve(distFolder),out=resolve(outFolder),source=tree(dist);
 if(existsSync(out)||out===dist||out.startsWith(dist+sep)||dist.startsWith(out+sep))
  stop('new disjoint output folder required');
 if(!source.includes('server/index.js')||
    !source.includes('server/wrangler.json')||
    !source.includes('client/fire-offline/app.js'))
  stop('real full TEST compiled server and field assets missing');
 const local=readJSON(join(dist,'server/wrangler.json'));
 const review=prepareStripeTestManifest(local);
 const proof=inspectCompiledServer(join(dist,'server'));
 const localAssets=createLocalAssetManifest(join(dist,'client'));
 const allAssets=Object.keys(localAssets).sort();
 if(proof.moduleCount<80||proof.totalBytes>=60*1024*1024||
    allAssets.length<30||allAssets.length>200||allAssets.some(p=>p.includes('%')))
  stop('unexpected TEST source/module/asset count or size');
 const originalServer=source.filter(p=>p.startsWith('server/')&&
   !p.startsWith('server/.vite/')&&!p.endsWith('.map')&&
   !['server/wrangler.json','server/BUILD_ID','server/wrangler.FIRE_TEST_REVIEW_ONLY.json'].includes(p));
 if(originalServer.length<80)stop('compiled TEST SSR modules absent');
 const assets=[];let total=0;
 for(let i=0;i<allAssets.length;i++){
  const p=allAssets[i],bytes=file(join(dist,'client'+p)),h=sha(bytes);
  if(bytes.length!==localAssets[p].size||bytes.length>16*1024*1024||
     total+bytes.length>32*1024*1024)
   stop('compiled TEST public client oversized or changed');
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
 writeFileSync(join(dir,'fire-gate9-noassets-entry.mjs'),entry,{flag:'wx'});
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
  note:'REVIEW SOURCE ONLY. Existing TEST immutable serving predecessor untouched. No authorization to deploy/replace a Worker, alter Access/D1/Stripe, create version or publish.'
 };
 writeFileSync(join(out,'gate9-noassets-dark-source-receipt.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 return validateReview(out);
}
export const verifyGate9NoAssetsDarkSource=validateReview;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv[2]==='verify'){
   if(process.argv.length<4||process.argv.length>5)
    stop('usage: verify SOURCE_ONLY_SAVED_FOLDER [PINNED_RECEIPT_SHA256]');
   console.log(JSON.stringify(validateReview(process.argv[3],process.argv[4]),null,2));
  }else{
   if(process.argv[2]!=='build'||process.argv.length!==6)
    stop('usage: build BUILT_TEST_DIST EXACT_SOURCE_SHA NEW_ABSENT_FOLDER');
   console.log(JSON.stringify(prepareGate9NoAssetsDarkSource(...process.argv.slice(3)),null,2));
  }
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
