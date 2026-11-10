/** Review-only candidate core records export.
 *
 * NOT a complete FIRE backup and NEVER a restore endpoint. Production stays
 * disabled absent a separate owner-reviewed deployment/config authorization.
 * Existing v1 /api/backup 409 numbered-identity lock remains unchanged.
 */
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {captureNumberedCoreV2ReadOnly} from '../../../../lib/numbered-v2-d1-snapshot.mjs';
import {serviceLocationsEnabled} from '../../../../lib/service-location';
import {customerPropertiesEnabled} from '../../../../lib/customer-properties';

const ownerEmail='kylebrooks8605@gmail.com';
const blockedHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const errorResponse=(status:number,message:string)=>Response.json({error:message,completeBackup:false},{status,headers:blockedHeaders});

export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==ownerEmail)
  return errorResponse(401,'Unauthorized');
 // This candidate is never enabled by ordinary numbering flags.
 const flags=env as typeof env & {FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE?:string};
 if(flags.FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE!=='owner-review-only')
  return errorResponse(404,'Numbered records review export is not enabled.');
 // Optional property/service-location records are NOT in the reviewed 23-table
 // v2 core contract. Refuse any incomplete export rather than omit them.
 if(customerPropertiesEnabled(flags)||serviceLocationsEnabled(flags))
  return errorResponse(409,'Additional property or service-location tables require a reviewed full recovery format.');
 try{
  const coreSnapshot=await captureNumberedCoreV2ReadOnly(env.DB);
  return Response.json({
   format:'fire-numbered-core-export-review',
   version:1,
   completeBackup:false,
   recoveryAuthorized:false,
   photoBytesIncluded:false,
   offDeviceCustodyVerified:false,
   warning:'CORE DATABASE RECORDS ONLY. This is NOT a complete FIRE app backup or restore point. Obtain independently verified R2 and device-local photo archives, provider database identity, all activated schemas and an owner-approved isolated restore before activation.',
   coreSnapshot
  },{
   status:200,
   headers:{
    ...blockedHeaders,
    'content-disposition':'attachment; filename="fire-numbered-v2-core-review-NOT-FULL-BACKUP.json"'
   }
  });
 }catch{
  return errorResponse(503,'Numbered records capture could not verify every table, saved number and ledger. No backup was issued; no data was changed.');
 }
}
