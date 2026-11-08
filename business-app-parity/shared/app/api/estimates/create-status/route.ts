import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {ESTIMATE_CREATE_PROOF_PREFIX,readEstimateCreateProof,validEstimateCreateRequestId} from '../../../../lib/estimate-create-idempotency';
import {DISCOUNT_SNAPSHOT_PREFIX} from '../../../../lib/discount-input';
import {ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX} from '../../../../lib/estimate-promotion-attribution';
const OWNER_EMAIL='kylebrooks8605@gmail.com';
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:'Unauthorized'},{status:401,headers:{'cache-control':'private, no-store'}});
 const requestId=new URL(request.url).searchParams.get('requestId');
 if(!validEstimateCreateRequestId(requestId))return Response.json({error:'A valid estimate creation request ID is required.'},{status:400,headers:{'cache-control':'private, no-store'}});
 try{
  const row=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.created_at AS createdAt,c.name AS customer FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.id=?`).bind(requestId).first<{id:string;customerId:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;createdAt:string;customer:string}>();
  if(!row)return Response.json({found:false,requestId},{headers:{'cache-control':'private, no-store'}});
  const raw=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_CREATE_PROOF_PREFIX+requestId).first<{body:string}>();
  let recognized=false;
  try{
   const proof=readEstimateCreateProof(raw?.body??null);
   if(proof&&proof.requestId===requestId&&proof.customerId===row.customerId&&row.status==='draft'&&
      proof.subtotalCents===Number(row.subtotalCents)&&proof.discountCents===Number(row.discountCents)&&
      proof.totalCents===Number(row.totalCents)&&proof.depositCents===Number(row.depositCents)&&
      proof.appreciationDiscount===Number(row.appreciationDiscount)&&
      proof.additionalDiscountType===row.additionalDiscountType&&
      proof.additionalDiscountValue===Number(row.additionalDiscountValue)){
     const [lines,promotion,bundle]=await Promise.all([
       env.DB.prepare('SELECT COUNT(*) AS lineCount, COALESCE(SUM(total_cents),0) AS lineTotal FROM estimate_items WHERE estimate_id=?').bind(requestId).first<{lineCount:number;lineTotal:number}>(),
       proof.promotionAttributionSaved?env.DB.prepare('SELECT key FROM message_templates WHERE key=?').bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+requestId).first():Promise.resolve({key:'not-required'}),
       proof.bundleDiscountCents>0?env.DB.prepare('SELECT key FROM message_templates WHERE key=?').bind(DISCOUNT_SNAPSHOT_PREFIX+requestId).first():Promise.resolve({key:'not-required'})
     ]);
     recognized=Number(lines?.lineCount)>0&&Number(lines?.lineTotal)===proof.subtotalCents&&Boolean(promotion)&&Boolean(bundle);
   }
  }catch{/* Any unverifiable quote, stale total, or missing audit requires manual review. */}
  return Response.json({found:true,recognized,requestId,estimate:{id:row.id,customerId:row.customerId,customer:row.customer,status:row.status,subtotalCents:Number(row.subtotalCents),totalCents:Number(row.totalCents),depositCents:Number(row.depositCents),createdAt:row.createdAt}},{headers:{'cache-control':'private, no-store'}});
 }catch{return Response.json({error:'Saved estimate request could not be checked. Keep the pending request marker and retry the read-only check.'},{status:503,headers:{'cache-control':'private, no-store'}});}
}
