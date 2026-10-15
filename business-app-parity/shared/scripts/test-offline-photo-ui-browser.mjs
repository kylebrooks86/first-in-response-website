/** Gate 7: ACTUAL FIRE customer-photo React screen in pinned Chrome.
 * Native DOM controls, real IndexedDB, ZIP download/readback and offline actions.
 * All data is synthetic. No deployed app, server auth, external URLs or accounts.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
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
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIRE synthetic customer photo UI</title><div id="app"></div><script type="module" src="/bundle.js"></script>');return;}
 res.statusCode=404;res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const browserErrors=[],remote=[];
const check=(condition,msg)=>{assert.ok(condition,msg);checks++;console.log('PASS: '+msg);};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
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
 check(remote.length===0,'No external network, Cloudflare, R2, or Stripe requests occurred');
 check(browserErrors.length===0,'Actual browser photo UI produced no uncaught client errors: '+browserErrors.join(' / '));
 await ctx.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+checks+' actual owner React photo-screen acceptance checks in isolated Chrome; iPhone/iPad acceptance still pending.');
