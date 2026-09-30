import { chromium } from 'playwright';
const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';

async function clickVisibleText(scope,text){
  const x=scope.getByText(text,{exact:true});
  for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}
  return false;
}
async function jobRootByFields(page){
  for(const id of ['houseWashArea','svcHouse']){
    const field=page.locator('#'+id);
    if(await field.count()){
      for(const selector of ['#view-job','#job']){
        const root=field.locator(`xpath=ancestor::*[@id='${selector.slice(1)}']`);
        if(await root.count())return root.first();
      }
    }
  }
  for(const selector of ['#view-job','#job']){const root=page.locator(selector);if(await root.count())return root.first()}
  return null;
}
async function openJob(page){
  for(let attempt=0;attempt<3;attempt++){
    await clickVisibleText(page,'Job Math');
    await page.waitForTimeout(180);
    const root=await jobRootByFields(page);
    if(root){await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return root}
  }
  throw new Error('Job Math route missing');
}
async function reacquire(page){
  const root=await jobRootByFields(page);if(!root)throw new Error('Job Math DOM missing after rerender');
  await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return root;
}
async function setHouse(page,root){const x=root.locator('#houseWashArea,#svcHouse').first();if(!await x.count())throw new Error('House wash field missing');await x.fill('1000');await x.dispatchEvent('change');await page.waitForTimeout(140)}
async function discountValue(root){const x=root.locator('#discountPct,#fullDiscount').first();return await x.count()?Number(await x.inputValue()):null}
async function customerTotal(root){const raw=(await root.innerText()).replace(/,/g,'').replace(/\s+/g,' ');const m=raw.match(/Customer total\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);return m?Number(m[1]):null}
async function clickJobAction(page,root,text){
  if(await clickVisibleText(root,text))return true;
  root=await reacquire(page);
  return clickVisibleText(root,text);
}
async function run(base,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  let root=await openJob(page);await setHouse(page,root);root=await reacquire(page);
  const initial={discount:await discountValue(root),total:await customerTotal(root)};
  const hasBundle=await clickJobAction(page,root,'+10% bundle');await page.waitForTimeout(120);root=await reacquire(page);const afterBundle={discount:await discountValue(root),total:await customerTotal(root)};
  const hasPromo=await clickJobAction(page,root,'+15% promotion');await page.waitForTimeout(120);root=await reacquire(page);const afterPromo={discount:await discountValue(root),total:await customerTotal(root)};
  const hasClear=await clickJobAction(page,root,'Clear');await page.waitForTimeout(120);root=await reacquire(page);const afterClear={discount:await discountValue(root),total:await customerTotal(root)};
  await ctx.close();return {hasBundle,hasPromo,hasClear,initial,afterBundle,afterPromo,afterClear};
}
const browser=await chromium.launch({headless:true});
try{
  const live=await run(LIVE,browser),staging=await run(STAGING,browser);
  console.log('LIVE BUNDLE '+JSON.stringify(live));console.log('STAGING BUNDLE '+JSON.stringify(staging));
  const ok=JSON.stringify(live)===JSON.stringify(staging);console.log(`BUNDLE/PROMOTION PARITY ${ok?'PASS':'FAIL'}`);
  if(!ok)process.exit(1);console.log('BUNDLE LIVE PARITY PASS');
}finally{await browser.close()}
