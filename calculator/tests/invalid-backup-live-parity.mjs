import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function clickVisible(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}return false}
async function visibleRoot(page,sels){for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function openRoute(page,label,roots){for(let i=0;i<28;i++){await clickVisible(page,label).catch(()=>false);await sleep(100);const r=await visibleRoot(page,roots);if(r)return r}throw new Error(`Route missing: ${label}`)}
async function openJob(page){const r=await openRoute(page,'Job Math',['#view-job','#job']);await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r}
async function openTools(page){return await openRoute(page,'Field Tools',['#view-tools','#tools']).catch(()=>openRoute(page,'Tools',['#view-tools','#tools']))}
async function byIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function setDom(el,v){if(!el)throw new Error('Missing field');await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}

async function run(base,label,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    await ctx.route('**/*',route=>['image','media','font'].includes(route.request().resourceType())?route.abort():route.continue());
    const page=await ctx.newPage();page.setDefaultTimeout(4000);page.setDefaultNavigationTimeout(15000);
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    const job=await openJob(page);
    const name=job.getByLabel('Customer / job name',{exact:true});if(!await name.count())throw new Error(`${label}: customer/job field missing`);
    await setDom(name.first(),'Invalid Backup Guard');
    const house=await byIds(page,['houseWashArea','svcHouse']);if(!house)throw new Error(`${label}: house field missing`);await setDom(house,777);
    await sleep(220);
    await openTools(page);
    for(let i=0;i<30&&!await page.locator('#importFile').count();i++)await sleep(100);
    const input=page.locator('#importFile');if(!await input.count())throw new Error(`${label}: restore file input missing`);
    const beforeUrl=page.url();
    await input.setInputFiles({name:'corrupt-fire-backup.json',mimeType:'application/json',buffer:Buffer.from('{ definitely not valid json')});
    await sleep(900);
    const status=(await page.locator('#backupStatus').innerText().catch(()=>'' )).replace(/\s+/g,' ').trim();
    const afterUrl=page.url();
    const restoredJob=await openJob(page);
    const restoredName=restoredJob.getByLabel('Customer / job name',{exact:true});
    const restoredHouse=await byIds(page,['houseWashArea','svcHouse']);
    const state={name:await restoredName.first().inputValue(),house:await restoredHouse.inputValue()};
    const result={label,status,beforeUrl,afterUrl,state};
    if(state.name!=='Invalid Backup Guard'||state.house!=='777')throw new Error(`${label}: corrupt backup changed current estimate ${JSON.stringify(result)}`);
    if(beforeUrl.split('#')[0]!==afterUrl.split('#')[0])throw new Error(`${label}: corrupt backup navigated away ${JSON.stringify(result)}`);
    if(!/could not be restored|couldn.t be restored|invalid|unable/i.test(status))throw new Error(`${label}: corrupt backup did not show a safe error ${JSON.stringify(result)}`);
    return result;
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const live=await run(LIVE,'LIVE',browser);
  const staging=await run(STAGING,'DR',browser);
  const normalized=x=>({status:x.status,state:x.state});
  const parity=JSON.stringify(normalized(live))===JSON.stringify(normalized(staging));
  const report={status:parity?'PASS':'FAIL',live,staging,parity};
  fs.writeFileSync(`${OUT}/invalid-backup-parity.json`,JSON.stringify(report,null,2));
  console.log('INVALID BACKUP PARITY '+JSON.stringify(report));
  if(!parity)throw new Error('LIVE and DR invalid-backup behavior differ');
  console.log('INVALID BACKUP SAFE-ERROR PARITY PASS');
}catch(e){
  const path=`${OUT}/invalid-backup-parity.json`;if(!fs.existsSync(path))fs.writeFileSync(path,JSON.stringify({status:'FAIL',message:e?.message||String(e),stack:e?.stack||null},null,2));
  console.error(e);process.exitCode=1;
}finally{await browser.close()}
