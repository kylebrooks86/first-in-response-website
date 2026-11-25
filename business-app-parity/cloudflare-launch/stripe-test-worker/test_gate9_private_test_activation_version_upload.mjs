// Offline targeted regression for the new private upload adapter. No real credentials or network.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareModules,buildPrivateVersionBody,uploadOneInactiveTestVersion} from './gate9_private_test_activation_version_upload.mjs';
const h=x=>createHash('sha256').update(x).digest('hex');
const root=mkdtempSync(join(tmpdir(),'fire-g9-synthetic-'));
const worker='fire-stripe-test-20261101',db='dba421ba-fc66-4cf8-9c31-51616f8249ba',stripe='acct_1ULRIG7ND12rd1wI',prev='96e32262-fa33-4f04-a161-bee11f0353e2',origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev',entry='fire-gate9-test-activation-entry.mjs';
const vars={FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:origin,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'test',FIRE_STRIPE_EXPECTED_ACCOUNT_ID:stripe,FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'};
try{
 mkdirSync(join(root,'server'));
 const inventory=[entry,'index.js',...Array.from({length:78},(_,i)=>'fixture'+i+'.mjs')].map(name=>{const path='server/'+name,data='export default '+JSON.stringify(name)+';';writeFileSync(join(root,path),data);return {path,sha256:h(data),bytes:Buffer.byteLength(data)}});
 const config=JSON.stringify({name:worker,main:entry,vars,d1_databases:[{binding:'DB',database_id:db}],r2_buckets:[],kv_namespaces:[],services:[],routes:[],preview_urls:false,workers_dev:false,observability:{enabled:false},compatibility_date:'2026-01-01',compatibility_flags:['nodejs_compat']});
 writeFileSync(join(root,'activation-config.REVIEW-ONLY.json'),config);
 const receipt=JSON.stringify({sourceSha:'33f24500d9b6af665c4fa1e2e1e588e92227c70e',worker,d1:db,account:stripe,rollbackVersion:prev,uploadAuthorized:false,activationAuthorized:false,providerContacted:false,inventory,inventoryDigest:h(JSON.stringify(inventory)),configSha256:h(config)});
 writeFileSync(join(root,'activation-review-receipt.json'),receipt);
 const pin=h(receipt),bindings=[{name:'DB',type:'d1',id:db},...['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'].map(name=>({name,type:'secret_text'})),...Object.entries({FIRE_ENV:vars.FIRE_ENV,SITE_ORIGIN:origin,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'disabled'}).map(([name,text])=>({name,type:'plain_text',text}))];
 const args={packageRoot:root,receiptPin:pin,restrictedKey:'rk_test_SYNTHETICONLY',predecessor:{id:prev,resources:{bindings}}};
 assert.equal(prepareModules(root,pin).modules.length,80);
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
 writeFileSync(join(root,'server',entry),'tampered');assert.throws(()=>prepareModules(root,pin),/MODULE_HASH/);
 console.log('G9_UPLOAD_ADAPTER_SYNTHETIC_PASS; no provider calls');
}finally{rmSync(root,{recursive:true,force:true})}
