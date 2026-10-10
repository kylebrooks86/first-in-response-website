// Native browser verification of the dependency-free exported synthetic package.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {exportCustomerDemo} from './export-local-customer-demo.mjs';
const root=mkdtempSync(join(tmpdir(),'fire-package-test-')),target=join(root,'package'),profile=join(root,'profile');
const require=createRequire(import.meta.url),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
let context,app,passed=0;const phrase='synthetic package phrase';
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
async function launch(offline){context=await chromium.launchPersistentContext(profile,{executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu']});await context.setOffline(offline);}
async function close(){const browser=context.browser();await context.close();context=null;assert.equal(browser.isConnected(),false);}
try{
 const exported=exportCustomerDemo(target),receipt=JSON.parse(readFileSync(join(target,'package-receipt.json')));
 await check('static package has nine allowlisted assets and no customer records or dependencies',()=>{assert.equal(receipt.files.length,9);assert.equal(receipt.syntheticOnly,true);assert.equal(receipt.realRecordsIncluded,false);assert.deepEqual(readdirSync(target).sort(),['README.txt','package-receipt.json','serve-demo.mjs','synthetic-customer-demo']);});
 await check('repeated export preserves an existing destination',()=>{const before=readFileSync(join(target,'package-receipt.json'));assert.throws(()=>exportCustomerDemo(target),/overwrite/);assert.deepEqual(readFileSync(join(target,'package-receipt.json')),before);});
 const {startPackagedCustomerDemo}=await import(pathToFileURL(join(target,'serve-demo.mjs')));
 app=await startPackagedCustomerDemo(target);const url=app.origin+app.scope;
 await check('portable server serves exact routes and rejects POST and query paths',async()=>{assert.equal((await fetch(url+'demo.js?x=1')).status,404);assert.equal((await fetch(url+'api/customers')).status,404);assert.equal((await fetch(url,{method:'POST'})).status,405);assert.equal(app.version,exported.version);});
 await launch(false);let page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));await page.waitForFunction(()=>navigator.serviceWorker.controller);
 await check('manifest and unchanged installation icons load and decode in Chromium',async()=>{const result=await page.evaluate(async()=>{const manifest=await (await fetch('./manifest.webmanifest')).json();const sizes=[];for(const size of [180,512]){const response=await fetch('./icon-'+size+'.png');const image=await createImageBitmap(await response.blob());sizes.push([image.width,image.height]);image.close();}return {manifest,sizes,apple:document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href')};});assert.equal(result.manifest.scope,app.scope);assert.equal(result.manifest.start_url,app.scope);assert.equal(result.manifest.display,'standalone');assert.deepEqual(result.sizes,[[180,180],[512,512]]);assert.equal(result.apple,'./icon-180.png');});
 await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);await page.selectOption('#name','Synthetic Updated');await page.fill('#save-phrase',phrase);await page.click('#save');await page.waitForFunction(()=>document.getElementById('customer').textContent.includes('Revision 2'));
 await close();await new Promise(resolve=>app.server.close(resolve));app=null;
 await launch(true);page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>document.getElementById('offline-shell').textContent.includes('ready'));await page.fill('#phrase',phrase);await page.click('#unlock');await page.waitForFunction(()=>!document.getElementById('records').hidden);
 await check('packaged shell cold launches with server stopped and retrieves encrypted edit',async()=>assert.match(await page.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/));
 await check('installation metadata and both icons remain available offline',async()=>{assert.deepEqual(await page.evaluate(async()=>{const rows=[];for(const path of ['manifest.webmanifest','icon-180.png','icon-512.png']){const response=await fetch('./'+path);rows.push(response.ok);}return rows;}),[true,true,true]);});
 await close();const file=join(target,'synthetic-customer-demo','demo.js'),body=readFileSync(file);writeFileSync(file,'altered');
 await check('changed or missing assets fail before the portable server binds',async()=>{await assert.rejects(()=>startPackagedCustomerDemo(target),/changed/);rmSync(file);await assert.rejects(()=>startPackagedCustomerDemo(target),/ENOENT/);writeFileSync(file,body);});
 console.log(JSON.stringify({passed,total:7,genuineOfflineColdLaunch:true,serverStopped:true,nativeIndexedDB:true,nativeWebCrypto:true,iPhoneTested:false}));
}finally{await context?.close();if(app)await new Promise(resolve=>app.server.close(resolve));rmSync(root,{recursive:true,force:true});}
