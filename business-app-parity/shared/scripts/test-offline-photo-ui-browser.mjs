/** Gate 7: ACTUAL FIRE customer-photo React screen in pinned Chrome.
 * Native DOM controls, real IndexedDB, ZIP download/readback and offline actions.
 * All data is synthetic. No deployed app, server auth, external URLs or accounts.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
if(!process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||!process.env.FIRE_BROWSER_TEST_EXECUTABLE)
 throw Error('Pinned isolated browser runner is required.');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE);
const root=resolve(new URL('..',import.meta.url).pathname);
const bundle=await esbuild.build({stdin:{
 contents:"import React from 'react';import{createRoot}from'react-dom/client';import{OfflineCustomerPhotos}from'./components/offline-customer-photos';const root=createRoot(document.querySelector('#app'));root.render(React.createElement(OfflineCustomerPhotos,{customerId:'synthetic-customer-photo',customerName:'Synthetic Photo Customer',knownCustomerIds:['synthetic-customer-photo']}));",
 resolveDir:root,sourcefile:'photo-ui-browser-fixture.tsx',loader:'tsx'
 },bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
const shell='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIRE synthetic customer photo UI</title><div id="app"></div><script type="module" src="/bundle.js"></script>';
// Disposable test-only worker: deliberately NOT registered in FIRE production.
// Exercise true closed-browser, stopped-server cold launch with the actual
// React photo component bundled, rather than only the storage libraries.
const fixtureWorker=`const CACHE='fire-synthetic-photo-cold-launch-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(['/','/bundle.js']);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!['/','/bundle.js'].includes(url.pathname))return;
 event.respondWith((async()=>await (await caches.open(CACHE)).match(url.pathname)||fetch(event.request))());
});`;
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/sw.js'){res.setHeader('content-type','text/javascript');res.setHeader('Service-Worker-Allowed','/');res.end(fixtureWorker);return;}
 if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(shell);return;}
 res.statusCode=404;res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'fire-offline-react-photo-ui-'));
let context,serverClosed=false,checks=0;const browserErrors=[],remote=[];
const check=(condition,msg)=>{assert.ok(condition,msg);checks++;console.log('PASS: '+msg);};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,acceptDownloads:true,viewport:{width:390,height:844},args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=context;
 await ctx.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}
  return route.continue();
 });
 const page=await ctx.newPage();
 page.on('pageerror',error=>browserErrors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(origin);
 await page.getByRole('button',{name:'Photo library'}).waitFor();
 await page.getByText('No on-device photos for this customer').waitFor();
 check(await page.locator('.photo-card').count()===0,'Actual React customer-photo screen mounts with empty on-device gallery');
 const library=page.locator('input[type="file"][multiple]');
 const take=(name)=>({name,mimeType:'image/png',buffer:png});
 await page.getByPlaceholder('North siding, water damage…').fill('Before north siding');
 await library.setInputFiles(take('synthetic-before.png'));
 await page.getByText('Photos verified on this device.').waitFor({timeout:20000}).catch(async()=>page.getByText(/Photos verified on this device/).waitFor());
 check(await page.locator('.photo-card').count()===1,'Owner photo-library control creates a real IndexedDB photo and renders it');
 check((await page.locator('.photo-card').first().innerText()).includes('Before north siding'),'Owner-entered photo caption is displayed');
 await page.getByLabel('Photo type').selectOption('after');
 await page.getByPlaceholder('North siding, water damage…').fill('After north siding');
 await library.setInputFiles(take('synthetic-after.png'));
 await page.getByText(/Photos verified on this device/).waitFor();
 await page.locator('.photo-card').nth(1).waitFor();
 check(await page.locator('.photo-card').count()===2,'Owner can create separate before and after local photographs');
 check(await page.getByText('Before & after comparison').count()===1,'Real gallery reveals its before/after comparison tool');
 await ctx.setOffline(true);
 await page.getByRole('button',{name:"Prepare this customer's photos ZIP"}).click();
 await page.getByText(/photo ZIP passed integrity checks/).waitFor({timeout:30000});
 check(await page.getByRole('button',{name:'Save prepared ZIP to Files'}).count()===1,'Photo ZIP preparation works in airplane mode and exposes a separate iOS share gesture');
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'canShare',{configurable:true,value:files=>files.files?.length===1});
  Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
   // An iOS share-sheet call must be invoked within the real TAP handler,
   // before awaiting file creation or unrelated asynchronous work.
   window.fixtureNativeShare={active:Boolean(navigator.userActivation?.isActive),
     filename:files[0].name,size:files[0].size,type:files[0].type};
  }});
 });
 await page.getByRole('button',{name:'Save prepared ZIP to Files'}).click();
 await page.getByText(/Photo ZIP was offered to the iOS share sheet/).waitFor();
 const share=await page.evaluate(()=>window.fixtureNativeShare);
 check(share?.active===true&&share.size>100&&share.type==='application/zip',
   'Real owner Save-to-Files button invokes the native share sheet within its fresh user gesture');
 check(share.filename.startsWith('FIRE-customer-synthetic-customer-photo-photos-'),
   'Native sharing includes the verified customer-specific ZIP filename and bytes');

 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download prepared ZIP'}).click()]);
 const filename=download.suggestedFilename();
 const exported=readFileSync(await download.path());
 check(filename.startsWith('FIRE-customer-synthetic-customer-photo-photos-')&&exported.length>100,'Real owner click downloads a nonempty customer-only ZIP');
 const verifyInput=page.locator('input[type="file"][accept*=".zip"]').first();
 await verifyInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/Saved ZIP selected from Files passed photo checksums/).waitFor({timeout:30000});
 check((await page.getByRole('status').allInnerTexts()).some(t=>t.includes('2 exactly match this device')),'Actual Files re-selection checks saved backup against both original photo blobs');
 const restoreInput=page.locator('input[type="file"][accept*=".zip"]').nth(1);
 await restoreInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/Restored 0 new verified photo/).waitFor({timeout:30000});
 check(await page.locator('.photo-card').count()===2,'Repeated owner ZIP restore is idempotent and does not duplicate photos');
 await page.getByRole('button',{name:'Delete on-device photo'}).first().click();
 await page.locator('.photo-card').nth(1).waitFor({state:'detached'});
 check(await page.locator('.photo-card').count()===1,'Confirmed owner deletion affects only the selected local photo');
 await restoreInput.setInputFiles([]);
 await restoreInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/Restored 1 new verified photo/).waitFor({timeout:30000});
 check(await page.locator('.photo-card').count()===2,'Owner ZIP restore recovers deleted photo without replacing the remaining original');
 await ctx.setOffline(false);
 await page.reload();
 await page.locator('.photo-card').nth(1).waitFor({timeout:30000});
 check(await page.locator('.photo-card').count()===2,'React photo screen reload displays both restored IndexedDB photos');
 // Register a strictly-local fixture worker after online seeding of the
 // ACTUAL React UI. This tests installable-shell dependencies, but does NOT
 // assert full hosted FIRE framework offline support or iPhone Safari success.
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 const cacheEvidence=await page.evaluate(async()=>({
   controlled:Boolean(navigator.serviceWorker.controller),
   shell:Boolean(await (await caches.open('fire-synthetic-photo-cold-launch-v1')).match('/')),
   bundle:Boolean(await (await caches.open('fire-synthetic-photo-cold-launch-v1')).match('/bundle.js'))
 }));
 check(cacheEvidence.controlled&&cacheEvidence.shell&&cacheEvidence.bundle,'Actual React photo screen shell and bundle are cached by a separate synthetic install worker');
 await ctx.close();context=null;
 await new Promise(resolve=>server.close(resolve));serverClosed=true;
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,acceptDownloads:true,viewport:{width:390,height:844},args:['--no-sandbox','--disable-dev-shm-usage']});
 await context.setOffline(true);
 const coldPage=await context.newPage();
 coldPage.on('pageerror',error=>browserErrors.push(error.message));
 await coldPage.goto(origin+'/');
 await coldPage.locator('.photo-card').nth(1).waitFor({timeout:30000});
 check(await coldPage.locator('.photo-card').count()===2,'Browser fully closed, HTTP server stopped: actual React customer-photo screen cold-launches offline with original IndexedDB photos');
 check(await coldPage.getByRole('button',{name:"Prepare this customer's photos ZIP"}).count()===1,'Offline cold launch retains the real customer ZIP export control');
 await coldPage.getByRole('button',{name:"Prepare this customer's photos ZIP"}).click();
 await coldPage.getByText(/photo ZIP passed integrity checks/).waitFor({timeout:30000});
 check(await coldPage.getByRole('button',{name:'Download prepared ZIP'}).count()===1,'Actual photo ZIP can be freshly prepared after fully offline browser restart');
 // Browser-managed download paths can disappear when Chromium detaches its
 // offline download context. Verify a fresh ZIP through the native file-share
 // entry point, and separately reselect the previously saved bytes from Files.
 await coldPage.evaluate(()=>{
  Object.defineProperty(navigator,'canShare',{configurable:true,value:files=>files.files?.length===1});
  Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
   const actual=files[0],buffer=await actual.arrayBuffer();
   window.fixtureOfflineShare={filename:actual.name,size:buffer.byteLength,
     active:Boolean(navigator.userActivation?.isActive)};
  }});
 });
 await coldPage.getByRole('button',{name:'Save prepared ZIP to Files'}).click();
 await coldPage.getByText(/Photo ZIP was offered to the iOS share sheet/).waitFor();
 const coldShare=await coldPage.evaluate(()=>window.fixtureOfflineShare);
 check(coldShare?.active===true&&coldShare?.size===exported.length&&coldShare.size>100,
   'Fresh ZIP built after offline cold launch contains original two photographs and was handed to native share');
 const coldVerify=coldPage.locator('input[type="file"][accept*=".zip"]').first();
 await coldVerify.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await coldPage.getByText(/Saved ZIP selected from Files passed photo checksums/).waitFor({timeout:30000});
 check((await coldPage.getByRole('status').allInnerTexts()).some(t=>t.includes('2 exactly match this device')),'Saved photo ZIP verification still works after a genuinely offline cold launch');
 check(remote.length===0,'No external network, Cloudflare, R2, or Stripe requests occurred');
 check(browserErrors.length===0,'Actual browser photo UI produced no uncaught client errors: '+browserErrors.join(' / '));
 await context.close();context=null;
}finally{
 await context?.close();
 if(!serverClosed)await new Promise(resolve=>server.close(resolve));
 rmSync(profile,{recursive:true,force:true});
}
console.log('PASS '+checks+' actual React photo-screen acceptance tests, including stopped-server Chromium offline cold launch; production/iPhone/iPad acceptance still pending.');
