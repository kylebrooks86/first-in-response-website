import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const expected=[
['price_houseWash','House wash / ft²','0.22'],['price_gutterClean','Gutter clean / linear ft','1.5'],['price_gutterGuards','Guard remove + reinstall / ft','0.5'],['price_gutterBrightening','Gutter brightening / ft','2'],['price_window1','Standard window — 1st','7'],['price_window2','Standard window — 2nd','11'],['price_french1','French pane — 1st','12'],['price_french2','French pane — 2nd','18'],['price_screen1','Screen — 1st','3'],['price_screen2','Screen — 2nd','6'],['price_deepFrame1','1st Floor Deep Exterior Window Frame & Sill Cleaning','0'],['price_deepFrame2','2nd Floor Deep Exterior Window Frame & Sill Cleaning','0'],['price_oxidation','Frame oxidation removal','0'],['price_cobweb','Cobweb-removal add-on','0'],['price_fence','Fence cleaning / ft²','0.4'],['price_premiumFence','Premium fence restoration / ft²','0'],['price_roof','Roof cleaning / ft²','0'],['price_deck','Deck cleaning / ft²','0'],['price_paver','Paver / stone cleaning / ft²','0'],['price_masonry','Brick / masonry cleaning / ft²','0'],['price_driveway','Driveway flat rate','175'],['price_frontWalk','Front sidewalk + curb','75'],['price_sideWalk','Side sidewalk','25'],['price_trashBin','Trash bin / each','0'],['price_dryerVent','Dryer vent system / each','0'],['price_undergroundDownspout','Underground downspout line','0'],['price_frenchDrain','French drain line','0'],['price_acCondenser','AC condenser rinse','0'],['price_rvWash','RV wash','150'],['price_vehicleLinear','Boat / trailer / vehicle / ft','0']
];
async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function openPricing(page){
  for(let attempt=0;attempt<20;attempt++){
    await clickVisibleText(page,'Job Math').catch(()=>false);
    for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count()){await r.first().locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return}}
    await page.waitForTimeout(150);
  }
  throw new Error('Job Math route missing after app settled');
}
async function inspect(page){
  const out=[];
  for(const [id,label,value] of expected){
    const e=page.locator('#'+id);if(!await e.count())throw new Error(`missing ${id}`);
    const actualValue=await e.inputValue();
    const actualLabel=await e.evaluate(node=>{const f=node.closest('.field');return (f?.querySelector('label')?.textContent||node.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim()});
    out.push([id,actualLabel,actualValue]);
    if(actualLabel!==label||actualValue!==value)throw new Error(`${id} expected ${label}=${value}, got ${actualLabel}=${actualValue}`);
  }
  return out;
}
async function stableReload(page,base){
  let lastErr=null;
  for(let attempt=0;attempt<3;attempt++){
    try{await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(700);return}catch(err){lastErr=err;await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});await page.waitForTimeout(700)}
  }
  throw lastErr||new Error('reload failed');
}
async function run(base,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(700);await openPricing(page);await inspect(page);
  const rate=page.locator('#price_houseWash');await rate.evaluate(node=>{node.value='0.23';node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))});await page.waitForTimeout(180);
  await stableReload(page,base);await openPricing(page);const persisted=await page.locator('#price_houseWash').inputValue();
  await ctx.close();if(persisted!=='0.23')throw new Error(`${base}: house-wash rate did not persist across reload; got ${persisted}`);return persisted;
}
const browser=await chromium.launch({headless:true});
try{const live=await run(LIVE,browser);const staging=await run(STAGING,browser);console.log(`PRICING LIVE PARITY PASS live=${live} staging=${staging}`)}finally{await browser.close()}
