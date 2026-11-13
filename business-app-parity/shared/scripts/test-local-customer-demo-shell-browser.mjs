// Native Chromium worker lifecycle; faults affect only this localhost synthetic test server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startCustomerDemo} from './local-customer-demo-server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const phrase='synthetic shell recovery test phrase';
let app,browser,context,page,passed=0,port=0;const external=[];
async function start(revision,fault){
 app=await startCustomerDemo(port,{testRevision:revision});port=app.server.address().port;
 const handler=app.server.listeners('request')[0];app.server.removeAllListeners('request');
 app.server.on('request',(req,res)=>{
  if(fault==='download'&&req.url===app.scope+'vault.js'){req.socket.destroy();return;}
  if(fault==='write'&&req.url===app.scope+'worker.js'){
   const end=res.end.bind(res);res.end=body=>end("const originalPut=Cache.prototype.put;let attemptedPuts=0;Cache.prototype.put=function(...args){if(++attemptedPuts===2)return Promise.reject(new DOMException('Injected write failure','QuotaExceededError'));return originalPut.apply(this,args);};\n"+body);
  }
  handler(req,res);
 });return app;
}
async function stop(){if(app){app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app=null;}}
async function restart(revision,fault){await stop();return start(revision,fault);}
async function ready(){await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));await page.waitForFunction(()=>navigator.serviceWorker.controller);}
async function unlock(){await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);}
async function keys(){return page.evaluate(()=>caches.keys());}
async function update(){return page.evaluate(async()=>{
 const registration=await navigator.serviceWorker.getRegistration();
 const outcome=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Worker update did not finish')),12000);
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;
   const changed=()=>{if(['installed','redundant'].includes(worker.state)){clearTimeout(timer);resolve(worker.state);}};
   worker.addEventListener('statechange',changed);changed();
  },{once:true});
 });await registration.update();return outcome;
});}
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
process.exitCode=1;
try{
 await start('original');const origin=app.origin,scope=app.scope,url=origin+scope,oldCache='fire-synthetic-customer-shell:'+app.version;
 browser=await chromium.launch({executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
 context=await browser.newContext({viewport:{width:390,height:844}});context.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});
 page=await context.newPage();await page.goto(url);await ready();
 await check('initialize encrypted synthetic record before shell failures',async()=>{await unlock();await page.selectOption('#name','Synthetic Updated');await page.fill('#save-phrase',phrase);await page.click('#save');await page.waitForFunction(()=>document.getElementById('customer').textContent.includes('Revision 2'));});
 await check('missing JavaScript asset fails offline without recreating its cache entry',async()=>{
  await page.evaluate(async({oldCache,path})=>{await (await caches.open(oldCache)).delete(path);},{oldCache,path:scope+'vault.js'});
  await context.setOffline(true);const result=await page.evaluate(async path=>{const r=await fetch(path);return {status:r.status,body:await r.text()};},scope+'vault.js');assert.equal(result.status,503);assert.match(result.body,/asset missing/);
  assert.equal(await page.evaluate(async({oldCache,path})=>!!await(await caches.open(oldCache)).match(path),{oldCache,path:scope+'vault.js'}),false);
 });
 await check('reconnection repairs the missing static module',async()=>{await context.setOffline(false);assert.equal(await page.evaluate(async path=>(await fetch(path)).status,scope+'vault.js'),200);assert.equal(await page.evaluate(async({oldCache,path})=>!!await(await caches.open(oldCache)).match(path),{oldCache,path:scope+'vault.js'}),true);});
 await check('unmarked asset response is rejected and never cached',async()=>{
  await page.evaluate(async({oldCache,path})=>{await(await caches.open(oldCache)).delete(path);},{oldCache,path:scope+'vault.js'});
  const handler=app.server.listeners('request')[0];app.server.removeAllListeners('request');app.server.on('request',(req,res)=>{if(req.url===scope+'vault.js'){res.setHeader('Content-Type','text/javascript');res.end('// unmarked synthetic test response');}else handler(req,res);});
  assert.equal(await page.evaluate(async path=>(await fetch(path)).status,scope+'vault.js'),503);
  assert.equal(await page.evaluate(async({oldCache,path})=>!!await(await caches.open(oldCache)).match(path),{oldCache,path:scope+'vault.js'}),false);
  app.server.removeAllListeners('request');app.server.on('request',handler);assert.equal(await page.evaluate(async path=>(await fetch(path)).status,scope+'vault.js'),200);
 });
 await check('interrupted update download leaves old worker and complete shell active',async()=>{await restart('broken-download','download');assert.equal(await update(),'redundant');assert.deepEqual((await keys()).filter(k=>k.startsWith('fire-synthetic-customer-shell:')),[oldCache]);await context.setOffline(true);await page.reload();await ready();await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);await context.setOffline(false);});
 await check('partial cache-write failure discards candidate cache and preserves old shell',async()=>{await restart('broken-write','write');assert.equal(await update(),'redundant');assert.deepEqual((await keys()).filter(k=>k.startsWith('fire-synthetic-customer-shell:')),[oldCache]);await context.setOffline(true);await page.reload();await ready();await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);await context.setOffline(false);});
 const peer=await context.newPage();await peer.goto(url);await peer.waitForFunction(()=>navigator.serviceWorker.controller);let newCache;
 await check('valid new worker waits while old client remains open',async()=>{await page.evaluate(async()=>{await(await caches.open('unrelated-shell-test')).put('/unrelated',new Response('retain'));});await restart('replacement');newCache='fire-synthetic-customer-shell:'+app.version;assert.equal(await update(),'installed');const result=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {active:r.active.state,waiting:r.waiting?.state,keys:await caches.keys()};});assert.equal(result.active,'activated');assert.equal(result.waiting,'installed');assert.ok(result.keys.includes(oldCache)&&result.keys.includes(newCache));});
 await check('closing one client does not prematurely activate replacement',async()=>{await page.close();page=peer;assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).waiting?.state),'installed');});
 await check('replacement activates after last controlled client closes and retains vault',async()=>{
  await page.close();page=await context.newPage();await page.goto(origin+'/seed');await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration('/synthetic-customer-demo/');return r?.active?.state==='activated'&&!r.waiting;});
  await page.goto(url);await ready();assert.ok(!(await keys()).includes(oldCache));assert.ok((await keys()).includes(newCache));assert.ok((await keys()).includes('unrelated-shell-test'));
  await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);
 });
 await check('updated worker and retained vault remain usable without origin server',async()=>{await stop();await context.setOffline(true);await page.reload();await ready();await unlock();assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);});
 await check('no external service, database or Stripe requests',()=>assert.deepEqual(external,[]));
 console.log(JSON.stringify({passed,total:passed,nativeWorkerUpgrade:true,partialCacheWriteFailureInjected:true,interruptedDownload:true,missingJavaScriptRepair:true,nativeIndexedDB:true,nativeWebCrypto:true,iPhoneTested:false}));process.exitCode=0;
}finally{await browser?.close();await stop();}
