import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX,readPromotionAttribution} from '../../../../../lib/estimate-promotion-attribution';
import {SAVED_PROMOTIONS_KEY,decodeSavedPromotions,evaluateSavedPromotions,validOwnerConfirmedBookingDate,fireDate} from '../../../../../lib/saved-promotions';
import {FIRE_SERVICES} from '../../../../../lib/fire-services';

const OWNER='kylebrooks8605@gmail.com';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
type FinancialRow={
 id:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;
 appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;
 acceptedAt:string|null;signedAt:string|null;paidCents:number;invoiceCount:number;
};
type Item={name:string};
/** A read-only, owner-reviewed what-if proposal. This route never changes saved prices, agreements, bookings, or payment records. */
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();
 if(user?.email.toLowerCase()!==OWNER)return json({error:'Unauthorized'},401);
 const {id}=await params;
 let raw:unknown;
 try{raw=await request.json();}catch{return json({error:'Provide one valid owner-confirmed booking date.'},400);}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
   Object.keys(raw).join(',')!=='bookingConfirmedOn')return json({error:'Provide only the owner-confirmed booking date.'},400);
 const bookingDate=(raw as Record<string,unknown>).bookingConfirmedOn;
 const now=new Date();
 if(!validOwnerConfirmedBookingDate(bookingDate,now))return json({error:'The booking date must be a valid Tulsa-local date no later than today.'},400);
 try{
  const estimate=await env.DB.prepare(
   \`SELECT e.id,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,
   e.total_cents AS totalCents,e.deposit_cents AS depositCents,
   e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,
   e.additional_discount_value AS additionalDiscountValue,
   e.accepted_at AS acceptedAt,e.signed_at AS signedAt,
   COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
   (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id) AS invoiceCount
   FROM estimates e WHERE e.id=?\`
  ).bind(id).first<FinancialRow>();
  if(!estimate)return json({error:'Estimate not found.'},404);
  const meta=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+id).first<{body:string}>();
  if(!meta)return json({error:'This estimate has no verified saved-promotion snapshot. Review its discounts manually; no adjustment was made.'},409);
  const original=readPromotionAttribution(id,meta.body,estimate);
  if(!original)return json({error:'Original saved promotion terms require owner review.'},409);
  if(original.bookingConfirmedOn)return json({error:'This estimate already records a booking-confirmed promotion check. Do not reapply booking savings.'},409);
  const catalogRow=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(SAVED_PROMOTIONS_KEY).first<{body:string}>();
  const catalog=decodeSavedPromotions(catalogRow);
  if(original.catalogRevision!==catalog.revision)return json({error:'Promotion settings changed since the original quote. Review the customer agreement and current offers manually.'},409);
  const items=await env.DB.prepare('SELECT name FROM estimate_items WHERE estimate_id=?').bind(id).all<Item>();
  const known=new Map(FIRE_SERVICES.map(service=>[service.id,service.name]));
  if(original.selectedServices.some(serviceId=>!items.results.some(item=>item.name===known.get(serviceId))))
   return json({error:'Original qualifying services no longer match the estimate. Review manually.'},409);
  const quote={serviceIds:original.selectedServices,subtotalCents:estimate.subtotalCents,
   appreciationDiscount:Boolean(estimate.appreciationDiscount),estimateOn:original.checkedOn};
  const baseline=evaluateSavedPromotions(catalog,quote);
  if(baseline.blocked||baseline.totalCents!==original.totalCents||baseline.depositCents!==original.depositCents||
    baseline.percentBasisPoints!==original.percentBasisPoints||baseline.dollarCents!==original.flatDiscountCents||
    JSON.stringify(baseline.offered.map(rule=>({id:rule.id,name:rule.name,type:rule.type,valueCents:rule.valueCents})))!==JSON.stringify(original.rules))
   return json({error:'Original offers no longer reproduce the saved quote. Do not calculate an automatic adjustment.'},409);
  const proposed=evaluateSavedPromotions(catalog,{...quote,bookedOn:bookingDate});
  if(proposed.blocked||proposed.totalCents===null||proposed.depositCents===null)return json({error:proposed.blocked??'Proposed booking savings could not be safely calculated.'},409);
  const previouslyOffered=new Set(baseline.offered.map(rule=>rule.id));
  if(baseline.offered.some(rule=>!proposed.offered.some(next=>next.id===rule.id))||
     proposed.totalCents>original.totalCents)
   return json({error:'Booking adjustment would remove original savings. Review manually.'},409);
  const newlyEligible=proposed.offered.filter(rule=>!previouslyOffered.has(rule.id)).map(rule=>({
   id:rule.id,name:rule.name,type:rule.type,valueCents:rule.valueCents}));
  return json({
    estimateId:id,bookingConfirmedOn:bookingDate,checkedOn:fireDate(now),
    originalCatalogRevision:catalog.revision,originalCheckedOn:original.checkedOn,
    status:estimate.status,customerAlreadyAccepted:Boolean(estimate.signedAt||estimate.acceptedAt),
    hasFinancialActivity:estimate.invoiceCount>0||estimate.paidCents>0,
    current:{subtotalCents:original.subtotalCents,totalCents:original.totalCents,depositCents:original.depositCents},
    proposed:{totalCents:proposed.totalCents,depositCents:proposed.depositCents,
     percentBasisPoints:proposed.percentBasisPoints,flatDiscountCents:proposed.dollarCents},
    possibleSavingsCents:Math.max(0,original.totalCents-proposed.totalCents),
    newlyEligible,
    requiresReviewedAmendment:true,
    changesSavedEstimate:false,
    warning:'Preview only. No quote, contract, invoice, deposit, booking record, payment or customer approval was changed. A revised agreement requires explicit review and any necessary customer approval.'
  });
 }catch{
  return json({error:'The original terms or available promotion history could not be verified. No quote was changed.'},409);
 }
}
