/**
 * Owner-private, opt-in legacy Sites records review — Gate 7.
 * NOT a full backup, NOT a source/DB identity attestation, NOT a restore API.
 * Only an explicitly enabled LIVE adapter can read the attached database.
 * The existing /api/backup and numbered-v2 protections remain unchanged.
 */
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {LOCAL_CUSTOMER_DEPLOYMENT} from '../../../local-customer-deployment';
import {captureLegacySitesReviewReadOnly} from '../../../../lib/legacy-sites-readonly-export.mjs';

const OWNER_EMAIL='kylebrooks8605@gmail.com';
const PRIVATE_HEADERS={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const stopped=(status:number,message:string)=>Response.json(
 {error:message,completeBackup:false,recoveryAuthorized:false},
 {status,headers:PRIVATE_HEADERS}
);

export async function GET(){
 const user=await getChatGPTUser();
 if(!user||typeof user.email!=='string'||user.email.toLowerCase()!==OWNER_EMAIL)
   return stopped(401,'Unauthorized');
 const runtime=env as typeof env & {FIRE_LEGACY_SITES_REVIEW_EXPORT?:string};
 if(String(LOCAL_CUSTOMER_DEPLOYMENT)!=='live'||
    runtime.FIRE_LEGACY_SITES_REVIEW_EXPORT!=='owner-review-only')
   return stopped(404,'Legacy LIVE records review is not enabled.');
 try{
   const snapshot=await captureLegacySitesReviewReadOnly(runtime.DB);
   return Response.json(snapshot,{headers:{
     ...PRIVATE_HEADERS,
     'content-disposition':'attachment; filename="fire-sites-legacy-records-review-NOT-FULL-BACKUP.json"'
   }});
 }catch{
   // Never expose database table names, record values, SQL, source paths or
   // diagnostics in a client error, provider log, GitHub or conversation.
   return stopped(503,'The legacy records review could not safely capture every existing table twice. No export was issued and no records were changed.');
 }
}
