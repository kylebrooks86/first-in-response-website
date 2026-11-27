/** Exact-source first-create DARK package tests: all bytes are disposable. No provider. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {assetContentType} from './dr_noassets_runtime.mjs';
import {prepareCurrentDarkWorkerPackage,verifyCurrentDarkWorkerPackage} from './prepare_current_dark_worker_package.mjs';
import {prepareCurrentDarkFirstCreateOverlay,verifyCurrentDarkFirstCreateOverlay} from './prepare_current_dark_first_create_overlay.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const SHA='b'.repeat(40);
const DR='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const LIVE='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const main=mkdtempSync(join(tmpdir(),'fire-current-dark-source-'));
let n=0;
const ok=(v,label)=>{assert.ok(v,label);n++;};
const denied=(fn,label)=>{assert.throws(fn,/BLOCKED/,'Must refuse '+label);n++;};
const put=(file,data)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,data);};
const specs={
 dr:{worker:'fire-fullapp-dr',env:'isolated-dr',db:'fire-fullapp-dr-db',id:DR,prefix:'FIRE_DR',kind:'FIRE_SOURCE_ONLY_INERT_DR_COMPILED_ARTIFACT_V1',target:'independent-dr',alternative:'FIRE_SOURCE_ONLY_ALTERNATIVE_DR_NO_ASSETS_UPLOAD_V1'},
 'new-live':{worker:'fire-fullapp-new-live',env:'new-live-prelaunch',db:'fire-fullapp-new-live-db',id:LIVE,prefix:'FIRE_NEW_LIVE',kind:'FIRE_SOURCE_ONLY_INERT_NEW_LIVE_COMPILED_ARTIFACT_V1',target:'independent-live',alternative:'FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'}
};
const targetEntry=t=>[
 'import server from "./index.js";',
 'import manifest from "./fire-inline-assets/manifest.mjs";',
 'import {wrapInertDRWorker} from "./fire-inline-assets/runtime.mjs";',
 'export default wrapInertDRWorker(server,manifest,"'+(t==='dr'?'isolated-dr':'new-live-prelaunch')+'");',''
].join('\n');
const assets=['fire-offline/index.html','fire-offline/app.js','fire-offline/app.css',
 '_next/static/css/app.css','_next/static/chunks/app.js',
 ...Array.from({length:32},(_,i)=>'_next/static/chunks/chunk-'+String(i).padStart(3,'0')+'.js')];
function make(target,suffix='source'){
 const spec=specs[target],root=join(main,target+'-'+suffix);
 const alt=join(root,'alt'),sealFile=join(root,'seal.json');
 const cfg={name:spec.worker,main:'fire-noassets-entry.mjs',workers_dev:true,
  no_bundle:true,find_additional_modules:true,preserve_file_names:true,
  compatibility_date:'2026-11-13',compatibility_flags:['nodejs_compat'],
  vars:{FIRE_ENV:spec.env,SITE_ORIGIN:'https://'+spec.worker+'.kyle-bfc.workers.dev',
   [spec.prefix+'_AUTH_ENABLED']:'blocked'},
  secrets:{required:[spec.prefix+'_PASSWORD_HASH',spec.prefix+'_SESSION_SECRET']},
  d1_databases:[{binding:'DB',database_name:spec.db,
   database_id:'00000000-0000-4000-8000-000000000000'}],
  r2_buckets:[],kv_namespaces:[],services:[],durable_objects:{bindings:[]},
  rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]
 };
 put(join(alt,'server/wrangler.json'),JSON.stringify(cfg,null,2)+'\n');
 const server='export default {async fetch(){return new Response("Original saved QA-master compiled invoice code")}};\n';
 put(join(alt,'server/index.js'),server);
 const originalConfig={...cfg,main:'index.js',assets:{directory:'../client'},find_additional_modules:false};
 const originals=[{path:'server/index.js',bytes:Buffer.byteLength(server),sha256:sha(server)},
   {path:'server/wrangler.json',bytes:Buffer.byteLength(JSON.stringify(originalConfig)),sha256:sha(JSON.stringify(originalConfig))}];
 const metadata=[];
 for(let i=0;i<assets.length;i++){
  const path=assets[i],bytes=Buffer.from('FIRE synthetic compiled client data '+path+'\n');
  const h=sha(bytes),name='asset-'+String(i).padStart(3,'0')+'-'+h.slice(0,16)+'.bin';
  const module='fire-inline-assets/'+name;
  put(join(alt,'server',module),bytes);
  originals.push({path:'client/'+path,bytes:bytes.length,sha256:h});
  metadata.push({path:'/'+path,bytes:bytes.length,sha256:h,module,type:assetContentType(path)});
 }
 originals.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const distDigest=sha(JSON.stringify(originals));
 const seal={kind:spec.kind,reviewedPullRequest:264,reviewedSourceSha:SHA,
  target:spec.target,[target==='dr'?'drWorker':'liveWorker']:spec.worker,
  physicalDatabaseBindingAttempted:false,ownerAuthenticationEnabled:false,
  cloudflareUploaded:false,cloudflareDeployed:false,stripeActivated:false,
  ownerApprovedDeployment:false,reviewedFileCount:originals.length,
  filesDigestSha256:distDigest,files:originals};
 put(sealFile,JSON.stringify(seal,null,2)+'\n');
 const originalReceipt={kind:spec.alternative,reviewedSourceSha:SHA,
  originalFilesDigestSha256:distDigest,sourceOnly:true,
  cloudflareContacted:false,workerDeployed:false,
  ownerApprovedDeployment:false,ownerAuthenticationEnabled:false,
  physicalD1Bound:false,paidR2Required:false,
  cloudflareAssetsUploadSessionRequired:false,assetFileCount:metadata.length,
  assetBytes:metadata.reduce((s,x)=>s+x.bytes,0),clientAssets:metadata};
 put(join(alt,'alternative-receipt.json'),JSON.stringify(originalReceipt,null,2)+'\n');
 const lines=metadata.map((x,i)=>'import b'+i+' from "./'+x.module.split('/').at(-1)+'";');
 lines.push('export default Object.freeze({');
 metadata.forEach((x,i)=>lines.push('  '+JSON.stringify(x.path)+':Object.freeze({data:b'+i+',type:'+JSON.stringify(x.type)+'}),'));
 lines.push('});');
 put(join(alt,'server/fire-inline-assets/manifest.mjs'),lines.join('\n')+'\n');
 const runtime=readFileSync(new URL('./dr_noassets_runtime.mjs',import.meta.url));
 put(join(alt,'server/fire-inline-assets/runtime.mjs'),runtime);
 put(join(alt,'server/fire-noassets-entry.mjs'),targetEntry(target));
 return {root,alt,sealFile,metadata,spec};
}
function rehashUnsignedReceipt(root){
 // A review archive's JSON receipt alone is NOT a trusted signature.
 // Keep the embedded inventory internally consistent to test strict guards.
 const {readdirSync,lstatSync}=requireFs;
 const {relative,sep}=requirePath;
 const r=JSON.parse(readFileSync(join(root,'current-dark-source-receipt.json'),'utf8'));
 const paths=[];
 function walk(folder){for(const k of readdirSync(folder)){const p=join(folder,k);
   if(lstatSync(p).isDirectory())walk(p);
   else{const key=relative(root,p).split(sep).join('/');
    if(key!=='current-dark-source-receipt.json')paths.push(key);}
 }}
 walk(root);paths.sort();
 r.packageFileInventory=paths.map(p=>({path:p,bytes:readFileSync(join(root,p)).length,sha256:sha(readFileSync(join(root,p)))}));
 r.packageFilesDigestSha256=sha(JSON.stringify(r.packageFileInventory));
 put(join(root,'current-dark-source-receipt.json'),JSON.stringify(r,null,2)+'\n');
}
import * as requireFs from 'node:fs';
import * as requirePath from 'node:path';
try{
 for(const target of ['dr','new-live']){
  const f=make(target),out=join(f.root,'dark-reviewed');
  const done=prepareCurrentDarkWorkerPackage(target,f.alt,f.sealFile,SHA,out);
  ok(done.status==='CURRENT_QA_MASTER_DARK_SOURCE_ONLY_VERIFIED',target+' creates verified current-code source');
  ok(done.compiledSourceSha===SHA,target+' fully pins current source commit');
  ok(done.clientDataAssets===assets.length,target+' verifies every saved client Data byte');
  const cfg=JSON.parse(readFileSync(join(out,'server/wrangler.json'),'utf8'));
  ok(cfg.d1_databases[0].database_id===f.spec.id&&cfg.workers_dev===false&&
     cfg.preview_urls===false&&cfg.r2_buckets.length===0&&
     cfg.observability?.enabled===false,
     target+' physical D1, private routes, no R2 and invocation observability disabled');
  ok(cfg.vars[f.spec.prefix+'_AUTH_ENABLED']==='blocked'&&
     cfg.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip',
     target+' no auth/payment/photo cloud activation');
  ok(readFileSync(join(out,'server/index.js')).equals(readFileSync(join(f.alt,'server/index.js'))),
    target+' exact latest compiled SSR bytes preserved');
  ok(verifyCurrentDarkWorkerPackage(target,out).filesVerified>40,
    target+' standalone extracted-package verifier accepts saved source');

  // NEW real first-create packaging: leave original saved Worker untouched,
  // remove ONLY Cloudflare's future-login secret requirement in an out-of-place
  // DARK copy. No Wrangler, provider, migration or authentication operations.
  const firstCreate=join(f.root,'first-create-only-copy');
  const overlay=prepareCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate);
  ok(overlay.firstRequestDenied===true&&overlay.noProviderCalls===true&&
     overlay.deployed===false&&overlay.firstCreationAuthorized===false,
     target+' creates private first-create overlay without provider action');
  const firstCfg=join(firstCreate,'server/wrangler.json');
  const copied=JSON.parse(readFileSync(firstCfg,'utf8'));
  ok(!Object.hasOwn(copied,'secrets')&&copied.vars[f.spec.prefix+'_AUTH_ENABLED']==='blocked'&&
     copied.workers_dev===false&&copied.preview_urls===false&&
     copied.d1_databases[0].database_id===f.spec.id&&copied.r2_buckets.length===0,
     target+' removes only future login-secret declaration, preserves physical D1 and route lock');
  ok(verifyCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate).filesVerified>40,
     target+' privately saved overlay independently verified');
  denied(()=>verifyCurrentDarkFirstCreateOverlay(target==='dr'?'new-live':'dr',out,SHA,firstCreate),
     target+' wrong-target overlay');
  denied(()=>verifyCurrentDarkFirstCreateOverlay(target,out,'a'.repeat(40),firstCreate),
     target+' wrong source SHA overlay');
  denied(()=>prepareCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate),
     target+' existing overlay cannot be overwritten');
  const originalFirstCfg=readFileSync(firstCfg);
  copied.vars[f.spec.prefix+'_AUTH_ENABLED']='owner-approved';
  put(firstCfg,JSON.stringify(copied));
  denied(()=>verifyCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate),
     target+' overlay login must remain blocked');
  put(firstCfg,originalFirstCfg);
  copied.vars[f.spec.prefix+'_AUTH_ENABLED']='blocked';
  copied.r2_buckets=[{binding:'BUCKET',bucket_name:'unapproved'}];
  put(firstCfg,JSON.stringify(copied));
  denied(()=>verifyCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate),
     target+' overlay cannot add paid photo storage');
  put(firstCfg,originalFirstCfg);
  const originalCopiedAsset=join(firstCreate,'server',f.metadata[0].module);
  const savedCopiedAsset=readFileSync(originalCopiedAsset);
  put(originalCopiedAsset,Buffer.from('tampered-once-copied'));
  denied(()=>verifyCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate),
     target+' original Data asset cannot change after copy');
  put(originalCopiedAsset,savedCopiedAsset);
  ok(verifyCurrentDarkFirstCreateOverlay(target,out,SHA,firstCreate).deployed===false,
     target+' original source and overlay remain verifiable after negative controls');
  denied(()=>verifyCurrentDarkWorkerPackage(target==='dr'?'new-live':'dr',out),
    target+' wrong-target release verifier');

  // Modify an actual client Data module, even if the unsigned receipt is
  // rewritten: saved compiled-source SHA inventory still protects the data.
  const brokenAsset=join(out,'server',f.metadata[0].module);
  const originalAsset=readFileSync(brokenAsset);
  put(brokenAsset,Buffer.from('tampered source asset'));
  rehashUnsignedReceipt(out);
  denied(()=>verifyCurrentDarkWorkerPackage(target,out),target+' modified binary client asset');
  put(brokenAsset,originalAsset);

  const c=join(out,'server/wrangler.json'),originalConfig=readFileSync(c);
  const badCfg=JSON.parse(originalConfig.toString());
  badCfg.vars.FIRE_STRIPE_MODE='live';
  put(c,JSON.stringify(badCfg,null,2)+'\n');
  rehashUnsignedReceipt(out);
  denied(()=>verifyCurrentDarkWorkerPackage(target,out),
    target+' silent payment activation despite rewritten unsigned receipt');
  put(c,originalConfig);
  const logEnabled=JSON.parse(originalConfig.toString());
  logEnabled.observability={enabled:true};
  put(c,JSON.stringify(logEnabled,null,2)+'\n');
  rehashUnsignedReceipt(out);
  denied(()=>verifyCurrentDarkWorkerPackage(target,out),
    target+' source receipt cannot silently re-enable invocation logs');
  put(c,originalConfig);

  const originalEntry=readFileSync(join(out,'server/fire-noassets-entry.mjs'));
  put(join(out,'server/fire-noassets-entry.mjs'),
    originalEntry.toString().replace(',"'+(target==='dr'?'isolated-dr':'new-live-prelaunch')+'"',''));
  rehashUnsignedReceipt(out);
  denied(()=>verifyCurrentDarkWorkerPackage(target,out),target+' old unpinned entry');
  put(join(out,'server/fire-noassets-entry.mjs'),originalEntry);
  rehashUnsignedReceipt(out);
  ok(verifyCurrentDarkWorkerPackage(target,out).sourceOnly===true,
     target+' fully restored source is independently verifiable');

  const wrongSource=make(target,'wrong');
  const seal=JSON.parse(readFileSync(wrongSource.sealFile,'utf8'));
  seal.reviewedSourceSha='a'.repeat(40);
  put(wrongSource.sealFile,JSON.stringify(seal));
  denied(()=>prepareCurrentDarkWorkerPackage(target,wrongSource.alt,wrongSource.sealFile,SHA,
   join(wrongSource.root,'refused')),target+' wrong compiled source seal');
  denied(()=>prepareCurrentDarkWorkerPackage(target,f.alt,f.sealFile,'a'.repeat(40),
   join(f.root,'wrong-sha')),target+' wrong requested exact reviewed commit');
  denied(()=>prepareCurrentDarkWorkerPackage(target,f.alt,f.sealFile,SHA,out),
   target+' cannot overwrite reviewed immutable output');
  const unrelated=join(f.root,'extra-original');
  cpSync(f.alt,unrelated,{recursive:true});
  put(join(unrelated,'server/unreviewed.js'),'export const unexpected=true;');
  denied(()=>prepareCurrentDarkWorkerPackage(target,unrelated,f.sealFile,SHA,
   join(f.root,'extra-refused')),target+' unsealed compiled server module');
  const linked=join(f.root,'linked-original');
  cpSync(f.alt,linked,{recursive:true});
  symlinkSync(join(linked,'server/index.js'),join(linked,'server/linked-file.js'));
  denied(()=>prepareCurrentDarkWorkerPackage(target,linked,f.sealFile,SHA,
   join(f.root,'symlink-refused')),target+' symlink in release source');
 }
 console.log('PASS '+n+'/'+n+' current QA-master source-to-dark DR/NEW LIVE first-create packaging: SHA-sealed SSR/Data, no paid R2, private routes, static module/race/tamper negatives; NO PROVIDER.');
}finally{rmSync(main,{recursive:true,force:true})}
