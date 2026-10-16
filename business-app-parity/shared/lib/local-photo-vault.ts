import {type OfflinePhoto,readOfflinePhotoBackup,exportOfflinePhotoBackup,supportedOfflinePhotoType} from './offline-photo-backup';
import { LOCAL_CUSTOMER_DEPLOYMENT } from '../app/local-customer-deployment';

// This fixed deployment adapter isolates browsers that host different FIRE
// candidates under the same origin. Never derive identity from the URL, query,
 // browser storage, or untrusted environment variables.
const DB_NAME='fire-private-offline-photos-'+LOCAL_CUSTOMER_DEPLOYMENT+'-v1',STORE='photos';
const MAX_FILE=15*1024*1024;
function requestDone<T>(request:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??Error('On-device photo operation failed'));});
}
function transactionDone(tx:IDBTransaction):Promise<void>{
 return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??Error('Photo storage transaction failed'));tx.onabort=()=>reject(tx.error??Error('Photo storage transaction was rolled back'));});
}
async function openVault():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')throw Error('Offline photo storage is unavailable on this device.');
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('customerId','customerId',{unique:false});}
  };
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  request.onerror=()=>reject(request.error??Error('Could not open photo storage'));
  request.onblocked=()=>reject(Error('Photo storage is in use by another app window. Close other FIRE tabs and retry.'));
 });
}
export async function listOfflinePhotos(customerId?:string):Promise<OfflinePhoto[]>{
 const db=await openVault();
 try{
  const tx=db.transaction(STORE,'readonly');const done=transactionDone(tx);
  const store=tx.objectStore(STORE);
  const request=customerId?store.index('customerId').getAll(customerId):store.getAll();
  const rows=await requestDone(request) as OfflinePhoto[];await done;
  return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }finally{db.close();}
}
export async function addOfflinePhoto(customerId:string,category:OfflinePhoto['category'],caption:string,file:File):Promise<OfflinePhoto>{
 if(!customerId||!/^[a-zA-Z0-9_-]{1,120}$/.test(customerId))throw Error('Choose a valid saved customer before adding photos.');
 if(!['before','after','property'].includes(category))throw Error('Choose a valid photo category.');
 if(!(file instanceof File)||!supportedOfflinePhotoType(file.type)||file.size<=0||file.size>MAX_FILE)throw Error('Choose an image smaller than 15 MB.');
 const record:OfflinePhoto={id:crypto.randomUUID(),customerId,category,caption:caption.slice(0,2000),
  filename:(file.name||'photo').slice(0,240),contentType:file.type,sizeBytes:file.size,createdAt:new Date().toISOString(),blob:file};
 const db=await openVault();
 try{
  const tx=db.transaction(STORE,'readwrite');const done=transactionDone(tx);
  await requestDone(tx.objectStore(STORE).add(record));await done;
 }finally{db.close();}
 // Verify the saved blob exists and retained its full length before claiming success.
 const check=(await listOfflinePhotos(customerId)).find(x=>x.id===record.id);
 if(!check||check.blob.size!==file.size||check.contentType!==file.type)throw Error('Photo save could not be verified. Review local photos before retrying.');
 return record;
}
export async function removeOfflinePhoto(id:string,customerId:string):Promise<void>{
 const db=await openVault();
 try{
  const tx=db.transaction(STORE,'readwrite'),done=transactionDone(tx),store=tx.objectStore(STORE);
  const row=await requestDone(store.get(id)) as OfflinePhoto|undefined;
  if(!row||row.customerId!==customerId){tx.abort();try{await done;}catch{}throw Error('Photo does not belong to this customer or was already removed.');}
  await requestDone(store.delete(id));await done;
 }finally{db.close();}
 if((await listOfflinePhotos(customerId)).some(x=>x.id===id))throw Error('Photo removal could not be verified.');
}
/** Reject an all-customer or scoped ZIP if another tab changed the photo
 * inventory while the archive was being prepared. No additional blob reads. */
export function sameOfflinePhotoInventory(before:OfflinePhoto[],after:OfflinePhoto[]):boolean{
 if(before.length!==after.length)return false;
 const fields=['id','customerId','category','caption','filename','contentType','sizeBytes','createdAt'] as const;
 return before.every((row,i)=>{
  const current=after[i];
  return Boolean(current&&fields.every(field=>row[field]===current[field])&&
    row.blob instanceof Blob&&current.blob instanceof Blob&&
    row.blob.size===current.blob.size&&row.blob.type===current.blob.type);
 });
}
/** Match a fully verified ZIP against the current IndexedDB images, not only
 * their names and lengths. A second tab can replace a photo with different
 * bytes while preserving every metadata field and the original byte length.
 * Hash sequentially to bound memory on iPhone/iPad (15 MB maximum per image).
 */
export async function byteIdenticalOfflinePhotoInventory(archive:OfflinePhoto[],current:OfflinePhoto[]):Promise<boolean>{
 if(!sameOfflinePhotoInventory(archive,current))return false;
 for(let i=0;i<archive.length;i++)if(!await exactSavedPhotoMatch(archive[i],current[i]))return false;
 return true;
}
export async function exportLocalPhotos(customerId?:string):Promise<Blob>{
 if(customerId!==undefined&&!/^[a-zA-Z0-9_-]{1,120}$/.test(customerId))
   throw Error('Cannot export photos for an invalid customer identifier.');
 const rows=await listOfflinePhotos(customerId);
 if(!rows.length)throw Error(customerId?'This customer has no on-device photos to back up.':'There are no on-device photos to back up.');
 const zip=await exportOfflinePhotoBackup(rows);
 // Validate the actual final ZIP, not only its source manifest. This detects
 // interrupted streams and broken central directory metadata before a user
 // is offered a file and mistakenly believes photos were backed up.
 const checked=await readOfflinePhotoBackup(zip);
 if(!sameOfflinePhotoInventory(rows,checked))
   throw Error('Final photo archive could not be fully verified; no successful backup was offered.');
 // Two FIRE tabs can add/remove photos during an expensive mobile ZIP export.
 // A genuine saved backup must not claim current all-customer coverage then.
 if(!await byteIdenticalOfflinePhotoInventory(checked,await listOfflinePhotos(customerId)))
   throw Error('Photos changed while this ZIP was prepared. Prepare a fresh backup before saving to Files.');
 return zip;
}
export type PhotoRestoreResult={restored:number;alreadyPresent:number};
export async function exactSavedPhotoMatch(saved:OfflinePhoto,incoming:OfflinePhoto):Promise<boolean>{
 const fields=['id','customerId','category','caption','filename','contentType','sizeBytes','createdAt'] as const;
 if(fields.some(field=>saved[field]!==incoming[field]))return false;
 if(!(saved.blob instanceof Blob)||saved.blob.size!==saved.sizeBytes||
    saved.blob.type!==saved.contentType)return false;
 // Identical IDs alone are NOT evidence of identical originals. The ZIP has
 // already passed CRC-32 and SHA-256; compare the actual existing device bytes.
 const [a,b]=await Promise.all([
  crypto.subtle.digest('SHA-256',await saved.blob.arrayBuffer()),
  crypto.subtle.digest('SHA-256',await incoming.blob.arrayBuffer())
 ]);
 const left=new Uint8Array(a),right=new Uint8Array(b);
 return left.length===right.length&&left.every((value,i)=>value===right[i]);
}
export async function restoreLocalPhotos(archive:Blob,knownCustomerIds:string[]):Promise<PhotoRestoreResult>{
 // Verify the entire ZIP and its customer association BEFORE any local write.
 const rows=await readOfflinePhotoBackup(archive);
 if(!rows.length)throw Error('This photo backup is empty; no data was changed.');
 const allowed=new Set(knownCustomerIds);
 for(const row of rows)if(!allowed.has(row.customerId))
   throw Error('Restore the matching FIRE customer records first. Photo backup contains an unknown customer ID.');
 // Preflight outside a write transaction: awaiting a blob digest from inside
 // an IndexedDB transaction could auto-commit/close that transaction on iOS.
 const existing=new Map((await listOfflinePhotos()).map(photo=>[photo.id,photo]));
 const additions:OfflinePhoto[]=[];
 let alreadyPresent=0;
 for(const row of rows){
  const stored=existing.get(row.id);
  if(!stored){additions.push(row);continue;}
  if(!await exactSavedPhotoMatch(stored,row))
    throw Error('Restore stopped: the same photo ID contains different data on this device. No photos were changed.');
  alreadyPresent++;
 }
 if(!additions.length)return {restored:0,alreadyPresent};
 const db=await openVault();
 try{
  const tx=db.transaction(STORE,'readwrite'),done=transactionDone(tx),store=tx.objectStore(STORE);
  // add(), never put(): any concurrent same-ID insertion aborts the whole
  // transaction. Existing originals cannot be overwritten or silently merged.
  try{for(const row of additions)await requestDone(store.add(row));await done;}
  catch(error){
   try{tx.abort();}catch{/* Transaction already rolled back. */}
   try{await done;}catch{}
   throw Error('Photo restore was cancelled without replacing existing photos. Review the library before retrying.');
  }
 }finally{db.close();}
 const restored=new Map((await listOfflinePhotos()).map(photo=>[photo.id,photo]));
 if(additions.some(row=>!restored.has(row.id)||restored.get(row.id)!.blob.size!==row.sizeBytes))
   throw Error('Restore needs review: not every newly added photo could be verified.');
 return {restored:additions.length,alreadyPresent};
}
