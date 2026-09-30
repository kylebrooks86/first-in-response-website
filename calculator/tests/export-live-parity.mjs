import { chromium } from 'playwright';
const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function root(page){
  for(const id of ['houseWashArea','svcHouse']){
    const field=page.locator('#'+id);if(await field.count()){
      for(const sel of ['#view-job','#job']){const r=field.locator(`xpath=ancestor::*[@id='${sel.slice(1)}']`);if(await r.count())return r.first()}
    }
  }
  for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count())return r.first()}
  return null;
}
async function openDetails(page){const r=await root(page);if(!r)return null;await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return r}
async function openJob(page){if(!await clickVisibleText(page,'Job Math'))throw new Error('Job Math route control missing');await page.waitForTimeout(180);const r=await openDetails(page);if(!r)throw new Error('Job Math route missing');return r}
async function setDom(el,value){await el.evaluate((n,v)=>{n.value=String(v);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function field(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function clickButton(page,text){const r=await openDetails(page);if(!r)throw new Error('Job Math route missing before action '+text);const ok=await r.locator('button').evaluateAll((bs,t)=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();const b=bs.find(x=>norm(x.textContent)===t);if(!b)return false;b.click();return true},text);if(!ok)throw new Error('Missing action '+text);await page.waitForTimeout(120)}
async function run(base,browser){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
   window.__fireParity={copied:[],shared:[],printed:0};
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__fireParity.copied.push(String(text));}}});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__fireParity.shared.push(JSON.parse(JSON.stringify(data||{})));}});
   window.print=()=>{window.__fireParity.printed++};
 });
 const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});await openJob(page);
 const house=await field(page,['houseWashArea','svcHouse']);if(!house)throw new Error('House field missing');await setDom(house,'1000');await page.waitForTimeout(180);
 await clickButton(page,'Copy customer quote');
 await clickButton(page,'Share quote');
 await clickButton(page,'Print / Save PDF');
 const result=await page.evaluate(()=>window.__fireParity);await ctx.close();return result;
}
const browser=await chromium.launch({headless:true});try{const live=await run(LIVE,browser),staging=await run(STAGING,browser);console.log('LIVE EXPORT '+JSON.stringify(live));console.log('STAGING EXPORT '+JSON.stringify(staging));const ok=JSON.stringify(live)===JSON.stringify(staging);console.log(`EXPORT ACTION PARITY ${ok?'PASS':'FAIL'}`);if(!ok)process.exit(1);console.log('EXPORT LIVE PARITY PASS')}finally{await browser.close()}
