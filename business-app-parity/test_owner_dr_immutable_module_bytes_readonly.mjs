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
 // Original frozen DR ZIP verified independently from owner-private Drive:
 // 190 JS + 3 MJS, 41 BIN, 5 JSON (one Wrangler), 2 CSS, BUILD_ID.
 // Only JS/MJS match the actual reviewed ESModule Wrangler globs.
 for(let i=0;i<193;i++){
  const name=i===0?'fire-noassets-entry.mjs':
   i<=190?'fire-inline-assets/module-'+String(i).padStart(3,'0')+'.js':
   'fire-inline-assets/module-'+String(i).padStart(3,'0')+'.mjs';
  const content=textFor(i);
  inventory.push({path:name,bytes:content.length,sha256:sha(content)});
  modules.push({name,content_type:'application/javascript+module',content_base64:content.toString('base64')});
 }
 const aux=['BUILD_ID',
  'next/styles.css','next/layout.css',
  ...Array.from({length:41},(_,i)=>'fire-inline-assets/asset-'+String(i).padStart(3,'0')+'-1234567890abcdef.bin'),
  '.vite/manifest.json','vinext-externals.json','vinext-server.json','other.json'];
 for(const name of aux){
  const content=Buffer.from('SYNTHETIC '+name);
  inventory.push({path:name,bytes:content.length,sha256:sha(content)});
 }
 return {inventory,provider:{success:true,errors:[],result:{id:VERSION,main_module:'fire-noassets-entry.mjs',urls:[],modules}}};
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
test('all 193 rule-matching synthetic runtime module bytes match (49 excluded archive files)',()=>{
 const f=fixture(),r=compareImmutableModuleBytes(f.provider,f.inventory);
 assert.equal(r.matchedModules,193);
 assert.equal(r.auxiliaryNonRuntimeFilesNotProven,48);
 assert.equal(r.wholeArchiveHostedBytesVerified,false);
 assert.equal(r.moduleContentHashesCompared,true);
 assert.equal(r.versionPinnedRoutableUrlCount,0);
 assert.equal(r.versionPinnedRoutableUrlsRequireReview,false);
 assert.equal(r.accountWideAliasRouteOrAccessIsolationVerified,false);
 assert.equal(r.authenticatedProviderReadback,false);
 assert.equal(r.gate4Accepted,false);
 assert.equal(r.deploymentPerformed,false);
});
test('version-pinned public URLs are recorded only as a count, never claimed secured',()=>{
 const f=fixture();
 f.provider.result.urls=['https://synthetic-version.example.invalid'];
 const r=compareImmutableModuleBytes(f.provider,f.inventory);
 assert.equal(r.versionPinnedRoutableUrlCount,1);
 assert.equal(r.versionPinnedRoutableUrlsRequireReview,true);
 assert.equal(r.accountWideAliasRouteOrAccessIsolationVerified,false);
 assert.ok(!JSON.stringify(r).includes('synthetic-version.example.invalid'));
 assert.equal(r.gate4Accepted,false);
});
denied('reject missing version-pinned URL inventory',f=>delete f.provider.result.urls);
denied('reject malformed version routable URL entry',f=>f.provider.result.urls=['https://ok.example.invalid',23]);
denied('reject control characters in version routable URL',f=>f.provider.result.urls=['https://ok.example.invalid\nX']);
denied('reject script bytes mislabeled as plain text module',f=>f.provider.result.modules[4].content_type='text/plain');
denied('reject script bytes mislabeled as commonjs module',f=>f.provider.result.modules[4].content_type='application/javascript');
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
denied('reject auxiliary binary file presented as a runtime module',f=>{
 const want=f.inventory.find(x=>x.path.endsWith('.bin'));
 f.provider.result.modules[10]={name:want.path,content_type:'application/octet-stream',
  content_base64:Buffer.from('x').toString('base64')};
});
denied('reject previously excluded binary asset reclassified as JS in reviewed archive',f=>{
 f.inventory.find(x=>x.path.endsWith('.bin')).path='fire-inline-assets/asset-000-1234567890abcdef.js';
});
denied('reject archive with missing binary asset despite unchanged 193 JS modules',f=>{
 f.inventory.find(x=>x.path.endsWith('.bin')).path='fire-inline-assets/other.bin';
});
console.log('TOTAL '+passed+'/'+passed+' DR ESModule-matched hosted-byte negative cases PASS; no external requests');
