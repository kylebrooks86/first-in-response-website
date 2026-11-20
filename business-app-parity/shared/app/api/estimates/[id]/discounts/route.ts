import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {DISCOUNT_SNAPSHOT_PREFIX,verifiedSavedDiscounts} from '../../../../../lib/discount-input';
const privateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(typeof user?.email!=='string'||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return reply({error:'Unauthorized'},401);
 const {id}=await params;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))return reply({error:'Invalid estimate.'},400);
 try{
  const row=await env.DB.prepare('SELECT appreciation_discount AS appreciationDiscount,additional_discount_type AS additionalDiscountType,additional_discount_value AS additionalDiscountValue,id,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents FROM estimates WHERE id=?').bind(id).first<{appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;id:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number}>();
  if(!row)return reply({error:'Estimate not found.'},404);
  const saved=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DISCOUNT_SNAPSHOT_PREFIX+id).first<{body:string}>();
  const snapshot=verifiedSavedDiscounts(id,saved?.body??null,row);
  return reply({estimateId:id,totalCents:row.totalCents,bundleDiscountCents:snapshot?.bundleDiscountCents??0,snapshot});
 }catch{return reply({error:'Saved discount breakdown could not be verified. Refresh before editing; agreed totals are unchanged.'},409);}
}
