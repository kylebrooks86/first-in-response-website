import {FIRE_SERVICES} from './fire-services';
import {type SavedPromotionCatalog,evaluateSavedPromotions,fireDate,validPromotionDate} from './saved-promotions';

export const ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX='fire:estimate-promotion-attribution:v1:';
export type PromotionEvidence={revision:string|null;checkedOn:string;ruleIds:string[];serviceIds:string[]};
export type PromotionAttribution={
 format:'fire-estimate-promotions-v1';estimateId:string;catalogRevision:string|null;checkedOn:string;
 selectedServices:string[];rules:{id:string;name:string;type:'percent'|'dollar';valueCents:number}[];
 subtotalCents:number;percentBasisPoints:number;flatDiscountCents:number;
 totalCents:number;depositCents:number;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const exactKeys=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
const known=new Map(FIRE_SERVICES.map(s=>[s.id,s.name]));
const safe=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
export function validPromotionEvidence(x:unknown):x is PromotionEvidence{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const p=x as Record<string,unknown>;
 if(!exactKeys(p,['revision','checkedOn','ruleIds','serviceIds'])||
  !(p.revision===null||typeof p.revision==='string'&&uuid.test(p.revision))||
  !validPromotionDate(p.checkedOn)||p.checkedOn===null||
  !Array.isArray(p.ruleIds)||p.ruleIds.length>40||
  !p.ruleIds.every(id=>typeof id==='string'&&uuid.test(id))||
  new Set(p.ruleIds).size!==p.ruleIds.length||
  !Array.isArray(p.serviceIds)||p.serviceIds.length>known.size||
  !p.serviceIds.every(id=>typeof id==='string'&&known.has(id))||
  new Set(p.serviceIds).size!==p.serviceIds.length)return false;
 return true;
}
export function buildPromotionAttribution(input:{
 estimateId:string;rawEvidence:unknown;catalog:SavedPromotionCatalog;now:Date;
 items:{name:string}[];subtotalCents:number;appreciationDiscount:boolean;
 additionalDiscountType:'percent'|'dollar';additionalDiscountValue:number;bundleDiscountCents:number;
 totalCents:number;depositCents:number;
}):PromotionAttribution{
 const {estimateId,rawEvidence,catalog,now,items,subtotalCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,bundleDiscountCents,totalCents,depositCents}=input;
 if(!validPromotionEvidence(rawEvidence))throw Error('Saved promotion attribution must be verified with the current estimate.');
 const evidence=rawEvidence;
 if(evidence.revision!==catalog.revision||evidence.checkedOn!==fireDate(now))
  throw Error('Saved promotions changed or the local promotion date rolled over. Refresh before saving.');
 if(!evidence.serviceIds.every(id=>items.some(item=>item.name===known.get(id))))
  throw Error('Service names changed since the promotion check. Refresh selected services or apply discounts manually.');
 const result=evaluateSavedPromotions(catalog,{serviceIds:evidence.serviceIds,subtotalCents,appreciationDiscount,estimateOn:evidence.checkedOn});
 if(result.blocked)throw Error(result.blocked);
 if(evidence.ruleIds.join(',')!==result.offered.map(p=>p.id).join(','))
  throw Error('Promotion eligibility changed. Refresh current rules before saving.');
 if(additionalDiscountType!=='percent'||additionalDiscountValue!==result.percentBasisPoints||bundleDiscountCents!==result.dollarCents||
   totalCents!==result.totalCents||depositCents!==result.depositCents)
  throw Error('The quote discounts no longer match the verified promotion rules. Review the quote before saving.');
 return {format:'fire-estimate-promotions-v1',estimateId,catalogRevision:evidence.revision,checkedOn:evidence.checkedOn,
  selectedServices:[...evidence.serviceIds],rules:result.offered.map(p=>({id:p.id,name:p.name,type:p.type,valueCents:p.valueCents})),
  subtotalCents,percentBasisPoints:result.percentBasisPoints,flatDiscountCents:result.dollarCents,
  totalCents,depositCents};
}
/** Read the original evidence without re-evaluating current rules, which may have changed. */
export function readPromotionAttribution(estimateId:string,raw:string|null,financials:{subtotalCents:number;totalCents:number;depositCents:number}):PromotionAttribution|null{
 if(raw===null)return null;
 if(raw.length>16000)throw Error('Saved promotion history is too large to verify.');
 const x=JSON.parse(raw) as unknown;
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Invalid saved promotion evidence.');
 const p=x as Record<string,unknown>;
 if(!exactKeys(p,['format','estimateId','catalogRevision','checkedOn','selectedServices','rules','subtotalCents','percentBasisPoints','flatDiscountCents','totalCents','depositCents'])||
  p.format!=='fire-estimate-promotions-v1'||p.estimateId!==estimateId||
  !(p.catalogRevision===null||typeof p.catalogRevision==='string'&&uuid.test(p.catalogRevision))||
  !validPromotionDate(p.checkedOn)||p.checkedOn===null||
  !Array.isArray(p.selectedServices)||new Set(p.selectedServices).size!==p.selectedServices.length||
  !p.selectedServices.every(id=>typeof id==='string'&&known.has(id))||
  !Array.isArray(p.rules)||p.rules.length>40||
  !p.rules.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&exactKeys(r,['id','name','type','valueCents'])&&
    typeof r.id==='string'&&uuid.test(r.id)&&typeof r.name==='string'&&r.name.length>0&&r.name.length<=80&&
    ['percent','dollar'].includes(r.type)&&safe(r.valueCents))||
  new Set(p.rules.map(r=>r.id)).size!==p.rules.length||
  !safe(p.subtotalCents)||!safe(p.percentBasisPoints)||p.percentBasisPoints>5000||
  !safe(p.flatDiscountCents)||!safe(p.totalCents)||!safe(p.depositCents)||
  p.subtotalCents!==financials.subtotalCents||p.totalCents!==financials.totalCents||p.depositCents!==financials.depositCents||
  p.rules.filter(r=>r.type==='percent').reduce((sum,r)=>sum+r.valueCents,0)!==p.percentBasisPoints||
  p.rules.filter(r=>r.type==='dollar').reduce((sum,r)=>sum+r.valueCents,0)!==p.flatDiscountCents)
  throw Error('Saved promotion evidence does not match the agreed quote.');
 return p as PromotionAttribution;
}
