import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {FIRE_SERVICES} from '../../../../lib/fire-services';
import {SAVED_PROMOTIONS_KEY,decodeSavedPromotions,evaluateSavedPromotions,fireDate,validOwnerConfirmedBookingDate} from '../../../../lib/saved-promotions';

const OWNER='kylebrooks8605@gmail.com';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store, private'}});
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(user?.email.toLowerCase()!==OWNER)return json({error:'Unauthorized'},401);
 let input:unknown;
 try{input=await request.json();}catch{return json({error:'Invalid promotion preview request.'},400);}
 if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid promotion preview request.'},400);
 const body=input as Record<string,unknown>;
 const known=new Set(FIRE_SERVICES.map(service=>service.id));
 if(Object.keys(body).sort().join(',')!==(Object.prototype.hasOwnProperty.call(body,'bookingConfirmedOn')?'appreciationDiscount,bookingConfirmedOn,serviceIds,subtotalCents':'appreciationDiscount,serviceIds,subtotalCents')||
    (Object.prototype.hasOwnProperty.call(body,'bookingConfirmedOn')&&!validOwnerConfirmedBookingDate(body.bookingConfirmedOn,new Date()))||
    !Array.isArray(body.serviceIds)||body.serviceIds.length>FIRE_SERVICES.length||
    new Set(body.serviceIds).size!==body.serviceIds.length||
    !body.serviceIds.every(value=>typeof value==='string'&&known.has(value))||
    typeof body.subtotalCents!=='number'||!Number.isSafeInteger(body.subtotalCents)||body.subtotalCents<0||
    typeof body.appreciationDiscount!=='boolean')return json({error:'Review selected services and pricing before checking promotions.'},400);
 try{
  const stored=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(SAVED_PROMOTIONS_KEY).first<{body:string}>();
  const catalog=decodeSavedPromotions(stored);
  const checkedOn=fireDate(new Date());
  const result=evaluateSavedPromotions(catalog,{serviceIds:body.serviceIds,subtotalCents:body.subtotalCents,appreciationDiscount:body.appreciationDiscount,estimateOn:checkedOn,bookedOn:typeof body.bookingConfirmedOn==='string'?body.bookingConfirmedOn:undefined});
  return json({revision:catalog.revision,checkedOn,bookingConfirmedOn:typeof body.bookingConfirmedOn==='string'?body.bookingConfirmedOn:null,
   eligible:result.offered.map(p=>({id:p.id,name:p.name,type:p.type,valueCents:p.valueCents})),
   pendingBooking:result.pendingBooking.map(p=>({id:p.id,name:p.name,type:p.type,valueCents:p.valueCents,startOn:p.startOn,endOn:p.endOn})),
   percentBasisPoints:result.percentBasisPoints,dollarCents:result.dollarCents,
   blocked:result.blocked,previewTotalCents:result.totalCents,previewDepositCents:result.depositCents});
 }catch{return json({error:'Saved promotions could not be verified. Refresh them before quoting or explicitly continue without automatic promotions.'},503);}
}
