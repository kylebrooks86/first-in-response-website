import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createGate9ReadOnlyApi,deployedVersionFromApi,
  predecessorFromApi,createdVersionFromApi
} from './gate9_cloudflare_readonly_adapter.mjs';
import {WORKER,PREDECESSOR,DB_UUID,ORIGIN,INHERITED}
  from './gate9_inactive_fullapp_contract.mjs';
const acct='a'.repeat(32),id='11111111-2222-4333-8444-555555555555';
const vars={FIRE_ACCESS_REQUIRED:'enabled',FIRE_ENV:'cloudflare-staging',
  FIRE_STRIPE_MODE:'disabled',SITE_ORIGIN:ORIGIN};
const bindings=INHERITED.map(name=>name==='DB'?
  {name,type:'d1',database_id:DB_UUID}:
  Object.hasOwn(vars,name)?{name,type:'plain_text',text:vars[name]}:
  {name,type:'secret_text'});
const version=(newVersion=false)=>({
 id:newVersion?id:PREDECESSOR,
 bindings:newVersion?[...bindings,{name:'ASSETS',type:'assets'}]:bindings,
 ...(newVersion?{
 main_module:'index.js',compatibility_date:'2026-10-16',
 compatibility_flags:['nodejs_compat'],
 assets:{config:{run_worker_first:true}},
 modules:[
   {name:'index.js',content_type:'application/javascript+module',
     content_base64:Buffer.from('export default {fetch(){return new Response("TEST")}}').toString('base64')},
   {name:'_headers',content_type:'text/plain',
     content_base64:Buffer.from('/*\nX-Test: yes').toString('base64')}
 ]}: {})
});
const deployment=()=>({success:true,result:{deployments:[
 {strategy:'percentage',versions:[{version_id:PREDECESSOR,percentage:100}]},
 {strategy:'percentage',versions:[{version_id:id,percentage:100}]}
]}});
const wrap=result=>({success:true,result});
test('real documented API D1 database_id is normalized into trusted source verifier',()=>{
  const v=predecessorFromApi(wrap(version()));
  assert.equal(v.resources.bindings.find(x=>x.name==='DB').id,DB_UUID);
  assert.equal(v.resources.bindings.length,9);
  assert.equal(deployedVersionFromApi(deployment())[0].version_id,PREDECESSOR);
});
test('GET-only adapter makes exactly 2 pinned REST GETs for serving state',async()=>{
  const calls=[],currentVersion=version();
  const transport=createGate9ReadOnlyApi({
    accountId:acct,tokenProvider:async()=> 'SYNTHETIC_NONSECRET_READ_TOKEN',
    fetchImpl:async(url,opt)=>{
      calls.push({url,method:opt.method,redirect:opt.redirect,auth:opt.headers.Authorization});
      const data=url.endsWith('/deployments')?deployment():wrap(currentVersion);
      return new Response(JSON.stringify(data),{status:200});
    }
  });
  assert.equal(Object.hasOwn(transport,'request'),false);
  const state=await transport.readState();
  assert.equal(state.version.id,PREDECESSOR);
  assert.equal(state.version.resources.bindings.length,9);
  assert.equal(state.versions.length,1);
  assert.equal(calls.length,2);
  assert(calls.every(x=>x.method==='GET'&&x.redirect==='error'&&
    x.auth==='Bearer SYNTHETIC_NONSECRET_READ_TOKEN'));
  assert(calls[0].url.endsWith('/deployments'));
  assert(calls[1].url.endsWith('/versions/'+PREDECESSOR));
});
test('independent actual module byte GET includes modules and recomputes digest',async()=>{
  const v=version(true),calls=[];
  const transport=createGate9ReadOnlyApi({
    accountId:acct,tokenProvider:async()=> 'SYNTHETIC_NONSECRET_READ_TOKEN',
    fetchImpl:async(url,opt)=>{calls.push([url,opt.method]);return new Response(JSON.stringify(wrap(v)),{status:200});}
  });
  const actual=await transport.readVersion(id);
  const sorted=[...v.modules].sort((a,b)=>a.name.localeCompare(b.name));
  assert.equal(actual.moduleDigest,createHash('sha256')
    .update(JSON.stringify(sorted)).digest('hex'));
  assert.deepEqual(actual.bindings.filter(x=>x.type==='assets'),[{name:'ASSETS',type:'assets'}]);
  assert.equal(calls.length,1);
  assert(calls[0][0].endsWith('/versions/'+id+'?include=modules'));
});
test('refuses traffic drift, D1 substitution and unexpected extra secret',()=>{
  assert.throws(()=>deployedVersionFromApi(wrap({deployments:[
    {strategy:'percentage',versions:[{version_id:id,percentage:100}]}]})));
  assert.throws(()=>deployedVersionFromApi(wrap({deployments:[
    {strategy:'percentage',versions:[{version_id:PREDECESSOR,percentage:50},{version_id:id,percentage:50}]}]})));
  const changed=version();changed.bindings[0].database_id='d'.repeat(8)+'-'+
      'd'.repeat(4)+'-'+ 'd'.repeat(4)+'-'+ 'd'.repeat(4)+'-'+ 'd'.repeat(12);
  assert.throws(()=>predecessorFromApi(wrap(changed)));
  const changed2=version();changed2.bindings.push({name:'ANOTHER',type:'secret_text'});
  assert.throws(()=>predecessorFromApi(wrap(changed2)));
});
test('refuses secret values in READ responses and fail-closes unknown binding type',()=>{
  const leaked=version();
  leaked.bindings.find(x=>x.name==='STRIPE_WEBHOOK_SECRET').text='must-not-disclose';
  assert.throws(()=>predecessorFromApi(wrap(leaked)));
  const extra=version();
  extra.bindings[0]={name:'BUCKET',type:'r2_bucket'};
  assert.throws(()=>predecessorFromApi(wrap(extra)));
});
test('rejects GET response lacking independent modules, wrong ID, or poisoned metadata',()=>{
  const v=version(true);
  v.modules=undefined;
  assert.throws(()=>createdVersionFromApi(wrap(v),id));
  const different=version(true);different.id=PREDECESSOR;
  assert.throws(()=>createdVersionFromApi(wrap(different),id));
  const corrupt=version(true);corrupt.modules[0].content_base64='%%INVALID';
  assert.throws(()=>createdVersionFromApi(wrap(corrupt),id));
});
test('API error, 403 and unexpected HTML never leaks provider message or retries',async()=>{
  for(const response of [
    new Response('Unauthorized SECRET_CONTENT',{status:403}),
    new Response('<html>SECRET_CONTENT</html>',{status:200}),
    new Response(JSON.stringify({success:false,errors:[{message:'SECRET_CONTENT'}]}),{status:200})
  ]){
    let calls=0;
    const adapter=createGate9ReadOnlyApi({
      accountId:acct,tokenProvider:async()=> 'SYNTHETIC_NONSECRET_READ_TOKEN',
      fetchImpl:async()=>{calls++;return response.clone();}
    });
    await assert.rejects(adapter.readState(),e=>
      e.message.startsWith('STOP: Gate9 Cloudflare READ ONLY')&&!e.message.includes('SECRET_CONTENT'));
    assert.equal(calls,1);
  }
});
test('read-only adapter cannot be constructed for placeholder or invalid account',()=>{
  for(const id of ['0'.repeat(32),'not-an-account','']) {
    assert.throws(()=>createGate9ReadOnlyApi({
      accountId:id,tokenProvider:async()=> 'SYNTHETIC_NONSECRET_READ_TOKEN',fetchImpl:async()=>{}
    }));
  }
});
