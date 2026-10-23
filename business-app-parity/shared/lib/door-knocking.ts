/** Owner-managed house visits. No customer, pricing or payment linkage. */
export const DOOR_STATUSES={
 'not-contacted':'Not contacted', 'business-card':'Left business card', 'door-hanger':'Left door hanger',
 contacted:'Contacted', 'follow-up':'Follow-up', 'not-interested':'Not interested', 'do-not-knock':'Do not knock',
} as const;
export type DoorStatus=keyof typeof DOOR_STATUSES;
export type DoorVisit={id:string;status:DoorStatus;at:string;note:string;followUpOn?:string};
export type DoorHouse={id:string;address:string;addressKey:string;createdAt:string;visits:DoorVisit[]};
export type DoorBook={revision:string|null;houses:DoorHouse[]};
export const DOOR_BOOK_KEY='fire:door-knocking:v1';
export const doorId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const doorStatus=(v:unknown):v is DoorStatus=>typeof v==='string'&&Object.hasOwn(DOOR_STATUSES,v);
export function houseKey(address:string){return address.trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').replace(/\b(street|avenue|road|drive|lane|court|boulevard|place)\b/g,w=>({street:'st',avenue:'ave',road:'rd',drive:'dr',lane:'ln',court:'ct',boulevard:'blvd',place:'pl'}[w]!));}
const stamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
/** Date-only visit targets use Tulsa's calendar, not browser-local UTC midnight. */
export function validDoorFollowUpDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function doorTodayInTulsa(now:number=Date.now()):string{
 if(!Number.isFinite(now))throw Error('Cannot verify the local revisit date.');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
 const part=(type:string)=>parts.find(item=>item.type===type)?.value??'';
 return part('year')+'-'+part('month')+'-'+part('day');
}
export type DoorRevisit={houseId:string;address:string;followUpOn:string;lastVisitAt:string;due:boolean;overdue:boolean};
/** Only the latest house outcome can remain scheduled. Suppressed houses never surface. */
export function doorRevisitQueue(book:DoorBook,today:string):DoorRevisit[]{
 if(!validDoorFollowUpDate(today))return [];
 const visits:DoorRevisit[]=[];
 for(const house of book.houses){
  const latest=latestDoorVisit(house);
  if(!latest||latest.status!=='follow-up'||!validDoorFollowUpDate(latest.followUpOn)||doorSuppressed(house))continue;
  visits.push({houseId:house.id,address:house.address,followUpOn:latest.followUpOn,lastVisitAt:latest.at,due:latest.followUpOn<=today,overdue:latest.followUpOn<today});
 }
 return visits.sort((a,b)=>a.followUpOn.localeCompare(b.followUpOn)||a.address.localeCompare(b.address)||a.houseId.localeCompare(b.houseId));
}
export function validDoorBook(v:unknown):v is DoorBook{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const b=v as DoorBook;if(!(b.revision===null||doorId(b.revision))||!Array.isArray(b.houses)||b.houses.length>500)return false;
 const ids=new Set<string>(),keys=new Set<string>(),events=new Set<string>();
 return b.houses.every(h=>{
  if(!h||!doorId(h.id)||ids.has(h.id)||typeof h.address!=='string'||!h.address.trim()||h.address.length>240||h.addressKey!==houseKey(h.address)||keys.has(h.addressKey)||!stamp(h.createdAt)||!Array.isArray(h.visits)||h.visits.length>100)return false;
  ids.add(h.id);keys.add(h.addressKey);
  return h.visits.every(e=>{if(!e||!doorId(e.id)||events.has(e.id)||!doorStatus(e.status)||!stamp(e.at)||typeof e.note!=='string'||e.note.length>1000||(e.followUpOn!==undefined&&(e.status!=='follow-up'||!validDoorFollowUpDate(e.followUpOn))))return false;events.add(e.id);return true;});
 });
}
export function decodeDoorBook(row:{body:string}|null):DoorBook{
 if(!row)return {revision:null,houses:[]};
 const value:unknown=JSON.parse(row.body);if(!validDoorBook(value))throw Error('Saved house records need review.');return value;
}
export const latestDoorVisit=(h:DoorHouse)=>h.visits[h.visits.length-1]??null;
export const doorSuppressed=(h:DoorHouse)=>['do-not-knock','not-interested'].includes(latestDoorVisit(h)?.status??'');
