import { chromium } from 'playwright';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const browser=await chromium.launch({headless:true});
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  let count=0;
  page.on('pageerror',e=>{
    count++;
    if(count<=12) console.log(`DR STARTUP PAGE ERROR #${count}\n${e.stack||e.message}`);
  });
  page.on('console',m=>{
    if(['error','warning'].includes(m.type())&&count<=12) console.log(`DR STARTUP CONSOLE ${m.type()}: ${m.text()}`);
  });
  await page.goto(STAGING,{waitUntil:'commit',timeout:15000});
  await page.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{});
  await page.waitForTimeout(3000);
  const state=await page.evaluate(()=>({
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
  console.log('DR STARTUP STATE '+JSON.stringify(state));
  console.log('DR STARTUP PAGE ERROR COUNT '+count);
  await ctx.close();
} finally {
  await browser.close();
}
