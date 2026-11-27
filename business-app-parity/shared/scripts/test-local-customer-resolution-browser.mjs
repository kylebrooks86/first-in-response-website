// Real Chromium IndexedDB integration; synthetic disposable profile, localhost only.
// Optional FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE and FIRE_BROWSER_TEST_EXECUTABLE select local tools.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE || 'playwright');
const modules = new Map();
for (const [url, file] of [['/store.js','local-customer-store'],['/backup.js','local-customer-backup'],['/vault.js','local-customer-vault']]) {
  const source=readFileSync(new URL(`../lib/${file}.ts`,import.meta.url),'utf8');
  modules.set(url,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./local-customer-store'", "'/store.js'").replace("'./local-customer-backup'", "'/backup.js'"));
}
const server=createServer((req,res)=>{
  if(modules.has(req.url)){res.setHeader('Content-Type','application/javascript');res.end(modules.get(req.url));}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic encrypted recovery test</title>');}
  else {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=mkdtempSync(join(tmpdir(),'fire-customer-idb-'));
let context,passed=0;const remoteRequests=[];
async function launch(){
  context=await chromium.launchPersistentContext(profile,{
    executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE || undefined,
    headless:true,args:['--no-sandbox','--disable-gpu'],
  });
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){remoteRequests.push(route.request().url());return route.abort();}
    return route.continue();
  });
}
async function page(){
  const p=await context.newPage();await p.goto(origin);
  await p.evaluate(async()=>{
    window.api=await import('/store.js'); window.backups=await import('/backup.js'); window.phrase='synthetic browser recovery phrase only';
    window.customer={id:'synthetic-1',name:'Synthetic Customer',email:'test@example.invalid',phone:'',address:'Synthetic',leadSource:'test'};
    window.vaultApi=await import('/vault.js'); window.vault=await vaultApi.openLocalCustomerVault('synthetic-owner','synthetic-target'); const row={...customer,revision:1,updatedAt:'2026-10-10T00:00:00.000Z'}; window.archive={format:'fire-local-customers',version:1,namespace:api.localCustomerDatabaseName('synthetic-owner','synthetic-target'),customers:[row],pendingOperations:[{id:'synthetic-operation',kind:'customer-upsert',expectedRevision:0,customer:row,input:customer}]}; window.rawVault=async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(vault.namespace,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('sealed');const req=tx.objectStore('sealed').getAll();tx.oncomplete=()=>resolve(req.result);tx.onabort=()=>reject(tx.error);});db.close();return rows;};
  });return p;
}
async function check(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}
process.exitCode=1;
try {
 await launch();const p=await page();const version=context.browser().version();
 await p.evaluate(async()=>{await vault.initialize(archive,phrase);window.session=await vault.unlock(phrase);window.makeResolution=(op,reviewed)=>({format:'fire-local-customer-resolution',version:1,namespace:archive.namespace,operationId:op,originalDraft:{...customer,name:'Synthetic Unsaved Original'},originalExpectedRevision:1,reviewedSnapshot:reviewed,proposed:{...customer,name:'Synthetic Deliberate Result'}});});
 await check('deliberate resolution commits chosen record and encrypted original draft together',async()=>{
  assert.equal(await p.evaluate(async()=>{const result=await session.saveReviewedResolution(makeResolution('resolved-1',archive),phrase);const retained=await session.inspectResolutionArchive('resolved-1',phrase);return result.revision===2&&retained.originalDraft.name==='Synthetic Unsaved Original'&&retained.reviewedSnapshot.customers[0].revision===1&&session.exportSnapshot().pendingOperations.length===2;}),true);
 });
 await check('both stored rows exclude plaintext contact data',async()=>{const raw=await p.evaluate(()=>rawVault());assert.equal(raw.length,2);assert.ok(!JSON.stringify(raw).includes('Synthetic'));assert.ok(raw.every(row=>Object.keys(row).sort().join(',')==='envelope,id,version'));});
 await check('wrong phrase cannot inspect original draft archive',async()=>assert.equal(await p.evaluate(async()=>{try{await session.inspectResolutionArchive('resolved-1','incorrect synthetic phrase only');return false;}catch{return true;}}),true));
 await check('resolution archive cannot be mistaken for normal backup or another account',async()=>assert.equal(await p.evaluate(async()=>{const raw=(await rawVault()).find(row=>row.id==='resolution-resolved-1');let failures=0;try{await backups.recoverLocalCustomerBackup(raw.envelope,archive.namespace,phrase);}catch{failures++;}try{await backups.recoverLocalCustomerResolutionArchive(raw.envelope,'fire-local-customers:v1:another:account',phrase);}catch{failures++;}return failures===2;}),true));
 await check('duplicate resolution is rejected without another receipt or archive',async()=>assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await session.saveReviewedResolution(makeResolution('resolved-1',session.exportSnapshot()),phrase);return false;}catch{return before===JSON.stringify(await rawVault());}}),true));
 await p.evaluate(async()=>{window.reviewed=session.exportSnapshot();window.other=await vault.unlock(phrase);await other.saveCustomer({...customer,name:'Synthetic Other Writer'},'other-write',2,phrase);});
 await check('stale review rejects without modifying newer stored snapshot',async()=>assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await session.saveReviewedResolution(makeResolution('stale-review',reviewed),phrase);return false;}catch{return before===JSON.stringify(await rawVault());}}),true));
 await p.evaluate(async()=>{window.reviewed=await session.inspectStoredSnapshot(phrase);});
 await check('quota failure archiving draft aborts both changes',async()=>assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault()),original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){if(value.id.startsWith('resolution-'))throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,value,...args);};try{await session.saveReviewedResolution(makeResolution('quota-resolution',reviewed),phrase);return false;}catch{return before===JSON.stringify(await rawVault());}finally{IDBObjectStore.prototype.add=original;}}),true));
 await check('snapshot put failure rolls back pending draft archive add',async()=>assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault()),original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic write failure','QuotaExceededError');};try{await session.saveReviewedResolution(makeResolution('put-failure',reviewed),phrase);return false;}catch{return before===JSON.stringify(await rawVault());}finally{IDBObjectStore.prototype.put=original;}}),true));
 await check('native transaction abort leaves neither resolution receipt nor archive',async()=>assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault()),original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){const r=original.apply(this,args);r.addEventListener('success',()=>r.transaction.abort());return r;};try{await session.saveReviewedResolution(makeResolution('aborted-resolution',reviewed),phrase);return false;}catch{return before===JSON.stringify(await rawVault());}finally{IDBObjectStore.prototype.add=original;}}),true));
 await check('intervening writer during encryption is rejected by native transaction comparison',async()=>assert.equal(await p.evaluate(async()=>{const original=crypto.subtle.encrypt;let calls=0,injected=false;crypto.subtle.encrypt=async function(...args){calls++;if(calls===2&&!injected){injected=true;await other.saveCustomer({...customer,name:'Synthetic Intervening Writer'},'intervening-write',3,phrase);}return original.apply(this,args);};let rejected=false;try{await session.saveReviewedResolution(makeResolution('raced-resolution',reviewed),phrase);}catch{rejected=true;}finally{crypto.subtle.encrypt=original;}const fresh=await session.inspectStoredSnapshot(phrase),raw=await rawVault();return injected&&rejected&&fresh.customers[0].revision===4&&fresh.customers[0].name==='Synthetic Intervening Writer'&&!raw.some(row=>row.id==='resolution-raced-resolution')&&!fresh.pendingOperations.some(op=>op.id==='raced-resolution');}),true));
 await check('invalid original draft or customer mismatch fails before writes',async()=>assert.equal(await p.evaluate(async()=>{const fresh=await session.inspectStoredSnapshot(phrase),before=JSON.stringify(await rawVault());let failures=0;for(const patch of [{originalDraft:{...customer,id:'different'}},{originalExpectedRevision:-1},{namespace:'fire-local-customers:v1:other:target'}]){try{await session.saveReviewedResolution({...makeResolution('invalid-resolution',fresh),...patch},phrase);}catch{failures++;}}return failures===3&&before===JSON.stringify(await rawVault());}),true));
 await check('lock during encryption prevents both writes and archive disclosure',async()=>assert.equal(await p.evaluate(async()=>{const fresh=await session.inspectStoredSnapshot(phrase),before=JSON.stringify(await rawVault()),original=crypto.subtle.encrypt;crypto.subtle.encrypt=async function(...args){const result=await original.apply(this,args);vault.lock();return result;};let failed=false,hidden=false;try{await session.saveReviewedResolution(makeResolution('locked-resolution',fresh),phrase);}catch{failed=true;}finally{crypto.subtle.encrypt=original;}try{await session.inspectResolutionArchive('resolved-1',phrase);}catch{hidden=true;}return failed&&hidden&&before===JSON.stringify(await rawVault());}),true));
 await p.evaluate(()=>vault.close());await context.close();await launch();const reopened=await page();
 await check('browser restart retains encrypted original draft and winning stored history',async()=>assert.equal(await reopened.evaluate(async()=>{const opened=await vault.unlock(phrase);const retained=await opened.inspectResolutionArchive('resolved-1',phrase);return retained.originalDraft.name==='Synthetic Unsaved Original'&&retained.originalExpectedRevision===1&&opened.exportSnapshot().customers[0].revision===4&&opened.exportSnapshot().pendingOperations.length===4;}),true));
 await check('no external or production requests',async()=>assert.deepEqual(remoteRequests,[]));
 console.log(JSON.stringify({passed,total:passed,browser:version,nativeIndexedDB:true,nativeWebCrypto:true,syntheticOnly:true,resolutionUiActivated:false,productionActivated:false,originalDraftEncrypted:true,atomicTransactionCompared:true}));process.exitCode=0;
}finally{await context?.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
