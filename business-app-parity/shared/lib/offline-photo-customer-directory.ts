import { LOCAL_CUSTOMER_DEPLOYMENT } from '../app/local-customer-deployment';

// Only the minimum directory necessary to find on-device photos is retained:
// no contact details, invoices, customer notes, addresses or payment data.
// The build-time deployment identity prevents cross-candidate data leakage.
const DATABASE='fire-offline-photo-directory-'+LOCAL_CUSTOMER_DEPLOYMENT+'-v1';
const STORE='customers';
export type OfflinePhotoCustomer={id:string;name:string};
function valid(value:OfflinePhotoCustomer):boolean{
 return typeof value?.id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(value.id)
  &&typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=240;
}
function done(tx:IDBTransaction):Promise<void>{
 return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('Offline customer directory transaction failed'));tx.onabort=()=>reject(tx.error??Error('Offline customer directory was not saved'));});
}
function request<T>(r:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??Error('Offline directory read failed'));});
}
async function open():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')throw Error('Offline customer directory is not supported by this device.');
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DATABASE,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>db.close();resolve(db);};
  r.onerror=()=>reject(r.error??Error('Offline customer directory could not be opened'));
  r.onblocked=()=>reject(Error('Close other FIRE tabs before updating the offline photo directory.'));
 });
}
export async function saveOfflinePhotoCustomerDirectory(input:OfflinePhotoCustomer[]):Promise<number>{
 if(!Array.isArray(input)||input.length>10000)throw Error('Customer directory exceeds the offline safety limit.');
 const seen=new Set<string>();const records:OfflinePhotoCustomer[]=[];
 for(const row of input){
  if(!valid(row)||seen.has(row.id))throw Error('Invalid offline customer directory; previous cache retained.');
  seen.add(row.id);records.push({id:row.id,name:row.name.trim()});
 }
 const db=await open();
 try{
  const tx=db.transaction(STORE,'readwrite'),completed=done(tx),store=tx.objectStore(STORE);
  try{
   await request(store.clear());
   for(const row of records)await request(store.add(row));
   await completed;
  }catch(error){
   try{tx.abort();}catch{/* Already rolled back. */}
   try{await completed;}catch{}
   throw error;
  }
 }finally{db.close();}
 return records.length;
}
export async function loadOfflinePhotoCustomerDirectory():Promise<OfflinePhotoCustomer[]>{
 const db=await open();
 try{
  const tx=db.transaction(STORE,'readonly'),completed=done(tx);
  const rows=await request(tx.objectStore(STORE).getAll()) as OfflinePhotoCustomer[];
  await completed;
  if(rows.some(row=>!valid(row)))throw Error('Saved offline photo directory is invalid.');
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
 }finally{db.close();}
}
export async function clearOfflinePhotoCustomerDirectory():Promise<void>{
 const db=await open();
 try{
  const tx=db.transaction(STORE,'readwrite'),completed=done(tx);
  await request(tx.objectStore(STORE).clear());await completed;
 }finally{db.close();}
}
