import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startCustomerDemo} from './local-customer-demo-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const {server,origin}=await startCustomerDemo();let browser,passed=0;const remote=[];
const phrase='synthetic demo recovery phrase only';
const check=async(name,fn)=>{await fn();passed++;console.log(`PASS: ${name}`);};
const unlock=async p=>{await p.fill('#phrase',phrase);await p.click('#unlock');await p.waitForFunction(()=>!document.getElementById('records').hidden);};
const cleared=async p=>{await p.waitForFunction(()=>document.getElementById('records').hidden);assert.equal(await p.locator('#customer').textContent(),'');assert.equal(await p.inputValue('#save-phrase'),'');assert.equal(await p.inputValue('#phrase'),'');};
process.exitCode=1;
try{
 browser=await chromium.launch({executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){remote.push(route.request().url());return route.abort();}return route.continue();});
 const p=await context.newPage();await p.goto(origin);await p.waitForTimeout(100);
 await check('starts locked without rendering customer records',()=>cleared(p));
 await check('wrong phrase never exposes records',async()=>{await p.fill('#phrase','wrong');await p.click('#unlock');await p.waitForFunction(()=>document.getElementById('status').textContent.includes('failed'));await cleared(p);});
 await check('unlock retrieves the synthetic fixture and clears phrase field',async()=>{await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Customer.*Revision 1/);assert.equal(await p.inputValue('#phrase'),'');});
 await context.setOffline(true);
 await check('offline form edit saves and advances revision',async()=>{await p.selectOption('#name','Synthetic Updated');await p.fill('#save-phrase',phrase);await p.click('#save');await p.waitForFunction(()=>document.getElementById('customer').textContent.includes('Revision 2'));assert.equal(await p.inputValue('#save-phrase'),'');});
 await check('explicit lock clears rendered records and pending form values',async()=>{await p.fill('#save-phrase','unsaved synthetic secret');await p.click('#lock');await cleared(p);});
 await check('offline unlock retrieves retained encrypted edit',async()=>{await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);});
 await context.setOffline(false);const peer=await context.newPage();await peer.goto(origin);await unlock(peer);
 await check('cross-tab lock clears both screens',async()=>{await peer.click('#lock');await cleared(peer);await cleared(p);});
 await unlock(p);
 await check('simulated background locks and clears the rendered form',async()=>{await p.fill('#save-phrase','draft phrase');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await cleared(p);await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await cleared(p);});
 await unlock(p);
 await check('lock during encryption cannot repopulate the screen on late completion',async()=>{
  await p.evaluate(()=>{window.originalEncrypt=SubtleCrypto.prototype.encrypt;window.encryptStarted=false;window.cryptoGate=new Promise(resolve=>window.releaseCrypto=resolve);SubtleCrypto.prototype.encrypt=async function(...args){window.encryptStarted=true;await window.cryptoGate;return window.originalEncrypt.apply(this,args);};});
  await p.selectOption('#name','Synthetic Recovery');await p.fill('#save-phrase',phrase);await p.click('#save');await p.waitForFunction(()=>window.encryptStarted);await p.click('#lock');await cleared(p);await p.evaluate(()=>{window.releaseCrypto();SubtleCrypto.prototype.encrypt=window.originalEncrypt;});await p.waitForTimeout(150);await cleared(p);await unlock(p);assert.match(await p.locator('#customer').textContent(),/Synthetic Updated.*Revision 2/);
 });
 await check('ambiguous committed save is verified by receipt without automatic replay',async()=>{
  await p.evaluate(()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=window.originalTransaction.apply(this,args);if(args[1]==='readwrite')tx.addEventListener('complete',()=>document.getElementById('lock').click(),{once:true});return tx;};});
  await p.selectOption('#name','Synthetic Recovery');await p.fill('#save-phrase',phrase);await p.click('#save');await cleared(p);await p.evaluate(()=>{IDBDatabase.prototype.transaction=window.originalTransaction;});await unlock(p);assert.match(await p.locator('#status').textContent(),/receipt verified/);assert.match(await p.locator('#customer').textContent(),/Synthetic Recovery.*Revision 3/);
 });
 await check('simulated expired idle deadline clears visible records without timer callback',async()=>{await p.evaluate(()=>{const original=performance.now.bind(performance);performance.now=()=>original()+301000;document.dispatchEvent(new Event('pointerdown'));delete performance.now;});await cleared(p);});
 await unlock(p);
 await check('screen accepts only fixed synthetic name presets and fits mobile width',async()=>{assert.equal(await p.locator('#name option').count(),3);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('no remote app, database or Stripe calls',()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,viewport:'390x844',nativeIndexedDB:true,nativeWebCrypto:true,syntheticOnly:true,visibilityEventsSimulated:true,offlineColdLaunch:false,iPhoneTested:false}));process.exitCode=0;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
