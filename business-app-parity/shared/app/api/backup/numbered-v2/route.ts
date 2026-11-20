/** Review-only candidate core records export.
 *
 * Default-off complete review can include all reviewed D1 record tables, but
 * remains UNENCRYPTED and cannot include owner-device photo bytes.
 * NOT a complete FIRE backup and NEVER a restore endpoint. Production stays
 * disabled absent a separate owner-reviewed deployment/config authorization.
 * Existing v1 /api/backup 409 numbered-identity lock remains unchanged.
 */
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {captureNumberedCoreV2ReadOnly} from '../../../../lib/numbered-v2-d1-snapshot.mjs';
import {captureCompleteReviewedD1RecordsReadOnly} from '../../../../lib/complete-d1-records-review.mjs';
import {serviceLocationsEnabled} from '../../../../lib/service-location';
import {customerPropertiesEnabled} from '../../../../lib/customer-properties';

const ownerEmail='kylebrooks8605@gmail.com';
const blockedHeaders={'cache-control':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const errorResponse=(status:number,message:string)=>Response.json({error:message,completeBackup:false},{status,headers:blockedHeaders});

export async function GET(){
 // Malformed, unavailable or throwing session identities must be denied before
 // any review flags or private D1 records are examined.
 try{
  const user=await getChatGPTUser();
  if(typeof user?.email!=='string'||user.email.toLowerCase()!==ownerEmail)
   return errorResponse(401,'Unauthorized');
 }catch{
  return errorResponse(401,'Unauthorized');
 }
 // This candidate is never enabled by ordinary numbering flags.
 const flags=env as typeof env & {FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE?:string;FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE?:string};
 const full=flags.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE==='owner-review-only';
 if(!full&&flags.FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE!=='owner-review-only')
  return errorResponse(404,'Numbered records review export is not enabled.');
 // A separate exact opt-in permits COMPLETE SOURCE BUSINESS-RECORD REVIEW:
 // it is still unencrypted, not a physical complete photo/backup/restore.
 // Unlike the older 23-table core-only route, this reads all reviewed
 // supplemental tables, source migration journal and exact schema identity.
 // One D1.batch guarantees a single consistent source snapshot.
 if(full){
  try{
   const review=await captureCompleteReviewedD1RecordsReadOnly(env.DB,{
    customerProperties:customerPropertiesEnabled(flags),
    serviceLocations:serviceLocationsEnabled(flags)
   });
   return Response.json({
    format:'fire-complete-d1-records-owner-review',version:1,
    completeBackup:false,recoveryAuthorized:false,
    offDeviceCustodyVerified:false,photoBytesIncluded:false,
    warning:'ALL REVIEWED DATABASE RECORDS, NOT A PROTECTED OR COMPLETE BACKUP. The downloaded JSON is unencrypted. It contains private customer/financial records, never photo bytes. Do not share. A separate encrypted off-device records+photo archive and physical isolated restore are mandatory before Gate 7 acceptance. No R2 or paid Cloudflare product is authorized.',
    reviewedRecords:review
   },{status:200,headers:{...blockedHeaders,
     'content-disposition':'attachment; filename="fire-complete-records-review-NOT-PROTECTED-BACKUP.json"'}});
  }catch{
   return errorResponse(503,'Complete source record inventory or safe transactional read could not be verified. No backup was issued; no data was changed.');
  }
 }
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
   warning:'CORE DATABASE RECORDS ONLY. This is NOT a complete FIRE app backup or restore point. Pair this review file with an independently saved encrypted owner-device .firephotos archive. Verify all active schemas, provider database identity, off-device custody and an owner-approved isolated restore before activation. No R2 subscription or paid Cloudflare service is authorized.',
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
