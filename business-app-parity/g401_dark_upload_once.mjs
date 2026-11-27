// Exact G401 DARK version upload; one target per invocation, no traffic switch.
import {PINS,SOURCE,ACCOUNT,prepare,preflight,verifyBindings,compareModules} from './g401_dark_release_review.mjs';
import {join,resolve} from 'node:path';
import {mkdirSync,lstatSync,existsSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const need=(ok,label)=>{if(!ok)throw Error('G401_UPLOAD_STOP_'+label)};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export const phrase=t=>'AUTHORIZE ONE INACTIVE DARK '+t.toUpperCase()+' VERSION '+SOURCE;
export async function upload({target,pack,token,approval,reserve,fetchImpl=fetch,check=preflight}){
 need(Object.hasOwn(PINS,target),'TARGET');
 const p=PINS[target];
 need(approval===phrase(target),'APPROVAL');
 need(pack.summary.target===target&&pack.summary.receipt===p.receipt&&pack.summary.source===SOURCE&&pack.inventory.length===242,'PACKAGE');
 const before=await check(target,token,fetchImpl);
 need(before.servingVersion===p.version&&before.latestVersion===p.version&&before.traffic===100&&before.bindingsVerified===true&&before.authBlocked===true&&before.publicIngress===false&&before.previews===false,'PREDECESSOR');
 if(target==='new-live')need(before.workerId==='181c231d6a004c969593fbdfac980230'&&before.servingDeployment==='bc3bab52-c6f0-4ae1-a18b-38c5522872e7','PIN');
 const second=await check(target,token,fetchImpl);
 need(JSON.stringify(before)===JSON.stringify(second),'DRIFT');
 const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/';
 const headers={Authorization:'Bearer '+token};
 const body=JSON.stringify(pack.body);
 need(Buffer.byteLength(body)<=32*1024*1024,'SIZE');
 need(await reserve(before)===true,'LOCK');
 const res=await fetchImpl(base+'workers/'+before.workerId+'/versions?deploy=false',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(60000)});
 need(res.ok,'HTTP_NO_RETRY');
 const reply=await res.json(),id=reply.result?.id;
 need(reply.success===true&&uuid.test(id??'')&&id!==p.version,'REPLY_NO_RETRY');
 const after=await check(target,token,fetchImpl);
 need(after.workerId===before.workerId&&after.servingDeployment===before.servingDeployment&&after.servingVersion===p.version&&after.latestVersion===id&&after.traffic===100&&after.bindingsVerified&&after.authBlocked&&after.publicIngress===false&&after.previews===false,'POST_STATE_NO_RETRY');
 const get=async path=>{
  const x=await fetchImpl(base+path,{method:'GET',headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  need(x.ok,'READBACK_HTTP_NO_RETRY');
  const j=await x.json();need(j.success===true&&j.result,'READBACK_NO_RETRY');return j.result;
 };
 verifyBindings(target,await get('scripts/'+p.worker+'/versions/'+id),id);
 compareModules(await get('workers/'+before.workerId+'/versions/'+id+'?include=modules'),pack.inventory,id);
 return {result:'G401_DARK_INACTIVE_BYTES_PASS',target,workerId:before.workerId,newVersion:id,servingVersion:p.version,traffic:100,matchedModules:242,activated:false,authBlocked:true,publicIngress:false,previews:false};
}
async function main(){
 const [target,folder,...rest]=process.argv.slice(2);
 need(rest.length===0&&Object.hasOwn(PINS,target)&&folder,'ARGS');
 need(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 let raw='';for await(const chunk of process.stdin){raw+=chunk;need(Buffer.byteLength(raw)<=8192,'INPUT')}
 const p=JSON.parse(raw);
 need(Object.keys(p).sort().join(',')==='approval,token'&&p.approval===phrase(target),'INPUT');
 const pack=prepare(target,folder);
 const root=join(process.env.LOCALAPPDATA,'FIRE-G401-Private');
 mkdirSync(root,{recursive:true,mode:0o700});
 need(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'ROOT');
 const lock=join(root,'inactive-'+target+'-'+PINS[target].receipt+'.lock');
 need(!existsSync(lock),'SPENT_NO_RETRY');
 const reserve=before=>{try{writeFileSync(lock,JSON.stringify({target,source:SOURCE,receipt:PINS[target].receipt,predecessor:before.servingVersion,workerId:before.workerId,noRetry:true}),{flag:'wx',mode:0o600});return true}catch{return false}};
 console.log(JSON.stringify(await upload({target,pack,token:p.token,approval:p.approval,reserve}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(/^G401_UPLOAD_STOP_[A-Z_]+$/.test(e?.message??'')?e.message:'G401_UPLOAD_STOP_UNCERTAIN_NO_RETRY');process.exitCode=1});
