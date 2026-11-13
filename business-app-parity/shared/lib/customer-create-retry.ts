export type CustomerCreateInput={name:string;email:string;phone:string;address:string;leadSource:string};
export type CreatedCustomer=CustomerCreateInput&{id:string;createdAt:string;estimateCount:number;estimateTotal:number;paidTotal:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const key='fire:customer-create-request:v1';
// Persist only the operation ID, never plaintext customer contact/form details.
export function loadCustomerCreateRequest(storage:Pick<Storage,'getItem'>|undefined){try{const id=storage?.getItem(key);return id&&uuid.test(id)?id:null;}catch{return null;}}
export function saveCustomerCreateRequest(storage:Pick<Storage,'getItem'|'setItem'>|undefined,id:string){
 if(!storage||!uuid.test(id))return false;
 try{const existing=loadCustomerCreateRequest(storage);if(existing&&existing!==id)return false;storage.setItem(key,id);return storage.getItem(key)===id;}catch{return false;}
}
export function clearCustomerCreateRequest(storage:Pick<Storage,'getItem'|'removeItem'>|undefined,id:string){try{if(storage?.getItem(key)===id)storage.removeItem(key);}catch{/* Preserve the recovery ID if browser storage is unavailable. */}}
// A non-sensitive, request-ID-only handoff remembers a deliberate Save & estimate
// after a lost acknowledgement or iPhone tab reload. It never persists contact
// details and cannot trigger a quote without an independently confirmed customer.
const estimateHandoffKey='fire:customer-create-estimate-handoff:v1';
export function loadCustomerEstimateHandoff(storage:Pick<Storage,'getItem'>|undefined,id:string){
 try{return uuid.test(id)&&loadCustomerCreateRequest(storage)===id&&storage?.getItem(estimateHandoffKey)===id;}catch{return false;}
}
export function saveCustomerEstimateHandoff(storage:Pick<Storage,'getItem'|'setItem'>|undefined,id:string){
 if(!storage||!uuid.test(id)||loadCustomerCreateRequest(storage)!==id)return false;
 try{storage.setItem(estimateHandoffKey,id);return loadCustomerEstimateHandoff(storage,id);}catch{return false;}
}
export function clearCustomerEstimateHandoff(storage:Pick<Storage,'getItem'|'removeItem'>|undefined,id:string){
 try{if(uuid.test(id)&&storage?.getItem(estimateHandoffKey)===id)storage.removeItem(estimateHandoffKey);}catch{/* The recovery marker is keyed to the original request; never clear another. */}
}
export function confirmedCreatedCustomer(value:unknown,id:string):CreatedCustomer|null{
 if(!value||typeof value!=='object'||!uuid.test(id))return null;
 const r=value as {requestId?:unknown;confirmed?:unknown;customer?:unknown};
 if(r.requestId!==id||r.confirmed!==true||!r.customer||typeof r.customer!=='object')return null;
 const c=r.customer as CreatedCustomer;
 if(c.id!==id||typeof c.name!=='string'||!c.name.trim()||!['email','phone','address','leadSource','createdAt'].every(k=>typeof c[k as keyof CreatedCustomer]==='string')||!Number.isFinite(Date.parse(c.createdAt))||![c.estimateCount,c.estimateTotal,c.paidTotal].every(Number.isSafeInteger)||c.estimateCount<0||c.estimateTotal<0)return null;
 return c;
}
export function sameCustomerCreateInput(customer:CustomerCreateInput,input:CustomerCreateInput){return (['name','email','phone','address','leadSource'] as const).every(k=>customer[k]===input[k]);}
