import assert from 'node:assert/strict';
import {PINS,bindings} from './g401_dark_release_review.mjs';
import {TARGETS,phrase,switchTraffic} from './g401_dark_traffic_once.mjs';
let cases=0;
for(const target of Object.keys(TARGETS)){
 const p=PINS[target],s=TARGETS[target],old=s.deployment??'11111111-1111-4111-8111-111111111111',next='22222222-2222-4222-8222-222222222222';
 for(const fault of [null,'reply-shape','lost-ack','approval','ingress','bindings','rollback','drift','lock','no-switch']){
  let posts=0,reads=0,locked=false,switched=false;
  const fetchImpl=async(url,opts)=>{
   let result;
   if(opts.method==='POST'){
    posts++;assert.ok(locked);assert.ok(url.endsWith('/scripts/'+p.worker+'/deployments'));
    assert.deepEqual(JSON.parse(opts.body),{strategy:'percentage',versions:[{version_id:s.next,percentage:100}]});
    switched=fault!=='no-switch';
    if(fault==='lost-ack')throw Error('lost response');
    result=fault==='reply-shape'?{id:next}:{id:next,versions:[{version_id:s.next,percentage:100}]};
   }else{
    assert.equal(opts.method,'GET');
    if(url.endsWith('/subdomain'))result={enabled:fault==='ingress',previews_enabled:false};
    else if(url.includes('/deployments?')){
     reads++;
     result={deployments:[{id:switched||fault==='drift'&&reads===2?next:old,versions:[{version_id:switched?s.next:p.version,percentage:100}]}]};
    }else if(url.includes('/versions?'))result={items:[{id:s.next}]};
    else if(url.endsWith('/versions/'+s.older))result={id:fault==='rollback'?'wrong':s.older};
    else if(url.endsWith('/versions/'+s.next)||url.endsWith('/versions/'+p.version)){
     result={id:url.split('/').at(-1),resources:{bindings:bindings(target)}};
     if(fault==='bindings')result.resources.bindings[0].id='wrong';
    }else result={id:s.workerId,name:p.worker};
   }
   return {ok:true,json:async()=>({success:true,result})};
  };
  const promise=switchTraffic({target,token:'synthetic-only-token-12345',approval:fault==='approval'?'bad':phrase(target),reserve:async()=>{locked=true;return fault!=='lock'},fetchImpl});
  if([null,'reply-shape','lost-ack'].includes(fault)){
   const r=await promise;assert.equal(r.servingVersion,s.next);assert.equal(r.publicLaunch,false);assert.equal(r.traffic,100);assert.equal(posts,1);
  }else{
   await assert.rejects(promise,/G401_(TRAFFIC_)?STOP_/);
   assert.equal(posts,fault==='no-switch'?1:0);
  }
  cases++;
 }
}
console.log('G401_DARK_TRAFFIC_OFFLINE_PASS cases='+cases+' real_network=0');
