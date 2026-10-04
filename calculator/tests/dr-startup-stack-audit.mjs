import { chromium } from 'playwright';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true});
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  let firstResolve;
  const firstError=new Promise(resolve=>{firstResolve=resolve});
  let settled=false;
  page.on('pageerror',e=>{
    if(settled)return;
    settled=true;
    const stack=e.stack||e.message;
    console.log('DR STARTUP FIRST PAGE ERROR\n'+stack);
    firstResolve({type:'pageerror',stack});
  });
  page.on('console',m=>{
    if(['error','warning'].includes(m.type())) console.log(`DR STARTUP CONSOLE ${m.type()}: ${m.text()}`);
  });
  await page.goto(STAGING,{waitUntil:'commit',timeout:15000});
  console.log('DR STARTUP NAVIGATION COMMITTED');
  await Promise.race([
    page.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{}),
    sleep(5500)
  ]);
  console.log('DR STARTUP DOM WAIT COMPLETE');
  const result=await Promise.race([
    firstError,
    sleep(8000).then(()=>({type:'quiet-window-complete'}))
  ]);
  console.log('DR STARTUP RESULT '+JSON.stringify(result));
  if(result.type==='pageerror')throw new Error('DR startup emitted an uncaught page error: '+result.stack);
  const state=await Promise.race([
    page.evaluate(()=>({
      href:location.href,
      loader:!!window.__fireV18ModuleLoader,
      core:!!window.__fireFullV18,
      coreReady:!!window.__fireV18CoreReady,
      parityLoaded:!!window.__fireV18ParityLoader,
      tools:!!document.querySelector('#tools'),
      importFile:!!document.querySelector('#importFile'),
      priceEditor:!!document.querySelector('#priceEditor'),
      mixHistory:!!document.querySelector('#mixHistory'),
      scriptCount:document.scripts.length,
      recentScripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-12)
    })),
    sleep(5000).then(()=>({evaluationTimedOut:true}))
  ]);
  console.log('DR STARTUP STATE '+JSON.stringify(state));
  if(state?.evaluationTimedOut)throw new Error('DR startup page became unresponsive during state audit');
  const required=['loader','core','coreReady','tools','importFile','priceEditor','mixHistory'];
  const missing=required.filter(k=>!state?.[k]);
  if(missing.length)throw new Error('DR startup missing required runtime state: '+missing.join(', '));
  console.log('DR STARTUP STACK PASS');
  await Promise.race([ctx.close(),sleep(5000)]);
} finally {
  await Promise.race([browser.close(),sleep(5000)]);
}
