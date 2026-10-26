import { FIRE_SERVICES, type FireService } from './fire-services';
export const SERVICE_RATE_PREFIX='fire:service-rate:v1:';
export const CATALOG_UNITS=['sq ft','linear ft','quantity','each','job','line','window','screen','bin'] as const;
export type ServiceDetails={name:string;description:string;unit:string;category:'base'|'supplemental'|'other';active:boolean};
export type ServiceRate={id:string;rateCents:number;revision:string|null;details?:ServiceDetails};
export function validRate(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
export function priceCents(value:string):number|null{
  if(!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value))return null;
  const [whole,fraction='']=value.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return validRate(amount)?amount:null;
}
export function validDetails(value:unknown):value is ServiceDetails{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as ServiceDetails;
 return Object.keys(v).sort().join(',')==='active,category,description,name,unit'&&typeof v.name==='string'&&v.name.trim()===v.name&&v.name.length>0&&v.name.length<=160&&typeof v.description==='string'&&v.description.length<=5000&&CATALOG_UNITS.includes(v.unit as typeof CATALOG_UNITS[number])&&['base','supplemental','other'].includes(v.category)&&typeof v.active==='boolean';
}
export function customServiceId(id:unknown):id is string{return typeof id==='string'&&/^catalog-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);}
export function validServiceRates(value:unknown):value is ServiceRate[]{
 return Array.isArray(value)&&value.length>=FIRE_SERVICES.length&&value.length<=FIRE_SERVICES.length+500&&new Set(value.map(r=>r?.id)).size===value.length&&FIRE_SERVICES.every(s=>value.some(r=>r?.id===s.id))&&value.every(r=>r&&typeof r.id==='string'&&(FIRE_SERVICES.some(s=>s.id===r.id)||customServiceId(r.id))&&validRate(r.rateCents)&&(r.revision===null||typeof r.revision==='string'&&/^[0-9a-f-]{36}$/.test(r.revision))&&(r.details===undefined?FIRE_SERVICES.some(s=>s.id===r.id):validDetails(r.details)));
}
export function decodeServiceRate(id:string,row:{body:string}|null):ServiceRate{
 const service=FIRE_SERVICES.find(s=>s.id===id);if(!service&&!customServiceId(id))throw Error('Unknown service.');
 if(!row){if(!service)throw Error('Missing custom service.');return{id,rateCents:service.rate,revision:null};}
 const value=JSON.parse(row.body);
 if(!value||!['rateCents,revision','details,rateCents,revision'].includes(Object.keys(value).sort().join(','))||!validRate(value.rateCents)||typeof value.revision!=='string'||!/^[0-9a-f-]{36}$/.test(value.revision)||(value.details!==undefined&&!validDetails(value.details))||(!service&&!value.details))throw Error('Stored pricing is invalid.');
 return{id,...value};
}
export function catalogServices(rates:ServiceRate[],includeInactive=false):FireService[]{
 return rates.map(r=>{const base=FIRE_SERVICES.find(s=>s.id===r.id);return{...base,id:r.id,name:base?.name??'',unit:base?.unit??'quantity',description:base?.description??'',...r.details,provisionalName:Boolean(base?.provisionalName&&(!r.details||r.details.name===base.name)),rate:r.rateCents};}).filter(s=>includeInactive||s.active!==false);
}
export function serviceDetails(service:FireService):ServiceDetails{return{name:service.name,description:service.description,unit:service.unit,category:service.category??'other',active:service.active!==false};}
