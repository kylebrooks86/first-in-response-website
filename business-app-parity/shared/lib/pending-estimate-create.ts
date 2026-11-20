/** Opaque-only browser marker for an unconfirmed new quote save.
 * Keep no customer details, money or service scope on the device.
 */
import {validEstimateCreateRequestId} from './estimate-create-idempotency';
export const PENDING_ESTIMATE_CREATE_KEY='fire:estimate:create-request:v1';
type ReadOnlyStore={getItem(key:string):string|null};
type WriteStore=ReadOnlyStore&{setItem(key:string,value:string):void};
type DeleteStore=ReadOnlyStore&{removeItem(key:string):void};
export function estimateCreateStorage():Storage|undefined{
 try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined;}
}
export function readPendingEstimateCreate(store:ReadOnlyStore|undefined):{usable:boolean;requestId:string|null}{
 if(!store)return {usable:false,requestId:null};
 try{const value=store.getItem(PENDING_ESTIMATE_CREATE_KEY);
  if(value===null)return {usable:true,requestId:null};
  return validEstimateCreateRequestId(value)?{usable:true,requestId:value}:{usable:false,requestId:null};
 }catch{return {usable:false,requestId:null};}
}
export function reservePendingEstimateCreate(store:WriteStore|undefined,requestId:string):boolean{
 if(!validEstimateCreateRequestId(requestId))return false;
 const state=readPendingEstimateCreate(store);
 if(!state.usable||(state.requestId&&state.requestId!==requestId))return false;
 try{store!.setItem(PENDING_ESTIMATE_CREATE_KEY,requestId);return store!.getItem(PENDING_ESTIMATE_CREATE_KEY)===requestId;}catch{return false;}
}
export function releasePendingEstimateCreate(store:DeleteStore|undefined,requestId:string):boolean{
 if(!validEstimateCreateRequestId(requestId)||readPendingEstimateCreate(store).requestId!==requestId)return false;
 try{store!.removeItem(PENDING_ESTIMATE_CREATE_KEY);return store!.getItem(PENDING_ESTIMATE_CREATE_KEY)===null;}catch{return false;}
}
