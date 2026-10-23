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
const photoStyles=readFileSync(join(root,'app/globals.css'),'utf8').replace(/^@import[^;]+;\\s*/gm,'');
const shell='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIRE synthetic customer photo UI</title><link rel="stylesheet" href="/photo-styles.css"><main class="customers-view"><article class="customer-profile"><div id="app"></div></article></main><script type="module" src="/bundle.js"></script>';
// Disposable test-only worker: deliberately NOT registered in FIRE production.
// Exercise true closed-browser, stopped-server cold launch with the actual
// React photo component bundled, rather than only the storage libraries.
const fixtureWorker=`const CACHE='fire-synthetic-photo-cold-launch-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(['/','/bundle.js','/photo-styles.css']);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!['/','/bundle.js','/photo-styles.css'].includes(url.pathname))return;
 event.respondWith((async()=>await (await caches.open(CACHE)).match(url.pathname)||fetch(event.request))());
});`;
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/photo-styles.css'){res.setHeader('content-type','text/css');res.end(photoStyles);return;}
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
 // Owner-reported real iPhone defect: ZIP and restore buttons were cut off in
 // side-by-side columns. Check ACTUAL rendered box geometry with shared CSS,
 // not source strings or a static image. No navigation or hosted data needed.
 const verifyPhotoActionGeometry=async(label)=>{
  const state=await page.evaluate(()=>{
   const panel=document.querySelector('.photo-panel');
   const controls=[...panel.querySelectorAll('.photo-buttons>button')];
   const boxes=controls.map(button=>{
    const r=button.getBoundingClientRect();
    return {text:button.textContent?.trim(),left:r.left,right:r.right,top:r.top,
      bottom:r.bottom,width:r.width,height:r.height,display:getComputedStyle(button).display};
   });
   const container=panel.getBoundingClientRect();
   return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
    panel:{left:container.left,right:container.right},controls:boxes};
  });
  check(state.controls.length>=4&&state.controls.every(b=>
   b.left>=state.panel.left-1&&b.right<=state.panel.right+1&&
   b.left>=-1&&b.right<=state.viewport+1&&b.height>=44),
   label+' every ZIP, restore, camera and library button is fully within iPhone screen with >=44px touch height');
  const rows=state.controls.filter(b=>/ZIP|Camera|Photo library/.test(b.text));
  check(rows.every((b,i)=>i===0||b.left===rows[0].left),
   label+' photo/ZIP actions have the same left edge (one column, no cut-off side controls)');
  check(state.pageWidth<=state.viewport+1,
   label+' photo panel does not introduce document-level horizontal scrolling');
 };
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  await verifyPhotoActionGeometry(width+'px:');
 }
 await page.setViewportSize({width:390,height:844});
 const library=page.locator('input[type="file"][multiple]');
 const take=(name)=>({name,mimeType:'image/png',buffer:png});
 // A bulk selection can commit its first photo and then reject another.
 // The real UI must retain that committed photo and require explicit review.
 await library.setInputFiles([take('synthetic-partial.png'),{name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')}]);
 await page.getByText(/Photo changes are paused/).waitFor();
 check(await page.locator('.photo-card').count()===1,'Partially completed selection refreshes the committed photo without replaying it');
 check(await page.getByRole('button',{name:'Photo library',exact:true}).isDisabled(),'Uncertain batch disables new photo additions');
 check(await page.getByRole('button',{name:'Delete on-device photo'}).isDisabled(),'Uncertain batch disables destructive photo actions');
 await page.reload();
 await page.getByText(/Photo changes are paused/).waitFor();
 check(await page.locator('.photo-card').count()===1,'Reload after partial selection retains committed image and durable pause');
 check(await page.getByRole('button',{name:'Photo library',exact:true}).isDisabled(),'Reload cannot re-enable a duplicate upload after an interrupted selection');
 const allow=page.getByRole('button',{name:'I reviewed saved photos; allow new changes'});
 check(await allow.isDisabled(),'Owner cannot resume changes before a successful read-only refresh');
 await page.evaluate(()=>{
  window.originalPhotoGetAll=IDBIndex.prototype.getAll;
  IDBIndex.prototype.getAll=function(...args){if(this.objectStore.name==='photos')throw Error('Synthetic read unavailable');return window.originalPhotoGetAll.apply(this,args);};
 });
 await page.getByRole('button',{name:'Refresh saved photos for review'}).click();
 await page.getByText(/Changes remain paused/).waitFor();
 check(await allow.isDisabled(),'Failed read-only review cannot unlock photo mutations');
 await page.evaluate(()=>{IDBIndex.prototype.getAll=window.originalPhotoGetAll;});
 await page.getByRole('button',{name:'Refresh saved photos for review'}).click();
 await allow.click();
 check(await page.locator('.photo-card').count()===1,'Explicit review never retries the previous file selection');
 await page.getByRole('button',{name:'Delete on-device photo'}).click();
 await page.getByText('No on-device photos for this customer').waitFor();
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
 await verifyPhotoActionGeometry('390px, ZIP prepared:');
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
 check((await page.getByRole('status').allInnerTexts()).some(t=>t.includes('COMPLETE for all currently stored FIRE on-device photos')),
   'Saved ZIP confirms complete current device coverage only when all present photo bytes are included');
 // A stale ZIP passes its checksums, but must NEVER be represented as complete
 // after an actual new photo has been added to IndexedDB.
 await library.setInputFiles(take('new-after-backup.png'));
 await page.locator('.photo-card').nth(2).waitFor();
 check(await page.locator('.photo-card').count()===3,'New photo committed after the older archive was saved');
 await verifyInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/INCOMPLETE PHOTO BACKUP: 1 current device photo/).waitFor({timeout:30000});
 check(!(await page.getByRole('status').allInnerTexts()).some(t=>t.includes('COMPLETE for all currently stored FIRE on-device photos')),
   'Valid old ZIP cannot claim complete coverage of the newer device library');
 await page.getByRole('button',{name:'Delete on-device photo'}).nth(2).click();
 await page.locator('.photo-card').nth(2).waitFor({state:'detached'});
 check(await page.locator('.photo-card').count()===2,'Synthetic new photo removed without modifying originals');
 check((await page.getByRole('alert').allInnerTexts()).every(t=>!t.includes('Another FIRE tab changed')),
   'This same FIRE tab never falsely reports its own successful edit as a different tab');
 // The gallery can rerender before the mutation journal finishes and unlocks.
 // Do not send another file action while active.current is still true.
 await page.waitForFunction(()=>{
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Prepare all local photos ZIP'));
  return button&&!button.disabled;
 });
 // Native file input may retain the last selection after a previous verify.
 // Clear then reselect from Files to force a genuine new change event.
 await verifyInput.setInputFiles([]);
 await verifyInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 try{await page.getByText(/COMPLETE for all currently stored FIRE on-device photos/).waitFor({timeout:30000});}
 catch(err){
  const details=await page.evaluate(()=>({
   statuses:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent?.slice(0,400)),
   errors:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent?.slice(0,400)),
   gallery:document.querySelectorAll('.photo-card').length
  }));
  throw Error('Saved ZIP did not confirm coverage after deletion: '+JSON.stringify(details)+'; '+String(err));
 }
 check((await page.getByRole('alert').allInnerTexts()).every(t=>!t.includes('INCOMPLETE PHOTO BACKUP')),
   'Fresh exact archive versus device coverage check clears the incomplete warning');
 // Two tabs share IndexedDB but can disagree about an ALREADY PREPARED ZIP.
 // A photo added in the other tab must withdraw Save/Download until re-export.
 await page.getByRole('button',{name:'Prepare all local photos ZIP'}).click();
 await page.getByRole('button',{name:'Save prepared ZIP to Files'}).waitFor({timeout:30000});
 await ctx.setOffline(false);
 const otherTab=await ctx.newPage();
 otherTab.on('dialog',dialog=>dialog.accept());
 otherTab.on('pageerror',error=>browserErrors.push(error.message));
 await otherTab.goto(origin);
 await otherTab.getByRole('button',{name:'Photo library'}).waitFor();
 // A newly opened tab must finish its durable mutation-journal preflight
 // before the input event is dispatched, or a deliberately guarded upload
 // will be silently ignored by the real React handler.
 await otherTab.waitForFunction(()=>{
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Photo library');
  return button&&!button.disabled;
 });
 await otherTab.locator('input[type="file"][multiple]').setInputFiles(take('other-tab-new-photo.png'));
 await otherTab.locator('.photo-card').nth(2).waitFor();
 await page.getByText(/Another FIRE tab changed on-device photos/).waitFor({timeout:30000});
 check(await page.getByRole('button',{name:'Save prepared ZIP to Files'}).count()===0&&
   await page.getByRole('button',{name:'Download prepared ZIP'}).count()===0,
   'Other-tab photo mutation immediately withdraws stale prepared ZIP controls');
 await otherTab.getByRole('button',{name:'Delete on-device photo'}).nth(2).click();
 await otherTab.locator('.photo-card').nth(2).waitFor({state:'detached'});
 await page.locator('.photo-card').nth(2).waitFor({state:'detached'});
 await otherTab.close();await ctx.setOffline(true);
 check(await page.locator('.photo-card').count()===2,
   'Cross-tab changes refresh original gallery without overwriting other photos');
 await page.getByRole('button',{name:'Prepare all local photos ZIP'}).click();
 await page.getByRole('button',{name:'Save prepared ZIP to Files'}).waitFor({timeout:30000});
 check(await page.getByRole('button',{name:'Download prepared ZIP'}).count()===1,
   'Owner can prepare a fresh all-customer ZIP after cross-tab changes');
 const restoreInput=page.locator('input[type="file"][accept*=".zip"]').nth(1);
 await restoreInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/Restored 0 new verified photo/).waitFor({timeout:30000});
 check(await page.locator('.photo-card').count()===2,'Repeated owner ZIP restore is idempotent and does not duplicate photos');
 await page.getByRole('button',{name:'Delete on-device photo'}).first().click();
 await page.locator('.photo-card').nth(1).waitFor({state:'detached'});
 check(await page.locator('.photo-card').count()===1,'Confirmed owner deletion affects only the selected local photo');
 // Lose the verification read AFTER native IndexedDB restore commits.
 await page.evaluate(()=>{
  window.originalRestoreAdd=IDBObjectStore.prototype.add;
  window.originalRestoreGetAll=IDBObjectStore.prototype.getAll;
  window.failRestoreVerification=false;
  IDBObjectStore.prototype.add=function(...args){const request=window.originalRestoreAdd.apply(this,args);if(this.name==='photos')window.failRestoreVerification=true;return request;};
  IDBObjectStore.prototype.getAll=function(...args){if(this.name==='photos'&&window.failRestoreVerification){window.failRestoreVerification=false;throw Error('Synthetic post-commit verification unavailable');}return window.originalRestoreGetAll.apply(this,args);};
 });
 await restoreInput.setInputFiles([]);
 await restoreInput.setInputFiles({name:filename,mimeType:'application/zip',buffer:exported});
 await page.getByText(/Photos may already have been added/).waitFor();
 check(await page.locator('.photo-card').count()===2,'Interrupted post-commit restore refreshes both actual saved photos');
 check(await page.getByRole('button',{name:'Restore verified photo ZIP',exact:true}).isDisabled(),'Unconfirmed restore blocks a second recovery request');
 await page.evaluate(()=>{IDBObjectStore.prototype.add=window.originalRestoreAdd;IDBObjectStore.prototype.getAll=window.originalRestoreGetAll;});
 await ctx.setOffline(false);await page.reload();
 await page.getByText(/Photo changes are paused/).waitFor();
 check(await page.locator('.photo-card').count()===2,'Reload after committed-but-unconfirmed ZIP restore preserves images and durable pause');
 check(await page.getByRole('button',{name:'Restore verified photo ZIP',exact:true}).isDisabled(),'Reload cannot enable an unreviewed ZIP restore retry');
 await page.getByRole('button',{name:'Refresh saved photos for review'}).click();
 await page.getByRole('button',{name:'I reviewed saved photos; allow new changes'}).click();
 check(await page.locator('.photo-card').count()===2,'Review after interrupted restore never duplicates committed photos');
 await page.getByRole('button',{name:'Delete on-device photo'}).first().click();
 await page.locator('.photo-card').nth(1).waitFor({state:'detached'});
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
   bundle:Boolean(await (await caches.open('fire-synthetic-photo-cold-launch-v1')).match('/bundle.js')),
   styles:Boolean(await (await caches.open('fire-synthetic-photo-cold-launch-v1')).match('/photo-styles.css'))
 }));
 check(cacheEvidence.controlled&&cacheEvidence.shell&&cacheEvidence.bundle,'Actual React photo screen shell and bundle are cached by a separate synthetic install worker');
 check(cacheEvidence.styles,'Exact FIRE photo layout stylesheet remains cached for synthetic offline launch');
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
