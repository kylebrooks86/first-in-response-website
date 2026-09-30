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
async function inputByLabel(page,labels,value){
  for(const label of labels){const el=page.getByLabel(label,{exact:false});if(await el.count()){await el.first().fill(String(value));await el.first().dispatchEvent('input');await el.first().dispatchEvent('change');return true}}
  return false;
}
async function moneyNear(page,label){
  const text=page.getByText(label,{exact:true});if(!await text.count())return null;
  const box=text.first().locator('xpath=..');const raw=(await box.innerText()).replace(/,/g,'');const m=raw.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);return m?Number(m[1]):null;
}
async function runScenario(browser,base,scenario){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  if(!await clickText(page,'Job Math'))throw new Error(`Could not open Job Math at ${base}`);
  await page.waitForTimeout(300);
  const house=await inputByLabel(page,['House wash area'],scenario.house);
  const discount=await inputByLabel(page,['Stackable discount total','Discount'],scenario.discount);
  const override=await inputByLabel(page,['Final-price override','Final price override'],scenario.override);
  if(!house||!discount||!override)throw new Error(`${base}: missing Job Math input for ${scenario.name} house=${house} discount=${discount} override=${override}`);
  await page.waitForTimeout(250);
  const subtotal=await moneyNear(page,'Subtotal');
  const total=await moneyNear(page,'Customer total');
  const deposit=await moneyNear(page,'50% deposit');
  await ctx.close();
  if([subtotal,total,deposit].some(v=>v===null))throw new Error(`${base}: could not read totals for ${scenario.name}`);
  return {subtotal,total,deposit};
}
function same(a,b){return Math.abs(a-b)<0.011}
const browser=await chromium.launch({headless:true});
let failed=false;
try{
  for(const scenario of scenarios){
    const live=await runScenario(browser,LIVE,scenario);
    const staging=await runScenario(browser,STAGING,scenario);
    const ok=same(live.subtotal,staging.subtotal)&&same(live.total,staging.total)&&same(live.deposit,staging.deposit);
    console.log(`${ok?'PASS':'FAIL'} ${scenario.name}: live=${JSON.stringify(live)} staging=${JSON.stringify(staging)}`);
    if(!ok)failed=true;
  }
}finally{await browser.close()}
if(failed)process.exit(1);
console.log('JOB MATH LIVE PARITY PASS');
