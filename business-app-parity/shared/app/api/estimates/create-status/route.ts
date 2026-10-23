import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {ESTIMATE_CREATE_PROOF_PREFIX,readEstimateCreateProof,validEstimateCreateRequestId} from '../../../../lib/estimate-create-idempotency';
const OWNER_EMAIL='kylebrooks8605@gmail.com';
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:'Unauthorized'},{status:401,headers:{'cache-control':'private, no-store'}});
 const requestId=new URL(request.url).searchParams.get('requestId');
 if(!validEstimateCreateRequestId(requestId))return Response.json({error:'A valid estimate creation request ID is required.'},{status:400,headers:{'cache-control':'private, no-store'}});
 try{
  const row=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.created_at AS createdAt,c.name AS customer FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.id=?`).bind(requestId).first<{id:string;customerId:string;status:string;subtotalCents:number;totalCents:number;depositCents:number;createdAt:string;customer:string}>();
  if(!row)return Response.json({found:false,requestId},{headers:{'cache-control':'private, no-store'}});
  const raw=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_CREATE_PROOF_PREFIX+requestId).first<{body:string}>();
  let recognized=false;
  try{const proof=readEstimateCreateProof(raw?.body??null);recognized=Boolean(proof&&proof.requestId===requestId&&proof.customerId===row.customerId);}catch{/* Existing ID without trustworthy proof needs manual review. */}
  return Response.json({found:true,recognized,requestId,estimate:{id:row.id,customerId:row.customerId,customer:row.customer,status:row.status,subtotalCents:Number(row.subtotalCents),totalCents:Number(row.totalCents),depositCents:Number(row.depositCents),createdAt:row.createdAt}},{headers:{'cache-control':'private, no-store'}});
 }catch{return Response.json({error:'Saved estimate request could not be checked. Keep the pending request marker and retry the read-only check.'},{status:503,headers:{'cache-control':'private, no-store'}});}
}
