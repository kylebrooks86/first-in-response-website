// Offline targeted regression for the new private upload adapter. No real credentials or network.
import assert from 'node:assert/strict';
import {assessExistingVersion,KNOWN_INACTIVE_IDS} from './owner_gate9_failed_upload_source_provenance_read_only.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareModules,buildPrivateVersionBody,uploadOneInactiveTestVersion,sanitizedRefusalCodes} from './gate9_private_test_activation_version_upload.mjs';
const h=x=>createHash('sha256').update(x).digest('hex');
const root=mkdtempSync(join(tmpdir(),'fire-g9-synthetic-'));
const worker='fire-stripe-test-20261101',db='dba421ba-fc66-4cf8-9c31-51616f8249ba',stripe='acct_1ULRIG7ND12rd1wI',prev='96e32262-fa33-4f04-a161-bee11f0353e2',origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev',entry='fire-gate9-test-activation-entry.mjs';
const vars={FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:origin,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'test',FIRE_STRIPE_EXPECTED_ACCOUNT_ID:stripe,FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'};
try{
 mkdirSync(join(root,'server'));
 const inventory=[entry,'index.js',...Array.from({length:78},(_,i)=>i===0?'chunks/route+[id](client).mjs':i===1?'styles/app$base.css':i===2?'config/app[qa].json':'fixture'+i+'.mjs')].map(name=>{const path='server/'+name,data='export default '+JSON.stringify(name)+';';mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),data);return {path,sha256:h(data),bytes:Buffer.byteLength(data)}});
 const config=JSON.stringify({name:worker,main:entry,vars,d1_databases:[{binding:'DB',database_id:db}],r2_buckets:[],kv_namespaces:[],services:[],routes:[],preview_urls:false,workers_dev:false,observability:{enabled:false},compatibility_date:'2026-01-01',compatibility_flags:['nodejs_compat']});
 writeFileSync(join(root,'activation-config.REVIEW-ONLY.json'),config);
 const receipt=JSON.stringify({sourceSha:'33f24500d9b6af665c4fa1e2e1e588e92227c70e',worker,d1:db,account:stripe,rollbackVersion:prev,uploadAuthorized:false,activationAuthorized:false,providerContacted:false,inventory,inventoryDigest:h(JSON.stringify(inventory)),configSha256:h(config)});
 writeFileSync(join(root,'activation-review-receipt.json'),receipt);
 const pin=h(receipt),bindings=[{name:'DB',type:'d1',id:db},...['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'].map(name=>({name,type:'secret_text'})),...Object.entries({FIRE_ENV:vars.FIRE_ENV,SITE_ORIGIN:origin,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'disabled'}).map(([name,text])=>({name,type:'plain_text',text}))];
 const args={packageRoot:root,receiptPin:pin,restrictedKey:'rk_test_SYNTHETICONLY',predecessor:{id:prev,resources:{bindings}}};
 assert.equal(prepareModules(root,pin).modules.length,80);
 const parsed=prepareModules(root,pin).modules;
 assert.ok(parsed.some(m=>m.name==='chunks/route+[id](client).mjs'&&m.content_type==='application/javascript+module'));
 assert.ok(parsed.some(m=>m.name==='styles/app$base.css'&&m.content_type==='text/plain'));
 assert.ok(parsed.some(m=>m.name==='config/app[qa].json'&&m.content_type==='text/plain'));
 // A forged yet internally rehashed receipt must still reject traversal.
 const badInventory=inventory.map((row,i)=>i===0?{...row,path:'server/../outside.mjs'}:row);
 const badReceipt=JSON.stringify({...JSON.parse(receipt),inventory:badInventory,inventoryDigest:h(JSON.stringify(badInventory))});
 writeFileSync(join(root,'activation-review-receipt.json'),badReceipt);
 assert.throws(()=>prepareModules(root,h(badReceipt)),/G9_UPLOAD_STOP_PATH/);
 writeFileSync(join(root,'activation-review-receipt.json'),receipt);
 const body=buildPrivateVersionBody(args);
 assert.equal(body.bindings.filter(x=>x.type==='inherit').length,5);
 assert.ok(body.bindings.filter(x=>x.type==='inherit').every(x=>x.version_id===prev));
 assert.equal(body.bindings.find(x=>x.name==='FIRE_STRIPE_MODE').text,'test');
 assert.throws(()=>buildPrivateVersionBody({...args,restrictedKey:'sk_live_FAKE'}),/TEST_KEY/);
 assert.throws(()=>prepareModules(root,'0'.repeat(64)),/RECEIPT_CHANGED/);
 assert.throws(()=>buildPrivateVersionBody({...args,predecessor:{...args.predecessor,id:'wrong'}}),/PREDECESSOR/);
 let posts=0,reserved=false;
 const fake={...args,readServingState:async()=>({accountId:'bfc00939cfb2f8dfd8581a7a7f5f1307',worker,activeVersion:prev,activePercentage:100}),verifyStripeAccount:async()=>stripe,permissionGate:async()=>true,reserveOnce:async()=>{if(reserved)return false;reserved=true;return true},tokenProvider:async()=>'SYNTHETIC_TOKEN_ONLY',fetchImpl:async(url,req)=>{posts++;assert.ok(url.endsWith('/versions?deploy=false'));assert.equal(req.method,'POST');return {status:200,json:async()=>({success:true,result:{id:'11111111-1111-4111-8111-111111111111'}})}}};
 await assert.rejects(uploadOneInactiveTestVersion({...fake,permissionGate:async()=>false}),/OWNER_APPROVAL/);
 await assert.rejects(uploadOneInactiveTestVersion({...fake,verifyStripeAccount:async()=>'wrong'}),/STRIPE_ACCOUNT/);
 await assert.rejects(uploadOneInactiveTestVersion({...fake,readServingState:async()=>({})}),/SERVING_DRIFT/);
 assert.equal(posts,0);assert.equal(reserved,false);
 const result=await uploadOneInactiveTestVersion(fake);assert.equal(result.activationPerformed,false);assert.equal(posts,1);
 await assert.rejects(uploadOneInactiveTestVersion(fake),/ATTEMPT_ALREADY_CONSUMED/);assert.equal(posts,1);
 // Refusal diagnostics must be numeric-only, bounded to 64 KiB, and never
 // permit a second POST. This exercises the same WHATWG body stream as fetch.
 const refusal=(status,payload)=>{
  const data=Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload));
  return {status,body:new ReadableStream({start(controller){
   for(let i=0;i<data.length;i+=1024)controller.enqueue(new Uint8Array(data.subarray(i,i+1024)));
   controller.close();
  }})};
 };
 assert.deepEqual(await sanitizedRefusalCodes(refusal(403,{errors:[{code:10013},{code:10013},{code:10014}]})),[10013,10014]);
 assert.deepEqual(await sanitizedRefusalCodes(refusal(500,'not json')),[]);
 assert.deepEqual(await sanitizedRefusalCodes(refusal(413,'X'.repeat(70000))),[]);
 assert.deepEqual(await sanitizedRefusalCodes({status:500}),[]);
 for(const scenario of [
  {...refusal(403,{errors:[{code:10000,message:'SECRET_MUST_NOT_LEAK'},{code:10000},{code:'SECRET_MUST_NOT_LEAK'}]}),expected:'STATUS_403_CODES_10000'},
  {...refusal(500,'SECRET_MUST_NOT_LEAK'),expected:'STATUS_500_CODES_UNKNOWN'},
  {...refusal(400,{errors:[{code:10013},{code:10014}]}),expected:'STATUS_400_CODES_10013_10014'},
  {...refusal(413,'PRIVATE_REFUSAL_BODY'.repeat(5000)),expected:'STATUS_413_CODES_UNKNOWN'},
  {...refusal(502,{errors:[{code:-1},{code:1.5},{code:10013},{code:10013}]}),expected:'STATUS_502_CODES_10013'}
 ]){
  let consumed=false,calls=0;
  const refused={...fake,reserveOnce:async()=>{if(consumed)return false;consumed=true;return true},fetchImpl:async()=>{calls++;return scenario}};
  await assert.rejects(uploadOneInactiveTestVersion(refused),e=>e.message==='G9_UPLOAD_STOP_HTTP_REFUSAL_NO_RETRY_'+scenario.expected&&!e.message.includes('SECRET_MUST_NOT_LEAK'));
  assert.equal(consumed,true);
  await assert.rejects(uploadOneInactiveTestVersion(refused),/ATTEMPT_ALREADY_CONSUMED/);
  assert.equal(calls,1);
 }
 writeFileSync(join(root,'server',entry),'tampered');assert.throws(()=>prepareModules(root,pin),/MODULE_HASH/);

 // The historical failed one-shot must be reconciled by actual GET module
 // bytes, not just a plausible inactive version ID, metadata or secret names.
 const knownId=KNOWN_INACTIVE_IDS[0],attemptedAt='2026-11-25T20:46:08.133Z';
 const expectedReadback={
  id:knownId,attemptedAt,db,
  main_module:body.main_module,compatibility_date:body.compatibility_date,
  compatibility_flags:body.compatibility_flags,modules:body.modules,
  secrets:['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN',
   'STRIPE_WEBHOOK_SECRET','STRIPE_RESTRICTED_KEY'],
  plain:{FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:origin,
   FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'test',
   FIRE_STRIPE_EXPECTED_ACCOUNT_ID:stripe,FIRE_GATE9_PRIVATE_ACTIVATION:'owner-approved'}
 };
 const resolvedBindings=body.bindings.map(b=>b.type==='inherit'?
  (b.name==='DB'?{name:'DB',type:'d1',database_id:db}:{name:b.name,type:'secret_text'}):
  b.type==='secret_text'?{name:b.name,type:'secret_text'}:b);
 const provider={id:knownId,created_on:'2026-11-25T20:46:25.000Z',
  main_module:body.main_module,compatibility_date:body.compatibility_date,
  compatibility_flags:body.compatibility_flags,urls:[],
  bindings:resolvedBindings,modules:body.modules};
 const assess=(v)=>assessExistingVersion(v,expectedReadback);
 assert.equal(assess(provider).exactAttemptCandidate,true);
 assert.equal(assess({...provider,modules:undefined}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,created_on:'2026-11-24T20:46:25.000Z'}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,urls:['https://wrong.example']}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,assets:{jwt:'synthetic'}}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,bindings:resolvedBindings.filter(b=>b.name!=='STRIPE_RESTRICTED_KEY')}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,bindings:resolvedBindings.map(b=>b.name==='DB'?
  {...b,database_id:'55555555-5555-4555-8555-555555555555'}:b)}).exactAttemptCandidate,false);
 const textBody=resolvedBindings.map(b=>b.name==='FIRE_STRIPE_MODE'?{...b,text:'live'}:b);
 assert.equal(assess({...provider,bindings:textBody}).exactAttemptCandidate,false);
 const altered=body.modules.map((m,i)=>i===0?{...m,content_base64:Buffer.from('tampered').toString('base64')}:m);
 assert.equal(assess({...provider,modules:altered}).exactAttemptCandidate,false);
 assert.equal(assess({...provider,modules:body.modules.slice(1)}).exactAttemptCandidate,false);
 assert.throws(()=>assess({...provider,id:'00000000-0000-4000-8000-000000000000'}),/VERSION_ID/);
 assert.throws(()=>assess({...provider,created_on:'not-a-date'}),/CREATED_AT/);
 console.log('G9_UPLOAD_ADAPTER_SYNTHETIC_PASS; no provider calls');
}finally{rmSync(root,{recursive:true,force:true})}
