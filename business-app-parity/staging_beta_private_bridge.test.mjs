// Offline one-shot STAGING beta private-bridge safety regression.
// All provider requests use injected in-memory Responses. No Cloudflare call,
// DPAPI, credentials, upload or activation occurs in this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {createPrivateReaders,createReservation} from './staging_beta_private_bridge.mjs';

const fakeToken='T'.repeat(40);
const oldVersion='7838d0ea-be89-49c6-9984-d3b021082d72';
const alternateVersion='a1b2c3d4-1111-4222-8333-aaaabbbbcccc';
const result = value => new Response(JSON.stringify({success:true,errors:[],result:value}),{
  status:200,headers:{'content-type':'application/json'}
});
const serving = () => ({deployments:[{id:PIN.deployment,versions:[
  {version_id:PIN.version,percentage:100}]}]});
const olderListing = () => ({items:[{id:oldVersion,metadata:{
  created_on:'2026-11-24T22:00:00Z'}}]});
function mockTransport(makeReply) {
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    return makeReply(url,options);
  };
  return {calls,fetchImpl};
}
function inspectOnlyGet(call) {
  assert.equal(call.options.method,'GET');
  assert.equal(call.options.redirect,'error');
  assert.equal(call.options.cache,'no-store');
  assert.equal(call.options.headers.Authorization,'Bearer '+fakeToken);
  assert.equal(call.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'),true);
  assert.equal(call.url.includes('/workers/scripts/'+PIN.worker+'/'),true);
  assert.equal(call.options.body,undefined);
}
test('readServing validates exact predecessor and makes GET only',async()=>{
  const t=mockTransport(url=>{
    assert.match(url,/\/deployments\?page=1&per_page=1$/);
    return result(serving());
  });
  const r=createPrivateReaders(fakeToken,t.fetchImpl);
  const observed=await r.readServing();
  assert.equal(observed.workerId,PIN.workerId);
  assert.equal(observed.deployment,PIN.deployment);
  assert.equal(observed.version,PIN.version);
  assert.equal(observed.percentage,100);
  assert.equal(t.calls.length,1);
  inspectOnlyGet(t.calls[0]);
  assert.equal(JSON.stringify(observed).includes(fakeToken),false);
});
test('readServing stops on a different live version or traffic split',async()=>{
  for(const changed of [
    {version_id:alternateVersion,percentage:100},
    {version_id:PIN.version,percentage:99}
  ]){
    const t=mockTransport(()=>result({deployments:[{id:PIN.deployment,versions:[changed]}]}));
    await assert.rejects(createPrivateReaders(fakeToken,t.fetchImpl).readServing(),
      /STAGING_PRIVATE_BRIDGE_STOP_DRIFT/);
    assert.equal(t.calls.length,1);
    inspectOnlyGet(t.calls[0]);
  }
});
test('duplicate scan honors existing baseline and never sends provider writes',async()=>{
  const t=mockTransport(url=>{
    assert.match(url,/\/versions\?page=1&per_page=100$/);
    return result(olderListing());
  });
  assert.equal(await createPrivateReaders(fakeToken,t.fetchImpl).verifyNoDuplicate(),true);
  assert.equal(t.calls.length,1);
  inspectOnlyGet(t.calls[0]);
});
test('duplicate admin-hash or Stripe-disabled version STOPs before upload',async()=>{
  for(const name of ['FIRE_ADMIN_PASSWORD_HASH','FIRE_STRIPE_MODE']){
    const t=mockTransport(url=>{
      if(url.endsWith('/versions?page=1&per_page=100'))
        return result({items:[{id:alternateVersion,metadata:{created_on:'2026-11-25T23:00:00Z'}}]});
      if(url.endsWith('/versions/'+alternateVersion))
        return result({id:alternateVersion,resources:{bindings:[{name,type:'secret_text'}]}});
      throw Error('Unexpected provider URL');
    });
    await assert.rejects(createPrivateReaders(fakeToken,t.fetchImpl).verifyNoDuplicate(),
      /STAGING_PRIVATE_BRIDGE_STOP_POSSIBLE_DUPLICATE/);
    assert.equal(t.calls.length,2);
    t.calls.forEach(inspectOnlyGet);
  }
});
test('duplicate scan rejects missing version history and malformed replies',async()=>{
  for(const payload of [{success:false,errors:[],result:{}},
    {success:true,errors:[{code:1}],result:{}},
    {success:true,errors:[],result:{items:'not-an-array'}}]){
    const t=mockTransport(()=>new Response(JSON.stringify(payload),{status:200}));
    await assert.rejects(createPrivateReaders(fakeToken,t.fetchImpl).verifyNoDuplicate(),
      /STAGING_PRIVATE_BRIDGE_STOP_/);
    assert.equal(t.calls.length,1);
    inspectOnlyGet(t.calls[0]);
  }
});
test('strict token and response size cap fail closed without exposing bytes',async()=>{
  assert.throws(()=>createPrivateReaders('short',async()=>result(serving())),
    /STAGING_PRIVATE_BRIDGE_STOP_TOKEN/);
  const t=mockTransport(()=>new Response('X'.repeat(524300),{status:200}));
  await assert.rejects(createPrivateReaders(fakeToken,t.fetchImpl).readServing(),
    /STAGING_PRIVATE_BRIDGE_STOP_BODY/);
  assert.equal(t.calls.length,1);
  inspectOnlyGet(t.calls[0]);
});
test('one-shot private reservation never resets consumed historical locks',()=>{
  const folder=mkdtempSync(join(tmpdir(),'fire-staging-one-shot-'));
  const oldLocks=['g404-one-inactive-version-attempt-20261122.lock',
    'g404-new-inactive-version-attempt-20261123.lock'];
  const nextLock='g404-new-inactive-version-attempt-20261125-reviewed.lock';
  const intent={workerId:PIN.workerId,predecessor:PIN.version,
    activation:false,stripeMode:'disabled',receiptPin:'a'.repeat(64)};
  try {
    for(const lock of oldLocks)writeFileSync(join(folder,lock),'HISTORICAL CONSUMED',{mode:0o600});
    const reserve=createReservation(folder);
    assert.equal(reserve(intent),true);
    assert.equal(existsSync(join(folder,nextLock)),true);
    assert.match(readFileSync(join(folder,nextLock),'utf8'),/"reserved":true/);
    assert.throws(()=>reserve(intent),/STAGING_PRIVATE_BRIDGE_STOP_RESERVATION_NO_RETRY/);
    for(const lock of oldLocks)
      assert.equal(readFileSync(join(folder,lock),'utf8'),'HISTORICAL CONSUMED');
    assert.throws(()=>reserve({...intent,activation:true}),
      /STAGING_PRIVATE_BRIDGE_STOP_INTENT/);
  } finally {rmSync(folder,{force:true,recursive:true});}
});
