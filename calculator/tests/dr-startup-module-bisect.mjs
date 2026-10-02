import { chromium } from 'playwright';
import fs from 'node:fs';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const corePath='calculator/full-v18-core.js';
const original=fs.readFileSync(corePath,'utf8');
const startupNeedle="try{loadFullState();buildPriceEditor();calcReverseX();calcInjectorReal();calcFill();stainFinder();compat();areaHelpers();calcFullEstimator();chemicalCost();renderHistory();renderCustomChems();inventory()}catch(e){console.error('Full v18 extension',e)}";

const variants={
  blocked:null,
  original,
  mainOnly:original.split('// LIVE_V18_LAYOUT_PARITY')[0],
  noGuide:original.split('// LIVE_V18_GUIDE_PRESETS')[0],
  noStartup:original.replace(startupNeedle,"try{}catch(e){console.error('Full v18 extension',e)}"),
  noStartupMainOnly:original.replace(startupNeedle,"try{}catch(e){console.error('Full v18 extension',e)}").split('// LIVE_V18_LAYOUT_PARITY')[0]
};

if(variants.noStartup===original)throw new Error('Could not locate core startup initializer for diagnostic replacement');

async function probe(name,body){
  const browser=await chromium.launch({headless:true});
  let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('/full-v18-core.js')){
        if(body===null)return route.abort();
        return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body});
      }
      if(req.resourceType()==='script'&&url.includes('/calculator/')&&!url.includes('/full-v18.js'))return route.abort();
      if(['image','media','font'].includes(req.resourceType()))return route.abort();
      return route.continue();
    });
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(STAGING,{waitUntil:'commit',timeout:10000});
    await page.waitForLoadState('domcontentloaded',{timeout:4000}).catch(()=>{});
    await sleep(1400);
    const result=await Promise.race([
      page.evaluate(()=>({pong:true,loader:!!window.__fireV18ModuleLoader,core:!!window.__fireFullV18,ready:!!window.__fireV18CoreReady,priceEditor:!!document.querySelector('#priceEditor'),mixHistory:!!document.querySelector('#mixHistory')})).then(state=>({responsive:true,state,errors})).catch(e=>({responsive:false,error:e.message,errors})),
      sleep(2500).then(()=>({responsive:false,error:'renderer-unresponsive',errors}))
    ]);
    console.log(`CORE VARIANT ${name} RESULT ${JSON.stringify(result)}`);
    return result;
  } finally {
    if(ctx)await Promise.race([ctx.close().catch(()=>{}),sleep(3000)]);
    await Promise.race([browser.close().catch(()=>{}),sleep(3000)]);
  }
}

const results={};
for(const [name,body] of Object.entries(variants))results[name]=await probe(name,body);
console.log('CORE VARIANT SUMMARY '+JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{responsive:v.responsive,error:v.error||null,errors:v.errors||[]}]))));

if(!results.blocked.responsive)throw new Error('Base inline calculator locks even when full-v18-core.js is blocked');
if(results.original.responsive){console.log('Original core is responsive under diagnostic isolation');process.exit(0)}
if(!results.mainOnly.responsive&&results.noStartupMainOnly.responsive){console.log('CORE STARTUP INITIALIZER IS FIRST LOCK SOURCE');process.exitCode=1}
if(results.mainOnly.responsive&&!results.noGuide.responsive){console.log('CORE LAYOUT PARITY BLOCK IS LOCK SOURCE');process.exitCode=1}
if(results.noGuide.responsive&&!results.original.responsive){console.log('CORE GUIDE PRESETS OR LATER BLOCK IS LOCK SOURCE');process.exitCode=1}
if(results.noStartup.responsive){console.log('CORE STARTUP INITIALIZER LOCKS; extra core IIFEs are responsive without it');process.exitCode=1}
console.log('CORE LOCK REQUIRES DEEPER FUNCTION-LEVEL BISECTION');
process.exitCode=1;
