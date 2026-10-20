/** Only an opaque operation ID is stored. No task, customer, expense or payment content. */
export type BusinessCreateKind="task"|"expense";
export type BusinessReceipt={requestId:string|null;usable:boolean};
const receiptKey=(kind:BusinessCreateKind)=>"fire:business:"+kind+":create-request:v1";
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ReceiptRead=Pick<Storage,"getItem">;
type ReceiptWrite=Pick<Storage,"getItem"|"setItem">;
type ReceiptDelete=Pick<Storage,"getItem"|"removeItem">;
export function businessReceiptStorage():Storage|undefined{
 try{return typeof window==="undefined"?undefined:window.localStorage;}catch{return undefined;}
}
export function readBusinessReceipt(storage:ReceiptRead|undefined,kind:BusinessCreateKind):BusinessReceipt{
 if(!storage)return {requestId:null,usable:false};
 try{
  const raw=storage.getItem(receiptKey(kind));
  if(raw===null)return {requestId:null,usable:true};
  return uuidV4.test(raw)?{requestId:raw,usable:true}:{requestId:null,usable:false};
 }catch{return {requestId:null,usable:false};}
}
export function reserveBusinessReceipt(storage:ReceiptWrite|undefined,kind:BusinessCreateKind,id:string):boolean{
 if(!uuidV4.test(id))return false;
 const current=readBusinessReceipt(storage,kind);
 if(!current.usable||(current.requestId&&current.requestId!==id))return false;
 try{storage!.setItem(receiptKey(kind),id);return storage!.getItem(receiptKey(kind))===id;}catch{return false;}
}
export function releaseBusinessReceipt(storage:ReceiptDelete|undefined,kind:BusinessCreateKind,id:string):boolean{
 if(!uuidV4.test(id)||readBusinessReceipt(storage,kind).requestId!==id)return false;
 try{storage!.removeItem(receiptKey(kind));return storage!.getItem(receiptKey(kind))===null;}catch{return false;}
}
