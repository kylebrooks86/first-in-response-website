/**
 * FIRE Gate 4 — immutable hosted DR module BYTE comparison, read-only.
 *
 * Does NOT repeat the already accepted DR deploy, D1, hosted version or QA tests.
 * Cloudflare beta Worker Version GET ?include=modules returns base64 module
 * content; compare it to the exact owner-private DR archive's 193 JS/MJS modules.
 *
 * Default/offline mode does NOT authenticate a provider. --capture requires
 * existing owner Windows TTY + already provisioned in-memory API token, and
 * requires the original publisher attempt lock. It GETs ONE immutable version.
 * Never prints source, provider JSON, credentials or archive contents, writes
 * provider data to disk, signs in, calls SQL, or mutates Cloudflare/Stripe/R2.
 *
 * Cloudflare docs: GET /accounts/{id}/workers/workers/{worker}/versions/{id}
 * with include=modules; result.modules[].{name,content_type,content_base64}.
 * A mere offline JSON file comparison CANNOT prove provider authenticity.
 */
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {inspectExistingDarkUpdateArchive,TARGETS} from './owner_existing_dark_code_update_once_approved.mjs';
import {verifyOriginalDarkUpdateAttempt} from './owner_existing_dark_code_update_postdeploy_readonly.mjs';

const VERSION='f7b7e27c-986b-44b5-b0f9-5e8e4b623426';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const SOURCE='15bd714c435a585f695ed7166cf06d2c31ea1a8e';
const stop=s=>{throw Error('FIRE DR IMMUTABLE MODULE PROOF STOP: '+s)};
const sha=b=>createHash('sha256').update(b).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const moduleName=s=>typeof s==='string'&&
  /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(s)&&
  !s.split('/').some(p=>p==='.'||p==='..');

/**
 * Called AFTER the original immutable ZIP digest and all 243 ZIP CRCs have
 * been accepted by the already reviewed owner updater. Reads one receipt only.
 */
export function readApprovedModuleInventory(zipPath){
  if(typeof zipPath!=='string'||!existsSync(zipPath))stop('original DR ZIP absent');
  const approved=inspectExistingDarkUpdateArchive('dr',zipPath);
  if(approved.filesVerified!==243||approved.sourceSha!==SOURCE||
     approved.archiveSha256!==TARGETS.dr.sha)stop('DR source/archive seal mismatch');
  const zip=readFileSync(zipPath);
  const endStart=Math.max(0,zip.length-65557);
  let end=-1;
  for(let i=zip.length-22;i>=endStart;i--){
    if(zip.readUInt32LE(i)===0x06054b50&&
       i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
  }
  if(end<0||zip.readUInt16LE(end+10)!==243)stop('invalid reviewed ZIP directory');
  let p=zip.readUInt32LE(end+16),receipt=null;
  for(let i=0;i<243;i++){
    if(p+46>end||zip.readUInt32LE(p)!==0x02014b50)stop('ZIP entry missing');
    const n=zip.readUInt16LE(p+28),extra=zip.readUInt16LE(p+30),
      comment=zip.readUInt16LE(p+32),method=zip.readUInt16LE(p+10),
      compressed=zip.readUInt32LE(p+20),expanded=zip.readUInt32LE(p+24),
      offset=zip.readUInt32LE(p+42),next=p+46+n+extra+comment;
    if(next>end)stop('ZIP entry overflow');
    const name=zip.subarray(p+46,p+46+n).toString('utf8');
    if(name==='first-create-source-only-receipt.json'){
      if(receipt!==null||expanded>3_000_000||compressed>1_000_000||
         offset+30>=p||zip.readUInt32LE(offset)!==0x04034b50)
        stop('unsafe receipt entry');
      const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);
      if(start+compressed>p)stop('receipt entry truncated');
      const bytes=zip.subarray(start,start+compressed);
      const out=method===0?bytes:method===8?
        inflateRawSync(bytes,{maxOutputLength:3_000_000}):null;
      if(!out||out.length!==expanded)stop('receipt entry decompression invalid');
      try{receipt=JSON.parse(out.toString('utf8'))}catch{stop('receipt JSON malformed')}
    }
    p=next;
  }
  if(!object(receipt)||receipt.reviewedSourceSha!==SOURCE||
     !Array.isArray(receipt.overlayServerFiles)||
     receipt.overlayServerFiles.length!==242)
    stop('reviewed package inventory absent');
  return receipt.overlayServerFiles;
}

/** Strict, pure comparison; does not trust a file's alleged provider identity. */
export function compareImmutableModuleBytes(provider,inventory){
  if(!Array.isArray(inventory)||inventory.length!==242)stop('complete reviewed inventory required');
  // The ORIGINAL archived wrangler.json strictly configures only ESModule
  // globs **/*.js and **/*.mjs under find_additional_modules. The complete
  // 242-file server inventory also includes 41 .bin assets, 2 CSS files,
  // 4 non-Wrangler JSON files and BUILD_ID; those are NOT modules under
  // this Worker upload rule. Never fake hosted proof of auxiliary bytes.
  const expected=new Map(),allPaths=new Set();
  let configs=0,js=0,mjs=0;
  const auxiliary={bin:0,css:0,json:0,buildId:0};
  for(const item of inventory){
    if(!object(item)||!moduleName(item.path)||!hex(item.sha256)||
       !Number.isSafeInteger(item.bytes)||item.bytes<0||item.bytes>10_000_000||
       allPaths.has(item.path))
      stop('unsafe or duplicate expected archive inventory');
    allPaths.add(item.path);
    if(item.path==='wrangler.json'){configs++;continue}
    if(/\.(?:js|mjs)$/.test(item.path)){
      if(item.path.endsWith('.mjs'))mjs++;else js++;
      expected.set(item.path,item);
    }else if(/^fire-inline-assets\/asset-\d{3}-[a-f0-9]{16}\.bin$/.test(item.path)){
      auxiliary.bin++;
    }else if(item.path.endsWith('.css')){
      auxiliary.css++;
    }else if(item.path.endsWith('.json')){
      auxiliary.json++;
    }else if(item.path==='BUILD_ID'){
      auxiliary.buildId++;
    }else stop('unexpected file type in reviewed archive');
  }
  if(configs!==1||js!==190||mjs!==3||expected.size!==193||
     !expected.has('fire-noassets-entry.mjs')||
     auxiliary.bin!==41||auxiliary.css!==2||auxiliary.json!==4||
     auxiliary.buildId!==1)
    stop('actual Wrangler ESModule configuration and reviewed ZIP inventory disagree');
  if(!object(provider)||provider.success!==true||
     !Array.isArray(provider.errors)||provider.errors.length||
     !object(provider.result)||provider.result.id!==VERSION||
     provider.result.main_module!=='fire-noassets-entry.mjs')
    stop('wrong or incomplete immutable hosted version response');
  const modules=provider.result.modules;
  if(!Array.isArray(modules)||modules.length!==193)
    stop('hosted modules omitted, truncated or unexpected');
  const seen=new Set();
  for(const m of modules){
    if(!object(m)||!moduleName(m.name)||seen.has(m.name)||
       typeof m.content_type!=='string'||m.content_type.length<4||
       m.content_type.length>120||typeof m.content_base64!=='string'||
       m.content_base64.length>14_000_000||
       !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(m.content_base64))
      stop('hosted module metadata or base64 malformed');
    const want=expected.get(m.name);
    if(!want)stop('unexpected hosted module name');
    const decoded=Buffer.from(m.content_base64,'base64');
    if(decoded.toString('base64')!==m.content_base64||
       decoded.length!==want.bytes||sha(decoded)!==want.sha256)
      stop('hosted module bytes differ from frozen QA-source DR archive');
    seen.add(m.name);
  }
  if(seen.size!==expected.size)stop('hosted source module set incomplete');
  return Object.freeze({
    result:'FIRE_DR_IMMUTABLE_VERSION_MODULE_BYTES_MATCH',
    target:'dr',worker:TARGETS.dr.name,newServingVersionPreviouslyVerified:VERSION,
    frozenQaMasterSourceCandidateSha:SOURCE,
    matchedModules:seen.size,unexpectedModules:0,mismatchedModules:0,
    auxiliaryNonRuntimeFilesNotProven:48,wranglerConfigNotRuntimeModule:1,
    moduleContentHashesCompared:true,wholeArchiveHostedBytesVerified:false,
    // This pure function CANNOT prove where the JSON came from.
    authenticatedProviderReadback:false,gate4Accepted:false,
    deploymentPerformed:false,sourceUploaded:false,productionReady:false
  });
}
export function readOriginalDrUpdateLock(){
  const workspace=join(homedir(),'Documents','FIRE-EXISTING-DARK-UPDATE-DR-'+SOURCE.slice(0,8));
  const lock=join(workspace,'REMOTE-UPDATE-ATTEMPT-LOCK.json');
  const success=join(workspace,'CLI-UPLOAD-REPORTED-SUCCESS.json');
  if(!existsSync(lock)||!existsSync(success))stop('original immutable DR update lock/receipt absent');
  let l,s;
  try{
    l=JSON.parse(readFileSync(lock,'utf8'));
    s=JSON.parse(readFileSync(success,'utf8'));
  }catch{stop('original DR attempt evidence unreadable')}
  verifyOriginalDarkUpdateAttempt('dr',l);
  if(!object(s)||s.target!=='dr'||s.worker!==TARGETS.dr.name||
     s.sourceSha!==SOURCE||s.originalVersion!==TARGETS.dr.previousVersion||
     s.physicalD1!==TARGETS.dr.uuid||s.cliSuccess!==true||
     s.hostedParityAccepted!==false||s.gate4Accepted!==false)
    stop('original DR upload success receipt inconsistent');
  return true;
}
async function captureFromExistingCredential(zipPath){
  if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
     process.env.CI||process.env.GITHUB_ACTIONS)
    stop('capture requires existing owner Acer Windows interactive console');
  readOriginalDrUpdateLock();
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token))
    stop('existing in-memory scoped token absent; NO login or token creation');
  const inventory=readApprovedModuleInventory(zipPath);
  const path='/client/v4/accounts/'+ACCOUNT+'/workers/workers/'+TARGETS.dr.name+
    '/versions/'+VERSION+'?include=modules';
  let response,provider;
  try{
    response=await fetch('https://api.cloudflare.com'+path,{
      method:'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(25000),
      headers:{Authorization:'Bearer '+token,Accept:'application/json'}
    });
    if(!response.ok)stop('immutable version GET unsuccessful; NO retry');
    const raw=await response.text();
    if(raw.length>15_000_000)stop('immutable version content exceeds safe bound');
    provider=JSON.parse(raw);
  }catch{
    stop('read-only immutable version GET could not be authenticated; NO login or retry');
  }
  const match=compareImmutableModuleBytes(provider,inventory);
  console.log(JSON.stringify({...match,
    result:'FIRE_DR_AUTHENTICATED_IMMUTABLE_RUNTIME_MODULE_BYTES_PASS',
    authenticatedProviderReadback:true,runtimeModuleBytesReadOnlyVerified:true,
    wholeArchiveHostedBytesVerified:false,
    originalAttemptLockValidated:true,providerWritePerformed:false,
    gate4Accepted:false,productionReady:false},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  try{
    if(args.length===0){
      console.log(JSON.stringify({result:'DR_MODULE_PROOF_OFFLINE_DEFAULT',
        immutableVersion:VERSION,providerContacted:false,gate4Accepted:false}));
    }else if(args.length===3&&args[0]==='inspect'&&args[1]==='dr'){
      const input=resolve(args[2]);
      if(!existsSync(input))stop('provider input JSON missing');
      // Offline mode intentionally requires a JSON file only, not source ZIP.
      // It is NOT a hosted authenticity proof and may not close Gate4.
      const record=JSON.parse(readFileSync(input,'utf8'));
      if(!object(record)||!Array.isArray(record.expectedInventory)||
         !object(record.provider))stop('offline fixture needs expectedInventory and provider');
      console.log(JSON.stringify(compareImmutableModuleBytes(record.provider,record.expectedInventory),null,2));
    }else if(args.length===3&&args[0]==='--capture'&&args[1]==='dr'){
      await captureFromExistingCredential(resolve(args[2]));
    }else stop('usage: offline default | inspect dr LOCAL_FIXTURE_JSON | --capture dr EXACT_OWNER_PRIVATE_ZIP');
  }catch{
    // No raw provider payload, module bytes, credentials, or private path.
    console.error('FIRE DR IMMUTABLE MODULE PROOF STOP: byte proof unavailable; NO provider write, login or retries');
    process.exitCode=1;
  }
}
