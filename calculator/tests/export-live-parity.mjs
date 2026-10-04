import { chromium } from 'playwright';
const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}return false}
async function root(page){
  for(const id of ['houseWashArea','svcHouse']){
    const field=page.locator('#'+id);if(await field.count()&&await field.first().isVisible()){
      for(const sel of ['#view-job','#job']){const r=field.first().locator(`xpath=ancestor::*[@id='${sel.slice(1)}']`);if(await r.count()&&await r.first().isVisible())return r.first()}
    }
  }
  return null;
}
async function openDetails(page){const r=await root(page);if(!r)return null;await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return r}
async function openJob(page){
  for(let attempt=0;attempt<30;attempt++){
    await clickVisibleText(page,'Job Math');
    await page.waitForTimeout(120);
    const r=await openDetails(page);
    if(r)return r;
  }
  throw new Error('Job Math route/house field missing at '+page.url());
}
async function setDom(el,value){await el.evaluate((n,v)=>{n.value=String(v);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function field(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function clickButton(page,text){
  for(let attempt=0;attempt<40;attempt++){
    const r=await openDetails(page);
    if(r){
      const ok=await r.locator('button').evaluateAll((bs,t)=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();const b=bs.find(x=>norm(x.textContent)===t&&x.getBoundingClientRect().width>0);if(!b)return false;b.click();return true},text);
      if(ok){await page.waitForTimeout(180);return}
    }
    const global=page.getByRole('button',{name:text,exact:true});
    for(let i=0;i<await global.count();i++){const b=global.nth(i);if(await b.isVisible()){await b.evaluate(n=>n.click());await page.waitForTimeout(180);return}}
    await page.waitForTimeout(150);
  }
  const visibleButtons=await page.locator('button:visible').allTextContents().catch(()=>[]);
  throw new Error('Missing action '+text+' at '+page.url()+'; visible buttons='+JSON.stringify(visibleButtons.map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)));
}
async function armHooks(page){
 await page.evaluate(()=>{
   window.__fireParity={copied:[],shared:[],printed:0};
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__fireParity.copied.push(String(text));}}});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__fireParity.shared.push(JSON.parse(JSON.stringify(data||{})));}});
   window.print=()=>{window.__fireParity.printed++};
 });
}
async function waitForHook(page,key){
  for(let i=0;i<20;i++){
    const n=await page.evaluate(k=>Array.isArray(window.__fireParity?.[k])?window.__fireParity[k].length:0,key);
    if(n>0)return true;
    await page.waitForTimeout(100);
  }
  return false;
}
async function run(base,browser){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
   window.__fireParity={copied:[],shared:[],printed:0};
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__fireParity.copied.push(String(text));}}});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__fireParity.shared.push(JSON.parse(JSON.stringify(data||{})));}});
   window.print=()=>{window.__fireParity.printed++};
 });
 const page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(700);await openJob(page);
 await armHooks(page);
 const house=await field(page,['houseWashArea','svcHouse']);if(!house)throw new Error('House field missing at '+base);await setDom(house,'1000');await page.waitForTimeout(220);
 await clickButton(page,'Copy customer quote');if(!await waitForHook(page,'copied')){await clickButton(page,'Copy customer quote');await waitForHook(page,'copied')}
 await clickButton(page,'Share quote');if(!await waitForHook(page,'shared')){await clickButton(page,'Share quote');await waitForHook(page,'shared')}
 await clickButton(page,'Print / Save PDF');
 const result=await page.evaluate(()=>window.__fireParity);await ctx.close();return result;
}
const browser=await chromium.launch({headless:true});try{const live=await run(LIVE,browser),staging=await run(STAGING,browser);console.log('LIVE EXPORT '+JSON.stringify(live));console.log('STAGING EXPORT '+JSON.stringify(staging));const normalize=x=>({copied:x.copied.slice(0,1),shared:x.shared.slice(0,1),printed:x.printed});const ok=JSON.stringify(normalize(live))===JSON.stringify(normalize(staging));console.log(`EXPORT ACTION PARITY ${ok?'PASS':'FAIL'}`);if(!ok)process.exit(1);console.log('EXPORT LIVE PARITY PASS')}finally{await browser.close()}
