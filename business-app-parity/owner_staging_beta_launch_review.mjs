// Owner Windows launcher integration, intentionally offline until release approval.
// Synthetic hash only; no DPAPI access, HTTP, or reservation in this review mode.
import {reviewPinnedStagingVersion} from './cloudflare-launch/stripe-test-worker/review_staging_pinned_version_contract.mjs';
import {prepareStagingFullAppBody} from './staging_beta_fullapp_body.mjs';
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function reviewOwnerLaunch(folder,receiptPin){
 const review=reviewPinnedStagingVersion(folder,receiptPin);
 if(review.unresolvedAuxiliary.length)return {result:'STAGING_MODULE_CLASSIFICATION_REQUIRED',unresolvedAuxiliary:review.unresolvedAuxiliary,providerContacted:false,uploadAuthorized:false};
 const body=prepareStagingFullAppBody({folder,receiptPin,workerId:PIN.workerId,serving:{deployment:PIN.deployment,version:PIN.version,percentage:100},predecessor:{id:PIN.version,resources:{bindings:[{name:'DB',type:'d1',id:PIN.db},{name:'FIRE_SESSION_SECRET',type:'secret_text'},{name:'STRIPE_SECRET_KEY',type:'secret_text'}]}},adminHash:'0'.repeat(64)});
 return {result:'STAGING_FULLAPP_OFFLINE_BODY_READY',moduleCount:body.modules.length,requestBytes:Buffer.byteLength(JSON.stringify(body)),receiptPin,providerContacted:false,uploadAuthorized:false,privateHashRead:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==4)throw Error('ARGS');
  console.log(JSON.stringify(reviewOwnerLaunch(process.argv[2],process.argv[3]),null,2));
 }catch{console.error('STAGING_LAUNCH_REVIEW_STOP: no provider request or credential access');process.exitCode=1}
}
