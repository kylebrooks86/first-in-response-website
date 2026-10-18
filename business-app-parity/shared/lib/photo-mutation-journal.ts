import {LOCAL_CUSTOMER_DEPLOYMENT} from '../app/local-customer-deployment';

// Device-only interruption receipt. Never contains photo bytes, names, phrases,
// provider credentials or customer contact details. Separate from vault backups.
const DATABASE='fire-photo-mutation-'+LOCAL_CUSTOMER_DEPLOYMENT+'-v1';
const STORE='attempts', LOCK=DATABASE+'-exclusive';
export type PhotoMutationAttempt={id:string;kind:'add'|'delete'|'restore';customerId:string;startedAt:string};
const paused='A previous photo change needs review. No photo action was retried.';
function valid(value:PhotoMutationAttempt){
 return value&&typeof value.id==='string'&&/^[0-9a-f-]{36}$/.test(value.id)
  &&['add','delete','restore'].includes(value.kind)&&typeof value.customerId==='string'
  &&/^[a-zA-Z0-9_-]{1,120}$/.test(value.customerId)&&Number.isFinite(Date.parse(value.startedAt));
}
async function database():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')throw Error('Photo safety storage is unavailable. Photo changes remain paused.');
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onerror=()=>reject(request.error??Error('Photo safety storage could not be opened.'));
  request.onblocked=()=>reject(Error('Close other FIRE tabs before updating photo safety storage.'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
 });
}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore,set:(value:T)=>void)=>void):Promise<T>{
 const db=await database();
 try{
  return await new Promise<T>((resolve,reject)=>{
   const tx=db.transaction(STORE,mode);let value:T;
   tx.oncomplete=()=>resolve(value);
   tx.onerror=()=>reject(tx.error??Error('Photo safety transaction failed.'));
   tx.onabort=()=>reject(tx.error??Error('Photo safety transaction was interrupted.'));
   try{action(tx.objectStore(STORE),result=>{value=result;});}catch(error){tx.abort();reject(error);}
  });
 }finally{db.close();}
}
export async function readPhotoMutationAttempt():Promise<PhotoMutationAttempt|null>{
 return transaction('readonly',(store,set)=>{
  const request=store.get('pending');
  request.onsuccess=()=>{
   if(request.result===undefined){set(null);return;}
   if(!valid(request.result)){store.transaction.abort();return;}
   set(request.result);
  };
 });
}
async function exclusive<T>(action:()=>Promise<T>):Promise<T>{
 if(typeof navigator==='undefined'||!navigator.locks)throw Error('This browser cannot safely coordinate photo changes. Photo changes remain paused.');
 return navigator.locks.request(LOCK,{mode:'exclusive',ifAvailable:true},lock=>{
  if(!lock)throw Error('A photo change or review is active in another FIRE tab. Wait for it to finish; do not retry automatically.');
  return action();
 });
}
async function removeAttempt(id:string){
 await transaction<void>('readwrite',(store,set)=>{
  const request=store.get('pending');
  request.onsuccess=()=>{
   if(!valid(request.result)||request.result.id!==id){store.transaction.abort();return;}
   try{store.delete('pending');set(undefined);}catch{store.transaction.abort();}
  };
 });
}
export async function runPhotoMutation<T>(kind:PhotoMutationAttempt['kind'],customerId:string,action:()=>Promise<T>):Promise<T>{
 return exclusive(async()=>{
  const attempt:PhotoMutationAttempt={id:crypto.randomUUID(),kind,customerId,startedAt:new Date().toISOString()};
  if(!valid(attempt))throw Error('Invalid photo mutation identity.');
  await transaction<void>('readwrite',(store,set)=>{
   const request=store.get('pending');
   request.onsuccess=()=>{
    if(request.result!==undefined){store.transaction.abort();return;}
    try{store.add(attempt,'pending');set(undefined);}catch{store.transaction.abort();}
   };
  }).catch(()=>{throw Error(paused);});
  // Keep the receipt on ANY failure, including a lost acknowledgement after a
  // committed save. A browser close releases the Web Lock, never the receipt.
  const result=await action();
  await removeAttempt(attempt.id);
  return result;
 });
}
export async function reviewPhotoMutation(customerId:string,refresh:()=>Promise<unknown>):Promise<string|null>{
 return exclusive(async()=>{
  const attempt=await readPhotoMutationAttempt();
  if(attempt&&attempt.customerId!==customerId)throw Error('Open the customer photo gallery where the interrupted change began before reviewing it.');
  await refresh();
  return attempt?.id??null;
 });
}
export async function acknowledgePhotoMutation(reviewedId:string|null):Promise<void>{
 return exclusive(async()=>{
  const current=await readPhotoMutationAttempt();
  if(!current){if(reviewedId!==null)throw Error('Photo review changed. Refresh saved photos again.');return;}
  if(current.id!==reviewedId)throw Error('A newer photo change needs review. Refresh saved photos again.');
  await removeAttempt(current.id);
 });
}
