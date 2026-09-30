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
async function openAllJobDetails(page){for(const rootSel of ['#view-job','#job']){const root=page.locator(rootSel);if(await root.count()){await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return true}}return false}
async function openJob(page){
  if(!await clickVisibleText(page,'Job Math'))throw new Error('Job Math route control not found');
  await page.waitForTimeout(250);
  if(await openAllJobDetails(page))return;
  throw new Error('Job Math DOM not found');
}
async function clickJobButton(page,text){
  await openAllJobDetails(page);
  const q=page.locator('button').filter({hasText:text});
  for(let i=0;i<await q.count();i++){
    const b=q.nth(i);
    if((await b.innerText()).trim()===text&&await b.isVisible()){await b.click();return true}
  }
  return false;
}
async function snapshot(base){
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  try{
    await page.goto(base,{waitUntil:'networkidle',timeout:60000});
    await openJob(page);

    await setByIds(page,['measureLength','areaLen'],100);
    await setByIds(page,['measureHeight','areaWid'],10);
    await setByIds(page,['measureSections','areaSides'],2);
    await setByIds(page,['measureSubtract','areaSubtract'],100);
    await page.waitForTimeout(100);

    if(!await clickJobButton(page,'Use for mix planning'))throw new Error('Missing Use for mix planning shortcut');
    await page.waitForTimeout(100);
    const mixArea=await readByIds(page,['jobArea','area']);

    if(!await clickJobButton(page,'Use for house price'))throw new Error('Missing Use for house price shortcut');
    await page.waitForTimeout(100);
    const houseArea=await readByIds(page,['houseWashArea','svcHouse']);

    if(!await clickJobButton(page,'Use for fence price'))throw new Error('Missing Use for fence price shortcut');
    await page.waitForTimeout(100);
    const fenceArea=await readByIds(page,['fenceArea','svcFence']);

    return {mixArea,houseArea,fenceArea};
  }finally{await ctx.close();await browser.close()}
}

const live=await snapshot(LIVE);
const staging=await snapshot(STAGING);
const same=(a,b)=>Math.abs(a-b)<0.001;
const checks=[
  ['mix-planning area shortcut',live.mixArea,staging.mixArea],
  ['house-price area shortcut',live.houseArea,staging.houseArea],
  ['fence-price area shortcut',live.fenceArea,staging.fenceArea]
];
let failed=false;
for(const [name,a,b] of checks){const ok=same(a,b);console.log(`${ok?'PASS':'FAIL'} ${name}: live=${a} staging=${b}`);if(!ok)failed=true}
if(failed)process.exit(1);
console.log('JOB MATH SHORTCUT PARITY PASS',JSON.stringify({live,staging}));