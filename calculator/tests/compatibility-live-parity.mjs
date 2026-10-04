import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function openTools(page){for(let i=0;i<20;i++){await clickVisibleText(page,'Field Tools');await page.waitForTimeout(120);if(await page.locator('#compatA').count()&&await page.locator('#compatB').count()&&await page.locator('#compatResult').count())return}throw new Error('missing compatibility checker')}
async function select(page,id,value){const el=page.locator('#'+id);await el.evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value);await page.waitForTimeout(100)}
async function snapshot(page){const a=page.locator('#compatA'),b=page.locator('#compatB'),out=page.locator('#compatResult');return {a:await a.inputValue(),b:await b.inputValue(),text:(await out.innerText()).replace(/\s+/g,' ').trim().toLowerCase()}}
async function run(base,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});await openTools(page);
  const valuesA=await page.locator('#compatA option').evaluateAll(os=>os.map(o=>o.value));
  const valuesB=await page.locator('#compatB option').evaluateAll(os=>os.map(o=>o.value));
  const alternateA=valuesA.find(v=>v!=='sh')||valuesA[0];
  const alternateB=valuesB.find(v=>v!=='f9porous')||valuesB[0];
  await select(page,'compatA',alternateA);await select(page,'compatB',alternateB);
  await select(page,'compatA','sh');await select(page,'compatB','f9porous');
  const result=await snapshot(page);result.hasLiveValues=valuesA.includes('sh')&&valuesB.includes('f9porous');result.danger=/do not mix/.test(result.text)&&/must stay separate|dangerous gas|dangerous gases/.test(result.text);await ctx.close();return result}

const browser=await chromium.launch({headless:true});let live,staging;try{live=await run(LIVE,browser);staging=await run(STAGING,browser)}finally{await browser.close()}
console.log('LIVE COMPATIBILITY',JSON.stringify(live));
console.log('STAGING COMPATIBILITY',JSON.stringify(staging));
const ok=live.hasLiveValues&&staging.hasLiveValues&&live.a==='sh'&&live.b==='f9porous'&&staging.a==='sh'&&staging.b==='f9porous'&&live.danger&&staging.danger;
if(!ok)process.exit(1);
console.log('CHEMICAL COMPATIBILITY LIVE PARITY PASS');
