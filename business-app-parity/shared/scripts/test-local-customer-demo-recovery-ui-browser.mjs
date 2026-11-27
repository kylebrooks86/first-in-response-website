// First installation failures and missing-module recovery in native Chromium; synthetic-only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startCustomerDemo} from './local-customer-demo-server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const {server,origin,scope,version}=await startCustomerDemo();let browser,page,context,passed=0,failInstall=true;const remote=[];
const phrase='synthetic visible recovery phrase',cacheName='fire-synthetic-customer-shell:'+version;
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(failInstall&&req.url===scope+'worker.js'){
  const end=res.end.bind(res);res.end=body=>end("const originalPut=Cache.prototype.put;let count=0;Cache.prototype.put=function(...args){if(++count===2)return Promise.reject(new DOMException('Injected first install failure','QuotaExceededError'));return originalPut.apply(this,args);};\n"+body);
 }handler(req,res);
});
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
async function unlock(){await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);}
async function ready(){await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));await page.waitForFunction(()=>navigator.serviceWorker.controller);}
async function snapshot(){return page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fire-local-customer-vault:v1:synthetic-demo-owner:synthetic-demo-target');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const names=Array.from(db.objectStoreNames),tx=db.transaction(names,'readonly');return await Promise.all(names.map(name=>new Promise((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve({name,rows:r.result});r.onerror=()=>reject(r.error);})));}finally{db.close();}
 });}
process.exitCode=1;
try{
 browser=await chromium.launch({executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});context=await browser.newContext({viewport:{width:390,height:844}});
 context.on('request',r=>{if(new URL(r.url()).origin!==origin)remote.push(r.url());});page=await context.newPage();await page.goto(origin+scope);
 await check('first install failure shows visible retry without claiming offline readiness',async()=>{await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('unavailable'));assert.equal(await page.locator('#recovery').isVisible(),true);assert.match(await page.locator('#recovery-message').textContent(),/installation did not finish/);assert.equal(await page.locator('#retry-load').isEnabled(),true);assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null);assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);});
 await check('synthetic encrypted customer can be preserved during failed offline installation',async()=>{await unlock();await page.selectOption('#name','Synthetic Updated');await page.fill('#save-phrase',phrase);await page.click('#save');await page.waitForFunction(()=>document.getElementById('customer').textContent.includes('Revision 2'));await page.click('#lock');});
 let before=await snapshot();
 await check('successful first-install retry preserves existing encrypted record',async()=>{failInstall=false;await page.click('#retry-load');await ready();assert.equal(await page.locator('#recovery').isVisible(),false);assert.deepEqual(await snapshot(),before);await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);await page.click('#lock');});
 before=await snapshot();await context.setOffline(true);
 for(const asset of ['demo.js','vault.js']){
  await check('missing '+asset+' shows locked recovery controls on offline reload',async()=>{
   await page.evaluate(async({cacheName,path})=>{await(await caches.open(cacheName)).delete(path);},{cacheName,path:scope+asset});await page.reload();await page.waitForFunction(()=>!document.getElementById('recovery').hidden);
   assert.match(await page.locator('#status').textContent(),/customer records remain locked/);assert.match(await page.locator('#recovery-message').textContent(),/encrypted records are not deleted/);assert.equal(await page.locator('#records').isVisible(),false);assert.equal(await page.locator('#customer').textContent(),'');assert.equal(await page.locator('#unlock').isDisabled(),true);assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await page.locator('#lock').isDisabled(),true);assert.equal(await page.locator('#retry-load').isEnabled(),true);assert.deepEqual(await snapshot(),before);
  });
  await check('offline retry with missing '+asset+' remains locked without changing data',async()=>{await page.click('#retry-load');await page.waitForFunction(()=>!document.getElementById('recovery').hidden);assert.equal(await page.locator('#unlock').isDisabled(),true);assert.deepEqual(await snapshot(),before);});
  await check('online retry repairs '+asset+' and retrieves the unchanged customer',async()=>{await context.setOffline(false);await page.click('#retry-load');await ready();assert.equal(await page.locator('#recovery').isVisible(),false);assert.deepEqual(await snapshot(),before);await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);await page.click('#lock');await context.setOffline(true);});
 }
 await check('recovery screen has mobile touch targets and fits viewport',async()=>{const values=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,height:document.getElementById('unlock').getBoundingClientRect().height}));assert.equal(values.fits,true);assert.ok(values.height>=48);});
 await check('no external services, production database or Stripe requests',()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,firstInstallFailureInjected:true,visibleMissingModuleRecovery:true,unchangedEncryptedSnapshots:true,nativeIndexedDB:true,nativeWebCrypto:true,iPhoneTested:false}));process.exitCode=0;
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
