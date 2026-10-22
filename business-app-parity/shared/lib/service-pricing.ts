import { FIRE_SERVICES } from './fire-services';
export const SERVICE_RATE_PREFIX='fire:service-rate:v1:';
export type ServiceRate={id:string;rateCents:number;revision:string|null};
export function validRate(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
export function priceCents(value:string):number|null{
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return validRate(amount)?amount:null;
}
export function validServiceRates(value:unknown):value is ServiceRate[]{
  return Array.isArray(value)&&value.length===FIRE_SERVICES.length&&new Set(value.map(r=>r?.id)).size===FIRE_SERVICES.length&&value.every(r=>r&&FIRE_SERVICES.some(s=>s.id===r.id)&&validRate(r.rateCents)&&(r.revision===null||typeof r.revision==='string'&&/^[0-9a-f-]{36}$/.test(r.revision)));
}
export function decodeServiceRate(id:string,row:{body:string}|null):ServiceRate{
  const service=FIRE_SERVICES.find(s=>s.id===id);if(!service)throw Error('Unknown service.');
  if(!row)return{id,rateCents:service.rate,revision:null};
  const value=JSON.parse(row.body);
  if(!value||Object.keys(value).sort().join(',')!=='rateCents,revision'||!validRate(value.rateCents)||typeof value.revision!=='string'||!/^[0-9a-f-]{36}$/.test(value.revision))throw Error('Stored pricing is invalid.');
  return{id,...value};
}
