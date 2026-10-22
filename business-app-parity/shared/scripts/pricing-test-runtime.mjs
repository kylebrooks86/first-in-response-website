/** Disposable SQLite and actual pricing route, shared by source and Chrome tests. */
import {readFileSync,readdirSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
export function pricingRuntime(){
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
 let owner={email:'kylebrooks8605@gmail.com'},reads=0,writes=0;
 const env={DB:{prepare(sql){return{bind(...args){return{async first(){reads++;return db.prepare(sql).get(...args)??null;},async all(){reads++;return{results:db.prepare(sql).all(...args)};},async run(){writes++;return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}}}}};
 function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{assert.ok(key in imports,key);return imports[key];},Response,Request,crypto,Date,URL,console});return exports;}
 const catalog=load('lib/fire-services.ts',{});const pricing=load('lib/service-pricing.ts',{'./fire-services':catalog});
 const api=load('app/api/service-pricing/route.ts',{'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>owner},'../../../lib/fire-services':catalog,'../../../lib/service-pricing':pricing});
 return{db,api,pricing,catalog,load,setOwner:user=>owner=user,counters:()=>({reads,writes}),async put(body){return api.PUT(new Request('https://synthetic.invalid/api/service-pricing',{method:'PUT',body:typeof body==='string'?body:JSON.stringify(body)}));},async get(){const response=await api.GET();return{response,data:await response.json()};}};
}
