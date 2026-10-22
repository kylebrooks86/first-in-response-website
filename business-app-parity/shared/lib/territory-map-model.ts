/**
 * FIRE Map & Territory candidate domain model.
 * No hosted writes, background GPS, address geocoding or network requests here.
 * Only verified owner-controlled points may become pins. Never infer coordinates
 * from mutable legacy customer addresses.
 */
export const TERRITORY_KINDS=['customer','job','canvass','business-card','yard-sign'] as const;
export const CANVASS_STATUSES=['not-visited','no-answer','contacted','interested','follow-up','appointment','not-interested','do-not-knock'] as const;
export type TerritoryKind=typeof TERRITORY_KINDS[number];
export type CanvassStatus=typeof CANVASS_STATUSES[number];
export type VerifiedLocation={latitude:number;longitude:number;source:'owner-dropped'|'owner-verified-geocode'|'verified-service-property';confirmedAt:string};
export type TerritoryPin={
 id:string;kind:TerritoryKind;location:VerifiedLocation;propertyId:string|null;customerId:string|null;
 serviceIds:string[];status:CanvassStatus|null;lastActivityOn:string|null;
 label:string;note:string;doNotKnock:boolean;
};
export type TerritoryFilters={
 kinds?:TerritoryKind[];serviceIds?:string[];statuses?:CanvassStatus[];
 sinceOn?:string;untilOn?:string;
 bounds?:{south:number;north:number;west:number;east:number};
 text?:string;
};
export type DoorKnockEvent={
 eventId:string;pinId:string;status:CanvassStatus;occurredAt:string;note:string;
 mode:'owner-attested';syncState:'local-pending';
};
const kinds=new Set<string>(TERRITORY_KINDS),statuses=new Set<string>(CANVASS_STATUSES);
const validDate=(s:unknown):s is string=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;
};
const nonempty=(s:unknown,max:number):s is string=>typeof s==='string'&&s.length>0&&s.length<=max;
export function isVerifiedTerritoryPin(value:unknown):value is TerritoryPin{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as Partial<TerritoryPin>,g=p.location;
 return nonempty(p.id,160)&&kinds.has(p.kind??'')&&g!==null&&typeof g==='object'&&
  typeof g?.latitude==='number'&&Number.isFinite(g.latitude)&&g.latitude>=-90&&g.latitude<=90&&
  typeof g?.longitude==='number'&&Number.isFinite(g.longitude)&&g.longitude>=-180&&g.longitude<=180&&
  (g.source==='owner-dropped'||g.source==='owner-verified-geocode'||g.source==='verified-service-property')&&
  typeof g.confirmedAt==='string'&&Number.isFinite(Date.parse(g.confirmedAt))&&
  (p.propertyId===null||nonempty(p.propertyId,160))&&
  (p.customerId===null||nonempty(p.customerId,160))&&
  Array.isArray(p.serviceIds)&&p.serviceIds.length<=30&&p.serviceIds.every(x=>nonempty(x,80))&&
  (p.status===null||statuses.has(p.status??''))&&
  (p.lastActivityOn===null||validDate(p.lastActivityOn))&&
  typeof p.label==='string'&&p.label.length<=200&&
  typeof p.note==='string'&&p.note.length<=1000&&typeof p.doNotKnock==='boolean';
}
export function filterTerritoryPins(pins:readonly TerritoryPin[],f:TerritoryFilters={}):TerritoryPin[]{
 if(f.sinceOn!==undefined&&!validDate(f.sinceOn))throw Error('Invalid earliest activity date');
 if(f.untilOn!==undefined&&!validDate(f.untilOn))throw Error('Invalid latest activity date');
 if(f.sinceOn&&f.untilOn&&f.sinceOn>f.untilOn)throw Error('Activity range is reversed');
 if(f.bounds&&(![-90,90].includes(f.bounds.south)&&(!Number.isFinite(f.bounds.south)||f.bounds.south< -90||f.bounds.south>90)||
   !Number.isFinite(f.bounds.north)||f.bounds.north< -90||f.bounds.north>90||
   !Number.isFinite(f.bounds.west)||f.bounds.west< -180||f.bounds.west>180||
   !Number.isFinite(f.bounds.east)||f.bounds.east< -180||f.bounds.east>180||
   f.bounds.north<f.bounds.south))throw Error('Invalid map bounds');
 const text=(f.text??'').trim().toLowerCase();
 return pins.filter(p=>{
  if(!isVerifiedTerritoryPin(p))return false; // never place an unconfirmed house pin
  if(f.kinds?.length&&!f.kinds.includes(p.kind))return false;
  if(f.serviceIds?.length&&!f.serviceIds.some(id=>p.serviceIds.includes(id)))return false;
  if(f.statuses?.length&&(!p.status||!f.statuses.includes(p.status)))return false;
  if(f.sinceOn&&(!p.lastActivityOn||p.lastActivityOn<f.sinceOn))return false;
  if(f.untilOn&&(!p.lastActivityOn||p.lastActivityOn>f.untilOn))return false;
  if(f.bounds){
   const {latitude:lat,longitude:lng}=p.location,b=f.bounds;
   if(lat<b.south||lat>b.north)return false;
   // International date line is a valid wrapped viewport.
   if(b.west<=b.east?(lng<b.west||lng>b.east):(lng<b.west&&lng>b.east))return false;
  }
  if(text&&!([p.label,p.note,...p.serviceIds].join(' ').toLowerCase().includes(text)))return false;
  return true;
 });
}
/** A DND, explicit decline or known existing customer never becomes an outreach stop. */
export function isSafeCanvassTarget(p:TerritoryPin):boolean{
 return isVerifiedTerritoryPin(p)&&p.kind==='canvass'&&p.customerId===null&&
  !p.doNotKnock&&p.status!=='do-not-knock'&&p.status!=='not-interested'&&
  p.status!=='appointment'&&p.status!=='contacted';
}
export function candidateCanvassStops(pins:readonly TerritoryPin[]):TerritoryPin[]{
 // Keep one per verified property, no duplicates across event histories.
 const seen=new Set<string>();
 return pins.filter(p=>{
  if(!isSafeCanvassTarget(p))return false;
  const key=p.propertyId??'pin:'+p.id;
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}
export function offlineDoorKnockEvent(input:{
 eventId:string;pin:TerritoryPin;status:CanvassStatus;occurredAt:string;note:string;
}):DoorKnockEvent{
 if(!isVerifiedTerritoryPin(input.pin)||input.pin.kind!=='canvass'||
  !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(input.eventId)||
  !statuses.has(input.status)||!Number.isFinite(Date.parse(input.occurredAt))||
  typeof input.note!=='string'||input.note.length>1000)throw Error('Invalid offline canvass event');
 if(input.pin.doNotKnock&&input.status!=='do-not-knock')throw Error('Do-not-knock suppression cannot be overwritten offline');
 if(input.pin.status==='do-not-knock'&&input.status!=='do-not-knock')throw Error('Existing do-not-knock status cannot be overwritten offline');
 return {eventId:input.eventId,pinId:input.pin.id,status:input.status,occurredAt:input.occurredAt,note:input.note,
  mode:'owner-attested',syncState:'local-pending'};
}
export function territorySummary(pins:readonly TerritoryPin[]){
 const verified=pins.filter(isVerifiedTerritoryPin);
 return {
  verifiedPins:verified.length,
  customers:new Set(verified.filter(p=>p.customerId!==null).map(p=>p.customerId)).size,
  serviceProperties:new Set(verified.filter(p=>p.propertyId!==null).map(p=>p.propertyId)).size,
  knocked:verified.filter(p=>p.kind==='canvass'&&p.status!==null&&p.status!=='not-visited').length,
  followUps:verified.filter(p=>p.kind==='canvass'&&p.status==='follow-up'&&!p.doNotKnock).length,
  suppressed:verified.filter(p=>p.doNotKnock||p.status==='do-not-knock').length,
 };
}
