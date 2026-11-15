import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseExistingWranglerToken,readExistingWranglerToken} from './owner_current_dark_exposure_existing_session.mjs';
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
 ['reject whitespace secret',JSON.stringify({type:'oauth',token:secret+'\\nBAD'})],
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
console.log('TOTAL',passed,'preexisting-Wrangler owner-session safeguards PASS; mock only');
