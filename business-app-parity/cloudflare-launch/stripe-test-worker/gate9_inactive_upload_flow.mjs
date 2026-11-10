/** Guarded Gate9 protocol coordinator. No HTTP, credentials, CLI, or default transport.
 * A separately reviewed authenticated adapter and explicit owner approval are REQUIRED.
 * API references: Cloudflare Workers static-assets/direct-upload and beta versions/create.
 * Never log transport bodies, JWTs, credentials, or raw provider errors.
 */
import {createHash} from 'node:crypto';
import {WORKER,PREDECESSOR,DB_UUID,verifyPredecessor,verifyAssetManifest,
  verifyInactiveProposal,proposedInactivePlan} from './gate9_inactive_fullapp_contract.mjs';
const fail=code=>{throw Error('STOP: Gate9 inactive upload ['+code+']; reconcile before retry.');};
const check=(v,c)=>{if(!v)fail(c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const token=x=>typeof x==='string'&&x.length>0&&x.length<32768&&!/[\s\u0000-\u001f]/.test(x);
const successful=r=>r&&Number.isInteger(r.status)&&r.status>=200&&r.status<300&&
  r.body?.success===true&&(r.body.errors==null||
    (Array.isArray(r.body.errors)&&r.body.errors.length===0));
const OPS='register-assets,upload-assets,create-inactive-version';
export function uploadApprovalDigest(candidate){return digest(candidate);}
function serving(s,accountId){
  check(s?.worker===WORKER&&s.accountId===accountId,'TARGET');
  verifyPredecessor(s.version);
  check(Array.isArray(s.versions)&&s.versions.length===1&&
    s.versions[0].version_id===PREDECESSOR&&s.versions[0].percentage===100,'TRAFFIC');
}
/**
 * transport.request receives ONLY allowlisted request descriptors. It must enforce
 * official API origin, no redirects/retries, timeout, private auth and redacted errors.
 * readState/readVersion must be authenticated independent provider GETs, not echoes.
 * This module never supplies an adapter and does not grant authorization itself.
 */
export async function runApprovedInactiveUpload({candidate,approval,accountId,transport,
  now=()=>Date.now()}){
  const copy=structuredClone(candidate); // approval binds a stable copy, not caller-mutated objects
  check(/^[a-f0-9]{32}$/.test(accountId)&&!/^0+$/.test(accountId),'ACCOUNT');
  check(/^[a-f0-9]{40}$/.test(copy?.sourceSha),'SOURCE');
  verifyAssetManifest(copy.manifest);
  check(Object.keys(copy.versionBody||{}).sort().join(',')===
    'assets,bindings,compatibility_date,compatibility_flags,main_module,modules','VERSION_FIELDS');
  check(Object.keys(copy.versionBody.assets||{}).join(',')==='config'&&
    Object.keys(copy.versionBody.assets.config||{}).join(',')==='run_worker_first','ASSET_FIELDS');
  check(/^\d{4}-\d{2}-\d{2}$/.test(copy.versionBody.compatibility_date)&&
    Array.isArray(copy.versionBody.compatibility_flags)&&
    copy.versionBody.compatibility_flags.includes('nodejs_compat'),'COMPATIBILITY');
  check(copy.versionBody?.assets?.config?.run_worker_first===true,'WORKER_FIRST');
  check(!Object.hasOwn(copy.versionBody.assets,'jwt'),'NO_TOKEN_IN_CANDIDATE');
  verifyInactiveProposal({...proposedInactivePlan(),bindings:copy.versionBody.bindings});
  check(Array.isArray(copy.versionBody.modules)&&copy.versionBody.modules.length>0,'MODULES');
  const names=new Set();
  for(const m of copy.versionBody.modules){
    check(Object.keys(m).sort().join(',')==='content_base64,content_type,name'&&
      /^[A-Za-z0-9_.~\/-]+$/.test(m.name)&&!m.name.includes('..')&&
      !m.name.startsWith('/')&&!names.has(m.name),'MODULE_NAME');
    check(['application/javascript+module','application/json','text/plain','application/wasm']
      .includes(m.content_type)&&typeof m.content_base64==='string'&&m.content_base64.length>0&&
      Buffer.from(m.content_base64,'base64').toString('base64')===m.content_base64,'MODULE_BYTES');
    names.add(m.name);
  }
  check(names.has('_headers')&&names.has(copy.versionBody.main_module),'ENTRYPOINT');
  const fingerprint=digest(copy);
  const authorized=()=>check(approval?.worker===WORKER&&approval.predecessor===PREDECESSOR&&
    approval.dbUuid===DB_UUID&&approval.accountId===accountId&&
    approval.sourceSha===copy.sourceSha&&approval.candidateDigest===fingerprint&&
    approval.operations===OPS&&Number.isSafeInteger(approval.expiresAt)&&
    now()<approval.expiresAt,'APPROVAL');
  authorized();
  check(typeof transport?.request==='function'&&typeof transport.readState==='function'&&
    typeof transport.readVersion==='function','ADAPTER');
  const state=async()=>{
    let s;try{s=await transport.readState();}catch{fail('STATE_READ_UNVERIFIED');}
    serving(s,accountId);
  };
  const request=async descriptor=>{
    authorized();
    try{return await transport.request(descriptor);}
    catch{fail('REQUEST_UNCERTAIN');} // no automatic replay after ambiguous remote result
  };
  const prefix='/accounts/'+accountId;
  await state();
  const started=now();
  const reg=await request({method:'POST',path:prefix+'/workers/scripts/'+WORKER+
    '/assets-upload-session',auth:'account',json:{manifest:copy.manifest}});
  check(successful(reg)&&token(reg.body.result?.jwt)&&
    Array.isArray(reg.body.result.buckets),'REGISTRATION');
  const buckets=reg.body.result.buckets;
  const known=new Set(Object.values(copy.manifest).map(x=>x.hash));
  const used=new Set();
  check(buckets.length<=5000,'BUCKETS');
  for(const bucket of buckets){
    check(Array.isArray(bucket)&&bucket.length>0&&bucket.length<=500,'BUCKET');
    for(const h of bucket){check(known.has(h)&&!used.has(h),'HASH');used.add(h);}
  }
  let completion=buckets.length===0?reg.body.result.jwt:null;
  const uploadJwt=reg.body.result.jwt;
  for(let i=0;i<buckets.length;i++){
    check(now()-started<55*60*1000,'SESSION_EXPIRED');
    await state(); // changes to active version/config stop every next provider write
    const res=await request({method:'POST',path:prefix+'/workers/assets/upload?base64=true',
      auth:'asset-session',jwt:uploadJwt,hashes:buckets[i]});
    check(successful(res),'ASSET_UPLOAD');
    if(res.status===201){
      check(token(res.body.result?.jwt),'COMPLETION_TOKEN');
      completion=res.body.result.jwt;
    }
  }
  check(token(completion)&&now()-started<55*60*1000,'UPLOAD_NOT_COMPLETE');
  await state();
  const body={...copy.versionBody,assets:{...copy.versionBody.assets,jwt:completion}};
  const created=await request({method:'POST',path:prefix+'/workers/workers/'+WORKER+
    '/versions?deploy=false',auth:'account',json:body});
  const id=created?.body?.result?.id;
  check(successful(created)&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)&&
    id!==PREDECESSOR,'VERSION_RECEIPT');
  await state(); // checks predecessor still 100%, not merely new-version status
  let actual;try{actual=await transport.readVersion(id);}catch{fail('VERSION_READ_UNVERIFIED');}
  check(actual?.id===id&&actual.main_module===body.main_module&&
    actual.compatibility_date===body.compatibility_date&&
    digest(actual.compatibility_flags)===digest(body.compatibility_flags),'VERSION_IDENTITY');
  check(actual.assets?.config?.run_worker_first===true&&
    actual.moduleDigest===digest(body.modules),'VERSION_BYTES');
  // Adapter must normalize expanded immutable-version bindings, never requested inherit entries.
  const expanded=actual.bindings;
  check(Array.isArray(expanded)&&expanded.length===10,'BOUND_RESOURCES');
  check(expanded.filter(b=>b.type==='assets'&&b.name==='ASSETS').length===1,'ASSETS_BINDING');
  verifyPredecessor({id:PREDECESSOR,resources:{bindings:expanded.filter(b=>b.name!=='ASSETS')}});
  return {versionId:id,sourceSha:copy.sourceSha,candidateDigest:fingerprint,
    activePredecessor:PREDECESSOR,activePercentage:100,newVersionPercentage:0,
    providerReceiptChecked:true,assetDeliveryVerified:false,gate9Accepted:false};
}
