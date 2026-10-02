import { chromium } from 'playwright';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
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
  await page.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{});
  const result=await Promise.race([
    firstError,
    page.waitForTimeout(8000).then(()=>({type:'timeout'}))
  ]);
  let state=null;
  try{
    state=await page.evaluate(()=>({
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
    }));
  }catch(e){console.log('DR STARTUP STATE READ ERROR '+(e.stack||e.message))}
  console.log('DR STARTUP RESULT '+JSON.stringify(result));
  console.log('DR STARTUP STATE '+JSON.stringify(state));
  const required=['loader','core','coreReady','tools','importFile','priceEditor','mixHistory'];
  const missing=required.filter(k=>!state?.[k]);
  if(result.type==='pageerror')throw new Error('DR startup emitted an uncaught page error: '+result.stack);
  if(missing.length)throw new Error('DR startup missing required runtime state: '+missing.join(', '));
  console.log('DR STARTUP STACK PASS');
  await ctx.close();
} finally {
  await browser.close();
}
