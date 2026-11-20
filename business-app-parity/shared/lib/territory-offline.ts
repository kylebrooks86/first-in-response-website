import {DOOR_STATUSES,latestDoorVisit,doorId,doorSuppressed,houseKey,validDoorBook,validDoorFollowUpDate,validDoorPoint,type DoorBook,type DoorPoint,type DoorStatus} from './door-knocking';
export type TerritoryDraftDetails = {action:'add';address:string;point?:DoorPoint}|{action:'locate';houseId:string;point:DoorPoint}|{action:'visit';houseId:string;status:DoorStatus;note:string;followUpOn?:string};
export type TerritoryDraft = {id:string;capturedAt:string;details:TerritoryDraftDetails};
export type TerritoryJournal = {format:'fire-territory-drafts';version:1;namespace:string;book:DoorBook;checkedAt:string;pending:TerritoryDraft[]};
const stamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
export function validTerritoryDraft(v:unknown):v is TerritoryDraft {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const op=v as TerritoryDraft,d=op.details;
 if(!doorId(op.id)||!stamp(op.capturedAt)||!d||typeof d!=='object'||Array.isArray(d)||Object.keys(op).some(k=>!['id','capturedAt','details'].includes(k)))return false;
 const fields=d.action==='add'?['action','address','point']:d.action==='locate'?['action','houseId','point']:['action','houseId','status','note','followUpOn'];
 if(Object.keys(d).some(k=>!fields.includes(k)))return false;
 if(d.action==='add')return typeof d.address==='string'&&!!d.address.trim()&&d.address.length<=240&&(d.point===undefined||validDoorPoint(d.point));
 if(!('houseId' in d)||!doorId(d.houseId))return false;
 if(d.action==='locate')return validDoorPoint(d.point);
 return d.action==='visit'&&Object.hasOwn(DOOR_STATUSES,d.status)&&typeof d.note==='string'&&d.note.length<=1000&&(d.status==='follow-up'?validDoorFollowUpDate(d.followUpOn):d.followUpOn===undefined);
}
/** Pending drafts never mutate the verified base or claim a new server revision. */
export function territoryDraftPreview(book:DoorBook,pending:TerritoryDraft[]):DoorBook {
 if(!validDoorBook(book))throw Error('Saved pin history needs review.');
 const preview=structuredClone(book);
 for(const op of pending){
  if(!validTerritoryDraft(op))throw Error('An offline draft needs review.');const d=op.details;
  if(d.action==='add'){
   if(preview.houses.some(h=>h.addressKey===houseKey(d.address)))throw Error('This address is already tracked. Review the saved pin.');
   preview.houses.push({id:op.id,address:d.address.trim(),addressKey:houseKey(d.address),createdAt:op.capturedAt,visits:[],...(d.point?{location:{point:structuredClone(d.point),at:op.capturedAt,requestId:op.id}}:{})});
  }else{
   const h=preview.houses.find(h=>h.id===d.houseId);if(!h)throw Error('Draft house is unavailable. Keep the draft for review.');
   if(d.action==='locate')h.location={point:structuredClone(d.point),at:op.capturedAt,requestId:op.id};
   else{
    if(doorSuppressed(h))throw Error('Contact blocked at this house.');
    h.visits.push({id:op.id,status:d.status,note:d.note,at:op.capturedAt,...(d.followUpOn?{followUpOn:d.followUpOn}:{})});
   }
  }
 }
 if(!validDoorBook(preview))throw Error('Offline history is full. Sync existing drafts first.');
 return preview;
}
export function validateTerritoryJournal(value:unknown,namespace:string):TerritoryJournal {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Offline journal is invalid.');const v=value as TerritoryJournal;
 if(v.format!=='fire-territory-drafts'||v.version!==1||v.namespace!==namespace||!validDoorBook(v.book)||!stamp(v.checkedAt)||!Array.isArray(v.pending)||v.pending.length>200||!v.pending.every(validTerritoryDraft)||new Set(v.pending.map(p=>p.id)).size!==v.pending.length||Object.keys(v).some(k=>!['format','version','namespace','book','checkedAt','pending'].includes(k)))throw Error('Offline journal does not match this app.');
 return structuredClone(v);
}
/** Confirm the exact operation, not merely a successful HTTP response. */
export function territoryDraftConfirmed(op:TerritoryDraft,book:DoorBook):boolean {
 if(!validTerritoryDraft(op)||!validDoorBook(book))return false;const d=op.details;
 if(d.action==='add'){const h=book.houses.find(h=>h.id===op.id);return !!h&&h.address===d.address.trim()&&h.createdAt===op.capturedAt&&(!d.point||h.location?.point?.lat===d.point.lat&&h.location.point.lng===d.point.lng);}
 const h=book.houses.find(h=>h.id===d.houseId);if(!h)return false;
 if(d.action==='locate')return h.location?.requestId===op.id&&h.location.at===op.capturedAt&&h.location.point?.lat===d.point.lat&&h.location.point.lng===d.point.lng;
 const e=h.visits.find(e=>e.id===op.id);return !!e&&e.status===d.status&&e.note===d.note&&e.at===op.capturedAt&&(e.followUpOn??null)===(d.followUpOn??null);
}
/** Review is always against a fresh read; no background rebase or automatic write. */
export function reviewTerritoryDraft(op:TerritoryDraft,book:DoorBook) {
 if(!validTerritoryDraft(op)||!validDoorBook(book))throw Error('Saved pin history or draft needs review.');
 if(territoryDraftConfirmed(op,book))return {alreadySaved:true,book:structuredClone(book)};
 const d=op.details;if(d.action!=='add'){const house=book.houses.find(h=>h.id===d.houseId);if(d.action==='visit'&&house&&doorSuppressed(house))throw Error('Contact blocked at this house.');const latest=house&&(d.action==='visit'?latestDoorVisit(house)?.at:house.location?.at);if(latest&&Date.parse(latest)>Date.parse(op.capturedAt))throw Error('Newer house history exists. Review it before applying this older draft.');}
 return {alreadySaved:false,book:territoryDraftPreview(book,[op])};
}
