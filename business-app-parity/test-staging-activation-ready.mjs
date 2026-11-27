import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {SOURCE_VERSION,planActivationBindings,verifyActivationReadyBindings} from './staging_activation_ready_bindings.mjs';
import {CONSENT,LOCK,HISTORY,URL,reservation,createReadyVersion,verifyNoReadyDuplicate} from './owner_staging_activation_ready.mjs';
const accountId='bfc00939cfb2f8dfd8581a7a7f5f1307';
const next='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const serving={accountId,workerId:PIN.workerId,deployment:PIN.deployment,version:PIN.version,percentage:100};
const source={id:SOURCE_VERSION,resources:{bindings:[
 {name:'DB',type:'d1',id:PIN.db},
 ...['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH'].map(name=>({name,type:'secret_text'})),
 ...Object.entries({FIRE_ENV:'staging',SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev',FIRE_STAGING_PRIVATE_ACTIVATION:'blocked',FIRE_STRIPE_MODE:'disabled'}).map(([name,text])=>({name,type:'plain_text',text}))
]}};
const active={id:next,resources:{bindings:source.resources.bindings.map(b=>b.name==='FIRE_STAGING_PRIVATE_ACTIVATION'?{...b,text:'owner-approved'}:b)}};
const bindings=planActivationBindings(source,serving);
assert.equal(bindings.filter(b=>b.type==='inherit').length,3);
assert.ok(bindings.filter(b=>b.type==='inherit').every(b=>b.version_id===SOURCE_VERSION&&!('text'in b)));
assert.equal(verifyActivationReadyBindings(active),true);
assert.throws(()=>planActivationBindings({...source,id:next},serving));
assert.throws(()=>planActivationBindings(source,{...serving,percentage:99}));
for(const name of ['DB','FIRE_STRIPE_MODE','FIRE_ADMIN_PASSWORD_HASH']){
 const bad=structuredClone(source);bad.resources.bindings=bad.resources.bindings.filter(b=>b.name!==name);assert.throws(()=>planActivationBindings(bad,serving));
}
const bad=structuredClone(active);bad.resources.bindings.find(b=>b.name==='FIRE_STRIPE_MODE').text='live';assert.throws(()=>verifyActivationReadyBindings(bad));
const readers={readServing:async()=>serving,readVersion:async id=>id===SOURCE_VERSION?source:id===next?active:{id:PIN.version},verifyNoReadyDuplicate:async()=>true};
const buildBody=async()=>({main_module:'fire-staging-noassets-entry.mjs',compatibility_date:'2026-10-16',compatibility_flags:['nodejs_compat'],modules:Array.from({length:80},(_,i)=>({name:'synthetic'+i,content_base64:'YQ=='})),bindings});
let posts=0,reserves=0;
const opts={consent:CONSENT,token:'synthetic-token-not-real-12345',readers,buildBody,reserve:()=>{reserves++},fetchImpl:async(url,init)=>{
 assert.equal(url,URL);assert.equal(init.method,'POST');assert.equal(reserves,1);assert.deepEqual(JSON.parse(init.body).bindings,bindings);posts++;return Response.json({success:true,result:{id:next}});
}};
await assert.rejects(createReadyVersion({...opts,consent:'OLD'}),/CONSENT/);
await assert.rejects(createReadyVersion({...opts,readers:{...readers,verifyNoReadyDuplicate:async()=>false}}),/DUPLICATE/);
await assert.rejects(createReadyVersion({...opts,buildBody:async()=>({...await buildBody(),bindings:[...bindings,{name:'R2',type:'r2_bucket'}]})}),/BODY_BINDINGS/);
assert.equal(posts,0);assert.equal(reserves,0);
assert.equal((await createReadyVersion(opts)).activated,false);assert.equal(posts,1);
const listItem=(id,created_on)=>({id,metadata:{created_on}});
const listResponse=items=>async()=>Response.json({success:true,result:{items}});
assert.equal(await verifyNoReadyDuplicate(opts.token,readers,listResponse([listItem(SOURCE_VERSION,'2026-11-26T07:06:00Z')])),true);
await assert.rejects(verifyNoReadyDuplicate(opts.token,readers,listResponse([listItem(next,'2026-11-26T07:07:00Z'),listItem(SOURCE_VERSION,'2026-11-26T07:06:00Z')])),/READY_DUPLICATE/);
const root=mkdtempSync(join(tmpdir(),'fire-ready-'));
try{
 assert.throws(()=>reservation(root),/HISTORY/);
 for(const n of HISTORY)writeFileSync(join(root,n),'history',{flag:'wx'});
 const a=reservation(root),b=reservation(root);a();assert.throws(b,/RESERVATION_NO_RETRY/);assert.throws(()=>reservation(root),/SPENT/);
 assert.ok(existsSync(join(root,LOCK)));for(const n of HISTORY)assert.equal(readFileSync(join(root,n),'utf8'),'history');
}finally{rmSync(root,{recursive:true,force:true})}
console.log('PASS activation-ready bindings, no-write negative controls, mock single POST/readback, duplicate rejection and exclusive lock');
