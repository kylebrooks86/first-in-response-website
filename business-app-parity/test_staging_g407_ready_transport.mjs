// Offline transport regression using the actual sealed owner package. No real network.
import assert from 'node:assert/strict';
import {runOnce,syntheticPredecessor,SOURCE} from './staging_g407_ready_once.mjs';
import {PIN} from './staging_g407_upload_body.mjs';
const folder=process.argv[2];
assert.ok(folder);
globalThis.fetch=()=>{throw Error('REAL_NETWORK_FORBIDDEN')};
const base='https://api.cloudflare.com/client/v4/accounts/bfc00939cfb2f8dfd8581a7a7f5f1307/workers/';
const script='scripts/'+PIN.worker;
const newId='11111111-2222-4333-8444-555555555555';
const reply=result=>new Response(JSON.stringify({success:true,result}),{status:200});
function fixture(kind){
 let posts=0,reserves=0,reads=0;
 const fake=async(url,opts)=>{
  assert.ok(url.startsWith(base));
  const p=url.slice(base.length);
  if(opts.method==='POST'){
   posts++;assert.equal(reserves,1);assert.equal(posts,1);
   assert.equal(p,'workers/'+PIN.workerId+'/versions?deploy=false');
   const b=JSON.parse(opts.body);assert.equal(b.modules.length,242);
   assert.equal(b.bindings.length,8);
   assert.deepEqual(b.bindings.filter(x=>x.type==='inherit').map(x=>x.version_id),Array(3).fill(SOURCE));
   assert.equal(b.bindings.find(x=>x.name==='DB').id,PIN.db);
   assert.equal(b.bindings.find(x=>x.name==='FIRE_STRIPE_MODE').text,'disabled');
   assert.equal(b.bindings.find(x=>x.name==='FIRE_STAGING_PRIVATE_ACTIVATION').text,'owner-approved');
   assert.ok(!b.bindings.some(x=>x.type==='secret_text'));
   if(kind==='refusal')return new Response(JSON.stringify({success:false,errors:[{code:10000}]}),{status:403});
   if(kind==='network')throw Error('simulated network failure');
   return reply({id:newId});
  }
  assert.equal(opts.method,'GET');
  if(p==='workers/'+PIN.worker)return reply({id:kind==='wrong-worker'?'wrong':PIN.workerId,name:PIN.worker});
  if(p===script+'/subdomain')return reply({enabled:true,previews_enabled:kind==='preview'});
  if(p===script+'/deployments?page=1&per_page=1'){
   reads++;return reply({deployments:[{id:PIN.deployment,versions:[{version_id:kind==='drift'&&reads===2?newId:PIN.version,percentage:100}]}]});
  }
  if(p===script+'/versions?page=1&per_page=10')return reply({items:[{id:kind==='newer'?newId:SOURCE}]});
  if(p===script+'/versions/'+PIN.version){
   const v=syntheticPredecessor();
   if(kind==='wrong-db')v.resources.bindings.find(x=>x.name==='DB').id='wrong';
   return reply(v);
  }
  if(p===script+'/versions/'+SOURCE){
   const v=syntheticPredecessor();v.id=SOURCE;
   v.resources.bindings.find(x=>x.name==='FIRE_STAGING_PRIVATE_ACTIVATION').text=kind==='source-not-dark'?'owner-approved':'blocked';
   return reply(v);
  }
  if(p===script+'/versions/'+newId){
   const v=syntheticPredecessor();v.id=newId;
   v.resources.bindings.find(x=>x.name==='FIRE_STAGING_PRIVATE_ACTIVATION').text=kind==='post-dark'?'blocked':'owner-approved';
   if(kind==='post-bindings')v.resources.bindings.find(x=>x.name==='FIRE_STRIPE_MODE').text='test';
   return reply(v);
  }
  assert.fail('unexpected mock path '+p);
 };
 return {args:{folder,token:'offline-synthetic-token-only',consent:kind==='consent'?'wrong':'7221855040',reserve:async()=>{reserves++;return kind!=='spent'},fetchImpl:fake},counts:()=>({posts,reserves})};
}
for(const [kind,pattern,posts,reserves] of [
 ['consent',/CONSENT/,0,0],['wrong-worker',/WORKER_ID/,0,0],['preview',/INGRESS/,0,0],
 ['newer',/UNEXPECTED_NEWER_VERSION/,0,0],['wrong-db',/DB/,0,0],
 ['source-not-dark',/VARIABLE/,0,0],['post-dark',/READY_FLAG/,1,1],['drift',/SERVING_DRIFT/,0,0],['spent',/LOCK_SPENT/,0,1],
 ['refusal',/HTTP_403.*NO_RETRY/,1,1],['network',/NETWORK_UNCERTAIN_NO_RETRY/,1,1],
 ['post-bindings',/VARIABLE/,1,1]]){
 const f=fixture(kind);await assert.rejects(runOnce(f.args),pattern);assert.deepEqual(f.counts(),{posts,reserves});
}
const f=fixture('success');const result=await runOnce(f.args);
assert.equal(result.newVersion,newId);assert.equal(result.activated,false);assert.equal(result.servingTraffic,100);
assert.deepEqual(f.counts(),{posts:1,reserves:1});
console.log('G407_READY_TRANSPORT_OFFLINE_PASS cases=13 real_network=0');
