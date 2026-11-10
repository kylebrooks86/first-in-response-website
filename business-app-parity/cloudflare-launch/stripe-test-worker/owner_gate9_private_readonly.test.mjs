import test from 'node:test';
import assert from 'node:assert/strict';
import {readExistingWranglerToken,runOwnerPrivateReadOnly} from './owner_gate9_private_readonly.mjs';
import {PREDECESSOR,DB_UUID,ORIGIN,INHERITED} from './gate9_inactive_fullapp_contract.mjs';
const fake='SYNTHETIC_AUTH_PRIVATE_TEST_ONLY';
test('Wrangler 4.151 logger.log JSON remains privately capturable and disk logging is disabled',()=>{
 let captured;
 const got=readExistingWranglerToken({platform:'win32',spawn:(cmd,args,opts)=>{
  // Pinned Wrangler 4.151.0 authTokenCommand uses logger.log(JSON.stringify(...)).
  // error/none levels suppress its valid JSON despite process exit status zero.
  const stdout=opts.env.WRANGLER_LOG==='log'?
    JSON.stringify({type:'oauth',token:fake}):'';
  captured=opts;
  return {status:0,stdout};
 }});
 assert.equal(captured.env.WRANGLER_WRITE_LOGS,'false');
 assert.deepEqual(captured.stdio,['ignore','pipe','pipe']);
 assert.equal(got,fake);
});
test('captures existing Wrangler auth privately; never invokes login or shell interpolation',()=>{
 const calls=[];
 const got=readExistingWranglerToken({platform:'win32',spawn:(cmd,args,opts)=>{
  calls.push({cmd,args,opts});return {status:0,stdout:JSON.stringify({type:'oauth',token:fake})};
 }});
 assert.equal(got,fake);
 assert.deepEqual(calls[0].args,['/d','/s','/c','wrangler.cmd auth token --json']);
 assert.equal(calls[0].opts.stdio[1],'pipe');
 assert.equal(calls[0].opts.stdio[2],'pipe');
 assert.equal(calls[0].opts.shell,undefined);
});
test('auth failures and unsupported API-key credentials never expose subprocess output',()=>{
 for(const r of [{status:1,stdout:fake,stderr:fake},
  {status:0,stdout:fake},
  {status:0,stdout:JSON.stringify({type:'api_key',key:fake,email:'private@example.invalid'})}]){
  assert.throws(()=>readExistingWranglerToken({spawn:()=>r}),e=>
   e.message.startsWith('STOP: Gate9')&&!e.message.includes(fake)&&!e.message.includes('@'));
 }
});
test('source mismatch stops before credential read or HTTP',async()=>{
 let auth=0,http=0;
 await assert.rejects(runOwnerPrivateReadOnly({reviewedSource:'a'.repeat(40),getHead:async()=> 'b'.repeat(40),
  readToken:async()=>{auth++;return fake;},fetchImpl:async()=>{http++;}}),/SOURCE_MISMATCH/);
 assert.equal(auth,0);assert.equal(http,0);
});
test('private credential callback failure is redacted',async()=>{
 await assert.rejects(runOwnerPrivateReadOnly({reviewedSource:'a'.repeat(40),getHead:async()=> 'a'.repeat(40),
  readToken:async()=>{throw Error(fake);},fetchImpl:async()=>{}}),e=>
   /PRIVATE_AUTH_UNAVAILABLE/.test(e.message)&&!e.message.includes(fake));
});
test('owner runner performs two GETs only and returns redacted pin receipt',async()=>{
 const vars={FIRE_ACCESS_REQUIRED:'enabled',FIRE_ENV:'cloudflare-staging',
  FIRE_STRIPE_MODE:'disabled',SITE_ORIGIN:ORIGIN};
 const bindings=INHERITED.map(name=>name==='DB'?{name,type:'d1',database_id:DB_UUID}:
  Object.hasOwn(vars,name)?{name,type:'plain_text',text:vars[name]}:{name,type:'secret_text'});
 const calls=[];
 const result=await runOwnerPrivateReadOnly({reviewedSource:'a'.repeat(40),getHead:async()=> 'a'.repeat(40),
  readToken:async()=>fake,fetchImpl:async(url,opt)=>{
   calls.push([url,opt.method]);assert.equal(opt.method,'GET');
   assert.equal(opt.headers.Authorization,'Bearer '+fake);
   assert.equal(opt.redirect,'error');
   const v=url.endsWith('/deployments')?{deployments:[{strategy:'percentage',
     versions:[{version_id:PREDECESSOR,percentage:100}]}]}:{id:PREDECESSOR,bindings};
   return new Response(JSON.stringify({success:true,errors:null,result:v}),{status:200});
  }});
 assert.equal(calls.length,2);assert.equal(result.d1Uuid,DB_UUID);
 assert.equal(result.stripeMode,'disabled');assert.equal(result.accessRequired,'enabled');
 assert.equal(result.uploadAttempted,false);assert.equal(result.gate9Accepted,false);
 assert(!JSON.stringify(result).includes(fake));assert.equal(result.secretNames.length,4);
});
test('remote denial stops after first GET without leaking provider body',async()=>{
 let calls=0;
 await assert.rejects(runOwnerPrivateReadOnly({reviewedSource:'a'.repeat(40),getHead:async()=> 'a'.repeat(40),
  readToken:async()=>fake,fetchImpl:async()=>{calls++;return new Response(fake,{status:403});}}),
  e=>/GET_STATUS/.test(e.message)&&!e.message.includes(fake));
 assert.equal(calls,1);
});
