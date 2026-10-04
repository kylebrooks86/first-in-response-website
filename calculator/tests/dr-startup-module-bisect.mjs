import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const loader=fs.readFileSync('calculator/full-v18.js','utf8');
const modules=[...loader.matchAll(/await load\('(\.\/[^']+)'\);/g)].map(m=>m[1]);
if(modules.length<20)throw new Error('Unexpected loader module count '+modules.length);

const parityDispatch="window.dispatchEvent(new CustomEvent('fire-v18-parity-loaded'));";
const sharedDispatch="window.dispatchEvent(new CustomEvent('fire-v18-shared-core-ready'));";
if(!loader.includes(parityDispatch)||!loader.includes(sharedDispatch))throw new Error('Expected final readiness dispatches missing');
const noFinalDispatch=loader.replace(parityDispatch,'').replace(sharedDispatch,'');
const sharedOnly=loader.replace(parityDispatch,'');
const candidateModules=modules.map(src=>src.split('?')[0]).filter(src=>{
  const file=path.join('calculator',src.replace(/^\.\//,''));
  return fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('fire-v18-parity-loaded');
});
console.log('PARITY EVENT SOURCE MODULES '+JSON.stringify(candidateModules));

async function probe(label,loaderBody,{disabledModule=null}={}){
  const browser=await chromium.launch({headless:true}); let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('/full-v18.js'))return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:loaderBody});
      if(disabledModule&&url.includes('/'+disabledModule.replace(/^\.\//,''))){
        const file=path.join('calculator',disabledModule.replace(/^\.\//,''));
        const body=fs.readFileSync(file,'utf8').replaceAll('fire-v18-parity-loaded','fire-v18-parity-loaded-disabled');
        return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body});
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
      page.evaluate(()=>({pong:true,ready:!!window.__fireV18CoreReady,priceEditor:!!document.querySelector('#priceEditor'),mixHistory:!!document.querySelector('#mixHistory')})).then(state=>({responsive:true,state,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})).catch(e=>({responsive:false,error:e.message,errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)})),
      sleep(3000).then(()=>({responsive:false,error:'renderer-unresponsive',errors:errors.slice(0,8),consoleErrors:consoleErrors.slice(0,8)}))
    ]);
    console.log('MODULE BISECT '+label+' '+JSON.stringify(result)); return result;
  } finally {
    if(ctx)await Promise.race([ctx.close().catch(()=>{}),sleep(2500)]);
    await Promise.race([browser.close().catch(()=>{}),sleep(2500)]);
  }
}

const results={};
results.full=await probe('full-parity-dispatch',loader);
results.noFinalDispatch=await probe('no-final-readiness-dispatch',noFinalDispatch);
results.sharedOnly=await probe('shared-core-ready-only',sharedOnly);
for(const mod of candidateModules){
  const key='disable-'+mod.replace(/^\.\//,'').replace(/\.js$/,'');
  results[key]=await probe(key,loader,{disabledModule:mod});
}
console.log('PARITY MODULE DISABLE SUMMARY '+JSON.stringify(results));
const rescuers=candidateModules.filter(mod=>results['disable-'+mod.replace(/^\.\//,'').replace(/\.js$/,'')]?.responsive);
console.log('PARITY EVENT RESCUING MODULES '+JSON.stringify(rescuers));
if(rescuers.length===1)console.log('PARITY EVENT LOCK OWNER '+rescuers[0]);
if(!results.noFinalDispatch.responsive)throw new Error('Renderer locks without final readiness dispatch; diagnosis invalid');
if(results.full.responsive)console.log('Full loader became responsive; no parity-event lock reproduced');
process.exitCode=0;
