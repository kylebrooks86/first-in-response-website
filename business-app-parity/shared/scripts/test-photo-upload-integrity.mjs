import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=new URL('./fixtures/photo-integrity/', import.meta.url);
assert.equal(readFileSync(new URL('../app/api/customer-photos/route.ts',import.meta.url),'utf8'),readFileSync(new URL('./fixtures/photo-integrity/customer-photos.patched.ts.txt',import.meta.url),'utf8'),'Current shared route must match the tested patched source');
let passed=0;
function check(name,result){assert.equal(result,true,name);console.log('PASS:',name);passed++;}
function loadRoute(filename,mode='success',isAuthorized=true,hasBucket=true){
  const objects=new Map();const rows=new Map();let deletes=0,puts=0,dbWrites=0,photoSelects=0;
  const env={
    BUCKET:hasBucket?{
      async put(key,stream){puts++;if(mode==='bucket-error')throw Error('R2 failed');objects.set(key,stream);},
      async delete(key){deletes++;objects.delete(key);}
    }:null,
    DB:{prepare(query){return {bind(...args){return {
      async first(){if(query.startsWith('SELECT id FROM customers'))return args[0]==='customer-1'?{id:'customer-1'}:null;photoSelects++;return null;},
      async run(){dbWrites++;const [id,customerId,category,caption,filename,type,size,key,date]=args;
        if(mode==='precommit-error')throw Error('D1 insert never committed');
        rows.set(id,{id,customerId,category,caption,filename,type,size,key,date});
        if(mode==='postcommit-error')throw Error('D1 committed but response lost');
        return {success:true};
      }
    }; } }; } }
  };
  const compiled=ts.transpileModule(readFileSync(new URL(filename+'.txt',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{exports,require(id){if(id==='cloudflare:workers')return {env};if(id==='../../chatgpt-auth'||id==='../../owner-auth')return {getChatGPTUser:async()=>isAuthorized?{email:'kylebrooks8605@gmail.com'}:null,getOwnerUser:async()=>isAuthorized?{email:'kylebrooks8605@gmail.com'}:null};throw Error('Unexpected import '+id);},Response,Request,FormData,File,crypto:webcrypto,Date,console},{filename});
  return {POST:exports.POST,objects,rows,counts:()=>({deletes,puts,dbWrites,photoSelects})};
}
function request({customerId='customer-1',mime='image/png',name='before.png',bytes=4,category='before'}={}){
  const fd=new FormData();fd.set('customerId',customerId);fd.set('category',category);fd.set('caption','Before house wash');fd.set('photo',new File([new Uint8Array(bytes)],name,{type:mime}));return new Request('https://synthetic.invalid/api/customer-photos',{method:'POST',body:fd});
}
for (const file of ['customer-photos.original.ts','customer-photos.patched.ts','legacy.original.ts','legacy.patched.ts']) {
  const patched=file.includes('patched');
  {
    const m=loadRoute(file);const response=await m.POST(request());check(`${file} success returns 201 and retains photo with row`,response.status===201&&m.rows.size===1&&m.objects.size===1&&m.counts().deletes===0);
  }
  {
    const m=loadRoute(file,'postcommit-error');const response=await m.POST(request());check(`${file} ambiguous D1 response returns an unconfirmed error`,response.status===(patched?503:500)&&m.rows.size===1);
    if(patched){const payload=await response.json();check('patched ambiguous response instructs owner to inspect before retry',payload.saveUncertain===true&&payload.error.includes('Check this customer'));}
    check(`${file} committed photo bytes ${patched?'PRESERVED':'LOST (negative control)'}`,m.objects.size===(patched?1:0)&&m.counts().deletes===(patched?0:1));
  }
  {
    const m=loadRoute(file,'precommit-error');const response=await m.POST(request());check(`${file} D1 precommit error does not claim success`,response.status===(patched?503:500)&&m.rows.size===0);
    if(patched)check('patched precommit error leaves uploaded bytes for later reconciliation',m.objects.size===1&&m.counts().deletes===0);
  }
  {
    const m=loadRoute(file,'bucket-error');const response=await m.POST(request());check(`${file} R2 failure refuses DB insert`,response.status===500&&m.rows.size===0&&m.counts().dbWrites===0);
  }
  {
    const m=loadRoute(file,'success',false);const response=await m.POST(request());check(`${file} unauthorized request does not touch bucket or DB`,response.status===401&&m.counts().puts===0&&m.counts().dbWrites===0);
  }
  {
    const m=loadRoute(file,'success',true,false);const response=await m.POST(request());check(`${file} missing bucket fails closed`,response.status===503&&m.counts().dbWrites===0);
  }
  if(patched){
    for(const [name,config,status] of [['wrong customer',{customerId:'wrong'},404],['invalid file',{mime:'text/plain'},400],['oversized image',{bytes:15*1024*1024+1},413]]){
      const m=loadRoute(file);const res=await m.POST(request(config));check(`patched ${name} yields ${status} without object/database writes`,res.status===status&&m.counts().puts===0&&m.counts().dbWrites===0);
    }
  }
}
console.log(`PASS ${passed}/${passed} actual route-in-VM scenarios with original negative control`);
