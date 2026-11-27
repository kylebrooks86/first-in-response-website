/**
 * FIRE Gate4 owner-only public-exposure proof using an ALREADY AUTHENTICATED
 * Wrangler CLI session, not a fresh login or a newly issued API token.
 *
 * Offline default is provider-free. --capture requires owner Windows TTY.
 * Pinned local Wrangler 4.162.0, --no-install and npm offline mode.
 * Token is accepted only from Wrangler auth token --json, kept in memory,
 * never printed, written to a file, uploaded to GitHub or included in errors.
 * Wrangler may refresh a previously issued OAuth token automatically;
 * it NEVER invokes wrangler login or opens a browser. Following token
 * retrieval, Cloudflare inventory requests are read-only GETs only.
 * No deploy, script/route mutation, D1, Stripe or paid R2 operation.
 */
import {existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {captureDarkExposure,FIRE_DARK_WORKERS} from './owner_current_dark_exposure_readonly.mjs';
/** One guarded owner action for both existing DARK Workers. No provider call
 * is made without an explicit --capture both and an already valid session. */
export async function captureBothDarkExposures({token,request}={}){
 const options=request===undefined?{token}:{token,request};
 const dr=await captureDarkExposure('dr',options);
 const newLive=await captureDarkExposure('new-live',options);
 const bothAbsent=dr.publicEndpointsAbsentInSuppliedEvidence===true&&
   newLive.publicEndpointsAbsentInSuppliedEvidence===true;
 return Object.freeze({
  result:bothAbsent?'FIRE_BOTH_DARK_EXPOSURE_INVENTORY_CLEAR':'FIRE_BOTH_DARK_EXPOSURE_REQUIRES_REVIEW',
  targets:[dr,newLive],
  publicEndpointsAbsentInSuppliedEvidence:bothAbsent,
  completeInventoryFromSuppliedEvidence:
   dr.completeInventoryFromSuppliedEvidence===true&&
   newLive.completeInventoryFromSuppliedEvidence===true,
  providerReadbackVerified:dr.providerReadbackVerified===true&&newLive.providerReadbackVerified===true,
  credentialStored:false,credentialDisplayed:false,
  accessPolicyProviderVerified:false,hostedNonownerDenialVerified:false,
  hostedSourceBytesVerified:false,gate4Accepted:false,productionReady:false
 });
}

const fail=()=>{throw new Error('FIRE EXISTING WRANGLER READ-ONLY STOP: session token unavailable or malformed; no login or retries attempted')};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function parseExistingWranglerToken(raw){
 let obj;try{obj=JSON.parse(raw)}catch{fail()}
 if(!isObj(obj)||!['oauth','api_token'].includes(obj.type)||
    typeof obj.token!=='string'||obj.token.length<20||obj.token.length>4096||
    /\s/.test(obj.token))fail();
 return obj.token;
}
export function readExistingWranglerToken({runner=spawnSync,npmCli=null,nodeBin=process.execPath}={}){
 if(typeof npmCli!=='string'||!npmCli)fail();
 // node/npx-cli invocation deliberately matches the accepted owner first-create
 // launcher, but has NO deploy path and NO browser/interactive login command.
 const args=[npmCli,'--no-install','wrangler@4.162.0','auth','token','--json'];
 let result;
 try{
  result=runner(nodeBin,args,{
   encoding:'utf8',timeout:20_000,maxBuffer:65_536,windowsHide:true,
   shell:false,stdio:['ignore','pipe','pipe'],
   env:{...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false',
    WRANGLER_SEND_METRICS:'false',npm_config_offline:'true',
    npm_config_yes:'false',npm_config_audit:'false',npm_config_fund:'false'}
  });
 }catch{fail()}
 if(!result||result.error||result.signal||result.status!==0||
    typeof result.stdout!=='string')fail();
 return parseExistingWranglerToken(result.stdout);
}
function installedNpmCli(){
 const candidates=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ];
 const match=candidates.find(existsSync);
 if(!match)fail();
 return match;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 try{
  if(args.length===0){
   console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER_NO_CREDENTIALS',
    providerContacted:false,existingSessionRead:false,
    permittedTargets:Object.keys(FIRE_DARK_WORKERS),gate4Accepted:false}));
  }else if(args.length===2&&args[0]==='--capture'&&
      (args[1]==='both'||FIRE_DARK_WORKERS[args[1]])){
   if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
      process.env.CI||process.env.GITHUB_ACTIONS)
    throw new Error('FIRE EXISTING WRANGLER READ-ONLY STOP: existing interactive owner Windows console required');
   const token=readExistingWranglerToken({npmCli:installedNpmCli()});
   const evidence=args[1]==='both'?
     await captureBothDarkExposures({token}):
     await captureDarkExposure(args[1],{token});
   // The token is NEVER copied to the result.
   console.log(JSON.stringify({...evidence,credentialSource:'existingWranglerSession',
    credentialStored:false,credentialDisplayed:false},null,2));
   if(!evidence.publicEndpointsAbsentInSuppliedEvidence)process.exitCode=2;
  }else throw new Error('usage: node SCRIPT (offline) OR SCRIPT --capture dr|new-live|both');
 }catch(_e){
  // Do not print provider response bodies or anything from Wrangler that
  // might contain credentials, even on failure.
  console.error('FIRE EXISTING WRANGLER READ-ONLY STOP: no verified proof; no login, deploy, DB or route write');
  process.exitCode=1;
 }
}
