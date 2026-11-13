// Persistent native Chromium profile; localhost server is stopped before offline process restarts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startCustomerDemo} from './local-customer-demo-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const {server,origin,scope,version}=await startCustomerDemo();const url=origin+scope;
const profile=mkdtempSync(join(tmpdir(),'fire-synthetic-cold-'));let context,serverRunning=true,passed=0;const remote=[];
const phrase='synthetic cold launch recovery phrase';
async function launch(offline){context=await chromium.launchPersistentContext(profile,{executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu'],viewport:{width:390,height:844}});await context.setOffline(offline);context.on('request',request=>{if(new URL(request.url()).origin!==origin)remote.push(request.url());});}
async function closeBrowser(){const browser=context.browser();await context.close();context=null;assert.equal(browser.isConnected(),false);}
async function open(){const p=await context.newPage();await p.goto(url);await p.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));return p;}
async function unlock(p){await p.fill('#phrase',phrase);await p.click('#unlock');await p.waitForFunction(()=>!document.getElementById('records').hidden);}
async function edit(p,name,revision){await p.selectOption('#name',name);await p.fill('#save-phrase',phrase);await p.click('#save');await p.waitForFunction(r=>document.getElementById('customer').textContent.includes('Revision '+r),revision);}
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
process.exitCode=1;
try{
 await launch(false);let p=await context.newPage();await p.goto(origin+'/seed');await p.evaluate(async()=>{await (await caches.open('fire-synthetic-customer-shell:obsolete')).put('/obsolete-synthetic',new Response('obsolete'));await (await caches.open('unrelated-cache')).put('/unrelated',new Response('retain'));});await p.goto(url);await p.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));
 await check('online installation controls only the isolated demo directory',async()=>{await p.waitForFunction(()=>navigator.serviceWorker.controller);const result=await p.evaluate(async()=>{const regs=await navigator.serviceWorker.getRegistrations();return regs.map(r=>r.scope);});assert.deepEqual(result,[url]);});
 await check('initialize and edit synthetic encrypted customer online',async()=>{await unlock(p);assert.match(await p.locator('#customer').textContent(),/Revision 1/);await edit(p,'Synthetic Updated',2);});
 await check('cache contains only eight static assets and no saved records or phrases',async()=>{
  const result=await p.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('fire-synthetic-customer-shell:')),entries=[];for(const name of names){const cache=await caches.open(name);for(const req of await cache.keys())entries.push({url:req.url,text:await (await cache.match(req)).text()});}return {names,entries};});assert.deepEqual(result.names,['fire-synthetic-customer-shell:'+version]);assert.deepEqual(result.entries.map(e=>new URL(e.url).pathname).sort(),[scope,...['store.js','backup.js','vault.js','demo.js','manifest.webmanifest','icon-180.png','icon-512.png'].map(f=>scope+f)].sort());for(const entry of result.entries){assert.ok(!entry.text.includes(phrase));assert.ok(!entry.text.includes('Synthetic Updated · Revision 2'));}
 });
 await check('API-like, query and POST responses never enter the shell cache',async()=>{const before=await p.evaluate(async()=>JSON.stringify(await (await caches.open((await caches.keys()).find(n=>n.startsWith('fire-synthetic-customer-shell:')))).keys().then(rows=>rows.map(r=>r.url))));await p.evaluate(async scope=>{await fetch(scope+'api/customers');await fetch(scope+'demo.js?customer=synthetic');await fetch(scope+'payments',{method:'POST',body:'synthetic only'});},scope);const after=await p.evaluate(async()=>JSON.stringify(await (await caches.open((await caches.keys()).find(n=>n.startsWith('fire-synthetic-customer-shell:')))).keys().then(rows=>rows.map(r=>r.url))));assert.equal(after,before);});
 await check('obsolete demo cache is removed without deleting an unrelated cache',async()=>{const result=await p.evaluate(async()=>({keys:await caches.keys(),unrelated:await (await (await caches.open('unrelated-cache')).match('/unrelated')).text()}));assert.ok(!result.keys.includes('fire-synthetic-customer-shell:obsolete'));assert.equal(result.unrelated,'retain');});
 await closeBrowser();await new Promise(resolve=>server.close(resolve));serverRunning=false;
 // Network disabled BEFORE the original URL is loaded; origin server is physically unavailable.
 await launch(true);p=await open();
 await check('first genuine offline cold launch retrieves saved encrypted edit',async()=>{await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);});
 await check('customer can be edited after offline cold launch',async()=>{await edit(p,'Synthetic Recovery',3);});
 await check('interrupted offline save preserves the prior record',async()=>{await p.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const r=window.originalPut.apply(this,args);r.addEventListener('success',()=>r.transaction.abort());return r;};});await p.selectOption('#name','Synthetic Customer');await p.fill('#save-phrase',phrase);await p.click('#save');await p.waitForFunction(()=>document.getElementById('status').textContent.includes('failed'));await p.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});await p.click('#lock');await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Recovery.*Revision 3/);});
 await closeBrowser();await launch(true);p=await open();
 await check('second offline process restart retains record and revision',async()=>{await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Recovery.*Revision 3/);});
 await check('missing cached shell fails clearly without exposing or erasing records',async()=>{await p.evaluate(async scope=>{const cache=await caches.open((await caches.keys()).find(n=>n.startsWith('fire-synthetic-customer-shell:')&&!n.endsWith('obsolete')));await cache.delete(scope);},scope);await p.reload();assert.match(await p.locator('body').textContent(),/assets are missing/);assert.equal(await p.locator('#customer').count(),0);const exists=await p.evaluate(async()=>{const databases=await indexedDB.databases();return databases.some(d=>d.name==='fire-local-customer-vault:v1:synthetic-demo-owner:synthetic-demo-target');});assert.equal(exists,true);});
 await check('no external services or Stripe requests',()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,genuineOfflineColdLaunch:true,offlineProcessRestarts:2,serverStopped:true,networkDisabledBeforeNavigation:true,nativeIndexedDB:true,nativeWebCrypto:true,iPhoneTested:false,obsoleteWorkerUpdateTested:false}));process.exitCode=0;
}finally{await context?.close();if(serverRunning)await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
