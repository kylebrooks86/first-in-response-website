import {houseKey,latestDoorVisit,doorSuppressed,type DoorBook,type DoorPoint} from './door-knocking';
// One registry drives pins, filters, legend and selected-record labels.
export const TERRITORY_CATEGORIES={
 customer:{label:'Current customer',filter:'Customers',color:'#2563eb'},
 completed:{label:'Completed job / past customer',filter:'Completed',color:'#15803d'},
 contacted:{label:'Door knocked / made contact',filter:'Door knocked',color:'#c45a08'},
 'no-answer':{label:'No answer',filter:'No answer',color:'#dc2626'},
 lead:{label:'Active lead / estimate sent',filter:'Leads',color:'#9333ea'},
 suppressed:{label:'Not interested / do not knock',filter:'Do not knock',color:'#5b6472'},
} as const;
export type TerritoryCategory=keyof typeof TERRITORY_CATEGORIES;
export type TerritoryCustomer={id:string;name:string;address:string};
export type TerritoryJob={id:string;customerId:string;address:string;status:string;addressVerified:boolean};
export type TerritoryRecords={customers:TerritoryCustomer[];jobs:TerritoryJob[]};
export type TerritoryPlace={key:string;address:string;houseId?:string;point?:DoorPoint;customers:TerritoryCustomer[];jobs:TerritoryJob[];categories:TerritoryCategory[];category:TerritoryCategory|null;lastContact:string|null;note:string;visitStatus?:string;unverifiedJobs:number};
/** Display priority never mutates customer, estimate, completion or visit state. */
export function territoryPlaces(book:DoorBook,records:TerritoryRecords):TerritoryPlace[]{
 const places=new Map<string,TerritoryPlace>();
 const customerById=new Map(records.customers.map(c=>[c.id,c]));
 const get=(address:string)=>{const key=houseKey(address);let p=places.get(key);if(!p){p={key,address,customers:[],jobs:[],categories:[],category:null,lastContact:null,note:'',unverifiedJobs:0};places.set(key,p);}return p;};
 const add=(p:TerritoryPlace,c:TerritoryCategory)=>{if(!p.categories.includes(c))p.categories.push(c);};
 for(const c of records.customers)if(c.address?.trim())get(c.address).customers.push(c);
 for(const j of records.jobs){
  // A historical job cannot be placed at a customer's newer address by guesswork.
  if(!j.addressVerified){const c=customerById.get(j.customerId);if(c?.address?.trim())get(c.address).unverifiedJobs++;continue;}
  if(!j.address?.trim())continue;const p=get(j.address);p.jobs.push(j);const c=customerById.get(j.customerId);if(c&&!p.customers.some(x=>x.id===c.id))p.customers.push(c);
  if(j.status==='completed')add(p,'completed');
  if(j.status==='sent')add(p,'lead');
  if(['approved','scheduled'].includes(j.status))add(p,'customer');
 }
 for(const h of book.houses){const p=get(h.address),v=latestDoorVisit(h);p.houseId=h.id;p.point=h.location?.point??undefined;p.lastContact=v?.at??null;p.note=v?.note??'';p.visitStatus=v?.status;
  if(doorSuppressed(h))add(p,'suppressed');
  else if(v?.status==='no-answer')add(p,'no-answer');
  else if(v&&['contacted','business-card','door-hanger','follow-up'].includes(v.status))add(p,'contacted');
 }
 for(const p of places.values()){
  if(p.customers.length&&!p.categories.some(c=>['customer','lead','completed'].includes(c)))add(p,'customer');
  p.category=(['suppressed','customer','lead','completed','no-answer','contacted'] as const).find(c=>p.categories.includes(c))??null;
 }
 return [...places.values()].sort((a,b)=>a.address.localeCompare(b.address));
}
export function territoryVisible(places:TerritoryPlace[],filter:string){return places.filter(p=>filter==='all'||p.categories.includes(filter as TerritoryCategory));}
export function territoryGeoJSON(places:TerritoryPlace[]){return {type:'FeatureCollection' as const,features:places.filter(p=>p.point).map(p=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[p.point!.lng,p.point!.lat]},properties:{key:p.key,label:p.category?TERRITORY_CATEGORIES[p.category].label:'Not visited',color:p.category?TERRITORY_CATEGORIES[p.category].color:'#334155'}}))};}

export function validTerritoryRecords(v:unknown):v is TerritoryRecords{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const r=v as TerritoryRecords;
 return Array.isArray(r.customers)&&Array.isArray(r.jobs)&&r.customers.every(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.address==='string')&&r.jobs.every(j=>j&&typeof j.id==='string'&&typeof j.customerId==='string'&&typeof j.address==='string'&&typeof j.status==='string'&&typeof j.addressVerified==='boolean');
}
