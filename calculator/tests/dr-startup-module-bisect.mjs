import { chromium } from 'playwright';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const modules=[
  'full-v18-core.js',
  'v18-legacy-job-detach.js',
  'full-v18-parity-core.js',
  'v18-behavior.js',
  'v18-interactions.js',
  'v18-fine-parity.js',
  'v18-equipment-parity.js',
  'v18-live-equipment-structure-parity.js',
  'v18-tools-state.js',
  'v18-live-estimator-parity.js',
  'v18-live-first-screen.js',
  'v18-live-jobmath-parity.js',
  'v18-live-jobmix-parity.js',
  'v18-live-planning-state.js',
  'v18-live-chemicals-parity.js',
  'v18-live-index-parity.js',
  'v18-live-guide-parity.js',
  'v18-live-navigation-parity.js',
  'v18-live-tools-parity.js',
  'v18-live-tools-options-parity.js',
  'v18-live-tools-fine.js',
  'v18-live-pricing-parity.js',
  'v18-live-customer-parity.js',
  'v18-live-backup-hydration.js',
  'v18-live-input-contract.js'
];

async function probe(allowCount){
  const browser=await chromium.launch({headless:true});
  let ctx;
  try{
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const allowed=new Set(modules.slice(0,allowCount));
    await ctx.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(req.resourceType()==='script'){
        const matched=modules.find(name=>url.includes('/'+name));
        if(matched&&!allowed.has(matched))return route.abort();
      }
      if(['image','media','font'].includes(req.resourceType()))return route.abort();
      return route.continue();
    });
    const page=await ctx.newPage();
    page.on('pageerror',e=>console.log(`BISECT ${allowCount} PAGE ERROR ${e.message}`));
    await page.goto(STAGING,{waitUntil:'commit',timeout:10000});
    await page.waitForLoadState('domcontentloaded',{timeout:4000}).catch(()=>{});
    await sleep(1600);
    const result=await Promise.race([
      page.evaluate(()=>({pong:true,loader:!!window.__fireV18ModuleLoader,core:!!window.__fireFullV18,ready:!!window.__fireV18CoreReady})).then(v=>({responsive:true,state:v})).catch(e=>({responsive:false,error:e.message})),
      sleep(2500).then(()=>({responsive:false,error:'renderer-unresponsive'}))
    ]);
    console.log(`BISECT ALLOW ${allowCount}/${modules.length} LAST ${modules[allowCount-1]||'none'} RESULT ${JSON.stringify(result)}`);
    return result.responsive;
  } finally {
    if(ctx)await Promise.race([ctx.close().catch(()=>{}),sleep(3000)]);
    await Promise.race([browser.close().catch(()=>{}),sleep(3000)]);
  }
}

let low=1,high=modules.length,firstBad=null;
const base=await probe(1);
if(!base)throw new Error('DR renderer locks with full-v18-core.js alone; suffix bisection cannot proceed');
const all=await probe(modules.length);
if(all){console.log('DR STARTUP BISECT: all modules responsive');process.exit(0)}
while(low<=high){
  const mid=Math.floor((low+high)/2);
  const ok=await probe(mid);
  if(ok)low=mid+1;
  else{firstBad=mid;high=mid-1}
}
if(firstBad===null)throw new Error('DR startup bisection failed to isolate a module');
console.log(`DR STARTUP FIRST BAD MODULE index=${firstBad} module=${modules[firstBad-1]} previous=${modules[firstBad-2]||'none'}`);
process.exitCode=1;
