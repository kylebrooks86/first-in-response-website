/**
 * FIRE Gate 9 — exact Cloudflare beta version POST shape, OFFLINE ONLY.
 *
 * This program PREPARES and validates an IN-MEMORY TEST SYNTHETIC envelope and
 * a NON-CREDENTIALed request descriptor. It NEVER sends HTTP, handles auth
 * tokens, creates upload sessions/asset JWTs, writes files or deploys.
 *
 * Documented:
 * POST /accounts/{account_id}/workers/workers/{worker_id}/versions?deploy=false
 * Body: main_module, compatibility_date, compatibility_flags, bindings,
 * assets: { jwt, config }, modules: [{ name, content_type, content_base64 }]
 * https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/
 *
 * The synthetic JWT is intentionally NOT a usable Cloudflare completion token.
 * Replacing it and running HTTP in this module is prohibited by design.
 */
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,realpathSync,lstatSync} from 'node:fs';
import {basename,extname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  inspectCompiledServer
} from './gate9_offline_server_modules.mjs';
import {
  createLocalAssetManifest,inspectSpecialWorkerModules
} from './gate9_offline_asset_manifest.mjs';
import {
  verifyInactiveProposal,proposedInactivePlan,WORKER,PREDECESSOR
} from './gate9_inactive_fullapp_contract.mjs';
import {prepareStripeTestManifest} from './prepare-stripe-test-manifest.mjs';

const PLACEHOLDER_ACCOUNT_ID='00000000000000000000000000000000';
export const SYNTHETIC_ASSET_JWT='SYNTHETIC_OFFLINE_ONLY_NOT_A_VALID_ASSET_JWT';
const MIME=Object.freeze({
  '.js':'application/javascript+module',
  '.mjs':'application/javascript+module',
  '.cjs':'application/javascript+module',
  '.json':'application/json',
  '.css':'text/plain',
  '.wasm':'application/wasm'
});
const HASH=/^[0-9a-f]{64}$/;
const check=(v,reason='SHAPE')=>{
  if(!v)throw Error('STOP: FIRE Gate9 synthetic upload envelope ['+reason+']; NO upload.');
};
const fakeOnly=x=>typeof x==='string'&&!x.includes('eyJ')&&!x.includes('Bearer')&&x===SYNTHETIC_ASSET_JWT;

function modulesFromCompiledServer(folder){
  const root=resolve(folder);
  check(basename(root)==='server' && basename(resolve(root,'..'))==='dist' &&
    realpathSync(root)===root,'ROOT');
  const parts=[];
  const walk=(dir,depth=0)=>{
    check(depth<20,'NESTING');
    for(const ent of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      const full=join(dir,ent.name);
      const st=lstatSync(full);
      check(!st.isSymbolicLink(),'SYMLINK');
      const rel=relative(root,full).replaceAll('\\','/');
      if(st.isDirectory()){
        if(depth===0 && ent.name==='.vite')continue;
        check(!ent.name.startsWith('.') && ent.name!=='node_modules','DIR');
        walk(full,depth+1);
        continue;
      }
      check(st.isFile(),'FILE');
      if(rel==='wrangler.json'||rel==='BUILD_ID'||
         rel==='wrangler.FIRE_TEST_REVIEW_ONLY.json'||
         extname(rel).toLowerCase()==='.map')continue;
      const ext=extname(rel).toLowerCase();
      check(Object.hasOwn(MIME,ext)||(['_headers','_redirects'].includes(rel) && ext===''),'MIME');
      const buf=readFileSync(full);
      check(buf.length===st.size && buf.length>0 && buf.length<80_000_000,'FILE_BYTES');
      const name=rel.replace(/^\.\//,'');
      check(/^[A-Za-z0-9_.~\/-]+$/.test(name) && !name.includes('..') &&
        !name.startsWith('/') && !name.includes('//'),'NAME');
      check(!/(?:sk|rk|rkcs)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}/
        .test(buf.toString('utf8')),'SECRET_LITERAL');
      parts.push({
        name,
        content_type:MIME[ext]||'text/plain',
        content_base64:buf.toString('base64')
      });
    }
  };
  walk(root);
  parts.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  return parts;
}

/** Build POST request as a local object, without any network/client functions. */
export function createOfflineVersionEnvelope(serverDir,clientDir) {
  const proof=inspectCompiledServer(serverDir);
  const assetsManifest=createLocalAssetManifest(clientDir);
  const special=inspectSpecialWorkerModules(clientDir);
  const generated=JSON.parse(readFileSync(join(serverDir,'wrangler.json'),'utf8'));
  const review=prepareStripeTestManifest(generated);
  check(review.name===WORKER && review.vars?.FIRE_STRIPE_MODE==='disabled' &&
    !Object.hasOwn(review,'r2_buckets') && review.d1_databases?.length===1,
    'TEST_REVIEW');
  check(/^\d{4}-\d{2}-\d{2}$/.test(review.compatibility_date)&&
    Array.isArray(review.compatibility_flags)&&
    review.compatibility_flags.includes('nodejs_compat'),'COMPATIBILITY');
  const proposal=proposedInactivePlan();
  verifyInactiveProposal(proposal);
  const modules=modulesFromCompiledServer(serverDir);
  check(modules.length===proof.moduleCount &&
    modules.reduce((n,m)=>n+Buffer.from(m.content_base64,'base64').length,0)===proof.totalBytes,
    'COMPLETE_SERVER_MODULES');
  const main=generated.main.replace(/^\.\//,'');
  check(modules.filter(x=>x.name===main&&x.content_type==='application/javascript+module').length===1,
    'SINGLE_MAIN');
  const configNames=new Set(modules.map(m=>m.name));
  for(const item of special){
    check(!configNames.has(item.name),'DUPLICATE_SPECIAL_MODULE');
    const bytes=readFileSync(join(clientDir,item.name));
    check(createHash('sha256').update(bytes).digest('hex')===item.sha256,
      'SPECIAL_MODULE_HASH');
    modules.push({
      name:item.name,content_type:'text/plain',content_base64:bytes.toString('base64')
    });
  }
  modules.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  // NB: deploy is a QUERY STRING parameter per beta Workers Version API.
  // This body intentionally does not contain a "deploy" property.
  const request={
    method:'POST',
    path:'/accounts/'+PLACEHOLDER_ACCOUNT_ID+'/workers/workers/'+WORKER+'/versions',
    query:{deploy:false},
    body:{
      main_module:main,
      compatibility_date:review.compatibility_date,
      compatibility_flags:review.compatibility_flags,
      bindings:proposal.bindings,
      assets:{
        jwt:SYNTHETIC_ASSET_JWT,
        config:{run_worker_first:true}
      },
      modules
    }
  };
  check(request.body.bindings.every(b=>b.type==='assets'||b.version_id===PREDECESSOR),
    'IMMUTABLE_PREDECESSOR');
  validateOfflineVersionEnvelope(request);
  return {request,proof,assetCount:Object.keys(assetsManifest).length,
    specialCount:special.length};
}

/** Reusable pure verifier for synthetic request fixtures; NEVER POST. */
export function validateOfflineVersionEnvelope(request) {
  check(request&&typeof request==='object'&&
    Object.keys(request).sort().join(',')==='body,method,path,query','TOP_LEVEL');
  check(request.method==='POST' &&
    request.path==='/accounts/'+PLACEHOLDER_ACCOUNT_ID+
      '/workers/workers/'+WORKER+'/versions','EXACT_TEST_PATH');
  check(request.query&&Object.keys(request.query).join(',')==='deploy' &&
    request.query.deploy===false && !Object.hasOwn(request,'url'),'INACTIVE_QUERY');
  const b=request.body;
  check(b&&typeof b==='object' &&
    Object.keys(b).sort().join(',')===
      'assets,bindings,compatibility_date,compatibility_flags,main_module,modules',
    'BODY_FIELDS');
  check(b.assets && Object.keys(b.assets).sort().join(',')==='config,jwt' &&
    fakeOnly(b.assets.jwt) && b.assets.config?.run_worker_first===true &&
    Object.keys(b.assets.config).join(',')==='run_worker_first','ASSETS_REQUIRE_WORKER_FIRST');
  const proposal={...proposedInactivePlan(),bindings:b.bindings};
  verifyInactiveProposal(proposal);
  check(Array.isArray(b.modules)&&b.modules.length>=2&&b.modules.length<=5000,
    'MODULE_COUNT');
  check(b.modules.filter(x=>x.name===b.main_module&&
    x.content_type==='application/javascript+module').length===1,'ENTRYPOINT');
  const seen=new Set();
  let bytes=0;
  for(const m of b.modules){
    check(m&&typeof m==='object' &&
      Object.keys(m).sort().join(',')==='content_base64,content_type,name',
      'MODULE_FIELDS');
    check(/^[A-Za-z0-9_.~\/-]+$/.test(m.name)&&
      !m.name.startsWith('/')&&!m.name.includes('//')&&!m.name.includes('..')&&
      !seen.has(m.name),'MODULE_NAME');
    seen.add(m.name);
    const ext=extname(m.name).toLowerCase();
    check(m.content_type===(MIME[ext]||(['_headers','_redirects'].includes(m.name)?
      'text/plain':null)),'MODULE_CONTENT_TYPE');
    check(typeof m.content_base64==='string'&&
      /^[A-Za-z0-9+/]+={0,2}$/.test(m.content_base64),'BASE64');
    const buf=Buffer.from(m.content_base64,'base64');
    check(buf.length>0 && buf.length<80_000_000 &&
      buf.toString('base64')===m.content_base64,'CANONICAL_BASE64');
    bytes+=buf.length;
  }
  check(bytes<200_000_000,'MODULE_TOTAL_BYTES');
  check(/^\d{4}-\d{2}-\d{2}$/.test(b.compatibility_date) &&
    b.compatibility_flags.includes('nodejs_compat'),'COMPAT');
  check(seen.has('_headers'),'SPECIAL_HEADERS_REQUIRED');
  return {validated:true,deploy:false,uploaded:false,versionCreated:false,
    moduleCount:b.modules.length,moduleBytes:bytes,gate9Accepted:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    check(process.argv.length===4,'ARGS');
    const {request,proof,assetCount,specialCount}=
      createOfflineVersionEnvelope(process.argv[2],process.argv[3]);
    const shape=validateOfflineVersionEnvelope(request);
    // Hash of synthetic request is provenance, but never print body/contents.
    const fingerprint=createHash('sha256')
      .update(JSON.stringify(request)).digest('hex');
    check(HASH.test(fingerprint),'FINGERPRINT');
    console.log('PASS: Exact TEST beta Worker Version POST envelope assembled IN MEMORY');
    console.log('VERSION_API_QUERY=deploy:false; PINNED_PREDECESSOR='+PREDECESSOR);
    console.log('VERSION_MAIN_MODULE_SHA256='+proof.mainSha256);
    console.log('VERSION_MODULE_COUNT='+shape.moduleCount);
    console.log('VERSION_MODULE_TOTAL_BYTES='+shape.moduleBytes);
    console.log('PUBLIC_ASSETS_METADATA_COUNT='+assetCount);
    console.log('SPECIAL_TEXT_MODULE_COUNT='+specialCount);
    console.log('OFFLINE_SYNTHETIC_ENVELOPE_SHA256='+fingerprint);
    console.log('SYNTHETIC_JWT_ONLY=TRUE; NO AUTH, NO PROVIDER API CALL, NO UPLOAD, NO DEPLOY.');
  }catch(err){
    const msg=err instanceof Error&&/^STOP: FIRE Gate9 synthetic upload envelope \[[A-Z_]+\]/.test(err.message)?
      err.message:'STOP: FIRE Gate9 synthetic upload envelope [UNVERIFIED]. NO upload.';
    console.error(msg);
    process.exitCode=1;
  }
}
