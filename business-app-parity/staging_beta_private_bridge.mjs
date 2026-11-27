// Private Windows bridge primitives for the STAGING beta uploader.
// No CLI entrypoint; importing this module never contacts Cloudflare or reads secrets.
import {openSync,closeSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {PIN} from './staging_beta_version_binding_contract.mjs';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/'+PIN.worker;
const need=(ok,code)=>{if(!ok)throw Error('STAGING_PRIVATE_BRIDGE_STOP_'+code)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function createReservation(privateDir){
 const root=resolve(privateDir);
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_ROOT');
 for(const name of ['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock']){
  const p=join(root,name);need(existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink(),'HISTORY');
 }
 const lock=join(root,'g404-new-inactive-version-attempt-20261125-reviewed.lock');
 return intent=>{
  need(intent?.workerId===PIN.workerId&&intent.predecessor===PIN.version&&intent.activation===false&&intent.stripeMode==='disabled'&&/^[a-f0-9]{64}$/.test(intent.receiptPin??''),'INTENT');
  let fd;
  try{fd=openSync(lock,'wx',0o600);writeFileSync(fd,JSON.stringify({worker:PIN.worker,receiptPin:intent.receiptPin,reserved:true,noRetry:true}));return true}
  catch{throw Error('STAGING_PRIVATE_BRIDGE_STOP_RESERVATION_NO_RETRY')}
  finally{if(fd!==undefined)closeSync(fd)}
 };
}
export function createPrivateReaders(token,fetchImpl){
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token)&&typeof fetchImpl==='function','TOKEN');
 async function get(path){
  need(/^\/(?:deployments\?page=1&per_page=1|versions\?page=[1-3]&per_page=100|versions\/[a-f0-9-]{36})$/.test(path),'PATH');
  let r;try{r=await fetchImpl(BASE+path,{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)})}catch{throw Error('STAGING_PRIVATE_BRIDGE_STOP_GET')}
  need(r?.ok,'HTTP');
  const reader=r.body?.getReader?.();need(reader,'BODY');
  const chunks=[];let total=0;
  try{for(;;){const p=await reader.read();if(p.done)break;total+=p.value.byteLength;if(total>524288){await reader.cancel();throw Error('LIMIT')}chunks.push(Buffer.from(p.value))}}catch{throw Error('STAGING_PRIVATE_BRIDGE_STOP_BODY')}
  let reply;try{reply=JSON.parse(Buffer.concat(chunks,total).toString('utf8'))}catch{throw Error('STAGING_PRIVATE_BRIDGE_STOP_JSON')}
  need(reply?.success===true&&(reply.errors==null||(Array.isArray(reply.errors)&&reply.errors.length===0))&&reply.result&&typeof reply.result==='object','RESULT');
  return reply.result;
 }
 async function readServing(){
  const d=await get('/deployments?page=1&per_page=1');
  need(Array.isArray(d.deployments)&&d.deployments.length===1,'DEPLOYMENT');
  const a=d.deployments[0];need(a.id===PIN.deployment&&Array.isArray(a.versions)&&a.versions.length===1&&a.versions[0].version_id===PIN.version&&a.versions[0].percentage===100,'DRIFT');
  return {accountId:ACCOUNT,workerId:PIN.workerId,deployment:a.id,version:a.versions[0].version_id,percentage:100};
 }
 async function readVersion(id){
  need(uuid.test(id),'VERSION');const v=await get('/versions/'+id);
  need(v.id===id&&Array.isArray(v.resources?.bindings),'VERSION_RESULT');return v;
 }
 async function verifyNoDuplicate(){
  const cutoff=Date.parse('2026-11-22T23:00:00Z');let last=Infinity,recent=0;const seen=new Set();
  for(let page=1;page<=3;page++){
   const r=await get('/versions?page='+page+'&per_page=100');need(Array.isArray(r.items)&&r.items.length<=100,'LIST');
   for(const item of r.items){
    const created=Date.parse(item.metadata?.created_on??'');
    need(uuid.test(item.id)&&!seen.has(item.id)&&Number.isFinite(created)&&created<=last,'ORDER');seen.add(item.id);last=created;
    if(created>=cutoff&&item.id!==PIN.version){
     need(++recent<=10,'RECENT_LIMIT');const v=await readVersion(item.id);
     need(!v.resources.bindings.some(b=>['FIRE_ADMIN_PASSWORD_HASH','FIRE_STRIPE_MODE'].includes(b.name)),'POSSIBLE_DUPLICATE');
    }
   }
   if(r.items.length<100||last<cutoff)return true;
  }
  throw Error('STAGING_PRIVATE_BRIDGE_STOP_INCOMPLETE_LIST');
 }
 return {readServing,readVersion,verifyNoDuplicate};
}
// Caller must independently establish package provenance and free-plan eligibility,
// obtain exact fresh owner approval and safely pass the local DPAPI hash in memory.
// No automatic provider operation is exposed here.
