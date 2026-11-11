/**
 * FIRE Gate9: concrete Cloudflare API READ-ONLY adapter for the existing TEST
 * Worker, using documented GET endpoints and an injected PRIVATE credential.
 *
 * NO upload, POST/PATCH/DELETE, Wrangler, CLI, browser cookies, logging,
 * token export or automatic retries. Connection is only used when an operator
 * explicitly supplies fetchImpl and read-only tokenProvider at runtime.
 * NEVER put an API token in GitHub, CI, a chat message or a screenshot.
 *
 * Official:
 * GET .../workers/scripts/{name}/deployments
 * GET .../workers/workers/{name}/versions/{uuid}
 * GET .../workers/workers/{name}/versions/{uuid}?include=modules
 */
import {createHash} from 'node:crypto';
import {WORKER,PREDECESSOR,DB_UUID,verifyPredecessor}
  from './gate9_inactive_fullapp_contract.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ACCOUNT=/^[0-9a-f]{32}$/i;
const MODULE_MIME=new Set(['application/javascript+module','application/json','text/plain','application/wasm']);
const fail=code=>{throw Error('STOP: Gate9 Cloudflare READ ONLY ['+code+']; no changes made.');};
const check=(b,reason)=>{if(!b)fail(reason);};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const secret=new Set([
  'FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL',
  'FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'
]);
function cleanBinding(b){
  check(b&&typeof b==='object'&&typeof b.name==='string'&&
    typeof b.type==='string','BINDING_SHAPE');
  const {name,type}=b;
  if(type==='d1'){
    const id=b.database_id??b.id;
    check(typeof id==='string'&&UUID.test(id)&&
      (b.id===undefined||b.database_id===undefined||b.id===b.database_id),
      'D1_ID');
    return {name,type,id};
  }
  if(type==='plain_text'){
    check(typeof b.text==='string'&&b.text.length<2048,'PLAIN_TEXT');
    return {name,type,text:b.text};
  }
  if(type==='secret_text'){
    check(secret.has(name)&&!Object.hasOwn(b,'text')&&
      !Object.hasOwn(b,'value'),'SECRET_VALUE_OR_NAME');
    return {name,type};
  }
  if(type==='assets'){
    return {name,type};
  }
  fail('UNEXPECTED_BINDING_TYPE');
}
function normalizedBindings(version){
  const b=version?.bindings??version?.resources?.bindings;
  check(Array.isArray(b)&&b.length>=9&&b.length<=10,'BINDINGS_MISSING');
  const result=b.map(cleanBinding);
  check(new Set(result.map(x=>x.name)).size===result.length,'DUPLICATE_BINDINGS');
  return result;
}
function unwrap(response){
  check(response&&response.success===true &&
    (response.errors==null||Array.isArray(response.errors)&&response.errors.length===0)&&
    response.result&&typeof response.result==='object',
    'PROVIDER_REPLY');
  return response.result;
}
/**
 * Parse the newest DEPLOYMENT, never most recently uploaded VERSION.
 * Version counts may include inactive uploads. Only 100% active is accepted.
 */
export function deployedVersionFromApi(payload){
  const a=unwrap(payload).deployments;
  check(Array.isArray(a)&&a.length>=1,'DEPLOYMENTS');
  const d=a[0];
  check(d?.strategy==='percentage'&&Array.isArray(d.versions)&&
    d.versions.length===1&&
    d.versions[0].version_id===PREDECESSOR&&d.versions[0].percentage===100,
    'ACTIVE_VERSION_CHANGED');
  return [{version_id:PREDECESSOR,percentage:100}];
}
/**
 * Never leak raw Cloudflare bindings or secrets in the returned result. Different
 * provider versions expose D1 as database_id; Wrangler uses id.
 */
export function predecessorFromApi(payload){
  const v=unwrap(payload);
  check(v.id===PREDECESSOR,'PREDECESSOR_ID');
  const safe={id:v.id,resources:{bindings:normalizedBindings(v)}};
  // Cloudflare's version GET can include default assets routing metadata
  // even for the owner's existing code-only TEST predecessor. Mere presence
  // of {assets:{config:{...}}} is not proof of an uploaded asset collection.
  // Refuse anything beyond the documented config-only response; an actual
  // ASSETS binding, JWT, provider resource or unexpected field must fail.
  if(v?.resources?.assets!==undefined||v?.resources?.static_assets!==undefined)
    fail('PREDECESSOR_ASSET_RESOURCE');
  if(v?.assets!==undefined){
    const a=v.assets;
    check(a&&typeof a==='object'&&!Array.isArray(a)&&
      Object.keys(a).length===1&&Object.hasOwn(a,'config')&&
      a.config&&typeof a.config==='object'&&!Array.isArray(a.config),
      'PREDECESSOR_ASSET_SHAPE');
    const allowed=new Set(['html_handling','not_found_handling','run_worker_first','base_path']);
    check(Object.keys(a.config).every(k=>allowed.has(k))&&
      a.config.run_worker_first===false&&
      (a.config.base_path===undefined||a.config.base_path===null||
       typeof a.config.base_path==='string')&&
      (a.config.html_handling===undefined||
       ['auto-trailing-slash','force-trailing-slash','drop-trailing-slash','none']
         .includes(a.config.html_handling))&&
      (a.config.not_found_handling===undefined||
       ['none','404-page','single-page-application']
         .includes(a.config.not_found_handling)),
      'PREDECESSOR_ASSET_CONFIG');
  }
  verifyPredecessor(safe);
  return safe;
}
/**
 * Provider GET ?include=modules contains actual module bytes, NOT our prior
 * requested body. Sort by name (order is not semantically significant), then
 * compute a local digest for an independent source-provenance comparison.
 */
// Cloudflare's beta Worker Version GET may encode the compatibility date as
// UTC midnight RFC3339 (as in the public API examples), while a Wrangler
// build specifies the same date as YYYY-MM-DD. Normalize ONLY equivalent
// date-only or exact UTC-midnight values; reject times/zones/date overflow.
// The coordinator still compares the result to the exact approved date.
export function normalizeWorkerCompatibilityDate(value){
  check(typeof value==='string','COMPATIBILITY_DATE');
  const match=/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  check(Boolean(match),'COMPATIBILITY_DATE');
  const date=match[1];
  const timestamp=new Date(date+'T00:00:00Z');
  check(!Number.isNaN(timestamp.getTime())&&
    timestamp.toISOString().slice(0,10)===date,'COMPATIBILITY_DATE');
  return date;
}

export function createdVersionFromApi(payload,expectedId){
  check(UUID.test(expectedId)&&expectedId!==PREDECESSOR,'VERSION_ID_ARG');
  const v=unwrap(payload);
  check(v.id===expectedId,'NEW_VERSION_ID');
  check(typeof v.main_module==='string'&&v.main_module.length>0&&
    Array.isArray(v.compatibility_flags),'VERSION_FIELDS');
  const compatibilityDate=normalizeWorkerCompatibilityDate(v.compatibility_date);
  check(v.assets&&typeof v.assets==='object'&&
    v.assets.config?.run_worker_first===true,'ASSET_CONFIGURATION');
  check(Array.isArray(v.modules)&&v.modules.length>0&&v.modules.length<5000,
    'INDEPENDENT_MODULE_READBACK_REQUIRED');
  const seen=new Set(),modules=[];
  let bytes=0;
  for(const m of v.modules){
    check(typeof m.name==='string'&&
      /^[A-Za-z0-9_.~\/-]+$/.test(m.name)&&
      !m.name.includes('..')&&!m.name.startsWith('/')&&!seen.has(m.name)&&
      MODULE_MIME.has(m.content_type)&&
      typeof m.content_base64==='string'&&m.content_base64.length>0,'MODULE_SHAPE');
    seen.add(m.name);
    const decoded=Buffer.from(m.content_base64,'base64');
    check(decoded.length>0&&decoded.length<80_000_000&&
      decoded.toString('base64')===m.content_base64,'MODULE_CONTENT');
    bytes+=decoded.length;
    check(bytes<200_000_000,'MODULE_BUDGET');
    modules.push({name:m.name,content_type:m.content_type,content_base64:m.content_base64});
  }
  modules.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  const bindings=normalizedBindings(v);
  check(bindings.length===10,'NEW_VERSION_BINDINGS');
  return {
    id:v.id,
    main_module:v.main_module,
    compatibility_date:compatibilityDate,
    compatibility_flags:[...v.compatibility_flags],
    bindings,
    assets:{config:{run_worker_first:true}},
    moduleDigest:sha(modules)
  };
}
/**
 * The only 3 provider operations this adapter can possibly perform are GET.
 * Token supplied via a private callback, never captured in a printed error.
 * The transport does not expose a request(...) function for ANY writes.
 */
export function createGate9ReadOnlyApi({
  accountId,tokenProvider,fetchImpl,timeoutMs=15000
}){
  check(typeof accountId==='string'&&ACCOUNT.test(accountId)&&
    !/^0+$/.test(accountId),'ACCOUNT_ID');
  check(typeof tokenProvider==='function'&&typeof fetchImpl==='function'&&
    Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=60000,'ADAPTER_CONFIG');
  const prefix='/accounts/'+accountId;
  const versionPath=prefix+'/workers/workers/'+WORKER+'/versions/';
  const deploymentsPath=prefix+'/workers/scripts/'+WORKER+'/deployments';
  const allowlist=new Set([deploymentsPath,versionPath+PREDECESSOR]);
  const get=async path=>{
    check(allowlist.has(path)||path.startsWith(versionPath)&&
      /^\b[0-9a-f-]{36}\?include=modules$/.test(path.slice(versionPath.length)),
      'GET_ALLOWLIST');
    let t;
    try{t=await tokenProvider();}catch{fail('PRIVATE_AUTH');}
    check(typeof t==='string'&&t.length>10&&t.length<4096&&!/\s/.test(t),
      'PRIVATE_AUTH');
    let res;
    try{
      res=await fetchImpl('https://api.cloudflare.com/client/v4'+path,{
        method:'GET',redirect:'error',cache:'no-store',
        headers:{Authorization:'Bearer '+t,Accept:'application/json'},
        signal:AbortSignal.timeout(timeoutMs)
      });
    }catch{fail('GET_FAILED');}
    check(res&&res.status===200&&res.ok===true,'GET_STATUS');
    const len=Number(res.headers?.get?.('content-length'));
    check(!Number.isFinite(len)||len<=32_000_000,'REPLY_SIZE');
    let body;
    try{body=await res.json();}catch{fail('GET_JSON');}
    return body;
  };
  return Object.freeze({
    readState:async()=>{
      // Fresh independently sourced serving traffic (NOT "latest upload").
      const deployed=deployedVersionFromApi(await get(deploymentsPath));
      const baseline=predecessorFromApi(await get(versionPath+PREDECESSOR));
      return {accountId,worker:WORKER,version:baseline,versions:deployed};
    },
    readVersion:async id=>{
      check(UUID.test(id)&&id!==PREDECESSOR,'READ_VERSION_ID');
      return createdVersionFromApi(await get(versionPath+id+'?include=modules'),id);
    }
  });
}

