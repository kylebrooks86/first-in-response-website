// Separate one-shot creation of an activation-ready, still inactive version.
import {openSync,closeSync,writeFileSync,lstatSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {platform} from 'node:os';
import {env,argv,stdin} from 'node:process';
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {RECEIPT} from './owner_staging_beta_private_fourth.mjs';
import {prepareStagingFullAppBody} from './staging_beta_fullapp_body.mjs';
import {createPrivateReaders} from './staging_beta_private_bridge.mjs';
import {SOURCE_VERSION,planActivationBindings,verifyActivationReadyBindings} from './staging_activation_ready_bindings.mjs';
export const CONSENT='I AUTHORIZE ONE INACTIVE ACTIVATION-READY STAGING VERSION ONLY';
export const LOCK='g404-activation-ready-version-20261126.lock';
export const HISTORY=['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock','g404-new-inactive-version-attempt-20261126-dedicated-token.lock'];
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const URL='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/workers/'+PIN.workerId+'/versions?deploy=false';
const need=(ok,code)=>{if(!ok)throw Error('STAGING_ACTIVATION_STOP_'+code)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const regular=p=>existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink();
export function reservation(root){
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_ROOT');
 for(const name of HISTORY)need(regular(join(root,name)),'HISTORY');
 const lock=join(root,LOCK);
 need(!existsSync(lock),'SPENT_NO_RETRY');
 return ()=>{
  let fd;
  try{fd=openSync(lock,'wx',0o600);writeFileSync(fd,JSON.stringify({source:SOURCE_VERSION,receipt:RECEIPT,noRetry:true}));}
  catch{throw Error('STAGING_ACTIVATION_STOP_RESERVATION_NO_RETRY')}
  finally{if(fd!==undefined)closeSync(fd)}
 };
}
const servingOK=s=>s?.accountId===ACCOUNT&&s.workerId===PIN.workerId&&s.deployment===PIN.deployment&&s.version===PIN.version&&s.percentage===100;
// No disk or HTTP in the body builder beyond reading the sealed local package.
// Synthetic placeholder is discarded, not transmitted; all three secrets inherited.
export function prepareBody(folder,serving,predecessor,source){
 const bindings=planActivationBindings(source,serving);
 const original=prepareStagingFullAppBody({folder,receiptPin:RECEIPT,workerId:PIN.workerId,serving,predecessor,adminHash:'0'.repeat(64)});
 return {...original,bindings};
}
export async function createReadyVersion({consent,token,readers,reserve,buildBody,fetchImpl}){
 need(consent===CONSENT,'CONSENT');
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'TOKEN');
 const serving=await readers.readServing();need(servingOK(serving),'SERVING');
 const source=await readers.readVersion(SOURCE_VERSION);
 const predecessor=await readers.readVersion(PIN.version);
 const bindings=planActivationBindings(source,serving);
 const body=await buildBody(serving,predecessor,source);
 need(JSON.stringify(body.bindings)===JSON.stringify(bindings),'BODY_BINDINGS');
 need(Object.keys(body).sort().join(',')==='bindings,compatibility_date,compatibility_flags,main_module,modules'&&body.main_module==='fire-staging-noassets-entry.mjs'&&Array.isArray(body.modules)&&body.modules.length>=80,'BODY_SCOPE');
 const encoded=JSON.stringify(body);need(Buffer.byteLength(encoded)<=32*1024*1024,'BUDGET');
 need(await readers.verifyNoReadyDuplicate()===true,'DUPLICATE');
 need(servingOK(await readers.readServing()),'DRIFT');
 reserve();
 let response;
 try{response=await fetchImpl(URL,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:encoded,signal:AbortSignal.timeout(60000)})}catch{throw Error('STAGING_ACTIVATION_STOP_NETWORK_NO_RETRY')}
 need(response?.ok,'HTTP_NO_RETRY');
 const reply=await response.json();
 const id=reply?.result?.id;
 need(reply?.success===true&&uuid.test(id??'')&&id!==SOURCE_VERSION&&id!==PIN.version,'REPLY_NO_RETRY');
 const next=await readers.readVersion(id);
 need(next.id===id&&verifyActivationReadyBindings(next),'READBACK_NO_RETRY');
 need(servingOK(await readers.readServing()),'POST_DRIFT_NO_RETRY');
 return {result:'STAGING_ACTIVATION_READY_INACTIVE_VERIFIED',newVersionId:id,sourceVersionId:SOURCE_VERSION,predecessorVersionId:PIN.version,servingStill100Percent:true,activated:false,stripeDisabled:true,needsHostedParity:true};
}
// Bounded exact target inventory, excluding only the known successful dark version.
export async function verifyNoReadyDuplicate(token,readers,fetchImpl){
 const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/'+PIN.worker+'/versions';
 const seen=new Set();let found=false,last=Infinity;
 for(let page=1;page<=3;page++){
  const res=await fetchImpl(base+'?page='+page+'&per_page=100',{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  need(res.ok,'LIST_HTTP');
  const raw=await res.text();need(Buffer.byteLength(raw)<=524288,'LIST_SIZE');
  const reply=JSON.parse(raw),items=reply?.result?.items;
  need(reply.success===true&&Array.isArray(items)&&items.length<=100,'LIST');
  for(const item of items){
   const stamp=Date.parse(item.metadata?.created_on??'');
   need(uuid.test(item.id)&&!seen.has(item.id)&&Number.isFinite(stamp)&&stamp<=last,'LIST_ORDER');seen.add(item.id);last=stamp;
   if(item.id===SOURCE_VERSION){found=true;continue}
   if(!found){const v=await readers.readVersion(item.id);need(!v.resources.bindings.some(b=>b.name==='FIRE_STAGING_PRIVATE_ACTIVATION'&&b.text==='owner-approved'),'READY_DUPLICATE')}
  }
  if(found)return true;
  need(items.length===100,'SOURCE_NOT_LISTED');
 }
 throw Error('STAGING_ACTIVATION_STOP_LIST_INCOMPLETE');
}
async function main(){
 need(platform()==='win32'&&!env.CI&&!env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 need(argv.length===4&&argv[2]==='--execute','ARGS');
 let s='';for await(const chunk of stdin){s+=chunk;need(Buffer.byteLength(s)<=8192,'INPUT_LIMIT')}
 const p=JSON.parse(s);need(Object.keys(p).sort().join(',')==='consent,token'&&p.consent===CONSENT,'INPUT');
 const reserve=reservation(join(env.LOCALAPPDATA,'FIRE-STAGING-Private'));
 const readers=createPrivateReaders(p.token,fetch);
 readers.verifyNoReadyDuplicate=()=>verifyNoReadyDuplicate(p.token,readers,fetch);
 const out=await createReadyVersion({consent:p.consent,token:p.token,readers,reserve,buildBody:(...args)=>prepareBody(resolve(argv[3]),...args),fetchImpl:fetch});
 console.log(JSON.stringify(out));
}
if(argv[1]&&import.meta.url===pathToFileURL(resolve(argv[1])).href)main().catch(e=>{console.error(/^STAGING_ACTIVATION_STOP_[A-Z_]+$/.test(e?.message??'')?e.message:'STAGING_ACTIVATION_STOP_UNCERTAIN_NO_RETRY');process.exitCode=1});
