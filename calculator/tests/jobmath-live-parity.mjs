import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';

const scenarios=[
  {name:'minimum floor',house:100,discount:0,override:0},
  {name:'discount below minimum',house:800,discount:10,override:0},
  {name:'discount above minimum',house:1000,discount:10,override:0},
  {name:'override below minimum',house:1000,discount:0,override:100},
  {name:'override after discount',house:1000,discount:10,override:200}
];

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const el=x.nth(i);if(await el.isVisible()){await el.evaluate(node=>node.click());return true}}return false}
async function waitSettled(page){await page.waitForLoadState('domcontentloaded',{timeout:4500}).catch(()=>{});await page.waitForTimeout(120)}
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
async function expandDetailsStable(page,root){
  for(let attempt=0;attempt<5;attempt++){
    try{await waitSettled(page);await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(60);return true}
    catch(e){if(!/Execution context was destroyed|navigation|Target closed/i.test(String(e?.message||e)))throw e;await waitSettled(page)}
  }
  return false;
}
async function openJob(page){
  for(let attempt=0;attempt<28;attempt++){
    await clickVisibleText(page,'Job Math').catch(()=>false);
    await page.waitForTimeout(100);
    const root=await jobRootByFields(page);
    if(root){
      const fieldCount=(await page.locator('#houseWashArea').count())+(await page.locator('#svcHouse').count());
      if(fieldCount&&await expandDetailsStable(page,root))return await jobRootByFields(page);
    }
  }
  return null;
}
async function setByIds(page,ids,value){for(const id of ids){const el=page.locator('#'+id);if(await el.count()){await el.evaluate((node,v)=>{node.value=String(v);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))},value);return true}}return false}
async function estimateTotals(root){
  const raw=(await root.innerText()).replace(/,/g,'').replace(/\s+/g,' ');
  const get=label=>{const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=raw.match(new RegExp(esc+'\\s*\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)','i'));return m?Number(m[1]):null};
  return {subtotal:get('Subtotal'),total:get('Customer total'),deposit:get('50% deposit'),raw};
}
async function openSession(browser,base){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  if(base===LIVE)await ctx.route('**/*',route=>{const t=route.request().resourceType();return ['image','media','font'].includes(t)?route.abort():route.continue()});
  const page=await ctx.newPage();
  page.setDefaultNavigationTimeout(12000);
  let root=null,lastError=null;
  for(let attempt=0;attempt<4&&!root;attempt++){
    try{
      await page.goto(base,{waitUntil:'commit',timeout:12000});
      await waitSettled(page);
      root=await openJob(page);
    }catch(e){lastError=e;await waitSettled(page).catch(()=>{})}
  }
  if(!root){await ctx.close();throw new Error(`${base}: no Job Math DOM found after retries${lastError?` (${lastError.message})`:''}`)}
  return {ctx,page};
}
async function runScenario(session,base,scenario){
  const {page}=session;
  let root=await jobRootByFields(page);if(!root)throw new Error(`${base}: Job Math DOM disappeared for ${scenario.name}`);
  if(!await expandDetailsStable(page,root)){root=await openJob(page);if(!root)throw new Error(`${base}: could not stabilize Job Math DOM for ${scenario.name}`)}
  const house=await setByIds(page,['houseWashArea','svcHouse'],scenario.house);
  const discount=await setByIds(page,['discountPct','fullDiscount'],scenario.discount);
  const override=await setByIds(page,['quotedPrice','fullOverride'],scenario.override);
  if(!house||!discount||!override)throw new Error(`${base}: missing Job Math input for ${scenario.name} house=${house} discount=${discount} override=${override}`);
  await page.waitForTimeout(220);
  const currentRoot=await jobRootByFields(page);const found=await estimateTotals(currentRoot);
  if(!found||[found.subtotal,found.total,found.deposit].some(v=>v===null))throw new Error(`${base}: could not read totals for ${scenario.name}. route=${found?.raw||'missing'}`);
  return {subtotal:found.subtotal,total:found.total,deposit:found.deposit};
}
function same(a,b){return Math.abs(a-b)<0.011}
const browser=await chromium.launch({headless:true});let failed=false;let liveSession,stagingSession;
try{
  liveSession=await openSession(browser,LIVE);stagingSession=await openSession(browser,STAGING);
  for(const scenario of scenarios){
    const live=await runScenario(liveSession,LIVE,scenario);const staging=await runScenario(stagingSession,STAGING,scenario);
    const ok=same(live.subtotal,staging.subtotal)&&same(live.total,staging.total)&&same(live.deposit,staging.deposit);
    console.log(`${ok?'PASS':'FAIL'} ${scenario.name}: live=${JSON.stringify(live)} staging=${JSON.stringify(staging)}`);if(!ok)failed=true;
  }
}finally{await liveSession?.ctx.close();await stagingSession?.ctx.close();await browser.close()}
if(failed)process.exit(1);
console.log('JOB MATH LIVE PARITY PASS');
