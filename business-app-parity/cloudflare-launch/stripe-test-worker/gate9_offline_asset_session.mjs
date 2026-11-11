/**
 * FIRE Gate 9 — OFFLINE ASSET UPLOAD SESSION CONTRACT.
 * No network, no Cloudflare authentication, no requests, no file writes.
 * Only synthetic session JWTs and locally compiled fake TEST assets.
 *
 * Official protocol:
 * POST /accounts/:account/workers/scripts/:name/assets-upload-session
 *   {"manifest":{"/file.js":{"hash":32 hex chars,"size":int},...}}
 * Response: {"result":{"jwt":"...","buckets":[["hash",...],...]}}
 * POST /accounts/:account/workers/assets/upload?base64=true
 *   multipart with one base64-file part per missing hash
 * https://developers.cloudflare.com/workers/static-assets/direct-upload/
 */
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createLocalAssetManifest
} from './gate9_offline_asset_manifest.mjs';
import {verifyAssetManifest,WORKER} from './gate9_inactive_fullapp_contract.mjs';
const DUMMY_ACCOUNT='00000000000000000000000000000000';
export const SYNTHETIC_SESSION_JWT='SYNTHETIC_OFFLINE_ASSET_UPLOAD_JWT_NOT_VALID';
const MIME=Object.freeze({
  '.js':'text/javascript','.css':'text/css',
  '.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json',
  '.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff',
  '.woff2':'font/woff2','.ttf':'font/ttf','.avif':'image/avif',
  '.mp4':'video/mp4','.webm':'video/webm'
});
const ensure=(ok,code)=>{
  if(!ok)throw Error('STOP: Gate9 synthetic asset session ['+code+']. NO remote writes.');
};
export function offlineAssetSessionRegistration(manifest){
  verifyAssetManifest(manifest);
  const request={
    method:'POST',
    path:'/accounts/'+DUMMY_ACCOUNT+'/workers/scripts/'+WORKER+'/assets-upload-session',
    body:{manifest}
  };
  ensure(Object.keys(request).sort().join(',')==='body,method,path','REGISTRATION');
  return request;
}
export function validateSyntheticUploadSession(manifest,response){
  verifyAssetManifest(manifest);
  ensure(response&&typeof response==='object'&&
    response.success===true&&response.result&&
    response.result.jwt===SYNTHETIC_SESSION_JWT&&
    Array.isArray(response.result.buckets),'UNTRUSTED_PROVIDER_RESPONSE');
  ensure(response.errors?.length===0||response.errors===undefined,'PROVIDER_ERRORS');
  const known=new Set(Object.values(manifest).map(v=>v.hash));
  const used=new Set();
  ensure(response.result.buckets.length<=5000,'BUCKET_BUDGET');
  for(const bucket of response.result.buckets){
    ensure(Array.isArray(bucket)&&bucket.length>0&&bucket.length<=500,'BUCKET_SHAPE');
    for(const hash of bucket){
      ensure(typeof hash==='string'&&/^[0-9a-f]{32}$/.test(hash)&&
        known.has(hash)&&!used.has(hash),'BUCKET_HASH');
      used.add(hash);
    }
  }
  // A missing hash may already exist in Cloudflare; never infer that it was uploaded.
  return {buckets:response.result.buckets.length,
    missingUniqueAssets:used.size,
    cachedDistinctAssets:known.size-used.size,
    uploaded:false,credentialUsed:false,completed:false};
}
export function fakeSessionForAllMissing(manifest,bucketLimit=12){
  verifyAssetManifest(manifest);
  ensure(Number.isSafeInteger(bucketLimit)&&bucketLimit>=1&&bucketLimit<=100,'BUCKET_LIMIT');
  const hashes=[...new Set(Object.values(manifest).map(x=>x.hash))].sort();
  const buckets=[];
  for(let i=0;i<hashes.length;i+=bucketLimit)buckets.push(hashes.slice(i,i+bucketLimit));
  return {success:true,errors:[],result:{jwt:SYNTHETIC_SESSION_JWT,buckets}};
}
/** Produces in-memory hash-named multipart candidates only. Never sends. */
export function simulateUploadBuckets(clientDir,manifest,session){
  const current=createLocalAssetManifest(clientDir);
  ensure(JSON.stringify(current)===JSON.stringify(manifest),'ASSETS_CHANGED_SINCE_REGISTRATION');
  const meta=validateSyntheticUploadSession(manifest,session);
  const findHash=new Map();
  for(const [path,item] of Object.entries(manifest))
    if(!findHash.has(item.hash))findHash.set(item.hash,[path,item]);
  let bytes=0;
  const groups=[];
  for(const bucket of session.result.buckets){
    const fields=[];
    for(const hash of bucket){
      const [path,item]=findHash.get(hash);
      const full=resolve(clientDir,'.'+path);
      ensure(full.startsWith(resolve(clientDir)+sep),'ASSET_ESCAPE');
      const stat=lstatSync(full);
      ensure(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===item.size,'ASSET_FILE');
      const buf=readFileSync(full);
      const suffix=extname(path).toLowerCase();
      const checkHash=createHash('sha256')
        .update(buf.toString('base64')+suffix.slice(1)).digest('hex').slice(0,32);
      ensure(checkHash===hash,'ASSET_HASH_CHANGED');
      ensure(Object.hasOwn(MIME,suffix),'ASSET_MIME');
      bytes+=buf.length;
      // fields are data for a local simulation, NOT a request to transmit.
      fields.push({fieldName:hash,contentType:MIME[suffix],contentBase64:buf.toString('base64')});
    }
    groups.push({method:'POST',
      path:'/accounts/'+DUMMY_ACCOUNT+'/workers/assets/upload?base64=true',
      multipartFields:fields});
  }
  ensure(bytes<=200_000_000,'SIMULATED_BYTES_BUDGET');
  return {
    simulatedBuckets:groups,
    assetCount:meta.missingUniqueAssets,
    byteCount:bytes,
    noRequestsSent:true,
    noAuthorizationHeader:true,
    allSessionsSynthetic:true,
    uploadCompletionTokenReceived:false
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    ensure(process.argv.length===3,'ARGS');
    const manifest=createLocalAssetManifest(process.argv[2]);
    const reg=offlineAssetSessionRegistration(manifest);
    ensure(reg.method==='POST'&&reg.path.endsWith('assets-upload-session'),'REGISTRATION_SHAPE');
    const fake=fakeSessionForAllMissing(manifest);
    const sim=simulateUploadBuckets(process.argv[2],manifest,fake);
    ensure(sim.assetCount===Object.keys(manifest).length,'COMPLETE_SYNTHETIC_COVERAGE');
    console.log('PASS: Offline complete asset-session/multipart-bucket protocol');
    console.log('REGISTERED_ASSET_COUNT='+Object.keys(manifest).length);
    console.log('SIMULATED_UPLOAD_BUCKETS='+sim.simulatedBuckets.length);
    console.log('SIMULATED_UPLOAD_BYTES='+sim.byteCount);
    console.log('NO HTTP, JWT, AUTHORIZATION, ASSET UPLOAD, VERSION OR TRAFFIC WRITES.');
  }catch(err){
    const message=err instanceof Error&&
      /^STOP: Gate9 synthetic asset session \[[A-Z_]+\]/.test(err.message)?
      err.message:'STOP: Gate9 synthetic asset session [UNVERIFIED]. NO remote writes.';
    console.error(message);
    process.exitCode=1;
  }
}
