import {FIRE_SERVICES} from './fire-services';
export const BUSINESS_PREFERENCES_KEY='fire:business-preferences:v1';
export type AvailabilityBlock={id:string;date:string;start:string;end:string;label:string};
export type BusinessPreferences={revision:string|null;blocks:AvailabilityBlock[];repeatMonths:Record<string,number>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(o:object,keys:string[])=>Object.keys(o).sort().join(',')===keys.sort().join(',');
export function validBusinessDate(v:unknown):v is string{return typeof v==='string'&&/^20\d\d-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
export function validBusinessPreferences(v:unknown):v is BusinessPreferences{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=v as BusinessPreferences;
 return exact(p,['revision','blocks','repeatMonths'])&&(p.revision===null||typeof p.revision==='string'&&uuid.test(p.revision))&&Array.isArray(p.blocks)&&p.blocks.length<=500&&new Set(p.blocks.map(b=>b?.id)).size===p.blocks.length&&p.blocks.every(b=>b&&exact(b,['id','date','start','end','label'])&&uuid.test(b.id)&&validBusinessDate(b.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)&&/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(b.end)&&b.end>b.start&&typeof b.label==='string'&&b.label.trim().length>0&&b.label.length<=100)&&!!p.repeatMonths&&typeof p.repeatMonths==='object'&&!Array.isArray(p.repeatMonths)&&Object.keys(p.repeatMonths).length<=558&&Object.entries(p.repeatMonths).every(([id,n])=>(FIRE_SERVICES.some(s=>s.id===id)||/^catalog-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))&&Number.isInteger(n)&&n>=0&&n<=120);
}
export function decodeBusinessPreferences(row:{body:string}|null):BusinessPreferences{if(!row)return{revision:null,blocks:[],repeatMonths:{}};if(row.body.length>150000)throw Error('Preferences too large.');const p=JSON.parse(row.body);if(!validBusinessPreferences(p))throw Error('Business preferences need review.');
// Legacy availability blocks are retired. Ignore any historical saved blocks
// while preserving saved repeat-service intervals until a guarded QA cleanup.
return {...p,blocks:[]};}
/** Choose the earliest enabled interval across a multi-service job, not whichever
 * word happens to occur first in its combined title. Zero explicitly disables it. */
export function repeatIntervalFor(names:string[],overrides:Record<string,number>,identities:readonly {id:string;name:string}[]=FIRE_SERVICES):number|null{
 const months=names.map(name=>{const service=identities.find(s=>s.name===name)??FIRE_SERVICES.find(s=>s.name===name);if(service&&Object.hasOwn(overrides,service.id))return overrides[service.id];const text=name.toLowerCase();return /trash|bin/.test(text)?3:/commercial|window/.test(text)?6:/roof/.test(text)?24:12;}).filter(n=>n>0);
 return months.length?Math.min(...months):null;
}
