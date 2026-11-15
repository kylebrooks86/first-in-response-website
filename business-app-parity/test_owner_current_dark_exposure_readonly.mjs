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
 if(path.includes('/zones?'))return {...success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),result_info:{page:1,per_page:50,count:1,total_pages:1,total_count:5}};
 if(path.endsWith('/workers/routes'))return success([]);
 throw Error('unexpected mock request '+path);
};
const proof=await captureDarkExposure('new-live',{token:'synthetic-only',request:mock});
assert.equal(proof.providerReadbackVerified,false);
assert.equal(proof.publicEndpointsAbsentInSuppliedEvidence,true);
assert.equal(proof.gate4Accepted,false);
assert.equal(calls.length,4);
assert.ok(calls.every(p=>p.startsWith('/client/v4/')&&!/\b(post|put|delete)\b/i.test(p)));
console.log('PASS four exact read-only GET mock calls; no paid API, auth or remote state');
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

console.log('TOTAL',passed+8,'targeted Gate4 checks PASS');
