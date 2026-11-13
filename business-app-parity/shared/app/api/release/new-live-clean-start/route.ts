/** Owner-only, read-only pre-activation evidence for the independent NEW LIVE
 * D1 bound to THIS Worker. No remote Cloudflare API, mutations or migration.
 * This is not provider-attested UUID, migration provenance or release approval.
 */
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {inspectNewLiveFirstJobCleanStart} from '../../../../lib/new-live-first-job-preflight.mjs';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const fail=(status:number,message:string)=>Response.json({
 error:message,releaseApproved:false,providerIdentityVerified:false
},{status,headers});
export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')
  return fail(401,'Unauthorized');
 const flags=env as typeof env & {
  FIRE_ENV?:string;FIRE_NEW_LIVE_CLEAN_START?:string;
  FIRE_JOB_NUMBERS_CANDIDATE?:string;FIRE_CUSTOMER_NUMBERS_CANDIDATE?:string
 };
 if(flags.FIRE_ENV!=='new-live-prelaunch'||flags.FIRE_NEW_LIVE_CLEAN_START!=='required')
  return fail(404,'Independent NEW LIVE pre-activation inspection is not enabled.');
 try{
  const proof=await inspectNewLiveFirstJobCleanStart(env.DB,flags);
  return Response.json({...proof,readOnly:true,releaseApproved:false,
   providerIdentityVerified:false,orderedMigrationsVerified:false},{
   status:200,headers
  });
 }catch{
  return fail(409,'NEW LIVE clean-start inspection could not verify the bound database. No data was changed.');
 }
}
