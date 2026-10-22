import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX,readPromotionAttribution} from '../../../../../lib/estimate-promotion-attribution';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store, private'}});
/** Owner-only immutable rule-at-save audit; never reruns present-day promotion rules. */
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();
 if(user?.email.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 const {id}=await params;
 try{
  const estimate=await env.DB.prepare('SELECT id,subtotal_cents AS subtotalCents,total_cents AS totalCents,deposit_cents AS depositCents FROM estimates WHERE id=?').bind(id).first<{id:string;subtotalCents:number;totalCents:number;depositCents:number}>();
  if(!estimate)return json({error:'Estimate not found.'},404);
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+id).first<{body:string}>();
  const attribution=readPromotionAttribution(id,row?.body??null,estimate);
  return json({estimateId:id,attribution});
 }catch{return json({error:'Saved promotion history could not be verified. The agreed total is unchanged; review the source record.'},409);}
}
