// Exact-version traffic switch only. No version creation, force, or automatic rollback.
import {existsSync,lstatSync,openSync,writeFileSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {platform} from 'node:os';
import {env,argv,stdin} from 'node:process';
import {PIN,verifyBindings} from './staging_g407_upload_body.mjs';
const verifyActivationReadyBindings=v=>verifyBindings({...v,id:PIN.version},'old');
export const HISTORY=['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock','g404-new-inactive-version-attempt-20261126-dedicated-token.lock','g404-activation-ready-version-20261126.lock','g407-staging-traffic-switch-c5b8dfe1.lock','g407-inactive-attempt-20261126-7199757965.lock'];
export const READY_LOCK='g407-ready-attempt-20261127-7221855040.lock';
export const TARGET='91d6b5b3-3be9-4a8f-a1f7-7eaff2af1512';
export const CONSENT='7221920122';
export const LOCK='g407-staging-traffic-switch-91d6b5b3.lock';
export const BASE='https://api.cloudflare.com/client/v4/accounts/bfc00939cfb2f8dfd8581a7a7f5f1307/workers/scripts/'+PIN.worker;
const ORIGIN='https://fire-app-independent-staging.kyle-bfc.workers.dev';
const need=(ok,code)=>{if(!ok)throw Error('STAGING_TRAFFIC_STOP_'+code)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const regular=p=>existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink();
export function reserveTraffic(root){
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_ROOT');
 for(const n of [...HISTORY,READY_LOCK])need(regular(join(root,n)),'HISTORY');
 const p=join(root,LOCK);need(!existsSync(p),'SPENT_NO_RETRY');
 return ()=>{let fd;try{fd=openSync(p,'wx',0o600);writeFileSync(fd,JSON.stringify({target:TARGET,rollback:PIN.version,noRetry:true}));}catch{throw Error('STAGING_TRAFFIC_STOP_RESERVATION_NO_RETRY')}finally{if(fd!==undefined)closeSync(fd)}};
}
function single(d,id,version){return d?.id===id&&Array.isArray(d.versions)&&d.versions.length===1&&d.versions[0].version_id===version&&d.versions[0].percentage===100}
export async function requireAccessChallenge(fetchImpl){
 // Anonymous root request only; never follow redirects or send API credentials.
 const res=await fetchImpl(ORIGIN+'/',{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const location=res.headers.get('location')??'';
 let u;try{u=new URL(location,ORIGIN)}catch{}
 need([302,303,307,308].includes(res.status)&&u?.protocol==='https:'&&u.hostname.endsWith('.cloudflareaccess.com')&&u.pathname.startsWith('/cdn-cgi/access/login'),'ACCESS_CHALLENGE_REQUIRED');
 return true;
}
export async function activate({token,consent,reserve,fetchImpl}){
 need(consent===CONSENT,'CONSENT');
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'TOKEN');
 async function call(path,method='GET',body){
  const r=await fetchImpl(BASE+path,{method,redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  need(r.ok,'PROVIDER_HTTP_NO_RETRY');
  const j=await r.json();need(j?.success===true&&j.result&&(!j.errors||j.errors.length===0),'PROVIDER_RESULT_NO_RETRY');return j.result;
 }
 async function latest(){
  const d=await call('/deployments?page=1&per_page=1');need(Array.isArray(d.deployments)&&d.deployments.length===1,'DEPLOYMENT_LIST');return d.deployments[0];
 }
 const sub=await call('/subdomain');need(sub.enabled===true&&sub.previews_enabled===false,'PREVIEW_SCOPE');
 need(single(await latest(),PIN.deployment,PIN.version),'PREDECESSOR_DRIFT');
 const target=await call('/versions/'+TARGET);
 need(target.id===TARGET&&verifyActivationReadyBindings(target),'TARGET_BINDINGS');
 const old=await call('/versions/'+PIN.version);
 need(old.id===PIN.version,'ROLLBACK_MISSING');
 await requireAccessChallenge(fetchImpl);
 need(single(await latest(),PIN.deployment,PIN.version),'PRE_POST_DRIFT');
 reserve();
 const d=await call('/deployments','POST',{strategy:'percentage',versions:[{version_id:TARGET,percentage:100}]});
 need(uuid.test(d.id??'')&&d.id!==PIN.deployment&&single(d,d.id,TARGET),'DEPLOYMENT_REPLY_NO_RETRY');
 need(single(await latest(),d.id,TARGET),'DEPLOYMENT_READBACK_NO_RETRY');
 const after=await call('/versions/'+TARGET);
 need(after.id===TARGET&&verifyActivationReadyBindings(after),'POST_BINDINGS_NO_RETRY');
 need((await call('/versions/'+PIN.version)).id===PIN.version,'POST_ROLLBACK_MISSING_NO_RETRY');
 await requireAccessChallenge(fetchImpl);
 const postSub=await call('/subdomain');need(postSub.enabled===true&&postSub.previews_enabled===false,'POST_PREVIEW_SCOPE');
 return {result:'STAGING_TRAFFIC_100_PERCENT_VERIFIED',deploymentId:d.id,servingVersion:TARGET,rollbackVersion:PIN.version,percentage:100,stripeDisabled:true,anonymousAccessChallenge:true,needsHostedParity:true};
}
async function main(){
 need(platform()==='win32'&&!env.CI&&!env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 need(argv.length===3&&argv[2]==='--execute','ARGS');
 let s='';for await(const c of stdin){s+=c;need(Buffer.byteLength(s)<=8192,'INPUT_LIMIT')}
 const p=JSON.parse(s);need(Object.keys(p).sort().join(',')==='consent,token'&&p.consent===CONSENT,'INPUT');
 console.log(JSON.stringify(await activate({token:p.token,consent:p.consent,reserve:reserveTraffic(join(env.LOCALAPPDATA,'FIRE-STAGING-Private')),fetchImpl:fetch})));
}
if(argv[1]&&import.meta.url===pathToFileURL(resolve(argv[1])).href)main().catch(e=>{console.error(/^STAGING_TRAFFIC_STOP_[A-Z_]+$/.test(e?.message??'')?e.message:'STAGING_TRAFFIC_STOP_UNCERTAIN_NO_RETRY');process.exitCode=1});
