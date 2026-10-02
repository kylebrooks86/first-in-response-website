import { chromium } from 'playwright';
import fs from 'node:fs';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function clickVisible(page,text){
  const q=page.getByText(text,{exact:true});
  for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}
  return false
}
async function openRoute(page,label,roots){
  for(let i=0;i<24;i++){
    await clickVisible(page,label).catch(()=>false);await sleep(100);
    for(const s of roots){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}
  }
  throw new Error(`Offline route failed: ${label}`)
}
async function setDom(el,value){await el.evaluate((n,v)=>{n.value=String(v);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function byId(page,id){const e=page.locator('#'+id);if(!await e.count())throw new Error('Missing #'+id);return e.first()}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
let ctx;
try{
  ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
  const page=await ctx.newPage();
  page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(20000);
  await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__fireV18ModuleLoader&&window.__fireV18CoreReady,{timeout:20000});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&window.__fireV18CoreReady,{timeout:20000});
  }

  const job=await openRoute(page,'Job Math',['#view-job','#job']);
  await job.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  const name=page.locator('#estimateJobName');if(await name.count())await setDom(name.first(),'Offline DR Acceptance');
  await setDom(await byId(page,'svcHouse'),1234);
  await setDom(await byId(page,'fullDiscount'),10);
  await setDom(await byId(page,'area'),2500);
  await sleep(500);

  const cacheState=await page.evaluate(async()=>({controller:!!navigator.serviceWorker.controller,keys:await caches.keys(),assets:(await caches.open((await caches.keys()).find(k=>k.startsWith('fire-field-calculator-')))).keys().then(xs=>xs.map(x=>x.url))}));
  if(!cacheState.controller)throw new Error('Service worker never controlled DR page');
  if(!cacheState.keys.some(k=>k==='fire-field-calculator-v18-exact-clone-62'))throw new Error('Expected cache generation 62 missing');
  if(!cacheState.assets.some(u=>u.includes('/calculator/full-v18.js?v=6')))throw new Error('Shared loader missing from offline cache');

  await ctx.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__fireV18ModuleLoader&&window.__fireV18CoreReady,{timeout:20000});
  const offlineState=await page.evaluate(()=>({online:navigator.onLine,controller:!!navigator.serviceWorker.controller,title:document.title,body:(document.body.innerText||'').slice(0,300)}));
  if(offlineState.online)throw new Error('Browser did not enter offline mode');
  if(!offlineState.controller)throw new Error('Offline reload lost service-worker control');

  await openRoute(page,'Equipment',['#view-equipment','#equipment']);
  await openRoute(page,'Chemicals',['#view-chemicals','#chemicals']);
  const offlineJob=await openRoute(page,'Job Math',['#view-job','#job']);
  await offlineJob.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  await openRoute(page,'Field Tools',['#view-tools','#tools']);
  await openRoute(page,'Field Guide',['#view-guide','#guide']);
  await openRoute(page,'Job Math',['#view-job','#job']);

  const restored={
    name:await page.locator('#estimateJobName').inputValue().catch(()=>''),
    house:await byId(page,'svcHouse').then(e=>e.inputValue()),
    discount:await byId(page,'fullDiscount').then(e=>e.inputValue()),
    area:await byId(page,'area').then(e=>e.inputValue())
  };
  if(restored.name!=='Offline DR Acceptance'||restored.house!=='1234'||restored.discount!=='10'||restored.area!=='2500')throw new Error('Offline state did not survive reload: '+JSON.stringify(restored));

  await setDom(await byId(page,'svcHouse'),1000);await sleep(250);
  const total=await page.locator('#fullTotal').innerText();
  if(!/\$198\.00/.test(total))throw new Error('Offline calculator math failed after reload: '+total);

  const report={status:'PASS',cacheState:{controller:cacheState.controller,keys:cacheState.keys,assetCount:cacheState.assets.length},offlineState,restored,total};
  fs.writeFileSync(`${OUT}/offline-dr-acceptance.json`,JSON.stringify(report,null,2));
  console.log('OFFLINE DR ACCEPTANCE PASS '+JSON.stringify(report));
}catch(e){
  const report={status:'FAIL',message:e?.message||String(e),stack:e?.stack||null};
  fs.writeFileSync(`${OUT}/offline-dr-acceptance.json`,JSON.stringify(report,null,2));
  console.error('OFFLINE DR ACCEPTANCE FAIL '+JSON.stringify(report));process.exitCode=1;
}finally{await ctx?.close().catch(()=>{});await browser.close().catch(()=>{})}
