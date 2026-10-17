/** Load actual TypeScript routes and their dependencies for isolated test bindings. */
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
export function createRouteFixtureLoader(root,env,user){
 const cache=new Map();
 return function load(path){
  const absolute=resolve(root,path);if(cache.has(absolute))return cache.get(absolute);
  const exports={};cache.set(absolute,exports);
  const code=ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports,Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,crypto,process,console,Error,structuredClone,fetch:(...args)=>globalThis.fetch(...args),require(name){
   if(name==='cloudflare:workers')return {env};
   if(name.endsWith('/chatgpt-auth')||name.endsWith('/owner-auth'))return {getChatGPTUser:async()=>user(),getOwnerUser:async()=>user()};
   if(name.startsWith('.')){const base=resolve(dirname(absolute),name);if(base.endsWith('.mjs'))return require(base);return load(existsSync(base)?base:base+'.ts');}
   return require(name);
  }};
  vm.runInNewContext(code,context,{filename:path});return exports;
 };
}
