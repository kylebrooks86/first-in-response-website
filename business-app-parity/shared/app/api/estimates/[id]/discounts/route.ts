import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {DISCOUNT_SNAPSHOT_PREFIX,verifiedSavedDiscounts} from '../../../../../lib/discount-input';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(user?.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401});
 const {id}=await params;
 try{
  const row=await env.DB.prepare('SELECT appreciation_discount AS appreciationDiscount,additional_discount_type AS additionalDiscountType,additional_discount_value AS additionalDiscountValue,id,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents FROM estimates WHERE id=?').bind(id).first<{appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;id:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number}>();
  if(!row)return Response.json({error:'Estimate not found.'},{status:404});
  const saved=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DISCOUNT_SNAPSHOT_PREFIX+id).first<{body:string}>();
  const snapshot=verifiedSavedDiscounts(id,saved?.body??null,row);
  return Response.json({estimateId:id,totalCents:row.totalCents,bundleDiscountCents:snapshot?.bundleDiscountCents??0,snapshot},{headers:{'cache-control':'no-store, private'}});
 }catch{return Response.json({error:'Saved discount breakdown could not be verified. Refresh before editing; agreed totals are unchanged.'},{status:409,headers:{'cache-control':'no-store'}});}
}
