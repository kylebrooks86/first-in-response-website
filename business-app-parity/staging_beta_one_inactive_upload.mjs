// Single-attempt version creation transport. No CLI entrypoint or automatic execution.
// Only private caller with independently reviewed package and fresh authorization may invoke.
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {prepareStagingFullAppBody} from './staging_beta_fullapp_body.mjs';
import {sanitizedRefusalCodes} from './cloudflare-launch/stripe-test-worker/gate9_private_test_activation_version_upload.mjs';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const URL='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/workers/'+PIN.workerId+'/versions?deploy=false';
const need=(x,stage)=>{if(!x)throw Error('STAGING_UPLOAD_STOP_'+stage)};
const sameServing=s=>s?.accountId===ACCOUNT&&s.workerId===PIN.workerId&&s.deployment===PIN.deployment&&s.version===PIN.version&&s.percentage===100;
export async function uploadOneInactiveStagingVersion({folder,receiptPin,adminHash,predecessor,verifyPackage,readServing,verifyNoDuplicate,permissionGate,reserveOnce,tokenProvider,fetchImpl}){
 for(const f of [verifyPackage,readServing,verifyNoDuplicate,permissionGate,reserveOnce,tokenProvider,fetchImpl])need(typeof f==='function','PRIVATE_CALLER');
 need(await verifyPackage({folder,receiptPin})===true,'INDEPENDENT_PACKAGE');
 const serving=await readServing();
 need(sameServing(serving),'SERVING_DRIFT');
 const body=prepareStagingFullAppBody({folder,receiptPin,workerId:PIN.workerId,serving,predecessor,adminHash});
 const intent=Object.freeze({action:'create-one-inactive-staging-version',worker:PIN.worker,workerId:PIN.workerId,receiptPin,predecessor:PIN.version,activation:false,stripeMode:'disabled'});
 need(await permissionGate(intent)===true,'OWNER_APPROVAL');
 need(await verifyNoDuplicate(intent)===true,'DUPLICATE_OR_UNCERTAIN');
 const token=await tokenProvider();
 need(typeof token==='string'&&token.length>=20&&token.length<=4096&&!/\s/.test(token),'TOKEN');
 need(sameServing(await readServing()),'SERVING_DRIFT');
 const encoded=JSON.stringify(body);
 // Conservative local bound, not a claim of provider free-plan compressed size eligibility.
 need(Buffer.byteLength(encoded)<=32*1024*1024,'REQUEST_BUDGET');
 need(await reserveOnce(intent)===true,'ATTEMPT_CONSUMED');
 let response;
 try{response=await fetchImpl(URL,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:encoded,signal:AbortSignal.timeout(60000)})}catch{throw Error('STAGING_UPLOAD_STOP_NETWORK_UNCERTAIN_NO_RETRY')}
 if(!(response?.status>=200&&response.status<300)){
  const status=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:'UNKNOWN';
  const codes=await sanitizedRefusalCodes(response);
  throw Error('STAGING_UPLOAD_STOP_HTTP_NO_RETRY_'+status+'_CODES_'+(codes.join('_')||'UNKNOWN'));
 }
 let reply;
 try{reply=await response.json()}catch{throw Error('STAGING_UPLOAD_STOP_RESPONSE_UNCERTAIN_NO_RETRY')}
 need(reply?.success===true&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(reply.result?.id??'')&&reply.result.id!==PIN.version,'RESPONSE_UNCERTAIN_NO_RETRY');
 let after;
 try{after=await readServing()}catch{throw Error('STAGING_UPLOAD_STOP_POST_READ_UNCERTAIN_NO_RETRY')}
 need(sameServing(after),'POST_SERVING_DRIFT_NO_RETRY');
 return {newVersion:reply.result.id,previousVersion:PIN.version,servingUnchanged:true,activationPerformed:false,requiresIndependentVersionReadback:true};
}
