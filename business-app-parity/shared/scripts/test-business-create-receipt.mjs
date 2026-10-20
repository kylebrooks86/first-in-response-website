/** Opaque-only pending create receipts, offline/restart recovery, storage refusal. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const script=ts.transpileModule(readFileSync('lib/business-create-receipt.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const globals={exports:{}};
vm.runInNewContext(script,globals);
const {readBusinessReceipt,reserveBusinessReceipt,releaseBusinessReceipt}=globals.exports;
let checks=0;const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
const key='fire:business:task:create-request:v1';
const storage=()=>{const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const task='10000000-0000-4000-8000-000000000001',expense='10000000-0000-4000-8000-000000000002';
const other='10000000-0000-4000-8000-000000000003';
{
 const store=storage();
 eq(readBusinessReceipt(store,'task').requestId,null,'No receipt until first operation');
 eq(readBusinessReceipt(store,'task').usable,true,'Available empty storage is usable');
 eq(reserveBusinessReceipt(store,'task',task),true,'First task receipt saved before any write');
 eq(store.data.size,1,'Only one key stored');
 eq(store.data.get(key),task,'Storage contains opaque UUID only');
 eq(reserveBusinessReceipt(store,'task',task),true,'Same ID is safe for deliberate retry');
 eq(reserveBusinessReceipt(store,'task',other),false,'Different request cannot replace unresolved receipt');
 eq(store.data.get(key),task,'Original recovery request remains intact');
 eq(reserveBusinessReceipt(store,'expense',expense),true,'Expense has separate recovery receipt');
 eq(store.data.size,2,'Receipt kinds are separate');
 eq(readBusinessReceipt(store,'expense').requestId,expense,'Expense persists across simulated component restart');
 eq(releaseBusinessReceipt(store,'task',other),false,'Unrelated completion cannot clear a receipt');
 eq(releaseBusinessReceipt(store,'task',task),true,'Matched task confirmation clears its receipt');
 eq(readBusinessReceipt(store,'task').requestId,null,'Task receipt is gone after verified release');
 eq(readBusinessReceipt(store,'expense').requestId,expense,'Task release does not affect pending expense');
 eq(releaseBusinessReceipt(store,'expense',expense),true,'Expense receipt can be released');
 eq(store.data.size,0,'No customer or task details retained');
}
for(const bad of ['not-uuid','10000000-0000-1000-8000-000000000001','',JSON.stringify({email:'no@example.test'}),'10000000-0000-4000-0000-000000000001']){
 const store=storage();store.setItem(key,bad);
 eq(readBusinessReceipt(store,'task').usable,false,'Corrupt persisted receipt blocks writes');
 eq(reserveBusinessReceipt(store,'task',task),false,'Corrupt receipt cannot silently be overwritten');
 eq(store.getItem(key),bad,'Corrupt receipt is preserved for owner review');
}
{
 const failStorage={getItem:()=>{throw Error('Browser storage blocked');},setItem:()=>{throw Error('Browser storage blocked');},removeItem:()=>{throw Error('Browser storage blocked');}};
 eq(readBusinessReceipt(undefined,'task').usable,false,'Absent browser storage blocks writes');
 eq(reserveBusinessReceipt(undefined,'task',task),false,'Missing storage cannot authorize a POST');
 eq(readBusinessReceipt(failStorage,'task').usable,false,'Unavailable storage is handled safely');
 eq(reserveBusinessReceipt(failStorage,'task',task),false,'Storage exception cannot silently authorize');
 eq(releaseBusinessReceipt(failStorage,'task',task),false,'Storage exception cannot claim the receipt was cleared');
}
{
 const store=storage();
 eq(reserveBusinessReceipt(store,'task','invalid'),false,'Invalid proposed operation ID is rejected');
 const blocked={...store,setItem:()=>{throw Error('quota');}};
 eq(reserveBusinessReceipt(blocked,'task',task),false,'Quota error refuses request before POST');
 eq(store.getItem(key),null,'Failed storage write leaves no false receipt');
}
console.log('PASS '+checks+'/'+checks+': opaque-only browser receipts persist across restart, never overwrite pending IDs, reject missing/corrupt storage. No PII saved.');
