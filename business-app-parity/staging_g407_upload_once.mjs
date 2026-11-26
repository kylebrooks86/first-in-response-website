// G4-07: one authorized inactive version, never activation. Import has no side effects.
import {PIN,prepareBody,verifyBindings} from './staging_g407_upload_body.mjs';
import {sanitizedRefusalCodes} from './cloudflare-launch/stripe-test-worker/gate9_private_test_activation_version_upload.mjs';
import {existsSync,lstatSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/';
const SCRIPT='scripts/'+PIN.worker;
const URL=BASE+'workers/'+PIN.workerId+'/versions?deploy=false';
const LOCK='g407-inactive-attempt-20261126-7199757965.lock';
const HIST=['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock','g404-new-inactive-version-attempt-20261126-dedicated-token.lock'];
const need=(x,c)=>{if(!x)throw Error('G407_STOP_'+c)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export async function runOnce({folder,token,reserve,fetchImpl,consent}){
 need(consent==='7199757965','CONSENT');
 need(typeof token==='string'&&token.length>=20&&!/\s/.test(token),'TOKEN');
 need(typeof reserve==='function'&&typeof fetchImpl==='function','CALLER');
 const headers={Authorization:'Bearer '+token};
 async function get(p){
  const res=await fetchImpl(BASE+p,{method:'GET',headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  need(res.ok,'GET_HTTP');
  const j=await res.json();need(j.success===true&&j.result,'GET_RESULT');return j.result;
 }
 async function serving(){
  const d=await get(SCRIPT+'/deployments?page=1&per_page=1');
  const a=d.deployments?.[0];
  need(a?.id===PIN.deployment&&a.versions?.length===1&&a.versions[0].version_id===PIN.version&&a.versions[0].percentage===100,'SERVING_DRIFT');
 }
 async function version(id){
  need(uuid.test(id),'VERSION_ID');
  const v=await get(SCRIPT+'/versions/'+id);need(v.id===id,'VERSION_READ');return v;
 }
 async function latest(){
  const l=await get(SCRIPT+'/versions?page=1&per_page=10');
  need(Array.isArray(l.items)&&l.items[0]?.id===PIN.version,'UNEXPECTED_NEWER_VERSION');
 }
 const w=await get('workers/'+PIN.worker);
 need(w.id===PIN.workerId&&w.name===PIN.worker,'WORKER_ID');
 const sub=await get(SCRIPT+'/subdomain');
 need(sub.enabled===true&&sub.previews_enabled===false,'INGRESS');
 await serving();await latest();
 const body=prepareBody(folder,await version(PIN.version));
 const encoded=JSON.stringify(body);
 need(Buffer.byteLength(encoded)<=32*1024*1024,'REQUEST_SIZE');
 await latest();await serving();
 need(await reserve()===true,'LOCK_SPENT');
 let res;
 try{res=await fetchImpl(URL,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:encoded,redirect:'error',signal:AbortSignal.timeout(60000)})}
 catch{throw Error('G407_STOP_NETWORK_UNCERTAIN_NO_RETRY')}
 if(!res.ok){
  const codes=await sanitizedRefusalCodes(res);
  throw Error('G407_STOP_HTTP_'+res.status+'_CODES_'+(codes.join('_')||'UNKNOWN')+'_NO_RETRY');
 }
 const j=await res.json(),id=j.result?.id;
 need(j.success===true&&uuid.test(id??'')&&id!==PIN.version,'CREATE_UNCERTAIN_NO_RETRY');
 await serving();verifyBindings(await version(id),'new');
 const after=await get(SCRIPT+'/subdomain');need(after.enabled===true&&after.previews_enabled===false,'POST_INGRESS');
 return {result:'G407_INACTIVE_VERSION_READBACK_PASS',newVersion:id,servingVersion:PIN.version,servingTraffic:100,activated:false,stripeMode:'disabled'};
}
function makeReservation(){
 const root=join(process.env.LOCALAPPDATA,'FIRE-STAGING-Private');
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_DIR');
 for(const n of HIST){const p=join(root,n);need(lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink(),'HISTORY');}
 const lock=join(root,LOCK);need(!existsSync(lock),'LOCK_SPENT');
 return ()=>{try{writeFileSync(lock,JSON.stringify({receipt:PIN.receipt,authorization:7199757965,predecessor:PIN.version,attemptedAt:new Date().toISOString(),noRetry:true}),{flag:'wx',mode:0o600});return true}catch{return false}};
}
export function syntheticPredecessor(){
 return {id:PIN.version,resources:{bindings:[
 {name:'DB',type:'d1',id:PIN.db},
 ...['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH'].map(name=>({name,type:'secret_text'})),
 ...Object.entries({FIRE_ENV:'staging',SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev',FIRE_STRIPE_MODE:'disabled',FIRE_STAGING_PRIVATE_ACTIVATION:'owner-approved'}).map(([name,text])=>({name,type:'plain_text',text}))
 ]}};
}
async function main(){
 const [mode,folder,consent]=process.argv.slice(2);
 need(folder&&process.argv.length===5&&consent==='7199757965','ARGS');
 if(mode==='--offline-review'){
  const body=prepareBody(folder,syntheticPredecessor());
  console.log('G407_BODY_OFFLINE_PASS modules='+body.modules.length);return;
 }
 need(mode==='--execute'&&process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'OWNER_ONLY');
 const reserve=makeReservation();
 const token=process.env.CLOUDFLARE_API_TOKEN;
 console.log(JSON.stringify(await runOnce({folder,token,reserve,fetchImpl:fetch,consent})));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main()}catch(e){console.error(/^G407_STOP_[A-Z0-9_]+$/.test(e.message)?e.message:'G407_STOP_UNVERIFIED_NO_RETRY');process.exitCode=1}
}
