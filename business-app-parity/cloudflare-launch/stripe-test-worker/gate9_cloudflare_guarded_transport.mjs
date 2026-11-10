/**
 * FIRE Gate9 — PRIVATE, permission-gated Cloudflare TEST Worker transport.
 *
 * This is a library, NOT an entry point, CLI, workflow deploy step, or an
 * authorization grant. No default HTTP client, token source, or approval gate
 * is provided. Construct only in a private execution channel AFTER owner
 * approval for exactly one TEST asset registration, requested asset buckets,
 * and one INACTIVE-only version creation. Do NOT call this from public CI.
 *
 * Never insert Cloudflare API tokens/JWTs in GitHub/chat/screenshots.
 * For actual use, pair with runApprovedInactiveUpload and a private, reviewed
 * permissionGate. Its approval-shaped object is NOT proof of user consent.
 *
 * The only allowed POST endpoints are:
 * 1. TEST script assets-upload-session (JSON manifest, account token)
 * 2. assets/upload?base64=true (multipart, session JWT, no account token)
 * 3. beta Worker versions?deploy=false (complete JSON, account token)
 * No route to deployments POST, database, secrets, settings, Stripe, or LIVE.
 */
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,join,extname,sep,basename} from 'node:path';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {verifyAssetManifest,WORKER,verifyInactiveProposal,proposedInactivePlan} from './gate9_inactive_fullapp_contract.mjs';
import {createGate9ReadOnlyApi} from './gate9_cloudflare_readonly_adapter.mjs';

const API_ORIGIN='https://api.cloudflare.com/client/v4';
const MIME=Object.freeze({
  '.js':'text/javascript','.css':'text/css',
  '.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json',
  '.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff',
  '.woff2':'font/woff2','.ttf':'font/ttf','.avif':'image/avif',
  '.mp4':'video/mp4','.webm':'video/webm'
});
const HASH=/^[a-f0-9]{32}$/;
const UUID=/^[a-f0-9]{32}$/;
const stop=c=>{throw Error('STOP: Gate9 guarded TEST Cloudflare transport ['+c+']; reconcile before retry.');};
const must=(yes,c)=>{if(!yes)stop(c);};
const tokenOk=t=>typeof t==='string'&&t.length>10&&t.length<4000&&
  !/[\s\u0000-\u001f]/.test(t);
const sortEntries=m=>JSON.stringify(Object.entries(m).sort(([a],[b])=>a.localeCompare(b)));
function validateAssetsDir(dir){
  const root=resolve(dir);
  must(basename(root)==='client'&&basename(resolve(root,'..'))==='dist'&&
    realpathSync(root)===root,'CLIENT_ROOT');
  return root;
}
export function createGuardedGate9Transport({
  accountId,tokenProvider,fetchImpl,permissionGate,
  clientDir,approvedManifest,timeoutMs=30000
}){
  must(typeof accountId==='string'&&UUID.test(accountId)&&!/^0+$/.test(accountId),
    'ACCOUNT');
  must(typeof tokenProvider==='function'&&typeof fetchImpl==='function'&&
    typeof permissionGate==='function'&&Number.isSafeInteger(timeoutMs)&&
    timeoutMs>=1000&&timeoutMs<=60000,'MISSING_PRIVATE_INTEGRATION');
  const root=validateAssetsDir(clientDir);
  verifyAssetManifest(approvedManifest);
  const expected=structuredClone(approvedManifest);
  must(sortEntries(createLocalAssetManifest(root))===sortEntries(expected),
    'COMPILED_ASSETS_NOT_APPROVED');
  const prefix='/accounts/'+accountId;
  const reg=prefix+'/workers/scripts/'+WORKER+'/assets-upload-session';
  const asset=prefix+'/workers/assets/upload?base64=true';
  const ver=prefix+'/workers/workers/'+WORKER+'/versions?deploy=false';
  const read=createGate9ReadOnlyApi({accountId,tokenProvider,fetchImpl,timeoutMs});
  const hashIndex=new Map();
  for(const [path,entry] of Object.entries(expected)){
    must(!hashIndex.has(entry.hash)||expected[hashIndex.get(entry.hash)].size===entry.size,
      'COLLIDING_ASSET_HASH');
    if(!hashIndex.has(entry.hash))hashIndex.set(entry.hash,path);
  }
  async function accountToken(){
    let t;
    try{t=await tokenProvider();}catch{stop('PRIVATE_AUTH_UNAVAILABLE');}
    must(tokenOk(t),'PRIVATE_AUTH');
    return t;
  }
  async function requirePermission(descriptor){
    let yes;
    try{yes=await permissionGate({
      action:descriptor.path===reg?'register-assets':
        descriptor.path===asset?'upload-assets':'create-inactive-version',
      worker:WORKER,accountId
    });}catch{stop('OWNER_PERMISSION_CHECK');}
    must(yes===true,'NO_OWNER_PERMISSION');
  }
  const makeBucketBody=hashes=>{
    must(Array.isArray(hashes)&&hashes.length>0&&hashes.length<=500&&
      new Set(hashes).size===hashes.length,'BUCKET_SHAPE');
    must(sortEntries(createLocalAssetManifest(root))===sortEntries(expected),
      'COMPILED_ASSETS_CHANGED');
    const form=new FormData();
    for(const hash of hashes){
      must(typeof hash==='string'&&HASH.test(hash)&&hashIndex.has(hash),'UNEXPECTED_HASH');
      const path=hashIndex.get(hash);
      const loc=resolve(root,'.'+path);
      must(loc.startsWith(root+sep),'TRAVERSAL');
      const st=lstatSync(loc);
      const entry=expected[path];
      must(st.isFile()&&!st.isSymbolicLink()&&st.size===entry.size,'ASSET_FILE_CHANGED');
      const data=readFileSync(loc);
      const ext=extname(path).toLowerCase();
      must(Object.hasOwn(MIME,ext),'ASSET_MIME');
      must(createHash('sha256')
        .update(data.toString('base64')+ext.slice(1)).digest('hex').slice(0,32)===hash,
        'ASSET_HASH_CHANGED');
      // Cloudflare requires multipart form with hash field name, base64 string
      // as the part contents, and original content MIME attached to each part.
      form.append(hash,new Blob([data.toString('base64')],{type:MIME[ext]}),'asset');
    }
    return form;
  };
  async function request(descriptor){
    must(descriptor&&descriptor.method==='POST'&&
      [reg,asset,ver].includes(descriptor.path)&&
      (descriptor.path===reg?descriptor.auth==='account'&&
        Object.keys(descriptor).sort().join(',')==='auth,json,method,path'&&
        sortEntries(descriptor.json?.manifest||{})===sortEntries(expected):
       descriptor.path===asset?descriptor.auth==='asset-session'&&
        Object.keys(descriptor).sort().join(',')==='auth,hashes,jwt,method,path':
       descriptor.auth==='account'&&
        Object.keys(descriptor).sort().join(',')==='auth,json,method,path'),
      'FORBIDDEN_POST_DESCRIPTOR');
    let body,auth;
    if(descriptor.path===asset){
      must(tokenOk(descriptor.jwt),'ASSET_SESSION_JWT');
      body=makeBucketBody(descriptor.hashes);
      auth=descriptor.jwt;
    }else{
      must(descriptor.json&&typeof descriptor.json==='object','JSON_BODY');
      body=JSON.stringify(descriptor.json);
      // Only the fixed beta Worker Version endpoint, never a deploy endpoint.
      if(descriptor.path===ver){
        must(!Object.hasOwn(descriptor.json,'deploy')&&
          descriptor.json.assets?.config?.run_worker_first===true&&
          tokenOk(descriptor.json.assets?.jwt)&&
          Array.isArray(descriptor.json.modules)&&descriptor.json.modules.length>1&&
          descriptor.json.modules.some(m=>m.name==='_headers'&&m.content_type==='text/plain')&&
          descriptor.json.modules.some(m=>m.name===descriptor.json.main_module)&&
          descriptor.json.bindings?.every(b=>b.type==='assets'||b.type==='inherit'),
          'VERSION_BODY_SAFETY');
        // Each of the 9 inherited bindings must explicitly pin the serving
        // immutable Worker VERSION. Never inherit from untrusted latest upload.
        try{
          verifyInactiveProposal({...proposedInactivePlan(),
            bindings:descriptor.json.bindings});
        }catch{stop('VERSION_BINDING_INHERITANCE');}
      }
      auth=await accountToken();
    }
    // A private out-of-band approval check must occur before every POST,
    // not merely once when the transport was constructed.
    await requirePermission(descriptor);
    let response;
    try{
      response=await fetchImpl(API_ORIGIN+descriptor.path,{
        method:'POST',redirect:'error',cache:'no-store',
        headers:{Authorization:'Bearer '+auth,
          ...(descriptor.path===asset?{}:{'Content-Type':'application/json'})},
        body,signal:AbortSignal.timeout(timeoutMs)
      });
    }catch{stop('UNCERTAIN_WRITE_NO_RETRY');}
    must(response&&Number.isInteger(response.status)&&
      response.status>=200&&response.status<300,'PROVIDER_POST_STATUS');
    let data;
    try{data=await response.json();}catch{stop('PROVIDER_POST_JSON');}
    must(data&&typeof data==='object'&&data.success===true&&
      (data.errors==null||Array.isArray(data.errors)&&data.errors.length===0),
      'PROVIDER_POST_RESULT');
    // Do not print, store, or expose to a user the token-bearing body.
    // The approved coordinator consumes this private result in memory.
    return {status:response.status,body:data};
  }
  return Object.freeze({readState:read.readState,readVersion:read.readVersion,request});
}

