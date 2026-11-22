import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 evaluateDarkExposureEvidence,captureDarkExposure,FIRE_DARK_ACCOUNT
} from './owner_current_dark_exposure_readonly.mjs';
const success=result=>({success:true,errors:[],result});
const zone='a'.repeat(32),foreign='b'.repeat(32);
const clean=()=>({
 subdomain:success({enabled:false,previews_enabled:false}),
 domains:success([{service:'unrelated-worker',hostname:'example.org'}]),domainsComplete:true,
 zones:success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),zonesComplete:true,
 zoneRoutes:[{zoneId:zone,response:success([{pattern:'example.org/*',script:'unrelated-worker'}])}]
});
let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS',name)};
const blocked=(edit)=>{const x=clean();edit(x);assert.throws(()=>evaluateDarkExposureEvidence('new-live',x),/STOP/)};
test('empty-scope default runs offline, no Cloudflare token or calls',()=>{
 const file=fileURLToPath(new URL('./owner_current_dark_exposure_readonly.mjs',import.meta.url));
 const out=JSON.parse(execFileSync(process.execPath,[file],{encoding:'utf8'}));
 assert.equal(out.providerContacted,false);
});
test('complete clean inventory does not falsely accept gate4',()=>{
 const proof=evaluateDarkExposureEvidence('new-live',clean());
 assert.equal(proof.publicEndpointsAbsentInSuppliedEvidence,true);
 assert.equal(proof.providerReadbackVerified,false);
 assert.equal(proof.gate4Accepted,false);
});
test('workers.dev production exposure flagged',()=>{
 const x=clean();x.subdomain.result.enabled=true;
 assert.equal(evaluateDarkExposureEvidence('new-live',x).publicEndpointsAbsentInSuppliedEvidence,false);
});
test('workers.dev preview exposure flagged',()=>{
 const x=clean();x.subdomain.result.previews_enabled=true;
 assert.equal(evaluateDarkExposureEvidence('new-live',x).publicEndpointsAbsentInSuppliedEvidence,false);
});
test('target custom-domain attachment flagged',()=>{
 const x=clean();x.domains.result.push({service:'fire-fullapp-new-live'});
 assert.equal(evaluateDarkExposureEvidence('new-live',x).targetCustomDomains,1);
});
test('target zone route flagged',()=>{
 const x=clean();x.zoneRoutes[0].response.result.push({pattern:'foo.org/*',script:'fire-fullapp-new-live'});
 assert.equal(evaluateDarkExposureEvidence('new-live',x).targetZoneRoutes,1);
});
test('different target route is not falsely flagged',()=>{
 const x=clean();x.zoneRoutes[0].response.result.push({pattern:'foo.org/*',script:'fire-fullapp-new-live'});
 assert.equal(evaluateDarkExposureEvidence('dr',x).publicEndpointsAbsentInSuppliedEvidence,true);
});
test('missing zone route page rejected',()=>blocked(x=>{x.zoneRoutes=[]}));
test('duplicate routes / unrelated zone response rejected',()=>blocked(x=>{x.zoneRoutes.push(x.zoneRoutes[0])}));
test('foreign zone rejected',()=>blocked(x=>{x.zones.result[0].account.id=foreign}));
test('incomplete domain pagination rejected',()=>blocked(x=>{x.domainsComplete=false}));
test('incomplete zone inventory rejected',()=>blocked(x=>{x.zonesComplete=false}));
test('false Cloudflare API success rejected',()=>blocked(x=>{x.subdomain.success=false}));
test('missing preview field rejected',()=>blocked(x=>{delete x.subdomain.result.previews_enabled}));
test('unknown domain binding shape rejected',()=>blocked(x=>{x.domains.result[0]={hostname:'unknown'} }));
test('unknown route schema rejected',()=>blocked(x=>{x.zoneRoutes[0].response.result[0].script=13}));
const calls=[];
const mock=async(_token,path)=>{
 calls.push(path);
 if(path.endsWith('/subdomain'))return success({enabled:false,previews_enabled:false});
 if(path.includes('/workers/domains?'))return {...success([]),result_info:{page:1,per_page:50,count:0,total_pages:0,total_count:0}};
 if(path.includes('/zones?')&&path.includes('&type=internal'))
  return {...success([]),result_info:{page:1,per_page:50,count:0,total_pages:0,total_count:0}};
 if(path.includes('/zones?'))return {...success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),result_info:{page:1,per_page:50,count:1,total_pages:1,total_count:1}};
 if(path.endsWith('/workers/routes'))return success([]);
 throw Error('unexpected mock request '+path);
};
// Real owner readback: HTTP 200 / success:true / result[] / pagination may have
// errors:null or omit errors entirely. Accept these success-only shapes without
// relaxing failure, non-empty errors, or malformed error collection denials.
for(const errorsShape of ['null','omitted']){
 const proofShape=await captureDarkExposure('dr',{
  token:'synthetic-only',request:async (token,path)=>{
   const response=await mock(token,path);
   if(path.includes('/workers/domains?')){
    const altered={...response};
    if(errorsShape==='null')altered.errors=null;
    else delete altered.errors;
    return altered;
   }
   return response;
  }
 });
 assert.equal(proofShape.publicEndpointsAbsentInSuppliedEvidence,true);
 assert.equal(proofShape.providerReadbackVerified,false);
 assert.equal(proofShape.gate4Accepted,false);
}
for(const rejectedErrors of [[{code:1000,message:'provider error'}],{},'bad error container']){
 await assert.rejects(captureDarkExposure('dr',{
  token:'synthetic-only',request:async (token,path)=>{
   const response=await mock(token,path);
   return path.includes('/workers/domains?')?
    {...response,errors:rejectedErrors}:response;
  }
 }),/domains missing successful complete API response/);
}
console.log('PASS Cloudflare successful null/omitted errors accepted; nonempty/malformed errors refused');

// The preceding injected API-shape cases share the mock call recorder; clear
// only their call history before the existing exact five-GET sequence assertion.
calls.length=0;
const proof=await captureDarkExposure('new-live',{token:'synthetic-only',request:mock});
assert.equal(proof.providerReadbackVerified,false);
assert.equal(proof.publicEndpointsAbsentInSuppliedEvidence,true);
assert.equal(proof.gate4Accepted,false);
assert.equal(calls.length,5);
assert.ok(calls.every(p=>p.startsWith('/client/v4/')&&!/\b(post|put|delete)\b/i.test(p)));
assert.ok(calls.some(p=>p.startsWith('/client/v4/zones?account.id='+FIRE_DARK_ACCOUNT+'&page=1&per_page=50')),
  'All-zone account inventory must be queried without a type filter');
assert.equal(calls.filter(p=>p.startsWith('/client/v4/zones?')).length,2);
assert.ok(calls.some(p=>p.startsWith('/client/v4/zones?account.id='+FIRE_DARK_ACCOUNT+'&type=internal&page=1&per_page=50')),
  'Internal zones must be separately enumerated because an unfiltered zones GET excludes them');
assert.ok(calls.some(p=>p.startsWith('/client/v4/zones?account.id='+FIRE_DARK_ACCOUNT+'&page=1&per_page=50')),
  'Ordinary account zones must remain covered independently');
console.log('PASS ordinary and internal account zones enumerated separately; no missed internal route');
console.log('PASS five exact read-only GET mock calls; no paid API, auth or remote state');
const malformedCounts=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/zones?'))return {...result,result_info:{...result.result_info,count:0}};
 return result;
};
await assert.rejects(captureDarkExposure('new-live',{token:'synthetic-only',request:malformedCounts}),/page item-count mismatch/);
console.log('PASS mismatched provider page item count cannot certify absence');

const inconsistentEmpty=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/workers/domains?'))return {...result,result_info:{...result.result_info,count:1}};
 return result;
};
await assert.rejects(captureDarkExposure('new-live',{token:'synthetic-only',request:inconsistentEmpty}),/inconsistent zero-page inventory/);
console.log('PASS impossible zero-page inventory cannot certify absence');

const missingSecondPage=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/workers/domains?')&&path.includes('page=1'))
  return {...success([{service:'unrelated-worker',hostname:'safe.example'}]),
   result_info:{...result.result_info,total_pages:2,total_count:2,count:1}};
 if(path.includes('/workers/domains?')&&path.includes('page=2'))
  return {...result,result_info:{...result.result_info,page:2,total_pages:1,total_count:2,count:0}};
 return result;
};
await assert.rejects(captureDarkExposure('new-live',{token:'synthetic-only',request:missingSecondPage}),/changed between pages/);
console.log('PASS changing pagination cannot falsely certify absence');

const zeroZones=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/zones?'))return {...success([]),result_info:{page:1,per_page:50,count:0,total_pages:0,total_count:0}};
 return result;
};
const emptyZonesProof=await captureDarkExposure('new-live',{token:'synthetic-only',request:zeroZones});
assert.equal(emptyZonesProof.zonesInspected,0);
assert.equal(emptyZonesProof.publicEndpointsAbsentInSuppliedEvidence,true);
assert.equal(emptyZonesProof.gate4Accepted,false);
console.log('PASS no-zone account and no-domain inventory stay explicit, source-only and unaccepted');
const falseEmptyDomainCount=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/workers/domains?'))
  return {...result,result_info:{...result.result_info,total_count:1}};
 return result;
};
await assert.rejects(
 captureDarkExposure('new-live',{token:'synthetic-only',request:falseEmptyDomainCount}),
 /domains total_count does not match exhausted pages/
);
console.log('PASS incomplete empty custom-domain page cannot certify absence');

const incompleteSingleDomainPage=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/workers/domains?'))
  return {...success([{service:'unrelated-worker',hostname:'safe.example'}]),
   result_info:{page:1,per_page:50,count:1,total_pages:1,total_count:2}};
 return result;
};
await assert.rejects(
 captureDarkExposure('new-live',{token:'synthetic-only',request:incompleteSingleDomainPage}),
 /domains total_count does not match exhausted pages/
);
console.log('PASS a single incomplete nonempty custom-domain page cannot certify absence');

const changingDomainTotals=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/workers/domains?')&&path.includes('page=1'))
  return {...success([{service:'unrelated-worker',hostname:'safe-one.example'}]),
   result_info:{page:1,per_page:50,count:1,total_pages:2,total_count:2}};
 if(path.includes('/workers/domains?')&&path.includes('page=2'))
  return {...success([{service:'unrelated-worker',hostname:'safe-two.example'}]),
   result_info:{page:2,per_page:50,count:1,total_pages:2,total_count:3}};
 return result;
};
await assert.rejects(
 captureDarkExposure('new-live',{token:'synthetic-only',request:changingDomainTotals}),
 /domains total_count changed between pages/
);
console.log('PASS changing custom-domain count across pages cannot certify absence');

const incompleteAccountZones=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/zones?'))
  return {...result,result_info:{...result.result_info,total_count:2}};
 return result;
};
await assert.rejects(
 captureDarkExposure('new-live',{token:'synthetic-only',request:incompleteAccountZones}),
 /zones total_count does not match exhausted pages/
);
console.log('PASS incomplete account-zone result cannot hide an uninspected Worker route');

const changingZoneTotals=async(_token,path)=>{
 const result=await mock(_token,path);
 if(path.includes('/zones?')&&path.includes('page=1'))
  return {...success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),
   result_info:{page:1,per_page:50,count:1,total_pages:2,total_count:2}};
 if(path.includes('/zones?')&&path.includes('page=2'))
  return {...success([{id:foreign,account:{id:FIRE_DARK_ACCOUNT}}]),
   result_info:{page:2,per_page:50,count:1,total_pages:2,total_count:3}};
 return result;
};
await assert.rejects(
 captureDarkExposure('dr',{token:'synthetic-only',request:changingZoneTotals}),
 /zones total_count changed between pages/
);
console.log('PASS changing account-zone total between pages cannot certify DARK ingress');
console.log('TOTAL',passed+11,'targeted Gate4 checks PASS');

/* Cloudflare zone listings exclude internal zones unless type=internal. A
 * hidden internal-zone route must deny DARK absence, never pass silently. */
const internalRoute=async (token,path)=>{
 if(path.includes('/zones?')&&path.includes('&type=internal'))
  return {...success([{id:foreign,account:{id:FIRE_DARK_ACCOUNT}}]),
   result_info:{page:1,per_page:50,count:1,total_pages:1,total_count:1}};
 if(path.includes('/zones/'+foreign+'/workers/routes'))
  return success([{pattern:'internal.example/*',script:'fire-fullapp-new-live'}]);
 return mock(token,path);
};
const exposedInternal=await captureDarkExposure('new-live',{
 token:'synthetic-only',request:internalRoute
});
assert.equal(exposedInternal.zonesInspected,2);
assert.equal(exposedInternal.targetZoneRoutes,1);
assert.equal(exposedInternal.publicEndpointsAbsentInSuppliedEvidence,false);
assert.equal(exposedInternal.gate4Accepted,false);
console.log('PASS real internal-zone Worker route cannot falsely certify DARK absence');
await assert.rejects(captureDarkExposure('new-live',{
 token:'synthetic-only',request:async (token,path)=>{
  if(path.includes('/zones?')&&path.includes('&type=internal'))
   throw Error('offline injected internal-zone inventory denial');
  return mock(token,path);
 }
}),/internal-zone inventory denial/);
console.log('PASS denied internal-zone inventory fails closed; no provider writes');
await assert.rejects(captureDarkExposure('new-live',{
 token:'synthetic-only',request:async (token,path)=>{
  if(path.includes('/zones?')&&path.includes('&type=internal'))
   return {...success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),
    result_info:{page:1,per_page:50,count:1,total_pages:1,total_count:1}};
  return mock(token,path);
 }
}),/overlap/);
console.log('PASS overlapping ordinary/internal zone inventories fail closed');
