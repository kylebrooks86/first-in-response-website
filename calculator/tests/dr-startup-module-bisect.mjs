import { chromium } from 'playwright';
import fs from 'node:fs';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const loader=fs.readFileSync('calculator/full-v18.js','utf8');
const modules=[...loader.matchAll(/await load\('(\.\/[^']+)'\);/g)].map(m=>m[1]);
if(modules.length<20)throw new Error('Unexpected loader module count '+modules.length);

const parityDispatch="window.dispatchEvent(new CustomEvent('fire-v18-parity-loaded'));";
const sharedDispatch="window.dispatchEvent(new CustomEvent('fire-v18-shared-core-ready'));";
if(!loader.includes(parityDispatch)||!loader.includes(sharedDispatch))throw new Error('Expected final readiness dispatches missing');
const noFinalDispatch=loader.replace(parityDispatch,'').replace(sharedDispatch,'');
const parityOnly=loader.replace(sharedDispatch,'');
const sharedOnly=loader.replace(parityDispatch,'');

function stopAfter(index){
  const src=modules[index];
  const needle="await load('"+src+"');";
  return loader.replace(needle,needle+' return;');
}

async function probe(label,loaderBody,{serviceWorkers='block',swMode='normal'}={}){
  const browser=await chromium.launch({headless:true}); let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers});
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('/full-v18.js'))return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:loaderBody});
      if(url.includes('/sw.js')){
        if(swMode==='abort')return route.abort();
        if(swMode==='inert')return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:"self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"});
      }
      if(['image','media','font'].includes(req.resourceType()))return route.abort();
      return route.continue();
    });
    const page=await ctx.newPage(); const errors=[]; const consoleErrors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleErrors.push(m.text())});
    await page.goto(STAGING,{waitUntil:'commit',timeout:10000});
    await page.waitForLoadState('domcontentloaded',{timeout:4000}).catch(()=>{});
    await sleep(1800);
    const result=await Promise.race([
      page.evaluate(async()=>({pong:true,ready:!!window.__fireV18CoreReady,sharedReady:!!window.__fireV18SharedCoreReady,priceEditor:!!document.querySelector('#priceEditor'),mixHistory:!!document.querySelector('#mixHistory'),controller:!!navigator.serviceWorker?.controller,registrations:navigator.serviceWorker?await navigator.serviceWorker.getRegistrations().then(x=>x.length):0,cacheKeys:typeof caches!=='undefined'?await caches.keys():[]})).then(state=>({responsive:true,state,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})).catch(e=>({responsive:false,error:e.message,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})),
      sleep(3000).then(()=>({responsive:false,error:'renderer-unresponsive',errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)}))
    ]);
    console.log('MODULE BISECT '+label+' '+JSON.stringify(result)); return result;
  } finally {
    if(ctx)await Promise.race([ctx.close().catch(()=>{}),sleep(2500)]);
    await Promise.race([browser.close().catch(()=>{}),sleep(2500)]);
  }
}

const results={};
const checkpoints=[4,9,14,19,modules.length-1];
for(const i of checkpoints)results['blocked-'+i]=await probe('blocked-through-'+(i+1)+'-'+modules[i],stopAfter(i));
results.fullBlocked=await probe('full-loader-service-worker-blocked',loader,{serviceWorkers:'block'});
results.noFinalDispatch=await probe('full-modules-no-final-readiness-dispatch',noFinalDispatch,{serviceWorkers:'block'});
results.parityOnly=await probe('parity-ready-dispatch-only',parityOnly,{serviceWorkers:'block'});
results.sharedOnly=await probe('shared-core-ready-dispatch-only',sharedOnly,{serviceWorkers:'block'});
results.swEnabledFull=await probe('service-worker-enabled-full',loader,{serviceWorkers:'allow',swMode:'normal'});
results.swRequestAborted=await probe('service-worker-request-aborted-full',loader,{serviceWorkers:'allow',swMode:'abort'});
results.swInert=await probe('service-worker-inert-full',loader,{serviceWorkers:'allow',swMode:'inert'});

console.log('MODULE LIST '+JSON.stringify(modules));
console.log('MODULE BISECT SUMMARY '+JSON.stringify(results));
const firstLocked=checkpoints.find(i=>!results['blocked-'+i].responsive);
if(firstLocked!==undefined)console.log('FIRST LOCKED MODULE CHECKPOINT '+(firstLocked+1)+' '+modules[firstLocked]);
const finalDispatchDiagnosis={fullBlocked:results.fullBlocked.responsive,noFinalDispatch:results.noFinalDispatch.responsive,parityOnly:results.parityOnly.responsive,sharedOnly:results.sharedOnly.responsive};
console.log('FINAL DISPATCH DIAGNOSIS '+JSON.stringify(finalDispatchDiagnosis));
const swDiagnosis={enabled:results.swEnabledFull.responsive,aborted:results.swRequestAborted.responsive,inert:results.swInert.responsive};
console.log('SERVICE WORKER DIAGNOSIS '+JSON.stringify(swDiagnosis));
if(firstLocked===undefined&&results.noFinalDispatch.responsive&&!results.fullBlocked.responsive){
  if(!results.parityOnly.responsive&&results.sharedOnly.responsive)console.log('PARITY-LOADED EVENT IS DR LOCK TRIGGER');
  else if(results.parityOnly.responsive&&!results.sharedOnly.responsive)console.log('SHARED-CORE-READY EVENT IS DR LOCK TRIGGER');
  else if(!results.parityOnly.responsive&&!results.sharedOnly.responsive)console.log('EITHER FINAL READINESS EVENT CAN TRIGGER DR LOCK');
  else console.log('COMBINED FINAL READINESS DISPATCH SEQUENCE TRIGGERS DR LOCK');
}
if(firstLocked===undefined&&results.fullBlocked.responsive&&!results.swEnabledFull.responsive)console.log('SERVICE WORKER ENABLEMENT IS DR LOCK TRIGGER');
process.exitCode=firstLocked===undefined?0:1;
