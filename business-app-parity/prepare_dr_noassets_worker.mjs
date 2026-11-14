/**
 * Build an ALTERNATIVE Cloudflare Worker-only DR package from a SEALED,
 * already-reviewed real QA-master compiled dist. Avoids Cloudflare's separate
 * assets-upload-session endpoint entirely by representing the exact compiled
 * public client bytes as Worker Data modules.
 *
 * NO provider calls, no database change, no Cloudflare login or deployment.
 * This does NOT assert the alternative works in hosted Cloudflare.
 * Usage: node prepare_dr_noassets_worker.mjs DIST SEAL EXACT_SOURCE_SHA NEW_OUTPUT_DIR
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,copyFileSync}
 from 'node:fs';
import {join,relative,resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyInertDRCIBundle} from './verify_inert_dr_ci_artifact.mjs';
import {assetContentType} from './dr_noassets_runtime.mjs';

const stop=why=>{throw Error('FIRE DR no-assets Worker BLOCKED: '+why);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_ASSET_BYTES=16*1024*1024;
const MAX_ALL_ASSETS=32*1024*1024;
const MAX_MODULE_BYTES=60*1024*1024; // 64 MiB plan limit, with safety margin.
const expectedSecret=['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET'];
const excluded=path=>path==='_headers'||path==='.assetsignore'||
 path==='vinext-client-entry-manifest.json'||
 path==='.dev.vars'||path==='wrangler.json'||
 path.split('/').some(part=>part.startsWith('.'));
function collectFiles(root){
 if(!existsSync(root)||!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())
  stop('source directory missing, linked or not ordinary');
 const files=[];
 function visit(dir){
  for(const name of readdirSync(dir).sort()){
   const full=join(dir,name),stat=lstatSync(full);
   if(stat.isSymbolicLink())stop('symlink source entries are forbidden');
   if(stat.isDirectory()){visit(full);continue;}
   if(!stat.isFile())stop('unexpected file type in source');
   const pathName=relative(root,full).replaceAll('\\','/');
   files.push({name:pathName,full,bytes:stat.size});
  }
 }
 visit(root);
 return files.sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
function safeWrite(file,bytes){
 if(existsSync(file))stop('new candidate output already exists: '+file);
 mkdirSync(dirname(file),{recursive:true,mode:0o700});
 writeFileSync(file,bytes,{flag:'wx',mode:0o600});
}
export function reviewNoAssetsDRCompiledConfig(config){
 if(!config||config.name!=='fire-fullapp-dr'||config.workers_dev!==true||
    config.main!=='index.js'||config.no_bundle!==true||
    config.assets?.directory!=='../client'||
    config.vars?.FIRE_ENV!=='isolated-dr'||
    config.vars?.FIRE_DR_AUTH_ENABLED!=='blocked'||
    config.d1_databases?.length!==1||
    config.d1_databases[0].binding!=='DB'||
    config.d1_databases[0].database_name!=='fire-fullapp-dr-db'||
    config.d1_databases[0].database_id!=='00000000-0000-4000-8000-000000000000'|| 
    !Array.isArray(config.r2_buckets)||config.r2_buckets.length!==0||
    JSON.stringify(config.secrets?.required)!==JSON.stringify(expectedSecret)||
    config.routes||config.route||config.zone_id||config.account_id||
    config.kv_namespaces?.length||config.services?.length||
    config.durable_objects?.bindings?.length)
  stop('source must be EXACT auth-blocked, non-deployed no-R2 DR Worker with original client assets');
 return true;
}
export function prepareNoAssetsDRWorker(distDir,receiptFile,sourceSha,newOutput){
 // Reverify existing real compiled bytes BEFORE beginning to materialize any
 // alternative upload package. Original compiled dist/receipt is read-only.
 const verified=verifyInertDRCIBundle(distDir,receiptFile,sourceSha);
 if(verified.status!=='VERIFIED_INERT_DR_CI_BUILD')stop('unverified original Worker archive');
 const dist=resolve(distDir),out=resolve(newOutput);
 if(existsSync(out))stop('output already exists, never overwrite');
 if(out===dist||out.startsWith(dist+sep)||dist.startsWith(out+sep))
  stop('source/output directory overlap');
 const config=JSON.parse(readFileSync(join(dist,'server','wrangler.json'),'utf8'));
 reviewNoAssetsDRCompiledConfig(config);
 const assets=collectFiles(join(dist,'client')).filter(f=>!excluded(f.name));
 if(assets.length<5||assets.length>2000||
    !assets.some(f=>f.name==='fire-offline/index.html')||
    !assets.some(f=>f.name==='fire-offline/app.js')||
    !assets.some(f=>f.name==='fire-offline/app.css')||
    !assets.some(f=>f.name.startsWith('_next/static/chunks/'))||
    !assets.some(f=>f.name.startsWith('_next/static/css/')))
  stop('QA-master assets, field app, JS or CSS are missing; cannot construct equivalent Worker');
 let total=0;
 for(const file of assets){
  if(!/^[A-Za-z0-9_./-]+$/.test(file.name)||file.name.split('/').includes('..')||
     file.name.split('/').some(part=>part.startsWith('.'))||
     file.bytes===0||file.bytes>MAX_ASSET_BYTES)
   stop('unsupported asset path/type/size: '+file.name);
  assetContentType(file.name);
  total+=file.bytes;
 }
 if(total>MAX_ALL_ASSETS)stop('client assets exceed bounded free-plan candidate');
 // All source files are enumerated and verified by the SHA-pinned seal.
 const server=collectFiles(join(dist,'server'));
 if(!server.some(f=>f.name==='index.js'))stop('compiled SSR Worker missing');
 const originals=server.reduce((sum,f)=>sum+f.bytes,0);
 if(originals+total>MAX_MODULE_BYTES)
  stop('Worker-only combined module size exceeds conservative 60 MiB limit');
 mkdirSync(out,{recursive:false,mode:0o700});
 const dst=join(out,'server');
 mkdirSync(dst,{mode:0o700});
 for(const f of server){
  // The generated no-assets manifest is new, never preserve the obsolete
  // compiled assets-binding config in the alternate output.
  if(f.name==='wrangler.json')continue;
  const destination=join(dst,...f.name.split('/'));
  mkdirSync(dirname(destination),{recursive:true,mode:0o700});
  // Source is separately sealed; binary-accurate copy only, never mutate.
  copyFileSync(f.full,destination,0);
 }
 const metadata=[],lines=[];
 for(let i=0;i<assets.length;i++){
  const file=assets[i],bytes=readFileSync(file.full),hash=sha(bytes);
  const name='asset-'+String(i).padStart(3,'0')+'-'+hash.slice(0,16)+'.bin';
  const modulePath='fire-inline-assets/'+name;
  safeWrite(join(dst,modulePath),bytes);
  lines.push('import b'+i+' from "./'+name+'";');
  metadata.push({path:'/'+file.name,bytes:file.bytes,sha256:hash,
    type:assetContentType(file.name),module:modulePath});
 }
 lines.push('export default Object.freeze({');
 metadata.forEach((f,i)=>{
  lines.push('  '+JSON.stringify(f.path)+':Object.freeze({data:b'+i+
   ',type:'+JSON.stringify(f.type)+'}),');
 });
 lines.push('});');
 safeWrite(join(dst,'fire-inline-assets','manifest.mjs'),lines.join('\n')+'\n');
 // Never import a source-code module from the project at runtime. Instead,
 // preserve the identical well-reviewed tiny static adapter bytes.
 const runtime=readFileSync(new URL('./dr_noassets_runtime.mjs',import.meta.url));
 safeWrite(join(dst,'fire-inline-assets','runtime.mjs'),runtime);
 const entry=[
  'import server from "./index.js";',
  'import manifest from "./fire-inline-assets/manifest.mjs";',
  'import {wrapInertDRWorker} from "./fire-inline-assets/runtime.mjs";',
  'export default wrapInertDRWorker(server,manifest);',
  ''
 ].join('\n');
 safeWrite(join(dst,'fire-noassets-entry.mjs'),entry);
 const alternative={...config,main:'fire-noassets-entry.mjs',
  no_bundle:true,find_additional_modules:true,preserve_file_names:true,
  // Wrangler 4.92 already has a built-in Data: **/*.bin rule. Adding a
  // second overlapping Data rule causes dry-run to refuse module uploads.
  rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]
 };
 delete alternative.assets;
 delete alternative.build;
 // Current Wrangler 4.162 refuses legacy_env; omitting it has the same
 // independent-worker naming semantics as the old legacy_env=true default.
 // Do not change the accepted original compiled QA-master manifest.
 delete alternative.legacy_env;
 safeWrite(join(dst,'wrangler.json'),JSON.stringify(alternative,null,2)+'\n');
 const receipt={
  kind:'FIRE_SOURCE_ONLY_ALTERNATIVE_DR_NO_ASSETS_UPLOAD_V1',
  reviewedSourceSha:sourceSha,sourceCompiledFiles:verified.compiledFileCount,
  originalFilesDigestSha256:verified.compiledFilesSha256,
  originalCompiledWorkerConfigSha256:sha(readFileSync(join(dist,'server','wrangler.json'))),
  cloudflareAssetsUploadSessionRequired:false,
  externalStaticStorageRequired:false,paidR2Required:false,
  sourceOnly:true,cloudflareContacted:false,workerDeployed:false,
  ownerApprovedDeployment:false,physicalD1Bound:false,
  ownerAuthenticationEnabled:false,
  worker:'fire-fullapp-dr',assetFileCount:metadata.length,assetBytes:total,
  serverOriginalBytes:originals,candidateTotalFileBytes:originals+total+
    runtime.length+Buffer.byteLength(entry),
  clientAssets:metadata
 };
 safeWrite(join(out,'alternative-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 return Object.freeze({status:'FIRE_DR_NO_ASSET_UPLOAD_WORKER_CANDIDATE_LOCAL_ONLY',
  sourceSha,assetCount:metadata.length,clientBytes:total,
  originalServerBytes:originals,providerContacted:false,
  workerDeployed:false,ownerApprovedDeployment:false,
  r2Required:false,authBlocked:true,output:out});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==6)stop('usage: DIST ORIGINAL_SEAL EXACT_40_CHAR_SHA NEW_OUTPUT_FOLDER');
  console.log(JSON.stringify(prepareNoAssetsDRWorker(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
