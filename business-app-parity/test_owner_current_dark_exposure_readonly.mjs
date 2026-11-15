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
 if(path.includes('/workers/domains?'))return {...success([]),result_info:{page:1,total_pages:1,total_count:0}};
 if(path.includes('/zones?'))return {...success([{id:zone,account:{id:FIRE_DARK_ACCOUNT}}]),result_info:{page:1,total_pages:1,total_count:1}};
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
console.log('TOTAL',passed+1,'targeted Gate4 checks PASS');
