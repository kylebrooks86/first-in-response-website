import {LOCAL_CUSTOMER_DEPLOYMENT} from '../app/local-customer-deployment';
import {protectPrivateDeviceJournal,recoverPrivateDeviceJournal} from './local-customer-backup';
import {validDoorBook,type DoorBook} from './door-knocking';
import {validateTerritoryJournal,territoryDraftPreview,territoryDraftConfirmed,type TerritoryJournal,type TerritoryDraftDetails} from './territory-offline';
// Same fixed owner/deployment boundary used by the existing on-device foundations.
export const TERRITORY_OFFLINE_NAMESPACE='fire-territory-drafts:fire-owner-account-v1:'+LOCAL_CUSTOMER_DEPLOYMENT;
type Row={id:'journal';revision:string;sealed:unknown};
export async function openTerritoryDraftVault(namespace=TERRITORY_OFFLINE_NAMESPACE,factory:IDBFactory|undefined=globalThis.indexedDB){
 if(!/^fire-territory-drafts:fire-owner-account-v1:(live|staging|doomsday|qa)$/.test(namespace)||!factory)throw Error('Secure offline storage is unavailable.');
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{let abandoned=false;const r=factory.open(namespace,1);r.onupgradeneeded=()=>r.result.createObjectStore('sealed',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onblocked=()=>{abandoned=true;reject(Error('Close other FIRE windows before opening offline drafts.'));};r.onsuccess=()=>{if(abandoned){r.result.close();return;}resolve(r.result);};});

 const read=()=>new Promise<Row|undefined>((resolve,reject)=>{const tx=db.transaction('sealed','readonly'),r=tx.objectStore('sealed').get('journal');let value:Row|undefined;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error??Error('Offline storage read failed.'));tx.onerror=()=>{};});
 const write=(row:Row,expected:string|null)=>new Promise<void>((resolve,reject)=>{const tx=db.transaction('sealed','readwrite'),store=tx.objectStore('sealed'),r=store.get('journal');let conflict=false;r.onsuccess=()=>{try{if((r.result?.revision??null)!==expected){conflict=true;tx.abort();return;}store.put(row);}catch{tx.abort();}};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error(conflict?'Offline drafts changed in another window. Unlock again; your saved drafts are kept.':'Offline save failed. Your last saved drafts are kept.'));tx.onerror=()=>{};});
 let closed=false;const sessions=new Set<()=>void>();
 const close=()=>{closed=true;for(const lock of sessions)lock();sessions.clear();db.close();};
 db.onversionchange=close;
 const validate=(v:unknown)=>validateTerritoryJournal(v,namespace);
 return {
  close,
  async exists(){return !!await read();},
  async unlock(phrase:string,initialBook?:DoorBook){
   if(closed)throw Error('Offline storage is closed.');let row=await read(),state:TerritoryJournal;
   if(row)state=await recoverPrivateDeviceJournal(row.sealed,phrase,validate);
   else{
    if(!validDoorBook(initialBook))throw Error('Connect and refresh pin history before enabling offline drafts.');
    state={format:'fire-territory-drafts',version:1,namespace,book:structuredClone(initialBook),checkedAt:new Date().toISOString(),pending:[]};
    row={id:'journal',revision:crypto.randomUUID(),sealed:await protectPrivateDeviceJournal(state,phrase,validate)};await write(row,null);
   }
   let secret=phrase,active=true,busy=false,epoch=0;
   const lock=()=>{active=false;secret='';epoch++;};sessions.add(lock);
   const check=()=>{if(!active||closed)throw Error('Offline drafts are locked.');};
   const commit=async(next:TerritoryJournal)=>{
    check();if(busy)throw Error('Wait for the current offline save.');busy=true;const generation=epoch;
    try{const checked=validate(next),sealed=await protectPrivateDeviceJournal(checked,secret,validate);check();if(generation!==epoch)throw Error('Offline drafts locked during save.');const updated:Row={id:'journal',revision:crypto.randomUUID(),sealed};await write(updated,row!.revision);check();row=updated;state=checked;}
    finally{busy=false;}
   };
   return {
    lock,
    snapshot(){check();return structuredClone(state);},
    preview(){check();try{return territoryDraftPreview(state.book,state.pending);}catch{return structuredClone(state.book);}},
    async queue(details:Record<string,unknown>){check();if(state.pending.length>=200)throw Error('Sync pending drafts before adding more.');const next=structuredClone(state);next.pending.push({id:crypto.randomUUID(),capturedAt:new Date().toISOString(),details:structuredClone(details) as TerritoryDraftDetails});territoryDraftPreview(next.book,next.pending);await commit(next);return territoryDraftPreview(state.book,state.pending);},
    async refresh(book:DoorBook){check();if(state.pending.length)throw Error('Review pending offline drafts first.');if(!validDoorBook(book))throw Error('Saved history is unavailable.');await commit({...state,book:structuredClone(book),checkedAt:new Date().toISOString()});},
    async discard(id:string,book:DoorBook){check();const op=state.pending[0];if(!op||op.id!==id||!validDoorBook(book))throw Error('Review the current draft first.');const pending=state.pending.filter(p=>p.id!==id&&!(op.details.action==='add'&&'houseId' in p.details&&p.details.houseId===op.id));await commit({...state,book:structuredClone(book),checkedAt:new Date().toISOString(),pending});},
    async acknowledge(id:string,book:DoorBook){check();const op=state.pending[0];if(!op||op.id!==id||!territoryDraftConfirmed(op,book))throw Error('Server save is not confirmed. The draft is kept.');await commit({...state,book:structuredClone(book),checkedAt:new Date().toISOString(),pending:state.pending.slice(1)});},
   };
  },
 };
}
export type TerritoryDraftSession=Awaited<ReturnType<Awaited<ReturnType<typeof openTerritoryDraftVault>>['unlock']>>;
