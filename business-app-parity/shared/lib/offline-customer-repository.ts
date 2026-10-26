/** Experimental local-only customer draft repository.
 * This module is not used by customer screens or the server; it sends NO requests,
 * does not claim an installed PWA will cold-launch, and must not store real records
 * until a secure local unlock and explicit server sync are separately reviewed.
 * No financial operations, payments, or Stripe outbox are supported.
 */
export type LocalCustomerTarget='live'|'staging'|'doomsday'|'qa';
export type LocalCustomerInput={name:string;email?:string;phone?:string;address?:string};
export type LocalCustomer={id:string;name:string;email:string;phone:string;address:string;revision:string;createdAt:string;updatedAt:string};
export type LocalCustomerOperation={id:string;action:'create'|'update';customerId:string;customer:LocalCustomer;at:string;expectedRevision:string|null};
type Receipt={id:string;fingerprint:string;customer:LocalCustomer};
const FORMAT='fire-offline-customer-drafts-v1';
const fields=(input:LocalCustomerInput):Omit<LocalCustomer,'id'|'revision'|'createdAt'|'updatedAt'>=>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid customer draft.');
 const out={name:input.name,email:input.email??'',phone:input.phone??'',address:input.address??''};
 if(Object.values(out).some(v=>typeof v!=='string'))throw Error('Invalid customer draft fields.');
 const value={name:out.name.trim(),email:out.email.trim(),phone:out.phone.trim(),address:out.address.trim()};
 if(!value.name||value.name.length>160||value.email.length>254||value.phone.length>80||value.address.length>320)throw Error('Customer draft fields are missing or too long.');
 return value;
};
const validKey=(value:string)=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value);
const validOperation=(value:string)=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value);

/** Caller supplies the authenticated account's opaque identity; never infer it
 * from localStorage, a displayed name, or a URL. Each target has its own DB. */
export async function openOfflineCustomerRepository(identity:{target:LocalCustomerTarget;accountKey:string},factory:IDBFactory|undefined=globalThis.indexedDB){
 if(!identity||!['live','staging','doomsday','qa'].includes(identity.target)||!validKey(identity.accountKey)||!factory)
  throw Error('Local customer store needs an explicit account, target and available IndexedDB.');
 const namespace=FORMAT+':'+identity.target+':'+identity.accountKey;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=factory.open(namespace,1);let blocked=false;
  request.onupgradeneeded=()=>{
   const target=request.result;
   if(!target.objectStoreNames.contains('customers'))target.createObjectStore('customers',{keyPath:'id'});
   if(!target.objectStoreNames.contains('operations'))target.createObjectStore('operations',{keyPath:'id'});
   if(!target.objectStoreNames.contains('outbox'))target.createObjectStore('outbox',{keyPath:'id'});
  };
  request.onblocked=()=>{blocked=true;reject(Error('Close other FIRE tabs before upgrading local records.'));};
  request.onerror=()=>reject(request.error??Error('IndexedDB unavailable.'));
  request.onsuccess=()=>{if(blocked){request.result.close();return;}resolve(request.result);};
 });
 let closed=false;
 const check=()=>{if(closed)throw Error('The local customer store is closed.');};
 const close=()=>{if(!closed){closed=true;db.close();}};
 db.onversionchange=close;
 function readOne<T>(storeName:string,id:string):Promise<T|null>{
  check();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(storeName,'readonly'),r=tx.objectStore(storeName).get(id);
   let row:T|null=null;r.onsuccess=()=>{row=(r.result as T|undefined)??null;};
   tx.oncomplete=()=>resolve(row);tx.onabort=()=>reject(tx.error??Error('Local customer read was interrupted.'));
  });
 }
 function readAll<T>(storeName:string):Promise<T[]>{
  check();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(storeName,'readonly'),r=tx.objectStore(storeName).getAll();
   let rows:T[]=[];r.onsuccess=()=>{rows=r.result as T[];};
   tx.oncomplete=()=>resolve(rows);tx.onabort=()=>reject(tx.error??Error('Local customer read was interrupted.'));
  });
 }
 function write(action:'create'|'update',id:string|null,input:LocalCustomerInput,expectedRevision:string|null,operationId:string):Promise<LocalCustomer>{
  check();if(!validOperation(operationId))throw Error('Invalid stable operation identifier.');
  if(action==='update'&&(!id||!validKey(id)||!validKey(expectedRevision??'')))throw Error('Customer revision is required for local editing.');
  const value=fields(input);
  const fingerprint=JSON.stringify([action,id,value,expectedRevision]);
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(['customers','operations','outbox'],'readwrite');
   const customers=tx.objectStore('customers'),operations=tx.objectStore('operations'),outbox=tx.objectStore('outbox');
   let result:LocalCustomer|undefined,problem:Error|undefined;
   const fail=(message:string)=>{problem=Error(message);try{tx.abort();}catch{/* Already aborted. */}};
   const apply=(previous:LocalCustomer|null)=>{
    if(action==='update'&&(!previous||previous.revision!==expectedRevision)){fail('Local customer changed. Review before editing again.');return;}
    if(action==='create'&&previous){fail('Customer identifier already exists.');return;}
    const now=new Date().toISOString();
    const row:LocalCustomer={...value,id:previous?.id??crypto.randomUUID(),revision:crypto.randomUUID(),createdAt:previous?.createdAt??now,updatedAt:now};
    const entry:LocalCustomerOperation={id:operationId,action,customerId:row.id,customer:row,at:now,expectedRevision};
    const receipt:Receipt={id:operationId,fingerprint,customer:row};
    try{customers.put(row);outbox.add(entry);operations.add(receipt);result=row;}
    catch{fail('Local draft storage failed. The previous customer remains unchanged.');}
   };
   const existing=operations.get(operationId);
   existing.onsuccess=()=>{
    const receipt=existing.result as Receipt|undefined;
    if(receipt){if(receipt.fingerprint!==fingerprint){fail('This operation ID was already used for different details.');return;}result=receipt.customer;return;}
    if(action==='create'){apply(null);return;}
    const request=customers.get(id!);
    request.onsuccess=()=>apply((request.result as LocalCustomer|undefined)??null);
   };
   tx.oncomplete=()=>{if(result)resolve(structuredClone(result));else reject(Error('Local draft was not confirmed.'));};
   tx.onabort=()=>reject(problem??tx.error??Error('Local storage interrupted. Prior records are unchanged.'));
  });
 }
 return {
  namespace,close,
  getCustomer:(id:string)=>readOne<LocalCustomer>('customers',id),
  listCustomers:async()=>(await readAll<LocalCustomer>('customers')).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),
  listPending:async()=>(await readAll<LocalCustomerOperation>('outbox')).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)),
  createCustomer:(input:LocalCustomerInput,operationId:string)=>write('create',null,input,null,operationId),
  updateCustomer:(id:string,input:LocalCustomerInput,expectedRevision:string,operationId:string)=>write('update',id,input,expectedRevision,operationId),
  /** Export only unsynced synthetic draft data in this isolated prototype.
   * No active sync or import; backup is not encrypted and must be secured by owner. */
  exportSnapshot:async()=>{check();return {format:FORMAT,namespace,customers:await readAll<LocalCustomer>('customers'),pending:await readAll<LocalCustomerOperation>('outbox'),encrypted:false,serverConfirmed:false};},
 };
}
