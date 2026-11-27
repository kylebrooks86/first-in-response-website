import {protectPrivateDeviceJournal,recoverPrivateDeviceJournal} from './local-customer-backup';

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
export type LocalCustomerSnapshot={format:string;namespace:string;customers:LocalCustomer[];pending:LocalCustomerOperation[];receipts:Receipt[];encrypted:false;serverConfirmed:false};
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
 const core = {
  namespace,close,
  getCustomer:(id:string)=>readOne<LocalCustomer>('customers',id),
  listCustomers:async()=>(await readAll<LocalCustomer>('customers')).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),
  listPending:async()=>(await readAll<LocalCustomerOperation>('outbox')).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)),
  createCustomer:(input:LocalCustomerInput,operationId:string)=>write('create',null,input,null,operationId),
  updateCustomer:(id:string,input:LocalCustomerInput,expectedRevision:string,operationId:string)=>write('update',id,input,expectedRevision,operationId),
  /** One readonly IndexedDB snapshot; customers, pending operations and their
   * idempotency receipts are captured together, never across drifting reads.
   * This prototype is PLAINTEXT and for synthetic local testing only. */
  exportSnapshot:():Promise<LocalCustomerSnapshot>=>{
   check();
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['customers','operations','outbox'],'readonly');
    const customers=tx.objectStore('customers').getAll(),receipts=tx.objectStore('operations').getAll(),pending=tx.objectStore('outbox').getAll();
    tx.oncomplete=()=>resolve({format:FORMAT,namespace,customers:customers.result as LocalCustomer[],pending:pending.result as LocalCustomerOperation[],receipts:receipts.result as Receipt[],encrypted:false,serverConfirmed:false});
    tx.onabort=()=>reject(tx.error??Error('Local customer snapshot was interrupted.'));
   });
  },
  /** Guarded synthetic-only recovery. A restore requires the *same* owner/target
   * namespace and all three stores empty. No merges, remote writes, or payments.
   * Validate all operation ancestry and receipt fingerprints BEFORE writing. */
  restoreSnapshot:async(snapshot:unknown):Promise<{customers:number;pending:number}>=>{
   check();
   const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
   const exact=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).length===keys.length&&Object.keys(x).every(key=>keys.includes(key));
   const timestamp=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
   const same=(a:LocalCustomer,b:LocalCustomer)=>Object.keys(a).every(key=>a[key as keyof LocalCustomer]===b[key as keyof LocalCustomer]);
   const validCustomer=(x:unknown):x is LocalCustomer=>{
    if(!object(x)||!exact(x,['id','name','email','phone','address','revision','createdAt','updatedAt'])||!validKey(x.id as string)||!validKey(x.revision as string)||!timestamp(x.createdAt)||!timestamp(x.updatedAt)||Date.parse(x.createdAt as string)>Date.parse(x.updatedAt as string))return false;
    try{const normalized=fields(x as unknown as LocalCustomerInput);return Object.keys(normalized).every(k=>x[k]===normalized[k as keyof typeof normalized]);}catch{return false;}
   };
   if(!object(snapshot)||!exact(snapshot,['format','namespace','customers','pending','receipts','encrypted','serverConfirmed'])||snapshot.format!==FORMAT||snapshot.namespace!==namespace||snapshot.encrypted!==false||snapshot.serverConfirmed!==false||!Array.isArray(snapshot.customers)||!Array.isArray(snapshot.pending)||!Array.isArray(snapshot.receipts)||snapshot.customers.length>10000||snapshot.pending.length>20000||snapshot.receipts.length>20000)
    throw Error('Local backup format, account, target or safety flags do not match. No records restored.');
   const customers=snapshot.customers as unknown[],pending=snapshot.pending as unknown[],receipts=snapshot.receipts as unknown[];
   if(!customers.every(validCustomer))throw Error('Local backup contains invalid customer records.');
   const byCustomer=new Map((customers as LocalCustomer[]).map(row=>[row.id,row]));
   if(byCustomer.size!==customers.length||pending.length!==receipts.length)throw Error('Local backup has duplicate customers or incomplete operation receipts.');
   const byReceipt=new Map<string,Receipt>();
   for(const candidate of receipts){
    if(!object(candidate)||!exact(candidate,['id','fingerprint','customer'])||!validOperation(candidate.id as string)||typeof candidate.fingerprint!=='string'||!validCustomer(candidate.customer)||byReceipt.has(candidate.id as string))throw Error('Local backup contains invalid or duplicate receipts.');
    byReceipt.set(candidate.id as string,candidate as Receipt);
   }
   const byOperation=new Map<string,LocalCustomerOperation>(),byCustomerOperations=new Map<string,LocalCustomerOperation[]>();
   for(const candidate of pending){
    if(!object(candidate)||!exact(candidate,['id','action','customerId','customer','at','expectedRevision'])||!validOperation(candidate.id as string)||(candidate.action!=='create'&&candidate.action!=='update')||!validKey(candidate.customerId as string)||!validCustomer(candidate.customer)||candidate.customerId!==(candidate.customer as LocalCustomer).id||!timestamp(candidate.at)||candidate.at!==(candidate.customer as LocalCustomer).updatedAt||(candidate.action==='create'?candidate.expectedRevision!==null:!validKey(candidate.expectedRevision as string))||byOperation.has(candidate.id as string)||!byCustomer.has(candidate.customerId as string))
     throw Error('Local backup contains invalid or orphaned pending operations.');
    const op=candidate as LocalCustomerOperation,receipt=byReceipt.get(op.id);
    if(!receipt||!same(receipt.customer,op.customer)||receipt.fingerprint!==JSON.stringify([op.action,op.action==='create'?null:op.customerId,fields(op.customer),op.expectedRevision]))throw Error('Local backup operation receipt or fingerprint does not match.');
    byOperation.set(op.id,op);
    byCustomerOperations.set(op.customerId,[...(byCustomerOperations.get(op.customerId)??[]),op]);
   }
   if(byOperation.size!==byReceipt.size)throw Error('Local backup contains unused receipts.');
   for(const customer of byCustomer.values()){
    const operations=byCustomerOperations.get(customer.id)??[];
    const creates=operations.filter(op=>op.action==='create');
    if(creates.length!==1)throw Error('Local backup customer has no unique create operation.');
    let state=creates[0].customer,used=1;
    while(true){
     const successors=operations.filter(op=>op.action==='update'&&op.expectedRevision===state.revision);
     if(successors.length>1)throw Error('Local backup contains conflicting customer edits.');
     if(!successors.length)break;
     state=successors[0].customer;used++;if(used>operations.length)throw Error('Local backup edit history contains a cycle.');
    }
    if(used!==operations.length||!same(state,customer))throw Error('Local backup final revision does not match pending history.');
   }
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['customers','operations','outbox'],'readwrite');
    const names=['customers','operations','outbox'] as const;
    let checked=0,problem:Error|undefined;
    const abort=(why:string)=>{problem=Error(why);try{tx.abort();}catch{/* Completed or already aborted. */}};
    for(const name of names){
     const count=tx.objectStore(name).count();
     count.onsuccess=()=>{
      if(count.result!==0){abort('Restore requires an empty local store. Existing customer drafts were not changed.');return;}
      if(++checked!==names.length)return;
      try{
       for(const row of customers)tx.objectStore('customers').add(row);
       for(const row of receipts)tx.objectStore('operations').add(row);
       for(const row of pending)tx.objectStore('outbox').add(row);
      }catch{abort('Local restore failed. Nothing was imported.');}
     };
    }
    tx.oncomplete=()=>resolve({customers:customers.length,pending:pending.length});
    tx.onabort=()=>reject(problem??tx.error??Error('Local restore interrupted. Existing records unchanged.'));
   });
  },
 };
 /** Portable archive protection for this isolated synthetic prototype.
  * Encryption protects EXPORTED bytes only; the IndexedDB prototype is still
  * plaintext and MUST NOT be wired to real customer screens or automatic sync.
  * Reuse the existing account/target and full atomic restore validation. */
 const verifyArchive=(value:unknown):LocalCustomerSnapshot=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid local customer archive.');
  const item=value as Partial<LocalCustomerSnapshot>;
  if(item.format!==FORMAT||item.namespace!==namespace||item.encrypted!==false||item.serverConfirmed!==false)
   throw Error('Local customer archive does not match this owner or deployment.');
  return value as LocalCustomerSnapshot;
 };
 return {
  ...core,
  exportEncryptedSnapshot:async(phrase:string)=>protectPrivateDeviceJournal(await core.exportSnapshot(),phrase,verifyArchive),
  restoreEncryptedSnapshot:async(archive:unknown,phrase:string)=>core.restoreSnapshot(await recoverPrivateDeviceJournal(archive,phrase,verifyArchive)),
 };
}
