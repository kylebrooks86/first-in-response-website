import {type OfflinePhoto,readOfflinePhotoBackup,exportOfflinePhotoBackup} from './offline-photo-backup';

const DB_NAME='fire-private-offline-photos-v1',STORE='photos';
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
 if(!(file instanceof File)||!file.type.startsWith('image/')||file.size<=0||file.size>MAX_FILE)throw Error('Choose an image smaller than 15 MB.');
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
export async function exportLocalPhotos():Promise<Blob>{
 const rows=await listOfflinePhotos();
 return exportOfflinePhotoBackup(rows);
}
export async function restoreLocalPhotos(archive:Blob,knownCustomerIds:string[]):Promise<number>{
 // Entire ZIP is validated, byte-checked and bound to existing customer IDs
 // BEFORE starting one atomic readwrite transaction.
 const rows=await readOfflinePhotoBackup(archive);
 if(!rows.length)throw Error('This photo backup is empty; no data was changed.');
 const allowed=new Set(knownCustomerIds);
 for(const row of rows)if(!allowed.has(row.customerId))throw Error('Restore the matching FIRE customer records first. Photo backup contains an unknown customer ID.');
 const db=await openVault();
 try{
  const tx=db.transaction(STORE,'readwrite'),done=transactionDone(tx),store=tx.objectStore(STORE);
  // add() (never put()) refuses existing IDs. Any conflict aborts and rolls
  // back the entire import; no existing photo can be silently overwritten.
  try{for(const row of rows)await requestDone(store.add(row));await done;}
  catch(error){if(tx.readyState==='active')tx.abort();try{await done;}catch{}throw Error('Photo restore was cancelled without replacing any existing photos. '+(error instanceof Error?error.message:''));}
 }finally{db.close();}
 const imported=(await listOfflinePhotos()).filter(r=>rows.some(p=>p.id===r.id));
 if(imported.length!==rows.length)throw Error('Restore needs review: not every imported photo could be verified.');
 return rows.length;
}
