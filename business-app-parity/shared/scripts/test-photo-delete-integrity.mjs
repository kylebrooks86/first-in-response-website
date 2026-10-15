import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
assert.equal(readFileSync(new URL('../app/api/customer-photos/[id]/route.ts',import.meta.url),'utf8'),readFileSync(new URL('./fixtures/photo-integrity/business-app-parity/shared/app/api/customer-photos/[id]/route.ts.txt',import.meta.url),'utf8'),'Current shared route must match the tested patched source');
let total=0;
function pass(name,predicate){assert.equal(Boolean(predicate),true,name);total++;console.log('PASS',name);}
const root=new URL('./fixtures/photo-integrity/',import.meta.url);
function harness(file,mode='success',authorized=true,bucket=true,found=true){
 const rows=new Map(found?[['photo-1',{objectKey:'customers/customer-1/photo-1.png',contentType:'image/png'}]]:[]);
 const objects=new Map([['customers/customer-1/photo-1.png','original-png-bytes']]);
 const events=[];
 const env={
   BUCKET:bucket?{async get(key){events.push('bucket-get');return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){events.push('bucket-delete');if(mode==='bucket-error')throw Error('R2 outage');objects.delete(key);}}:null,
   DB:{prepare(query){return {bind(id){return {
     async first(){events.push('db-select');return rows.get(id)||null;},
     async run(){events.push('db-delete');if(mode==='db-precommit-error')throw Error('D1 rejected before commit');rows.delete(id);if(mode==='db-postcommit-error')throw Error('D1 deleted before acknowledgement');return {success:true};}
   };}};}}
 };
 const exports={};
 const compiled=ts.transpileModule(readFileSync(new URL(file+'.txt',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports,Request,Response,Date,console,require(id){
   if(id==='cloudflare:workers')return {env};
   if(id==='../../../chatgpt-auth'||id==='../../../owner-auth')return {getChatGPTUser:async()=>authorized?{email:'kylebrooks8605@gmail.com'}:null,getOwnerUser:async()=>authorized?{email:'kylebrooks8605@gmail.com'}:null};
   throw Error('Unexpected import '+id);
 }},{filename:file});
 const context={params:Promise.resolve({id:'photo-1'})};
 return {GET:()=>exports.GET(new Request('https://synthetic.invalid/api/customer-photos/photo-1'),context),DELETE:()=>exports.DELETE(new Request('https://synthetic.invalid/api/customer-photos/photo-1',{method:'DELETE'}),context),rows,objects,events};
}
for (const prefix of ['business-app-parity/shared/app/api/customer-photos/[id]','fire-app-dr/app/api/customer-photos/[id]']){
 for (const patched of [false,true]){
  const file=`${prefix}/route.${patched?'ts':'original.ts'}`;
  if(patched&&prefix.startsWith('business-app-parity/shared/')){
    const getCase=harness(file);
    const photo=await getCase.GET();
    pass('current shared GET serves original synthetic bytes without changing records',photo.status===200&&(await photo.text())==='original-png-bytes'&&getCase.rows.size===1&&getCase.objects.size===1&&getCase.events.join(',')==='db-select,bucket-get');
    pass('current shared GET prevents sensitive photo caching',photo.headers.get('cache-control')==='private, no-store');
    pass('current shared GET prevents MIME-type sniffing',photo.headers.get('x-content-type-options')==='nosniff');
    pass('current shared GET isolates inline image content',photo.headers.get('content-security-policy')==='sandbox'&&photo.headers.get('content-disposition')==='inline');
    const locked=harness(file,'success',false);
    pass('current shared GET forbids unauthorized photo reads',(await locked.GET()).status===401&&locked.events.length===0);
    const missingBucket=harness(file,'success',true,false);
    pass('current shared GET fails closed without storage',(await missingBucket.GET()).status===503&&missingBucket.rows.size===1&&missingBucket.events.length===0);
  }
  let t=harness(file);let res=await t.DELETE();pass(`${file} normal success removes both`,res.status===200&&t.rows.size===0&&t.objects.size===0);
  t=harness(file,'db-precommit-error');let threw=false;try{res=await t.DELETE();}catch{threw=true;}
  pass(`${file} precommit failure preserves metadata`,t.rows.size===1);
  pass(`${file} precommit failure ${patched?'preserves bytes':'DELETES bytes (negative control)'}`,t.objects.size===(patched?1:0));
  if(patched){const data=await res.json();pass(`${file} precommit reports uncertainty`,res.status===503&&data.deleteUncertain===true);}
  t=harness(file,'db-postcommit-error');threw=false;try{res=await t.DELETE();}catch{threw=true;}
  pass(`${file} postcommit failure does not claim success`,patched?res.status===503:threw);
  pass(`${file} postcommit failure ${patched?'preserves backup bytes':'deletes original bytes'}`,t.objects.size===(patched?1:0));
  t=harness(file);res=await t.DELETE();pass(`${file} operation order ${patched?'D1 before R2':'R2 before D1 negative control'}`,t.events.join(',')===(patched?'db-select,db-delete,bucket-delete':'db-select,bucket-delete,db-delete'));
  t=harness(file,'success',false);res=await t.DELETE();pass(`${file} unauthorized leaves records and bytes`,res.status===401&&t.rows.size===1&&t.objects.size===1&&t.events.length===0);
  t=harness(file,'success',true,true,false);res=await t.DELETE();pass(`${file} nonexistent photo not mutated`,res.status===404&&t.rows.size===0&&t.objects.size===1&&t.events.join(',')==='db-select');
  if(patched){
   t=harness(file,'success',true,false);res=await t.DELETE();pass(`${file} no R2 fails closed, retains metadata`,res.status===503&&t.rows.size===1&&t.events.length===0);
   t=harness(file,'bucket-error');res=await t.DELETE();const body=await res.json();pass(`${file} R2 cleanup error explicitly reported`,res.status===503&&body.cleanupUncertain===true&&t.objects.size===1&&t.rows.size===0);
  }else{
   t=harness(file,'bucket-error');threw=false;try{await t.DELETE();}catch{threw=true;}pass(`${file} negative control R2 failure throws and leaves metadata`,threw&&t.rows.size===1&&t.objects.size===1);
  }
 }
}
console.log(`${total}/${total} REAL TS DELETE route assertions PASS (original negative controls + patched)`);
