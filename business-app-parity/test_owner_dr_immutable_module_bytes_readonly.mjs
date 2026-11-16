/**
 * Changed-function synthetic negatives for DR hosted immutable module proof.
 * ALL local; no owner private ZIP, Cloudflare, Stripe, login, mutations or R2.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compareImmutableModuleBytes} from './owner_dr_immutable_module_bytes_readonly.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const VERSION='f7b7e27c-986b-44b5-b0f9-5e8e4b623426';
const textFor=n=>Buffer.from('FIRE QA synthetic immutable module '+n+'\n','utf8');
const fixture=()=>{
 const inventory=[{path:'wrangler.json',bytes:2,sha256:sha(Buffer.from('{}'))}];
 const modules=[];
 for(let i=0;i<241;i++){
  const name=i===0?'fire-noassets-entry.mjs':'fire-inline-assets/module-'+String(i).padStart(3,'0')+'.mjs';
  const content=textFor(i);
  inventory.push({path:name,bytes:content.length,sha256:sha(content)});
  modules.push({name,content_type:'application/javascript+module',content_base64:content.toString('base64')});
 }
 return {inventory,provider:{success:true,errors:[],result:{id:VERSION,main_module:'fire-noassets-entry.mjs',modules}}};
};
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
const denied=(name,mutate)=>{
 const f=fixture();mutate(f);
 test(name,()=>assert.throws(()=>compareImmutableModuleBytes(f.provider,f.inventory),
  /FIRE DR IMMUTABLE MODULE PROOF STOP/));
};
test('default executable mode is truly offline and reports no provider proof',()=>{
 const file=fileURLToPath(new URL('./owner_dr_immutable_module_bytes_readonly.mjs',import.meta.url));
 const output=JSON.parse(execFileSync(process.execPath,[file],{encoding:'utf8',env:{...process.env,CI:'true'}}));
 assert.equal(output.providerContacted,false);
 assert.equal(output.gate4Accepted,false);
});
test('all 241 synthetic exact SHA256 module bytes match without pretending provider auth',()=>{
 const f=fixture(),r=compareImmutableModuleBytes(f.provider,f.inventory);
 assert.equal(r.matchedModules,241);
 assert.equal(r.moduleContentHashesCompared,true);
 assert.equal(r.authenticatedProviderReadback,false);
 assert.equal(r.gate4Accepted,false);
 assert.equal(r.deploymentPerformed,false);
});
denied('reject one altered hosted byte, same decoded byte length',f=>{
 const m=f.provider.result.modules[8];
 const b=Buffer.from(m.content_base64,'base64');b[0]^=1;m.content_base64=b.toString('base64');
});
denied('reject single omitted module',f=>f.provider.result.modules.pop());
denied('reject unexpected extra module',f=>f.provider.result.modules.push({
 name:'unexpected.mjs',content_type:'text/plain',content_base64:'eA=='
}));
denied('reject duplicate hosted name replacing a legitimate one',f=>{
 f.provider.result.modules[9]={...f.provider.result.modules[0]};
});
denied('reject wrong immutable DR version even with same files',f=>{
 f.provider.result.id='b7c42773-5a93-4c6c-91d2-83cdb8e857d9';
});
denied('reject wrong entrypoint',f=>f.provider.result.main_module='index.mjs');
denied('reject false provider success',f=>f.provider.success=false);
denied('reject provider error present',f=>f.provider.errors=[{code:1000}]);
denied('reject provider response missing modules',f=>delete f.provider.result.modules);
denied('reject malformed/whitespace base64',f=>f.provider.result.modules[6].content_base64+=' \n');
denied('reject noncanonical base64',f=>f.provider.result.modules[6].content_base64='Zg');
denied('reject claimed content digest with wrong expected bytes',f=>f.inventory[1].bytes++);
denied('reject duplicate approved source module names',f=>f.inventory[4].path=f.inventory[3].path);
denied('reject missing reviewed wrangler config',f=>f.inventory[0].path='another.mjs');
denied('reject missing expected entrypoint',f=>f.inventory[1].path='main.mjs');
denied('reject untrusted parent-directory source inventory',f=>f.inventory[3].path='../escape.mjs');
denied('reject unexpected empty/unsupported module metadata',f=>f.provider.result.modules[2].content_type='');
denied('reject source inventory size mismatches',f=>f.inventory.pop());
console.log('TOTAL '+passed+'/'+passed+' DR immutable-module proof changed-function tests PASS; no external requests');
