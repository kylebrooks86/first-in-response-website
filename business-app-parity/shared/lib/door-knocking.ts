/** Owner-managed house visits. No customer, pricing or payment linkage. */
export const DOOR_STATUSES={
 'not-contacted':'Not contacted', 'business-card':'Left business card', 'door-hanger':'Left door hanger',
 contacted:'Contacted', 'follow-up':'Follow-up', 'not-interested':'Not interested', 'do-not-knock':'Do not knock',
} as const;
export type DoorStatus=keyof typeof DOOR_STATUSES;
export type DoorVisit={id:string;status:DoorStatus;at:string;note:string};
export type DoorHouse={id:string;address:string;addressKey:string;createdAt:string;visits:DoorVisit[]};
export type DoorBook={revision:string|null;houses:DoorHouse[]};
export const DOOR_BOOK_KEY='fire:door-knocking:v1';
export const doorId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const doorStatus=(v:unknown):v is DoorStatus=>typeof v==='string'&&Object.hasOwn(DOOR_STATUSES,v);
export function houseKey(address:string){return address.trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').replace(/\b(street|avenue|road|drive|lane|court|boulevard|place)\b/g,w=>({street:'st',avenue:'ave',road:'rd',drive:'dr',lane:'ln',court:'ct',boulevard:'blvd',place:'pl'}[w]!));}
const stamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
export function validDoorBook(v:unknown):v is DoorBook{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const b=v as DoorBook;if(!(b.revision===null||doorId(b.revision))||!Array.isArray(b.houses)||b.houses.length>500)return false;
 const ids=new Set<string>(),keys=new Set<string>(),events=new Set<string>();
 return b.houses.every(h=>{
  if(!h||!doorId(h.id)||ids.has(h.id)||typeof h.address!=='string'||!h.address.trim()||h.address.length>240||h.addressKey!==houseKey(h.address)||keys.has(h.addressKey)||!stamp(h.createdAt)||!Array.isArray(h.visits)||h.visits.length>100)return false;
  ids.add(h.id);keys.add(h.addressKey);
  return h.visits.every(e=>{if(!e||!doorId(e.id)||events.has(e.id)||!doorStatus(e.status)||!stamp(e.at)||typeof e.note!=='string'||e.note.length>1000)return false;events.add(e.id);return true;});
 });
}
export function decodeDoorBook(row:{body:string}|null):DoorBook{
 if(!row)return {revision:null,houses:[]};
 const value:unknown=JSON.parse(row.body);if(!validDoorBook(value))throw Error('Saved house records need review.');return value;
}
export const latestDoorVisit=(h:DoorHouse)=>h.visits[h.visits.length-1]??null;
export const doorSuppressed=(h:DoorHouse)=>['do-not-knock','not-interested'].includes(latestDoorVisit(h)?.status??'');
