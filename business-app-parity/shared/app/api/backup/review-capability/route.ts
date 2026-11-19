/** Gate7 owner-only, READ-ONLY capability negotiation.
 * Exactly the same authenticated-owner and separate full-review flag as the
 * existing /api/backup/numbered-v2 export. No D1 read, passwords, photo bytes,
 * provider API or customer data. Default 404 in QA/STAGING/DR/NEW LIVE.
 */
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {completeRecordsOwnerReviewAllowed} from '../../../../lib/complete-records-owner-availability.mjs';

const safeHeaders={
 'cache-control':'private, no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'vary':'Cookie'
};
const unavailable=()=>Response.json({error:'Not found'},{status:404,headers:safeHeaders});

export async function GET(){
 try{
  const user=await getChatGPTUser();
  if(!completeRecordsOwnerReviewAllowed(user,env))return unavailable();
  return Response.json({
   format:'fire-complete-records-owner-review-capability',version:1,
   reviewEnabled:true,completeBackup:false,gate7Accepted:false
  },{status:200,headers:safeHeaders});
 }catch{return unavailable();}
}
