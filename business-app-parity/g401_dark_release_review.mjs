// G4-01/G4-02: exact new DARK package review and read-only preflight.
// No POST, deployment, database query, or credential changes.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyCurrentDarkWorkerPackage} from './prepare_current_dark_worker_package.mjs';
import {reviewStagingFreeWorkerBundleBudget} from './staging_beta_free_bundle_budget.mjs';
export const SOURCE='4283a360b41a6766615566520fe6bfd200cb9f35';
export const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const PINS=Object.freeze({
 dr:Object.freeze({worker:'fire-fullapp-dr',version:'f7b7e27c-986b-44b5-b0f9-5e8e4b623426',db:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',env:'isolated-dr',auth:'FIRE_DR_AUTH_ENABLED',receipt:'47a92bdf0398c11e1d5407e1ecb0ed7e208a865539a8d520651e95d4d56195cf',inventory:'1f3dea9ce92ad6da7f4949967b95f4a9b61fdde0b89bc40d8f7a534c5562e063',bytes:9602058}),
 'new-live':Object.freeze({worker:'fire-fullapp-new-live',version:'cfacbb3d-43de-4d2c-8008-c6732d78f756',db:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',env:'new-live-prelaunch',auth:'FIRE_NEW_LIVE_AUTH_ENABLED',receipt:'74c0476dfe86301d7491fa6a0b2e721f547e7058b9357ed7132b5a3f2b195404',inventory:'342ee11eb410ae4f839c5ad650267f22b1145131fae9b3033dc82f09f7396998',bytes:9606635})
});
const need=(ok,label)=>{if(!ok)throw Error('G401_STOP_'+label)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const spec=t=>{need(Object.hasOwn(PINS,t),'TARGET');return PINS[t]};
export function bindings(t){
 const p=spec(t);
 return [{name:'DB',type:'d1',id:p.db},...Object.entries({FIRE_ENV:p.env,SITE_ORIGIN:'https://'+p.worker+'.kyle-bfc.workers.dev',[p.auth]:'blocked',FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'}).map(([name,text])=>({name,type:'plain_text',text}))];
}
export function verifyBindings(t,v,id){
 need(v?.id===id,'VERSION');
 const b=v.resources?.bindings;
 need(Array.isArray(b)&&b.length===5&&new Set(b.map(x=>x.name)).size===5,'BINDINGS');
 for(const x of bindings(t)){
  const y=b.find(z=>z.name===x.name);
  need(y&&y.type===x.type,'BINDING_TYPE');
  if(x.type==='d1')need((y.database_id??y.id)===x.id&&(!y.id||!y.database_id||y.id===y.database_id),'D1');
  else need(y.text===x.text,'VAR');
 }
 return true;
}
export function contentType(n){
 need(typeof n==='string'&&/^[A-Za-z0-9_./@+~-]+$/.test(n)&&n.split('/').every(p=>p&&p!=='.'&&p!=='..'),'PATH');
 if(/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(n))return 'application/octet-stream';
 const e=extname(n);
 if(e==='.js'||e==='.mjs')return 'application/javascript+module';
 if(e==='.wasm')return 'application/wasm';
 if(e==='.css'||e==='.json'||n==='BUILD_ID')return 'text/plain';
 throw Error('G401_STOP_UNCLASSIFIED_FILE');
}
export function prepare(t,folder){
 const p=spec(t),root=resolve(folder);
 const raw=readFileSync(join(root,'current-dark-source-receipt.json'));
 need(hash(raw)===p.receipt,'RECEIPT');
 const r=JSON.parse(raw),proof=verifyCurrentDarkWorkerPackage(t,root);
 need(proof.compiledSourceSha===SOURCE&&r.packageFilesDigestSha256===p.inventory&&proof.firstRequestAuthBlocked&&proof.workersDev===false&&proof.previewUrls===false,'PACKAGE');
 const cfg=JSON.parse(readFileSync(join(root,'server/wrangler.json')));
 need(cfg.main==='fire-noassets-entry.mjs'&&cfg.observability?.enabled===false&&cfg.workers_dev===false&&cfg.preview_urls===false,'CONFIG');
 const rows=r.packageFileInventory.filter(x=>x.path.startsWith('server/')&&x.path!=='server/wrangler.json');
 need(rows.length===242&&rows.reduce((s,x)=>s+x.bytes,0)===p.bytes,'SCOPE');
 reviewStagingFreeWorkerBundleBudget(rows);
 const modules=[],inventory=[];
 for(const row of rows){
  const name=row.path.slice(7),content_type=contentType(name),data=readFileSync(join(root,row.path));
  need(data.length===row.bytes&&hash(data)===row.sha256,'BYTES');
  modules.push({name,content_type,content_base64:data.toString('base64')});
  inventory.push({name,content_type,bytes:row.bytes,sha256:row.sha256});
 }
 need(new Set(modules.map(x=>x.name)).size===242&&modules.some(x=>x.name===cfg.main)&&modules.filter(x=>x.content_type==='application/octet-stream').length===41,'MODULES');
 const body={main_module:cfg.main,compatibility_date:cfg.compatibility_date,compatibility_flags:cfg.compatibility_flags,bindings:bindings(t),modules};
 const json=JSON.stringify(body);
 need(Buffer.byteLength(json)<=32*1024*1024,'BODY_SIZE');
 return {body,inventory,summary:{target:t,source:SOURCE,receipt:p.receipt,bodySHA256:hash(json),moduleInventorySHA256:hash(JSON.stringify(inventory)),moduleCount:inventory.length,clientAssets:41,auxiliaryText:inventory.filter(x=>x.content_type==='text/plain').map(x=>x.name),bytes:p.bytes,providerWrite:false}};
}
export function compareModules(v,expected,id){
 need(v?.id===id&&v.main_module==='fire-noassets-entry.mjs'&&Array.isArray(v.urls)&&v.urls.length===0,'HOSTED_ID');
 need(Array.isArray(v.modules)&&v.modules.length===expected.length,'HOSTED_COUNT');
 const map=new Map(expected.map(x=>[x.name,x]));
 need(map.size===expected.length,'EXPECTED_DUPLICATE');
 for(const m of v.modules){
  const row=map.get(m.name);
  need(row&&row.content_type===m.content_type&&typeof m.content_base64==='string','HOSTED_TYPE');
  const b=Buffer.from(m.content_base64,'base64');
  need(b.toString('base64')===m.content_base64&&b.length===row.bytes&&hash(b)===row.sha256,'HOSTED_BYTES');
  map.delete(m.name);
 }
 need(map.size===0,'HOSTED_MISSING');
 return true;
}
export async function preflight(t,token,fetchImpl=fetch){
 const p=spec(t),base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/',s='scripts/'+p.worker;
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'TOKEN');
 async function get(path){
  const res=await fetchImpl(base+path,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});
  need(res.ok,'GET_HTTP');
  const j=await res.json();need(j.success===true&&j.result,'GET_RESULT');return j.result;
 }
 const w=await get('workers/'+p.worker);
 need(w.name===p.worker&&typeof w.id==='string'&&/^[a-f0-9]{32}$/.test(w.id),'WORKER');
 const sub=await get(s+'/subdomain');
 need(sub.enabled===false&&sub.previews_enabled===false,'INGRESS');
 const d=(await get(s+'/deployments?page=1&per_page=1')).deployments?.[0];
 need(uuid.test(d?.id??'')&&d.versions?.length===1&&d.versions[0].version_id===p.version&&d.versions[0].percentage===100,'SERVING_DRIFT');
 verifyBindings(t,await get(s+'/versions/'+p.version),p.version);
 const list=await get(s+'/versions?page=1&per_page=10');
 need(Array.isArray(list.items)&&list.items.length>0&&uuid.test(list.items[0].id),'LATEST');
 return {target:t,workerId:w.id,servingDeployment:d.id,servingVersion:p.version,latestVersion:list.items[0].id,traffic:100,bindingsVerified:true,authBlocked:true,publicIngress:false,previews:false,providerWrite:false};
}
async function main(){
 const [mode,t,folder,...rest]=process.argv.slice(2);
 need(rest.length===0&&folder&&['inspect','preflight'].includes(mode),'ARGS');
 const pack=prepare(t,folder);
 if(mode==='inspect'){console.log(JSON.stringify(pack.summary,null,2));return;}
 need(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'OWNER_WINDOWS');
 console.log(JSON.stringify({...pack.summary,...await preflight(t,process.env.CLOUDFLARE_API_TOKEN)},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(/^G401_STOP_[A-Z_]+$/.test(e?.message??'')?e.message:'G401_STOP_UNVERIFIED');process.exitCode=1});
