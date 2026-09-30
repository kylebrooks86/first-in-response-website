import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const TEST_NAME='DR Takeover Test';

async function clickVisible(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.scrollIntoViewIfNeeded().catch(()=>{});await e.click();return true}}return false}
async function byIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function setDom(el,v){if(!el)throw new Error('Missing field');await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}
async function openJob(page){if(!await clickVisible(page,'Job Math'))throw new Error('Job Math nav missing');await page.waitForTimeout(220);for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count()){await r.first().locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r.first()}}throw new Error('Job Math route missing')}
async function openTools(page){
  if(await clickVisible(page,'Field Tools')){await page.waitForTimeout(220);return}
  if(await clickVisible(page,'Tools')){await page.waitForTimeout(220);return}
  for(const selector of ['.tabs .tab[data-view="tools"]','.tabs button']){
    const q=page.locator(selector);for(let i=0;i<await q.count();i++){const e=q.nth(i),t=(await e.textContent()||'').trim();if(t==='Field Tools'||t==='Tools'){await e.scrollIntoViewIfNeeded().catch(()=>{});await e.click({force:true});await page.waitForTimeout(220);return}}
  }
  throw new Error('Field Tools nav missing');
}
async function setLiveDisposableState(page){const job=await openJob(page);const name=job.getByLabel('Customer / job name',{exact:true});if(!await name.count())throw new Error('Live customer/job field missing');await setDom(name.first(),TEST_NAME);await setDom(await byIds(page,['houseWashArea']),321);await setDom(await byIds(page,['discountPct']),7.5);await setDom(await byIds(page,['jobArea']),2468);await page.waitForTimeout(200);await openTools(page);await setDom(await byIds(page,['inv_sh']),2.75);await page.waitForTimeout(180)}
async function copyLiveBackup(page){const btn=page.getByRole('button',{name:'Copy backup text',exact:true});if(!await btn.count())throw new Error('Live Copy backup text missing');await btn.first().click();await page.waitForTimeout(160);const text=await page.evaluate(()=>navigator.clipboard.readText());if(!text||text.length<20)throw new Error('Live backup clipboard was empty');let parsed;try{parsed=JSON.parse(text)}catch{throw new Error('Live backup clipboard was not valid JSON')}return {text,summary:{schema:parsed.schema||null,version:parsed.version||null,topLevelKeys:Object.keys(parsed).sort(),storeKeys:parsed.stores?Object.keys(parsed.stores).sort():[]}}}
async function restoreIntoStaging(browser,backupText){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(700);await openTools(page);const input=await byIds(page,['importFile']);if(!input)throw new Error('DR restore file input missing');await input.setInputFiles({name:'FIRE_live_takeover_test.json',mimeType:'application/json',buffer:Buffer.from(backupText)});await page.waitForTimeout(900);const job=await openJob(page);const name=job.getByLabel('Customer / job name',{exact:true});const restored={name:await name.first().inputValue(),house:await (await byIds(page,['svcHouse'])).inputValue(),discount:await (await byIds(page,['fullDiscount'])).inputValue(),area:await (await byIds(page,['area'])).inputValue()};await openTools(page);const invRow=page.locator('.fire-inv-row[data-inv-key="sh"] input');restored.inventorySh=await invRow.count()?await invRow.first().inputValue():null;await ctx.close();return restored}

const browser=await chromium.launch({headless:true});try{
  const liveCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});const live=await liveCtx.newPage();await live.goto(LIVE,{waitUntil:'domcontentloaded',timeout:60000});await live.waitForTimeout(700);await setLiveDisposableState(live);const backup=await copyLiveBackup(live);await liveCtx.close();
  const restored=await restoreIntoStaging(browser,backup.text);const expected={name:TEST_NAME,house:'321',discount:'7.5',area:'2468',inventorySh:'2.75'};const result={backup:backup.summary,expected,restored};fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(`${OUT}/backup-takeover.json`,JSON.stringify(result,null,2));console.log('BACKUP TAKEOVER '+JSON.stringify(result));const ok=Object.entries(expected).every(([k,v])=>String(restored[k])===String(v));if(!ok)process.exit(1);console.log('LIVE BACKUP TO DR RESTORE PASS');
}finally{await browser.close()}
