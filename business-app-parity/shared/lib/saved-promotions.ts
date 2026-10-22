import {FIRE_SERVICES} from './fire-services';

export const SAVED_PROMOTIONS_KEY = 'fire:saved-promotions:v1';
export const MAX_SAVED_PROMOTIONS = 40;
export type SavedPromotion = {
  id:string; name:string; type:'percent'|'dollar'; valueCents:number;
  enabled:boolean; autoApply:boolean; startOn:string|null; endOn:string|null;
  dateBasis:'estimate-created'|'booking-confirmed'; requiredServiceIds:string[];
};
export type SavedPromotionCatalog = {revision:string|null; promotions:SavedPromotion[]};
const ids=new Set(FIRE_SERVICES.map(service=>service.id));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeCents=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
const exactKeys=(object:Record<string,unknown>,keys:string[])=>Object.keys(object).sort().join(',')===keys.slice().sort().join(',');
export function validPromotionDate(input:unknown):input is string|null {
  if(input===null)return true;
  if(typeof input!=='string'||!/^20[2-9]\d-\d\d-\d\d$/.test(input))return false;
  const date=new Date(input+'T00:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===input;
}
export function validPromotion(input:unknown):input is SavedPromotion {
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const p=input as Record<string,unknown>;
  if(!exactKeys(p,['id','name','type','valueCents','enabled','autoApply','startOn','endOn','dateBasis','requiredServiceIds']))return false;
  if(typeof p.id!=='string'||!uuid.test(p.id)||typeof p.name!=='string'||p.name.trim()!==p.name||p.name.length<1||p.name.length>80)return false;
  if(p.type!=='percent'&&p.type!=='dollar'||!safeCents(p.valueCents)||p.valueCents===0)return false;
  if(p.type==='percent'&&p.valueCents>5000||p.type==='dollar'&&p.valueCents>1000000000)return false;
  if(typeof p.enabled!=='boolean'||typeof p.autoApply!=='boolean')return false;
  if(!validPromotionDate(p.startOn)||!validPromotionDate(p.endOn)||(p.startOn&&p.endOn&&p.startOn>p.endOn))return false;
  if(p.dateBasis!=='estimate-created'&&p.dateBasis!=='booking-confirmed')return false;
  return Array.isArray(p.requiredServiceIds)&&p.requiredServiceIds.length<=ids.size&&
    new Set(p.requiredServiceIds).size===p.requiredServiceIds.length&&p.requiredServiceIds.every(id=>typeof id==='string'&&ids.has(id));
}
export function validPromotions(input:unknown):input is SavedPromotion[] {
  return Array.isArray(input)&&input.length<=MAX_SAVED_PROMOTIONS&&input.every(validPromotion)&&new Set(input.map(p=>p.id)).size===input.length;
}
export function validSavedPromotionCatalog(input:unknown):input is SavedPromotionCatalog {
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const value=input as Record<string,unknown>;
  return exactKeys(value,['revision','promotions'])&&
    (value.revision===null||typeof value.revision==='string'&&uuid.test(value.revision))&&validPromotions(value.promotions);
}
export function decodeSavedPromotions(row:{body:string}|null):SavedPromotionCatalog {
  if(!row)return{revision:null,promotions:[]};
  const parsed=JSON.parse(row.body) as unknown;
  if(!validSavedPromotionCatalog(parsed)||parsed.revision===null)throw Error('Stored promotions are invalid.');
  return parsed;
}
export function fireDate(date:Date):string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=(name:string)=>parts.find(p=>p.type===name)?.value;
  return part('year')+'-'+part('month')+'-'+part('day');
}
export type PromotionQuote = {
  serviceIds:string[]; estimateOn:string; bookedOn?:string|null;
  subtotalCents:number; appreciationDiscount?:boolean;
};
export function evaluateSavedPromotions(catalog:SavedPromotionCatalog,quote:PromotionQuote) {
  if(!validSavedPromotionCatalog(catalog)||!validPromotionDate(quote.estimateOn)||!quote.estimateOn||
    quote.bookedOn!==undefined&&!validPromotionDate(quote.bookedOn)||
    !Array.isArray(quote.serviceIds)||!safeCents(quote.subtotalCents)||
    !quote.serviceIds.every(id=>typeof id==='string'))throw Error('Invalid promotion evaluation inputs.');
  const offered:SavedPromotion[]=[];const pendingBooking:SavedPromotion[]=[];
  for(const rule of catalog.promotions){
    if(!rule.enabled||!rule.autoApply||!rule.requiredServiceIds.every(id=>quote.serviceIds.includes(id)))continue;
    if(rule.dateBasis==='booking-confirmed'&&!quote.bookedOn){
      if(!rule.endOn||quote.estimateOn<=rule.endOn)pendingBooking.push(rule);
      continue;
    }
    const checkedOn=rule.dateBasis==='booking-confirmed'?quote.bookedOn!:quote.estimateOn;
    if((rule.startOn&&checkedOn<rule.startOn)||(rule.endOn&&checkedOn>rule.endOn))continue;
    offered.push(rule);
  }
  const percentBasisPoints=offered.filter(p=>p.type==='percent').reduce((sum,p)=>sum+p.valueCents,0);
  const dollarCents=offered.filter(p=>p.type==='dollar').reduce((sum,p)=>sum+p.valueCents,0);
  const cap=(quote.appreciationDiscount?45:50)*100;
  const blocked=percentBasisPoints>cap?'Combined percentage promotions exceed FIRE discount limits. Review before applying.':dollarCents>quote.subtotalCents?'Combined flat promotions exceed the service subtotal. Review before applying.':null;
  const appreciationCents=quote.appreciationDiscount?Math.round(quote.subtotalCents*.05):0;
  const percentageCents=Math.round(quote.subtotalCents*percentBasisPoints/10000);
  const requestedCents=Math.min(quote.subtotalCents,appreciationCents+percentageCents+dollarCents);
  const totalCents=quote.serviceIds.length||quote.subtotalCents>0?Math.max(15000,quote.subtotalCents-requestedCents):0;
  return{offered,pendingBooking,percentBasisPoints,dollarCents,blocked,
    requestedDiscountCents:blocked?null:requestedCents,
    appliedDiscountCents:blocked?null:Math.max(0,quote.subtotalCents-totalCents),
    totalCents:blocked?null:totalCents,
    depositCents:blocked?null:Math.round(totalCents/2)};
}
