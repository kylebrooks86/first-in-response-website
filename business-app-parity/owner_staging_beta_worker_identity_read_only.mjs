/**
 * G4-04 STAGING Worker-ID/name mapping (Cloudflare beta Worker API).
 * EXACT two authenticated GETs. No Cloudflare login, Worker writes, migration,
 * Stripe operation, secret values, or full provider response logging.
 * This resolves ONLY API Worker identity, never runtime/source/Access proof.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {ACCOUNT_ID,TARGETS} from './owner_g4_hosted_binding_names_readonly.mjs';

const WORKER=TARGETS.staging.worker;
const PREFIX='/client/v4/accounts/'+ACCOUNT_ID+'/workers/workers/';
const ID=/^(?:[a-f0-9]{32}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const stop=()=>{throw Error('STAGING WORKER IDENTITY READ-ONLY STOP: inconclusive provider mapping')};

function unwrap(data){
 if(!object(data)||data.success!==true||
    !(data.errors==null||Array.isArray(data.errors)&&data.errors.length===0)||
    !object(data.result))stop();
 return data.result;
}
export function verifyWorkerIdentityResponses(nameResponse,idResponse){
 const byName=unwrap(nameResponse);
 if(byName.name!==WORKER||typeof byName.id!=='string'||!ID.test(byName.id))stop();
 const byId=unwrap(idResponse);
 if(byId.id!==byName.id||byId.name!==WORKER)stop();
 return Object.freeze({
   result:'FIRE_STAGING_BETA_WORKER_IDENTITY_GET_PASS',
   worker:WORKER,workerId:byName.id,
   workerNameAndIdCrossChecked:true,apiVersionTargetNameSupported:true,
   accountWorkerIdMappingVerified:true,
   servingVersionUnchangedVerified:false,sourceBytesVerified:false,
   accessPolicyVerified:false,d1MigrationStateVerified:false,
   paymentModeVerified:false,privateAdminHashVerified:false,
   providerWrites:false,loginAttempted:false,uploadAuthorized:false,
   activationAuthorized:false,gate4Accepted:false
 });
}
async function getOnly(token,path){
 if(path!==PREFIX+WORKER&&!new RegExp('^'+PREFIX+'[a-f0-9-]{32,36}$','i').test(path))stop();
 const url=new URL(path,'https://api.cloudflare.com');
 if(url.origin!=='https://api.cloudflare.com'||url.search||url.hash)stop();
 let response;
 try{response=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    signal:AbortSignal.timeout(15000)})}catch{stop()}
 if(!response.ok||response.status!==200)stop();
 // Strict response cap, including for chunked responses without Content-Length.
 const advertised=response.headers?.get?.('content-length');
 if(advertised!=null&&(!/^\\d+$/.test(advertised)||Number(advertised)>96000))stop();
 const reader=response.body?.getReader?.();if(!reader)stop();
 const parts=[];let total=0;
 try{
   while(true){
     const step=await reader.read();if(step.done)break;
     if(!(step.value instanceof Uint8Array))stop();
     total+=step.value.byteLength;
     if(total>96000){try{await reader.cancel()}catch{};stop()}
     parts.push(Buffer.from(step.value));
   }
   if(total===0)stop();
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,total)));
 }catch{stop()}
}
export async function captureStagingWorkerIdentity({token,request=getOnly}={}){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\\s/.test(token)||
    typeof request!=='function')stop();
 const nameResponse=await request(token,PREFIX+WORKER);
 const byName=unwrap(nameResponse);
 if(byName.name!==WORKER||typeof byName.id!=='string'||!ID.test(byName.id))stop();
 const idResponse=await request(token,PREFIX+byName.id);
 const verified=verifyWorkerIdentityResponses(nameResponse,idResponse);
 return Object.freeze({...verified,cloudflareGetRequests:2,
   directProviderReadback:request===getOnly});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length===0){
   console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER',worker:WORKER,
     instructions:'--capture uses an already-available private CLOUDFLARE_API_TOKEN on owner Windows TTY',
     providerContacted:false,gate4Accepted:false}));
 }else if(args.length===1&&args[0]==='--capture'){
   try{
     if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
        process.env.CI||process.env.GITHUB_ACTIONS)stop();
     const outcome=await captureStagingWorkerIdentity({token:process.env.CLOUDFLARE_API_TOKEN});
     console.log(JSON.stringify(outcome,null,2));
   }catch{
     console.error('STAGING WORKER IDENTITY READ-ONLY STOP: no authenticated mapping proof; NO WRITE or login');
     process.exitCode=1;
   }
 }else{
   console.error('STAGING WORKER IDENTITY READ-ONLY STOP: unexpected argument');
   process.exitCode=1;
 }
}
