import { chromium } from 'playwright';
const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function openJob(page){if(!await clickVisibleText(page,'Job Math'))throw new Error('Job Math route control missing');await page.waitForTimeout(180);for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count()){await r.first().locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r.first()}}throw new Error('Job Math route missing')}
async function setHouse(page,root){const x=root.locator('#houseWashArea,#svcHouse').first();if(!await x.count())throw new Error('House wash field missing');await x.fill('1000');await x.dispatchEvent('change');await page.waitForTimeout(120)}
async function discountValue(root){const x=root.locator('#discountPct,#fullDiscount').first();return await x.count()?Number(await x.inputValue()):null}
async function customerTotal(root){const raw=(await root.innerText()).replace(/,/g,'').replace(/\s+/g,' ');const m=raw.match(/Customer total\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);return m?Number(m[1]):null}
async function run(base,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});let root=await openJob(page);await setHouse(page,root);
  const initial={discount:await discountValue(root),total:await customerTotal(root)};
  const hasBundle=await clickVisibleText(page,'+10% bundle');await page.waitForTimeout(100);root=await openJob(page);const afterBundle={discount:await discountValue(root),total:await customerTotal(root)};
  const hasPromo=await clickVisibleText(page,'+15% promotion');await page.waitForTimeout(100);root=await openJob(page);const afterPromo={discount:await discountValue(root),total:await customerTotal(root)};
  const hasClear=await clickVisibleText(page,'Clear');await page.waitForTimeout(100);root=await openJob(page);const afterClear={discount:await discountValue(root),total:await customerTotal(root)};
  await ctx.close();return {hasBundle,hasPromo,hasClear,initial,afterBundle,afterPromo,afterClear}}
const browser=await chromium.launch({headless:true});try{const live=await run(LIVE,browser),staging=await run(STAGING,browser);console.log('LIVE BUNDLE '+JSON.stringify(live));console.log('STAGING BUNDLE '+JSON.stringify(staging));const ok=JSON.stringify(live)===JSON.stringify(staging);console.log(`BUNDLE/PROMOTION PARITY ${ok?'PASS':'FAIL'}`);if(!ok)process.exit(1);console.log('BUNDLE LIVE PARITY PASS')}finally{await browser.close()}
