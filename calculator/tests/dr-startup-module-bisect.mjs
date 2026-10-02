import { chromium } from 'playwright';
import fs from 'node:fs';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const loader=fs.readFileSync('calculator/full-v18.js','utf8');
const modules=[...loader.matchAll(/await load\('(\.\/[^']+)'\);/g)].map(m=>m[1]);
if(modules.length<20)throw new Error('Unexpected loader module count '+modules.length);
function stopAfter(index){
  const src=modules[index];
  const needle="await load('"+src+"');";
  return loader.replace(needle,needle+' return;');
}
async function probe(label,loaderBody){
  const browser=await chromium.launch({headless:true}); let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('/full-v18.js'))return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:loaderBody});
      if(['image','media','font'].includes(req.resourceType()))return route.abort();
      return route.continue();
    });
    const page=await ctx.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(STAGING,{waitUntil:'commit',timeout:10000});
    await page.waitForLoadState('domcontentloaded',{timeout:4000}).catch(()=>{});
    await sleep(1800);
    const result=await Promise.race([
      page.evaluate(()=>({pong:true,ready:!!window.__fireV18CoreReady,sharedReady:!!window.__fireV18SharedCoreReady,priceEditor:!!document.querySelector('#priceEditor'),mixHistory:!!document.querySelector('#mixHistory')})).then(state=>({responsive:true,state,errors:errors.slice(0,8)})).catch(e=>({responsive:false,error:e.message,errors:errors.slice(0,8)})),
      sleep(3000).then(()=>({responsive:false,error:'renderer-unresponsive',errors:errors.slice(0,8)}))
    ]);
    console.log('MODULE BISECT '+label+' '+JSON.stringify(result)); return result;
  } finally { if(ctx)await Promise.race([ctx.close().catch(()=>{}),sleep(2500)]); await Promise.race([browser.close().catch(()=>{}),sleep(2500)]) }
}
const checkpoints=[4,9,14,19,modules.length-1];
const results={};
for(const i of checkpoints)results[i]=await probe('through-'+(i+1)+'-'+modules[i],stopAfter(i));
console.log('MODULE LIST '+JSON.stringify(modules));
console.log('MODULE BISECT SUMMARY '+JSON.stringify(results));
const firstLocked=checkpoints.find(i=>!results[i].responsive);
if(firstLocked===undefined){console.log('No lock at module checkpoints');process.exit(0)}
console.log('FIRST LOCKED MODULE CHECKPOINT '+(firstLocked+1)+' '+modules[firstLocked]);
process.exitCode=1;
