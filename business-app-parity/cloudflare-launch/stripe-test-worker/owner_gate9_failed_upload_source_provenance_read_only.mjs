/**
 * FIRE G9: ONE missing read-only question after the consumed Nov 25 TEST upload.
 * Did any of the six already-inventoried inactive versions contain the exact
 * owner-sealed activation candidate? Compare immutable module bytes, bindings,
 * creation time and 100% predecessor traffic. NO provider write, retry or login.
 *
 * Owner Acer (existing token only):
 * node business-app-parity/cloudflare-launch/stripe-test-worker/owner_gate9_failed_upload_source_provenance_read_only.mjs "C:\absolute\sealed-review-folder"
 *
 * Token stays in process.env.CLOUDFLARE_API_TOKEN, never in chat/repository.
 * Do not publish the original provider responses: they contain Worker code.
 */
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareModules} from './gate9_private_test_activation_version_upload.mjs';
import {deployedVersionFromApi} from './gate9_cloudflare_readonly_adapter.mjs';

const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const WORKER='fire-stripe-test-20261101';
const PREDECESSOR='96e32262-fa33-4f04-a161-bee11f0353e2';
const DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const STRIPE='acct_1ULRIG7ND12rd1wI';
const SOURCE='33f24500d9b6af665c4fa1e2e1e588e92227c70e';
const RECEIPT_PIN='9ab0785724f1f9cd2b0254ec662545a5881ed2d6f62951fc4016d3c35c801481';
const LOCK='gate9-one-inactive-provider-attempt-consumed-20261125.json';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=x=>{throw Error('G9_PROVENANCE_READ_ONLY_STOP_'+x);};
const need=(ok,x)=>{if(!ok)stop(x);};
// These six were physically inventoried and classified Nov 25. We do NOT
// invent unseen IDs, rerun list inventory or change the current serving Worker.
export const KNOWN_INACTIVE_IDS=Object.freeze([
 '6eebb610-0e78-4b4e-9897-48d31fae3eb7',
 '28d5ef5d-7cd9-4e47-9b19-5b0ed731e2dc',
 'b7d0f5eb-63f2-47e1-9c50-11ef2bdd90a3',
 '10512a56-f529-4cb6-a8a6-0e090b704f65',
 '8a3931e2-c9ec-403e-8403-5833afbc2578',
 '1dff1fa7-05ae-419d-a223-9be66937e56d'
]);
const PLAIN=Object.freeze({
 FIRE_ENV:'cloudflare-staging',
 SITE_ORIGIN:ORIGIN,
 FIRE_ACCESS_REQUIRED:'enabled',
 FIRE_STRIPE_MODE:'test',
 FIRE_STRIPE_EXPECTED_ACCOUNT_ID:STRIPE,
 FIRE_GATE9_PRIVATE_ACTIVATION:'owner-approved'
});
const SECRETS=Object.freeze([
 'FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN',
 'STRIPE_WEBHOOK_SECRET','STRIPE_RESTRICTED_KEY'
]);

function stableBindings(value,expect) {
 const rows=value?.bindings??value?.resources?.bindings;
 if(!Array.isArray(rows)||rows.length!==1+Object.keys(expect.plain).length+expect.secrets.length)return false;
 const byName=new Map();
 for(const b of rows){
  if(!b||typeof b.name!=='string'||byName.has(b.name)||typeof b.type!=='string')return false;
  byName.set(b.name,b);
 }
 const db=byName.get('DB');
 if(!db||db.type!=='d1'||(db.database_id??db.id)!==expect.db||
    (db.database_id!==undefined&&db.id!==undefined&&db.database_id!==db.id))return false;
 for(const [name,text] of Object.entries(expect.plain)){
  const v=byName.get(name);
  if(!v||v.type!=='plain_text'||v.text!==text)return false;
 }
 for(const name of expect.secrets){
  const v=byName.get(name);
  if(!v||v.type!=='secret_text'||Object.hasOwn(v,'text')||Object.hasOwn(v,'value'))return false;
 }
 return true;
}
function byteIdentical(got,expected){
 if(!Array.isArray(got)||got.length!==expected.length||got.length<2||got.length>500)return false;
 const byName=new Map(expected.map(x=>[x.name,x]));
 if(byName.size!==expected.length)return false;
 let totalBytes=0;
 for(const m of got){
  const ref=byName.get(m?.name);
  if(!ref||m.content_type!==ref.content_type||
     typeof m.content_base64!=='string'||m.content_base64.length!==ref.content_base64.length)return false;
  const bytes=Buffer.from(m.content_base64,'base64');
  totalBytes+=bytes.length;
  if(totalBytes>32_000_000||bytes.toString('base64')!==m.content_base64||
     sha(bytes)!==sha(Buffer.from(ref.content_base64,'base64')))return false;
  byName.delete(m.name);
 }
 return byName.size===0;
}
/** Pure and testable: absence of modules can NEVER count as source verified. */
export function assessExistingVersion(version,expect){
 need(version&&typeof version==='object'&&UUID.test(expect.id)&&version.id===expect.id,'VERSION_ID');
 need(typeof version.created_on==='string'&&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(version.created_on)&&
  Number.isFinite(Date.parse(version.created_on)),'CREATED_AT');
 const attempted=Date.parse(expect.attemptedAt);
 need(Number.isFinite(attempted),'ATTEMPT_TIME');
 // 2m tolerance before owner lock, 45m after. This is attribution only;
 // exact code provenance and live traffic must ALSO match independently.
 const created=Date.parse(version.created_on);
 const inAttemptWindow=created>=attempted-120_000&&created<=attempted+45*60_000;
 const meta=version.main_module===expect.main_module&&
  version.compatibility_date===expect.compatibility_date&&
  Array.isArray(version.compatibility_flags)&&
  JSON.stringify([...version.compatibility_flags].sort())===
    JSON.stringify([...expect.compatibility_flags].sort())&&
  Array.isArray(version.urls)&&version.urls.length===0&&
  version.assets?.jwt===undefined&&version.resources?.assets===undefined&&
  version.resources?.static_assets===undefined;
 const bindingsMatch=meta&&stableBindings(version,expect);
 const modulesMatch=bindingsMatch&&byteIdentical(version.modules,expect.modules);
 return {id:version.id,inAttemptWindow,metadataMatch:meta,
  bindingsMatch,modulesMatch,
  exactAttemptCandidate:inAttemptWindow&&meta&&bindingsMatch&&modulesMatch};
}
function receiptExpect(folder){
 const rpath=join(folder,'activation-review-receipt.json');
 const bytes=readFileSync(rpath);
 need(sha(bytes)===RECEIPT_PIN,'PACKAGE_RECEIPT_PIN');
 const r=JSON.parse(bytes);
 need(r.sourceSha===SOURCE&&r.worker===WORKER&&r.d1===DB&&
  r.rollbackVersion===PREDECESSOR&&r.account===STRIPE&&
  r.uploadAuthorized===false&&r.activationAuthorized===false&&r.providerContacted===false,'PACKAGE_SCOPE');
 const lock=JSON.parse(readFileSync(join(folder,LOCK),'utf8'));
 need(lock.status==='CONSUMED_DO_NOT_RETRY'&&lock.worker===WORKER&&
  lock.sourceSha===SOURCE&&lock.receiptPin===RECEIPT_PIN&&
  lock.previousVersion===PREDECESSOR,'SPENT_LOCK');
 const entry=prepareModules(folder,RECEIPT_PIN);
 need(entry.main_module==='fire-gate9-test-activation-entry.mjs'&&
  entry.modules.length>=80,'ENTRY_SCOPE');
 return {...entry,plain:PLAIN,secrets:SECRETS,db:DB,attemptedAt:lock.attemptedAt};
}
async function getJson(path,token,maxBytes){
 let response;
 try{response=await fetch(BASE+path,{method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(45000)});}catch{stop('NETWORK');}
 need(response?.ok===true,'HTTP_'+(Number.isInteger(response?.status)?response.status:'UNKNOWN'));
 // Cap all provider responses in memory. Never write raw code or bindings to disk.
 const reader=response.body?.getReader();
 need(reader,'BODY');
 let chunks=[],size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();stop('RESPONSE_TOO_LARGE');}
   chunks.push(Buffer.from(value));
  }
 }catch{stop('BODY_READ');}
 let data;try{data=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}catch{stop('JSON');}
 need(data?.success===true&&(!Array.isArray(data.errors)||data.errors.length===0)&&data.result,'ENVELOPE');
 return data;
}
export async function main(args=process.argv.slice(2)){
 need(args.length===1&&isAbsolute(args[0]),'ABSOLUTE_FOLDER');
 const folder=resolve(args[0]),st=lstatSync(folder);
 need(st.isDirectory()&&!st.isSymbolicLink()&&realpathSync(folder)===folder,'LOCAL_FOLDER');
 const expect=receiptExpect(folder);
 const token=process.env.CLOUDFLARE_API_TOKEN;
 need(typeof token==='string'&&token.length>10&&!/\s/.test(token),'NO_EXISTING_TOKEN');
 let match=null;
 for(const id of KNOWN_INACTIVE_IDS){
  const base='/workers/workers/'+WORKER+'/versions/'+id;
  // Current version metadata was classified before, but created_at and the
  // owner-sealed code byte identity were NOT verified in the accepted receipt.
  const meta=(await getJson(base,token,2_000_000)).result;
  const date=assessExistingVersion({...meta,modules:undefined},{...expect,id});
  let verdict=date;
  if(date.inAttemptWindow&&date.metadataMatch&&date.bindingsMatch){
   const full=(await getJson(base+'?include=modules',token,48_000_000)).result;
   verdict=assessExistingVersion(full,{...expect,id});
  }
  console.log('VERSION_ID='+id+' IN_ATTEMPT_WINDOW='+verdict.inAttemptWindow+
   ' BINDINGS_MATCH='+verdict.bindingsMatch+' EXACT_MODULE_BYTES='+verdict.modulesMatch);
  if(verdict.exactAttemptCandidate){
   need(match===null,'MULTIPLE_EXACT_CANDIDATES');
   match=id;
  }
 }
 if(match!==null){
  // Recheck only if a byte-identical attempted candidate exists. Do not
  // mistake an inactive entry in a version list for unchanged serving traffic.
  deployedVersionFromApi(await getJson('/workers/scripts/'+WORKER+'/deployments',token,2_000_000));
  console.log('EXACT_ATTEMPT_CANDIDATE='+match+' SERVING_PREDECESSOR_100_PERCENT=TRUE');
  console.log('READ_ONLY_SOURCE_PROVENANCE_REQUIRES_OWNER_REVIEW_NOT_ACTIVATION_APPROVAL');
 }else{
  console.log('NO_EXACT_ATTEMPT_CANDIDATE_AMONG_SIX_PREVIOUSLY_INVENTORIED_IDS');
  console.log('THIS DOES_NOT_PROVE_ALL_ACCOUNT_VERSIONS_OR_PROVIDER_TRANSACTION_ABSENCE');
 }
 console.log('NO_POST_NO_UPLOAD_NO_ACTIVATION_NO_STRIPE_OR_D1_WRITE_NO_LOCK_RESET');
 return {exactCandidate:match,providerMutated:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(e){
  const reason=typeof e?.message==='string'&&/^G9_PROVENANCE_READ_ONLY_STOP_[A-Z0-9_]+$/.test(e.message)?
   e.message:'G9_PROVENANCE_READ_ONLY_STOP_UNVERIFIED';
  console.error(reason+'; no provider changes. No repeat upload or sign-in.');
  process.exitCode=1;
 }finally{delete process.env.CLOUDFLARE_API_TOKEN;}
}
