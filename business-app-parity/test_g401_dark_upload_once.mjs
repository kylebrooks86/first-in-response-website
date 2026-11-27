import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PINS,SOURCE,bindings} from './g401_dark_release_review.mjs';
import {upload,phrase} from './g401_dark_upload_once.mjs';
const target='new-live',p=PINS[target],id='33333333-3333-4333-8333-333333333333';
const bytes=Buffer.from('fixture');
const names=['fire-noassets-entry.mjs',...Array.from({length:241},(_,i)=>'synthetic-'+i+'.js')];
const modules=names.map(name=>({name,content_type:'application/javascript+module',content_base64:bytes.toString('base64')}));
const pack={summary:{target,receipt:p.receipt,source:SOURCE},body:{main_module:names[0],bindings:bindings(target),modules},inventory:modules.map(m=>({name:m.name,content_type:m.content_type,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))};
const before={workerId:'181c231d6a004c969593fbdfac980230',servingDeployment:'bc3bab52-c6f0-4ae1-a18b-38c5522872e7',servingVersion:p.version,latestVersion:p.version,traffic:100,bindingsVerified:true,authBlocked:true,publicIngress:false,previews:false};
let tests=0;
async function run(fault){
 let posts=0,checks=0,reservations=0;
 const check=async()=>{
  checks++;
  if(fault==='drift'&&checks===2)return {...before,latestVersion:id};
  if(fault==='public'&&checks===1)return {...before,publicIngress:true};
  return checks<=2?before:{...before,latestVersion:id,...(fault==='traffic'?{servingVersion:id}:{})};
 };
 const fetchImpl=async(url,opts)=>{
  assert.match(url,/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\//);
  if(opts.method==='POST'){
   posts++;
   assert.equal(reservations,1);
   assert.ok(url.endsWith('/workers/'+before.workerId+'/versions?deploy=false'));
   assert.deepEqual(JSON.parse(opts.body),pack.body);
   if(fault==='http')return {ok:false};
   return {ok:true,json:async()=>({success:true,result:{id:fault==='reply'?'invalid':id}})};
  }
  assert.equal(opts.method,'GET');
  const result=url.endsWith('?include=modules')?{id,main_module:names[0],urls:[],modules:fault==='bytes'?modules.slice(1):modules}:{id,resources:{bindings:bindings(target)}};
  return {ok:true,json:async()=>({success:true,result})};
 };
 const promise=upload({target,pack,token:'synthetic-only-token-12345',approval:fault==='approval'?'wrong':phrase(target),reserve:async()=>{reservations++;return fault!=='lock'},fetchImpl,check});
 if(fault)await assert.rejects(promise,/G401_(?:UPLOAD_)?STOP_/);else{const r=await promise;assert.equal(r.matchedModules,242);assert.equal(r.activated,false);}
 assert.equal(posts,['approval','public','drift','lock'].includes(fault)?0:1);
 tests++;
}
for(const f of [null,'approval','public','drift','lock','http','reply','traffic','bytes'])await run(f);
console.log('G401_DARK_UPLOAD_OFFLINE_PASS cases='+tests+' real_network=0');
