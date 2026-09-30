import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';

async function clickVisibleText(page,text){
  const q=page.getByText(text,{exact:true});
  for(let i=0;i<await q.count();i++){const el=q.nth(i);if(await el.isVisible()){await el.click();return true}}
  return false;
}
async function setByIds(page,ids,value){
  for(const id of ids){const el=page.locator('#'+id);if(await el.count()){await el.evaluate((node,v)=>{node.value=String(v);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))},value);return true}}
  return false;
}
async function readByIds(page,ids){for(const id of ids){const el=page.locator('#'+id);if(await el.count())return Number(await el.inputValue())}return NaN}
async function openJob(page){
  if(!await clickVisibleText(page,'Job Math'))throw new Error('Job Math route control not found');
  await page.waitForTimeout(250);
  for(const rootSel of ['#view-job','#job']){const root=page.locator(rootSel);if(await root.count()){await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return}}
  throw new Error('Job Math DOM not found');
}
async function snapshot(base){
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  try{
    await page.goto(base,{waitUntil:'networkidle',timeout:60000});
    await openJob(page);
    await setByIds(page,['houseWashArea','svcHouse'],1000);
    await page.waitForTimeout(150);
    if(!await clickVisibleText(page,'+3% cash'))throw new Error('Missing +3% cash shortcut');
    await page.waitForTimeout(100);
    const afterCash=await readByIds(page,['discountPct','fullDiscount']);
    if(!await clickVisibleText(page,'+5% responder / military'))throw new Error('Missing +5% responder / military shortcut');
    await page.waitForTimeout(100);
    const afterResponder=await readByIds(page,['discountPct','fullDiscount']);
    if(!await clickVisibleText(page,'Clear'))throw new Error('Missing Clear discount shortcut');
    await page.waitForTimeout(100);
    const afterClear=await readByIds(page,['discountPct','fullDiscount']);
    await setByIds(page,['calArea'],2000);
    await setByIds(page,['calMixUsed','calMix'],5);
    await page.waitForTimeout(100);
    if(!await clickVisibleText(page,'Use this coverage rate'))throw new Error('Missing Use this coverage rate action');
    await page.waitForTimeout(120);
    const coverage=await readByIds(page,['coverage']);
    return {afterCash,afterResponder,afterClear,coverage};
  }finally{await ctx.close();await browser.close()}
}

const live=await snapshot(LIVE);
const staging=await snapshot(STAGING);
const same=(a,b)=>Math.abs(a-b)<0.001;
const checks=[['cash shortcut',live.afterCash,staging.afterCash],['responder shortcut',live.afterResponder,staging.afterResponder],['clear shortcut',live.afterClear,staging.afterClear],['coverage transfer',live.coverage,staging.coverage]];
let failed=false;
for(const [name,a,b] of checks){const ok=same(a,b);console.log(`${ok?'PASS':'FAIL'} ${name}: live=${a} staging=${b}`);if(!ok)failed=true}
if(failed)process.exit(1);
console.log('JOB MATH SHORTCUT PARITY PASS',JSON.stringify({live,staging}));