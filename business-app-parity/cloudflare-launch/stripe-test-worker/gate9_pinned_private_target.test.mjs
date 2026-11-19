import test from 'node:test';
import assert from 'node:assert/strict';
import {
 FIRE_CF_ACCOUNT_ID,FIRE_CF_WORKER_ID,FIRE_CF_ACCESS_APP_ID,
 requirePinnedFireCloudflareTarget,createPinnedFireGate9ReadOnlyApi,
 createPinnedFireGate9PrivateTransport
} from './gate9_pinned_private_target.mjs';
import {WORKER,PREDECESSOR,DB_UUID} from './gate9_inactive_fullapp_contract.mjs';
const fixed=()=>({accountId:FIRE_CF_ACCOUNT_ID,workerName:WORKER,
  workerId:FIRE_CF_WORKER_ID,d1Id:DB_UUID,activeVersion:PREDECESSOR});
test('source-pinned TEST account/Worker/Access identities never confuse separate UUIDs',()=>{
 assert.match(FIRE_CF_ACCOUNT_ID,/^[a-f0-9]{32}$/);
 assert.match(FIRE_CF_WORKER_ID,/^[a-f0-9]{32}$/);
 assert.match(FIRE_CF_ACCESS_APP_ID,/^[a-f0-9-]{36}$/);
 assert.notEqual(FIRE_CF_ACCOUNT_ID,FIRE_CF_WORKER_ID);
 assert.notEqual(FIRE_CF_WORKER_ID,DB_UUID);
 assert.equal(requirePinnedFireCloudflareTarget(fixed()),true);
});
test('rejects wrong Cloudflare account, Worker, Worker ID, D1 or active predecessor',()=>{
 for(const [key,replacement] of [
  ['accountId','f'.repeat(32)],['workerName','LIVE'],
  ['workerId','e'.repeat(32)],
  ['d1Id','11111111-2222-4333-8444-555555555555'],
  ['activeVersion','11111111-2222-4333-8444-555555555555']
 ]){
  const o=fixed();o[key]=replacement;
  assert.throws(()=>requirePinnedFireCloudflareTarget(o));
 }
});
test('read-only pinned adapter contains no write API and causes no browser/API calls at construction',()=>{
 let n=0;
 const a=createPinnedFireGate9ReadOnlyApi({
   tokenProvider:async()=>{n++;return 'SYNTHETIC_TOKEN_LONG_ENOUGH';},
   fetchImpl:async()=>{n++;throw Error('NEVER_RUN');}
 });
 assert.equal(Object.hasOwn(a,'request'),false);
 assert.equal(n,0);
});
test('private write transport requires out-of-band permission function and actual compiled assets',()=>{
 assert.throws(()=>createPinnedFireGate9PrivateTransport({
   tokenProvider:async()=>{},
   fetchImpl:async()=>{},
   permissionGate:null,
   clientDir:'/does/not/exist',
   approvedManifest:{}
 }));
});
