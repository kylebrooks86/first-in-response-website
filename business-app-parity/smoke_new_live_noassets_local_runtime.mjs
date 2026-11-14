/**
 * Real Cloudflare workerd/Miniflare smoke for the alternative FIRE NEW LIVE Worker.
 * SOURCE ONLY. Boots Wrangler dev --local, never deploy/remote, with an
 * ephemeral isolated D1 simulation and AUTH BLOCKED. No secret inputs.
 *
 * node business-app-parity/smoke_dr_noassets_local_runtime.mjs
 *   ABSOLUTE_BUILT_NEW_LIVE_CANDIDATE ABSOLUTE_INSTALLED_WRANGLER_SCRIPT
 *
 * Uses locally served byte-for-byte static assets, missing chunk negatives
 * and the original existing SSR/API routing, without re-running accepted QA.
 */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';

const fail=s=>{throw Error('FIRE NEW LIVE real local Worker runtime BLOCKED: '+s);};
const hex=b=>createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const port=18872;
const origin='http://127.0.0.1:'+port;
function requireSafeCandidate(directory){
 const base=resolve(directory);
 const config=JSON.parse(readFileSync(join(base,'server','wrangler.json'),'utf8'));
 const receipt=JSON.parse(readFileSync(join(base,'alternative-receipt.json'),'utf8'));
 if(config.name!=='fire-fullapp-new-live'||config.assets!==undefined||
    config.vars?.FIRE_ENV!=='new-live-prelaunch'||
    config.vars?.SITE_ORIGIN!=='https://fire-fullapp-new-live.kyle-bfc.workers.dev'||
    config.vars?.FIRE_NEW_LIVE_AUTH_ENABLED!=='blocked'||
    config.d1_databases?.length!==1||
    config.d1_databases[0].database_id!=='00000000-0000-4000-8000-000000000000'||
    config.r2_buckets?.length!==0||
    receipt.kind!=='FIRE_SOURCE_ONLY_ALTERNATIVE_NEW_LIVE_NO_ASSETS_UPLOAD_V1'||
    receipt.workerDeployed!==false||receipt.ownerApprovedDeployment!==false||
    receipt.cloudflareAssetsUploadSessionRequired!==false||
    !Array.isArray(receipt.clientAssets)||receipt.clientAssets.length<35)
  fail('refuse real local runtime for any asset-binding, paid, live D1 or enabled-auth config');
 return {base,config,receipt};
}
const selected=(receipt)=>{
 const assets=receipt.clientAssets;
 const by=prefix=>assets.find(a=>a.path.startsWith(prefix));
 const set=[
  by('/_next/static/chunks/'),by('/_next/static/css/'),
  by('/fire-offline/index.html'),by('/fire-offline/app.js'),
  by('/fire-offline/app.css'),by('/favicon.svg')
 ];
 if(set.some(x=>!x)||new Set(set.map(x=>x.path)).size!==set.length)
  fail('mandatory six varied real QA-client asset classes missing');
 return set;
};
async function req(url,opts={}){
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(6000),...opts});
 return {status:response.status,headers:response.headers,body:Buffer.from(await response.arrayBuffer())};
}
async function main(){
 if(process.argv.length!==4)fail('usage: ABSOLUTE_ALTERNATIVE_DIR ABSOLUTE_WRANGLER_SCRIPT');
 const {base,receipt}=requireSafeCandidate(process.argv[2]);
 const wrangler=resolve(process.argv[3]);
 if(!existsSync(wrangler))fail('installed Wrangler JS binary not found');
 const state=mkdtempSync(join(tmpdir(),'fire-new-live-noasset-workerd-isolation-'));
 const logs=[];
 // Deliberately disable inherited Cloudflare account auth/identifiers;
 // Wrangler --local forbids all remote bindings and provider resources.
 const env={...process.env,
  CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_API_KEY:'',
  CLOUDFLARE_EMAIL:'',CLOUDFLARE_ACCOUNT_ID:'',
  CF_ACCOUNT_ID:'',CLOUDFLARE_CF_FETCH_ENABLED:'false',
  WRANGLER_SEND_METRICS:'false',CI:'true'};
 let child;
 try{
  child=spawn(process.execPath,[wrangler,'dev','--local','--no-bundle',
   '--config',join(base,'server','wrangler.json'),
   '--ip','127.0.0.1','--port',String(port),
   '--inspector-port','18873','--persist-to',state],{
   cwd:base,env,detached:process.platform!=='win32',
   stdio:['ignore','pipe','pipe']
  });
  for(const stream of [child.stdout,child.stderr]){
   stream.on('data',buf=>{logs.push(String(buf));if(logs.length>200)logs.shift()});
  }
  let ready=false;
  for(let i=0;i<75;i++){
   if(child.exitCode!==null||child.signalCode!==null)
    fail('local workerd stopped before it could serve the compiled Worker');
   try{
    const probe=await req(origin+'/favicon.svg');
    if(probe.status===200){ready=true;break;}
   }catch{}
   await wait(500);
  }
  if(!ready)fail('Wrangler local workerd failed to serve compiled asset within 38s');
  let count=0;
  for(const asset of selected(receipt)){
   const res=await req(origin+asset.path);
   if(res.status!==200||res.body.length!==asset.bytes||
      hex(res.body)!==asset.sha256||
      !res.headers.get('content-type')?.startsWith(asset.type.split(';')[0])||
      res.headers.get('x-content-type-options')!=='nosniff')
    fail('actual workerd returned nonmatching compiled public resource: '+asset.path+
     ' HTTP '+res.status);
   count++;
  }
  const chunk=selected(receipt)[0];
  const head=await req(origin+chunk.path,{method:'HEAD'});
  if(head.status!==200||head.body.length!==0)
   fail('local HEAD returned body or refused valid compiled route');
  count++;
  const missing=await req(origin+'/_next/static/chunks/THIS-CHUNK-DOES-NOT-EXIST.js');
  if(missing.status!==404)fail('missing hashed asset was not refused by real workerd');
  count++;
  const post=await req(origin+'/fire-offline/app.js',{method:'POST'});
  if(post.status!==405)fail('static asset accepted HTTP POST');
  count++;
  for(const path of ['/','/api/customers','/api/release/new-live-clean-start']){
   const res=await req(origin+path);
   if(res.status>=500||res.status===200&&path!=='/')
    fail('original QA-master dynamic route failed or exposed customer or first-Job authorization while NEW LIVE auth blocked: '+
     path+' status '+res.status);
   count++;
  }
  console.log('PASS '+count+'/'+count+
   ' actual LOCAL workerd requests: exact six compiled QA-master asset hashes,'+
   ' HEAD, missing asset 404, non-GET 405, home and protected customer + clean-start Job #0001 routes refuse unready authentication.'+
   ' NO remote/provider calls; NO D1 migrations, R2, payments or deployment.');
 }catch(e){
  const tail=logs.join('').slice(-6000).replace(/\x1b\[[0-9;]*m/g,'');
  console.error('OFFLINE WORKER STARTUP/SMOKE DETAILS (no credentials):\n'+tail);
  throw e;
 }finally{
  if(child?.pid){
   try{if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');
    else child.kill('SIGTERM');}catch{}
  }
  rmSync(state,{recursive:true,force:true});
 }
}
try{await main()}catch(e){console.error(String(e.message));process.exitCode=1}
