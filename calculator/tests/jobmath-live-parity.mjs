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

async function clickText(page,text){const x=page.getByText(text,{exact:true});if(await x.count()){await x.first().click();return true}return false}
async function visibleJobRoot(page){for(const s of ['#view-job','#job']){const x=page.locator(s);if(await x.count()&&await x.first().isVisible())return x.first()}return null}
async function jobRouteText(page){for(const s of ['#view-job','#job']){const x=page.locator(s);if(await x.count()){const raw=(await x.first().innerText()).replace(/,/g,'').replace(/\s+/g,' ');if(raw.includes('Price the whole job')||raw.includes('Subtotal'))return raw}}return null}
async function openAllJobDetails(page){const root=await visibleJobRoot(page);if(!root)return false;await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return true}
async function setByIds(page,ids,value){for(const id of ids){const el=page.locator('#'+id);if(await el.count()){await el.evaluate((node,v)=>{node.value=String(v);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))},value);return true}}return false}
async function estimateTotals(page){
  const raw=await jobRouteText(page);if(!raw)return null;
  const get=label=>{const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=raw.match(new RegExp(esc+'\\s+\\$\\s*([0-9]+(?:\\.[0-9]{1,2})?)','i'));return m?Number(m[1]):null};
  return {subtotal:get('Subtotal'),total:get('Customer total'),deposit:get('50% deposit'),raw};
}
async function runScenario(browser,base,scenario){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  if(!await clickText(page,'Job Math'))throw new Error(`Could not open Job Math at ${base}`);
  await page.waitForTimeout(300);
  if(!await openAllJobDetails(page))throw new Error(`${base}: no visible Job Math route`);
  const house=await setByIds(page,['houseWashArea','svcHouse'],scenario.house);
  const discount=await setByIds(page,['discountPct','fullDiscount'],scenario.discount);
  const override=await setByIds(page,['quotedPrice','fullOverride'],scenario.override);
  if(!house||!discount||!override)throw new Error(`${base}: missing Job Math input for ${scenario.name} house=${house} discount=${discount} override=${override}`);
  await page.waitForTimeout(300);
  const found=await estimateTotals(page);await ctx.close();
  if(!found||[found.subtotal,found.total,found.deposit].some(v=>v===null))throw new Error(`${base}: could not read totals for ${scenario.name}. route=${found?.raw||'missing'}`);
  return {subtotal:found.subtotal,total:found.total,deposit:found.deposit};
}
function same(a,b){return Math.abs(a-b)<0.011}
const browser=await chromium.launch({headless:true});let failed=false;
try{for(const scenario of scenarios){const live=await runScenario(browser,LIVE,scenario);const staging=await runScenario(browser,STAGING,scenario);const ok=same(live.subtotal,staging.subtotal)&&same(live.total,staging.total)&&same(live.deposit,staging.deposit);console.log(`${ok?'PASS':'FAIL'} ${scenario.name}: live=${JSON.stringify(live)} staging=${JSON.stringify(staging)}`);if(!ok)failed=true}}finally{await browser.close()}
if(failed)process.exit(1);
console.log('JOB MATH LIVE PARITY PASS');
