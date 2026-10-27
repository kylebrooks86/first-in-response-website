/** Owner-defined reusable service combinations. No customer, quantities, rates,
 * discounts, private descriptions, addresses or payment details are stored.
 */
import {FIRE_SERVICES,type FireService} from './fire-services';
export const QUOTE_PACKAGES_KEY='fire:quote-packages:v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type QuotePackage={id:string;name:string;serviceIds:string[]};
export type QuotePackageCatalog={revision:string|null;packages:QuotePackage[]};
export type QuotePackageDraftLine={serviceId:string;name:string;description:string;unit:string;quantity:number;unitRateCents:number};
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const names=new Set(FIRE_SERVICES.map(s=>s.id));
export function validQuotePackages(value:unknown):value is QuotePackage[]{
 if(!Array.isArray(value)||value.length>20)return false;
 const seenIds=new Set<string>(),seenNames=new Set<string>();
 return value.every((candidate:unknown)=>{
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return false;
  const p=candidate as Record<string,unknown>;
  if(!exact(p,['id','name','serviceIds'])||typeof p.id!=='string'||!uuid.test(p.id)||
   typeof p.name!=='string'||p.name.length<2||p.name.length>60||p.name!==p.name.trim()||
   /[\x00-\x1f\x7f<>]/.test(p.name)||seenIds.has(p.id)||seenNames.has(p.name.toLowerCase())||
   !Array.isArray(p.serviceIds)||!p.serviceIds.length||p.serviceIds.length>12||new Set(p.serviceIds).size!==p.serviceIds.length||
   !p.serviceIds.every(id=>typeof id==='string'&&(names.has(id)||/^catalog-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))))return false;
  seenIds.add(p.id);seenNames.add(p.name.toLowerCase());return true;
 });
}
export function validQuotePackageCatalog(value:unknown):value is QuotePackageCatalog{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return exact(v,['revision','packages'])&&(v.revision===null||typeof v.revision==='string'&&uuid.test(v.revision))&&validQuotePackages(v.packages);
}
export function decodeQuotePackages(row:{body:string}|null):QuotePackageCatalog{
 if(!row)return {revision:null,packages:[]};
 if(row.body.length>35000)throw Error('Saved package catalog is unusually large.');
 const data:unknown=JSON.parse(row.body);
 if(!validQuotePackageCatalog(data))throw Error('Saved quote packages need review.');
 return data;
}
export const STARTER_QUOTE_PACKAGES=[
 {name:'House + gutters',serviceIds:['house-wash','gutters']},
 {name:'House + concrete',serviceIds:['house-wash','concrete']},
 {name:'House + gutters + concrete',serviceIds:['house-wash','gutters','concrete']},
 {name:'House + gutters + windows',serviceIds:['house-wash','gutters','windows']},
] as const;
/** Source only from CURRENT owner-service pricing: prior package never dictates rates.
 * Every new line starts at quantity zero, including normally flat-price jobs.
 */
export function packageDraftLines(serviceIds:readonly string[],available:readonly FireService[]):QuotePackageDraftLine[]|null{
 if(!serviceIds.length||serviceIds.length>12||new Set(serviceIds).size!==serviceIds.length)return null;
 const result:QuotePackageDraftLine[]=[];
 for(const id of serviceIds){
  const known=available.find(s=>s.id===id);
  if(!known||!names.has(id)||typeof known.name!=='string'||!known.name.trim()||
   typeof known.description!=='string'||typeof known.unit!=='string'||!known.unit.trim()||
   typeof known.rate!=='number'||!Number.isSafeInteger(known.rate)||known.rate<0)return null;
  result.push({serviceId:id,name:known.name,description:known.description,unit:known.unit,quantity:0,unitRateCents:known.rate});
 }
 return result;
}
