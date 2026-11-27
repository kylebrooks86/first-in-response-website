import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PINS,bindings,verifyBindings,contentType,compareModules,preflight} from './g401_dark_release_review.mjs';
let checks=0;
const pass=(x)=>{assert.ok(x);checks++};
const rejects=(f)=>{assert.throws(f,/G401_STOP_/);checks++};
for(const t of Object.keys(PINS)){
 const p=PINS[t],v={id:p.version,resources:{bindings:bindings(t)}};
 pass(verifyBindings(t,v,p.version));
 for(const name of ['DB',p.auth,'FIRE_ENV']){
  const z=structuredClone(v),b=z.resources.bindings.find(x=>x.name===name);
  if(name==='DB')b.id='wrong';else b.text='wrong';
  rejects(()=>verifyBindings(t,z,p.version));
 }
 rejects(()=>verifyBindings(t,{...v,resources:{bindings:[...bindings(t),{name:'EXTRA',type:'secret_text'}]}},p.version));
 const data=Buffer.from('sample'),expected=[{name:'fire-noassets-entry.mjs',content_type:'application/javascript+module',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];
 const version={id:p.version,main_module:'fire-noassets-entry.mjs',urls:[],modules:[{name:expected[0].name,content_type:expected[0].content_type,content_base64:data.toString('base64')}]};
 pass(compareModules(version,expected,p.version));
 rejects(()=>compareModules({...version,urls:['https://example.invalid']},expected,p.version));
 rejects(()=>compareModules({...version,modules:[]},expected,p.version));
 rejects(()=>compareModules({...version,modules:[{...version.modules[0],content_base64:'AAAA'}]},expected,p.version));
 let calls=0;
 const fake=async(url,opts)=>{
  assert.equal(opts.method,'GET');calls++;
  const result=url.endsWith('/subdomain')?{enabled:false,previews_enabled:false}:url.includes('/deployments?')?{deployments:[{id:'11111111-1111-4111-8111-111111111111',versions:[{version_id:p.version,percentage:100}]}]}:url.endsWith('/versions/'+p.version)?v:url.includes('/versions?')?{items:[{id:p.version}]}:{name:p.worker,id:'a'.repeat(32)};
  return {ok:true,json:async()=>({success:true,result})};
 };
 pass((await preflight(t,'synthetic-token-not-a-real-secret',fake)).servingVersion===p.version);
 pass(calls===5);
}
for(const [n,m] of [['BUILD_ID','text/plain'],['index.js','application/javascript+module'],['x.json','text/plain'],['fire-inline-assets/asset-001-0123456789abcdef.bin','application/octet-stream']])pass(contentType(n)===m);
for(const n of ['../index.js','other.bin','x.exe'])rejects(()=>contentType(n));
console.log('G401_DARK_REVIEW_OFFLINE_PASS checks='+checks+' real_network=0');
