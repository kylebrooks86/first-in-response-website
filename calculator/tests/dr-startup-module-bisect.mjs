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
const loaderGuard='  if(window.__fireV18ModuleLoader)return;';
const listenerCapture=`  window.__fireParityListeners=[];\n  const __fireNativeWindowAdd=window.addEventListener.bind(window);\n  window.addEventListener=function(type,listener,options){if(type==='fire-v18-parity-loaded')window.__fireParityListeners.push(listener);return __fireNativeWindowAdd(type,listener,options)};`;
if(!loader.includes(loaderGuard))throw new Error('Loader guard missing');
const instrumented=loader.replace(loaderGuard,loaderGuard+'\n'+listenerCapture);
const inventoryLoader=instrumented.replace(parityDispatch,'').replace(sharedDispatch,'');
const listenerLoader=index=>instrumented
  .replace(parityDispatch,`window.__fireParityListeners[${index}]?.call(window,new CustomEvent('fire-v18-parity-loaded'));`)
  .replace(sharedDispatch,'');

function stopAfter(index){
  const src=modules[index];
  const needle="await load('"+src+"');";
  return loader.replace(needle,needle+' return;');
}

async function probe(label,loaderBody,{serviceWorkers='block'}={}){
  const browser=await chromium.launch({headless:true}); let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers});
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('/full-v18.js'))return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:loaderBody});
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
      page.evaluate(()=>({
        pong:true,
        ready:!!window.__fireV18CoreReady,
        priceEditor:!!document.querySelector('#priceEditor'),
        mixHistory:!!document.querySelector('#mixHistory'),
        parityListeners:(window.__fireParityListeners||[]).map((fn,i)=>({index:i,source:String(fn).slice(0,500)}))
      })).then(state=>({responsive:true,state,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})).catch(e=>({responsive:false,error:e.message,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})),
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
results.fullBlocked=await probe('full-loader-service-worker-blocked',loader);
results.noFinalDispatch=await probe('full-modules-no-final-readiness-dispatch',noFinalDispatch);
results.parityOnly=await probe('parity-ready-dispatch-only',parityOnly);
results.sharedOnly=await probe('shared-core-ready-dispatch-only',sharedOnly);
results.listenerInventory=await probe('parity-listener-inventory',inventoryLoader);
const listenerCount=results.listenerInventory.state?.parityListeners?.length||0;
console.log('PARITY LISTENER INVENTORY '+JSON.stringify(results.listenerInventory.state?.parityListeners||[]));
for(let i=0;i<listenerCount;i++)results['listener-'+i]=await probe('parity-listener-'+i,listenerLoader(i));

console.log('MODULE LIST '+JSON.stringify(modules));
console.log('MODULE BISECT SUMMARY '+JSON.stringify(results));
const firstLocked=checkpoints.find(i=>!results['blocked-'+i].responsive);
if(firstLocked!==undefined)console.log('FIRST LOCKED MODULE CHECKPOINT '+(firstLocked+1)+' '+modules[firstLocked]);
const finalDispatchDiagnosis={fullBlocked:results.fullBlocked.responsive,noFinalDispatch:results.noFinalDispatch.responsive,parityOnly:results.parityOnly.responsive,sharedOnly:results.sharedOnly.responsive};
console.log('FINAL DISPATCH DIAGNOSIS '+JSON.stringify(finalDispatchDiagnosis));
const lockedListeners=[];
for(let i=0;i<listenerCount;i++)if(!results['listener-'+i]?.responsive)lockedListeners.push(i);
console.log('LOCKING PARITY LISTENERS '+JSON.stringify(lockedListeners));
if(lockedListeners.length===1)console.log('PARITY LISTENER LOCK INDEX '+lockedListeners[0]);
process.exitCode=firstLocked===undefined?0:1;
