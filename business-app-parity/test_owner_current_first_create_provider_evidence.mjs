/** Exact Cloudflare provider-evidence validation using DISPOSABLE replies ONLY.
 * No network, real credential, Worker, D1 operation or owner intervention.
 */
import assert from 'node:assert/strict';
import {
 verifyOwnerAccountReadback,verifyPhysicalD1InfoReadback,
 verifyNewWorkerAbsentReadback,verifyCreatedWorkerListReadback
} from './owner_current_first_create_provider_evidence.mjs';
let count=0;
const pass=(x,label)=>{assert.ok(x,label);count++};
const deny=(fn,label)=>{assert.throws(fn,/FIRE OWNER FIRST-CREATE EVIDENCE BLOCKED/,label);count++};
const wrap=(obj,code=0)=>({code,stdout:JSON.stringify(obj),stderr:''});
const acc='bfc00939cfb2f8dfd8581a7a7f5f1307';
const elsewhere='bfc00939cfb2f8dfd8581a7a7f5f1308';
const dbName='fire-fullapp-dr-db',dbId='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const ver='639571a9-ff93-4fad-b661-914dde8cc7b2';
pass(verifyOwnerAccountReadback(wrap({loggedIn:true,accounts:[{id:elsewhere},{id:acc}]}),acc).ownerMembershipConfirmed,'exact account membership accepted');
deny(()=>verifyOwnerAccountReadback(wrap({loggedIn:false,accounts:[{id:acc}]}),acc),'signed-out false denied');
deny(()=>verifyOwnerAccountReadback(wrap({accounts:[{id:acc}]}),acc),'missing loggedIn flag denied');
deny(()=>verifyOwnerAccountReadback(wrap({loggedIn:true,accounts:[{id:elsewhere}]}),acc),'wrong account denied');
deny(()=>verifyOwnerAccountReadback(wrap({loggedIn:true,accounts:[{id:acc},{id:acc}]}),acc),'duplicate account evidence refused');
deny(()=>verifyOwnerAccountReadback(wrap({loggedIn:true,accounts:[]}),acc),'empty memberships refused');
deny(()=>verifyOwnerAccountReadback(wrap({loggedIn:true,accounts:[{name:acc}]}),acc),'account ID in display name refused');
deny(()=>verifyOwnerAccountReadback({code:0,stdout:'{"loggedIn":true,"accounts":[]}\n'+acc,stderr:''},acc),'nonJSON/stdout injected ID refused');
deny(()=>verifyOwnerAccountReadback({code:1,stdout:JSON.stringify({loggedIn:true,accounts:[{id:acc}]}),stderr:''},acc),'failure exit cannot be success');
deny(()=>verifyOwnerAccountReadback({code:0,stdout:'{"loggedIn":true}',stderr:'membership: '+acc},acc),'stderr spoofed account not accepted');

pass(verifyPhysicalD1InfoReadback(wrap({name:dbName,uuid:dbId}),dbName,dbId).physicalD1Confirmed,'exact physical D1 matched');
pass(verifyPhysicalD1InfoReadback(wrap({database_id:dbId,id:dbId}),dbName,dbId).physicalD1Confirmed,'equivalent explicit UUID aliases accepted');
deny(()=>verifyPhysicalD1InfoReadback(wrap({name:'opposite-db',uuid:dbId}),dbName,dbId),'different D1 name blocked');
deny(()=>verifyPhysicalD1InfoReadback(wrap({name:dbName,uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}),dbName,dbId),'opposite physical D1 UUID blocked');
deny(()=>verifyPhysicalD1InfoReadback(wrap({name:dbName,uuid:dbId,id:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}),dbName,dbId),'contradictory D1 fields blocked');
deny(()=>verifyPhysicalD1InfoReadback(wrap({name:dbName,other:dbId}),dbName,dbId),'D1 UUID in unknown field denied');
deny(()=>verifyPhysicalD1InfoReadback({code:0,stdout:JSON.stringify({uuid:dbId})+'\nNOTICE',stderr:''},dbName,dbId),'stdout diagnostic contamination denied');
deny(()=>verifyPhysicalD1InfoReadback({code:0,stdout:'{}',stderr:dbId},dbName,dbId),'stderr-only D1 UUID spoof refused');

const absent={code:1,stdout:'',stderr:'Error 10007: Worker does not exist (not found)'};
pass(verifyNewWorkerAbsentReadback(absent).exactWorkerAbsenceReported,'explicit Worker absent 10007 accepted');
deny(()=>verifyNewWorkerAbsentReadback({code:0,...absent,code:0}),'successful listing cannot prove absence');
deny(()=>verifyNewWorkerAbsentReadback({code:1,stdout:'',stderr:'Error 10007: invalid authorization'}),'10007 without absence refused');
deny(()=>verifyNewWorkerAbsentReadback({code:1,stdout:'',stderr:'Error 10000: Worker not found'}),'Worker not found without 10007 refused');
deny(()=>verifyNewWorkerAbsentReadback({code:1,stdout:'',stderr:'Permission denied'}),'auth failure is not absence');

pass(verifyCreatedWorkerListReadback(wrap([{id:ver}])).hostedVersionListReadback,'JSON version array confirms version listing');
pass(verifyCreatedWorkerListReadback(wrap({versions:[{version_id:ver}]})).hostedVersionListReadback,'named versions array accepted');
deny(()=>verifyCreatedWorkerListReadback(wrap([])),'empty version listing refused');
deny(()=>verifyCreatedWorkerListReadback(wrap([{version_id:'unsupported'}])),'nonUUID version refused');
deny(()=>verifyCreatedWorkerListReadback(wrap({versions:'version '+ver})),'unstructured output refused');
deny(()=>verifyCreatedWorkerListReadback({code:1,stdout:JSON.stringify([{id:ver}]),stderr:''}),'failure despite JSON refused');
console.log('PASS '+count+'/'+count+' owner first-create machine-readable Cloudflare account, D1, Worker-absent and postcreate version safety; synthetic only, NO PROVIDER.');
