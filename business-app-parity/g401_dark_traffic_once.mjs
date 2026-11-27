// G401 exact DARK traffic transition, separate from inactive upload.
// Never changes authentication, bindings, URLs, payments, databases or creates versions.
import {PINS,SOURCE,ACCOUNT,verifyBindings} from './g401_dark_release_review.mjs';
import {join,resolve} from 'node:path';
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const TARGETS=Object.freeze({
 dr:Object.freeze({workerId:'fad3095c4a9b45be8133310a2bb573fb',next:'264990d7-1902-45da-88b6-30d714c35200',older:'b7c42773-5a93-4c6c-91d2-83cdb8e857d9'}),
 'new-live':Object.freeze({workerId:'181c231d6a004c969593fbdfac980230',next:'136370a0-1ab6-4263-babf-06680b7ecd3b',older:'adb5fd7c-ddd0-4e97-87e7-6a4045d42d09',deployment:'bc3bab52-c6f0-4ae1-a18b-38c5522872e7'})
});
const need=(ok,c)=>{if(!ok)throw Error('G401_TRAFFIC_STOP_'+c)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const regular=p=>existsSync(p)&&lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink();
export const phrase=t=>'AUTHORIZE DARK TRAFFIC '+t.toUpperCase()+' '+TARGETS[t].next+' 100 PERCENT';
export function reserveTraffic(root,t){
 need(Object.hasOwn(TARGETS,t),'TARGET');
 const p=PINS[t],s=TARGETS[t];
 need(existsSync(root)&&lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'PRIVATE_ROOT');
 const upload=join(root,'inactive-'+t+'-'+p.receipt+'.lock');
 need(regular(upload),'UPLOAD_LOCK');
 const l=JSON.parse(readFileSync(upload,'utf8'));
 need(l.target===t&&l.source===SOURCE&&l.receipt===p.receipt&&l.predecessor===p.version&&l.workerId===s.workerId&&l.noRetry===true,'UPLOAD_LOCK_ID');
 const lock=join(root,'traffic-'+t+'-'+s.next+'.lock');
 need(!existsSync(lock),'SPENT_NO_RETRY');
 return before=>{try{writeFileSync(lock,JSON.stringify({target:t,source:SOURCE,old:p.version,next:s.next,oldDeployment:before.id,noRetry:true}),{flag:'wx',mode:0o600});return true}catch{return false}};
}
export async function switchTraffic({target,token,approval,reserve,fetchImpl=fetch}){
 need(Object.hasOwn(TARGETS,target),'TARGET');
 const p=PINS[target],s=TARGETS[target];
 need(approval===phrase(target),'APPROVAL');
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'TOKEN');
 const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/',script='scripts/'+p.worker;
 const headers={Authorization:'Bearer '+token};
 async function get(path){
  const res=await fetchImpl(base+path,{method:'GET',headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});
  need(res.ok,'GET_HTTP');
  const j=await res.json();need(j.success===true&&j.result,'GET_RESULT');return j.result;
 }
 async function current(){
  const list=await get(script+'/deployments?page=1&per_page=1'),d=list.deployments?.[0];
  need(Array.isArray(list.deployments)&&list.deployments.length===1&&uuid.test(d?.id??'')&&d.versions?.length===1&&d.versions[0].percentage===100,'DEPLOYMENT');
  return d;
 }
 async function dark(){
  const w=await get('workers/'+p.worker);need(w.id===s.workerId&&w.name===p.worker,'WORKER');
  const sub=await get(script+'/subdomain');need(sub.enabled===false&&sub.previews_enabled===false,'INGRESS');
 }
 async function versions(){
  const list=await get(script+'/versions?page=1&per_page=10');
  need(list.items?.[0]?.id===s.next,'LATEST');
  verifyBindings(target,await get(script+'/versions/'+s.next),s.next);
  verifyBindings(target,await get(script+'/versions/'+p.version),p.version);
  need((await get(script+'/versions/'+s.older)).id===s.older,'OLDER_ROLLBACK');
 }
 await dark();await versions();
 const before=await current();
 need(before.versions[0].version_id===p.version&&(!s.deployment||before.id===s.deployment),'PREDECESSOR');
 const last=await current();need(last.id===before.id&&last.versions[0].version_id===p.version,'DRIFT');
 need(await reserve(before)===true,'LOCK');
 // A successful POST envelope need not repeat GET's deployment shape.
 // Always reconcile by independent GET, never submit a second POST.
 let acknowledged=false;
 try{
  const response=await fetchImpl(base+script+'/deployments',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:s.next,percentage:100}]}),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(response.ok){const j=await response.json();acknowledged=j.success===true;}
 }catch{}
 const after=await current();
 need(after.id!==before.id&&after.versions[0].version_id===s.next,'OUTCOME_NO_RETRY');
 await dark();await versions();
 const final=await current();need(final.id===after.id&&final.versions[0].version_id===s.next,'POST_DRIFT_NO_RETRY');
 return {result:'G401_DARK_TRAFFIC_100_VERIFIED',target,worker:p.worker,deployment:after.id,servingVersion:s.next,traffic:100,rollbackVersion:p.version,olderRollback:s.older,authBlocked:true,workersDev:false,previews:false,postAcknowledged:acknowledged,publicLaunch:false};
}
async function main(){
 const [target,...rest]=process.argv.slice(2);
 need(rest.length===0&&Object.hasOwn(TARGETS,target),'ARGS');
 need(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 let raw='';for await(const c of process.stdin){raw+=c;need(Buffer.byteLength(raw)<=8192,'INPUT')}
 const data=JSON.parse(raw);
 need(Object.keys(data).sort().join(',')==='approval,token'&&data.approval===phrase(target),'INPUT');
 const reserve=reserveTraffic(join(process.env.LOCALAPPDATA,'FIRE-G401-Private'),target);
 console.log(JSON.stringify(await switchTraffic({target,...data,reserve}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(/^G401_TRAFFIC_STOP_[A-Z_]+$/.test(e?.message??'')?e.message:'G401_TRAFFIC_STOP_UNCERTAIN_NO_RETRY');process.exitCode=1});
