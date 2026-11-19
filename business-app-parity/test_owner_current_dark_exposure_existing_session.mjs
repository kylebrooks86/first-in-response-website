import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseExistingWranglerToken,readExistingWranglerToken,captureBothDarkExposures} from './owner_current_dark_exposure_existing_session.mjs';
const secret='cfoat_'+('a'.repeat(45));
let passed=0;
const test=(label,fn)=>{fn();passed++;console.log('PASS',label)};
test('safe default never reads credentials or calls a provider',()=>{
 const file=fileURLToPath(new URL('./owner_current_dark_exposure_existing_session.mjs',import.meta.url));
 const result=JSON.parse(execFileSync(process.execPath,[file],{encoding:'utf8'}));
 assert.equal(result.providerContacted,false);
 assert.equal(result.existingSessionRead,false);
 assert.equal(result.gate4Accepted,false);
});
test('valid existing OAuth JSON accepted without printing token',()=>{
 assert.equal(parseExistingWranglerToken(JSON.stringify({type:'oauth',token:secret})),secret);
});
test('valid existing API token supported without creating one',()=>{
 assert.equal(parseExistingWranglerToken(JSON.stringify({type:'api_token',token:secret})),secret);
});
for(const [name,raw] of [
 ['reject arbitrary text','not JSON'],
 ['reject API key and email mode',JSON.stringify({type:'api_key',key:secret,email:'owner@example.org'})],
 ['reject empty secret',JSON.stringify({type:'oauth',token:''})],
 ['reject short secret',JSON.stringify({type:'oauth',token:'abc'})],
 ['reject whitespace secret',JSON.stringify({type:'oauth',token:secret+String.fromCharCode(10)+'BAD'})],
 ['reject unknown token type',JSON.stringify({type:'new-login',token:secret})],
 ['reject null/array',JSON.stringify([])]
]){
 test(name,()=>{
  assert.throws(()=>parseExistingWranglerToken(raw),/session token unavailable/);
 });
}
test('mock runner sees only installed offline npx and exact auth token operation',()=>{
 let calls=0;
 const result=readExistingWranglerToken({npmCli:'X:/mock/npx-cli.js',nodeBin:'node.exe',
  runner:(binary,args,options)=>{
   calls++;
   assert.equal(binary,'node.exe');
   assert.deepEqual(args,['X:/mock/npx-cli.js','--no-install',
    'wrangler@4.162.0','auth','token','--json']);
   assert.equal(options.shell,false);
   assert.equal(options.env.npm_config_offline,'true');
   assert.equal(options.env.npm_config_yes,'false');
   assert.equal(options.stdio[0],'ignore');
   assert.equal(options.windowsHide,true);
   return {status:0,stdout:JSON.stringify({type:'oauth',token:secret}),stderr:''};
  }
 });
 assert.equal(result,secret);
 assert.equal(calls,1);
});
test('a failed existing-session command stops without leaking stdout or stderr',()=>{
 const planted='SENSITIVE_SECRET_DO_NOT_PRINT';
 let caught='';
 try{readExistingWranglerToken({npmCli:'fake',runner:()=>({
  status:1,stdout:planted,stderr:planted
 })})}catch(e){caught=e.message}
 assert.match(caught,/session token unavailable/);
 assert.ok(!caught.includes(planted));
});
test('missing npm command fails without triggering installer or network',()=>{
 assert.throws(()=>readExistingWranglerToken({npmCli:''}),/session token unavailable/);
});
test('runner exception is sanitized and never retried',()=>{
 let calls=0;
 assert.throws(()=>readExistingWranglerToken({npmCli:'mock',runner:()=>{
  calls++;throw new Error('secret in subprocess error')
 }}),/session token unavailable/);
 assert.equal(calls,1);
});

const success=result=>({success:true,errors:[],result});
const emptyInfo={page:1,per_page:50,count:0,total_pages:0,total_count:0};
const batchPaths=[];
const cleanMock=async(_token,path)=>{
 batchPaths.push(path);
 if(path.endsWith('/subdomain'))return success({enabled:false,previews_enabled:false});
 if(path.includes('/workers/domains?')||path.includes('/zones?'))
  return {...success([]),result_info:emptyInfo};
 throw new Error('unexpected offline mock path');
};
const both=await captureBothDarkExposures({token:secret,request:cleanMock});
assert.equal(both.targets.length,2);
assert.deepEqual(both.targets.map(x=>x.target),['dr','new-live']);
assert.equal(both.publicEndpointsAbsentInSuppliedEvidence,true);
assert.equal(both.providerReadbackVerified,false,'mock cannot be physical provider proof');
assert.equal(both.accessPolicyProviderVerified,false);
assert.equal(both.gate4Accepted,false);
assert.equal(both.productionReady,false);
assert.ok(!JSON.stringify(both).includes(secret),'no bearer token may appear in receipt');
assert.equal(batchPaths.length,6,'two Workers, three GET inventory operations each');
assert.ok(batchPaths.every(p=>p.startsWith('/client/v4/')));
passed++;
console.log('PASS one owner batch covers both DARK Worker targets with provider-free mock');

const exposedLive=await captureBothDarkExposures({token:secret,request:async(_token,path)=>{
 if(path.endsWith('/subdomain'))return success({
  enabled:path.includes('/fire-fullapp-new-live/'),previews_enabled:false
 });
 return cleanMock(_token,path);
}});
assert.equal(exposedLive.targets[0].publicEndpointsAbsentInSuppliedEvidence,true);
assert.equal(exposedLive.targets[1].publicEndpointsAbsentInSuppliedEvidence,false);
assert.equal(exposedLive.publicEndpointsAbsentInSuppliedEvidence,false);
assert.match(exposedLive.result,/REQUIRES_REVIEW/);
assert.equal(exposedLive.gate4Accepted,false);
passed++;
console.log('PASS either-target public route exposure blocks combined clean verdict');

await assert.rejects(captureBothDarkExposures({token:secret,request:async(_token,path)=>{
 if(path.includes('/zones?'))return {...success([]),result_info:{...emptyInfo,total_count:1}};
 return cleanMock(_token,path);
}}),/zones total_count does not match exhausted pages/);
passed++;
console.log('PASS incomplete account-zone data refuses combined proof');

const file=fileURLToPath(new URL('./owner_current_dark_exposure_existing_session.mjs',import.meta.url));
const {spawnSync}=await import('node:child_process');
const forbidden=spawnSync(process.execPath,[file,'--capture','both'],{
 encoding:'utf8',env:{...process.env,CI:'true'}
});
assert.notEqual(forbidden.status,0);
assert.match(forbidden.stderr,/FIRE EXISTING WRANGLER READ-ONLY STOP/);
assert.ok(!forbidden.stdout.includes(secret));
passed++;
console.log('PASS noninteractive batch cannot contact provider or load owner credentials');

console.log('TOTAL',passed,'preexisting-Wrangler owner-session safeguards PASS; mock only');
