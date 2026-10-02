import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function clickVisible(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}return false}
async function visibleRoot(page,sels){for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function openRoute(page,label,roots){for(let i=0;i<30;i++){await clickVisible(page,label).catch(()=>false);await sleep(100);const r=await visibleRoot(page,roots);if(r)return r}throw new Error(`Route missing: ${label}`)}
async function openJob(page){const r=await openRoute(page,'Job Math',['#view-job','#job']);await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r}
async function openTools(page){return await openRoute(page,'Field Tools',['#view-tools','#tools']).catch(()=>openRoute(page,'Tools',['#view-tools','#tools']))}
async function byIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function setDom(el,v){if(!el)throw new Error('Missing field');await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}

async function createDrBackup(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.addInitScript(()=>{window.__reverseCopied=[];try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__reverseCopied.push(String(t))}})}catch{}});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    const job=await openJob(page);
    const name=job.getByLabel('Customer / job name',{exact:true});if(!await name.count())throw new Error('DR customer/job field missing');
    await setDom(name.first(),'DR Reverse Portability');
    await setDom(await byIds(page,['svcHouse']),654);
    await setDom(await byIds(page,['fullDiscount']),12.5);
    await sleep(250);
    await openTools(page);
    for(let i=0;i<30&&!await page.locator('#copyBackupText').count();i++)await sleep(100);
    const b=page.locator('#copyBackupText');if(!await b.count())throw new Error('DR Copy backup text missing');
    await b.evaluate(n=>n.click());
    await page.waitForFunction(()=>window.__reverseCopied?.length>0,{timeout:5000});
    const text=await page.evaluate(()=>window.__reverseCopied.at(-1));
    const parsed=JSON.parse(text);
    const compatibility=JSON.stringify({
      format:'FIRE Field Calculator Backup',
      appVersion:18,
      version:3,
      exportedAt:new Date().toISOString(),
      data:{
        fireEstimateDraft:JSON.stringify({fields:{estimateJobName:'DR Reverse Portability',houseWashArea:'654',discountPct:'12.5'},savedAt:Date.now()}),
        fireFieldCalc:JSON.stringify({}),
        fireInventory:JSON.stringify({}),
        fireRig:JSON.stringify({}),
        fireXjet:JSON.stringify({})
      }
    },null,2);
    return {nativeText:text,compatibilityText:compatibility,summary:{schema:parsed.schema||null,version:parsed.version||null,format:parsed.format||null,appVersion:parsed.appVersion||null,topLevelKeys:Object.keys(parsed).sort(),storeKeys:Object.keys(parsed.stores||{}).sort()}};
  } finally {await ctx.close()}
}

async function tryRestoreIntoLive(browser,backupText,label){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    await ctx.route('**/*',route=>['image','media','font'].includes(route.request().resourceType())?route.abort():route.continue());
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(LIVE,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    const job=await openJob(page);
    const name=job.getByLabel('Customer / job name',{exact:true});if(!await name.count())throw new Error('LIVE customer/job field missing');
    await setDom(name.first(),'LIVE Reverse Guard');
    const house=await byIds(page,['houseWashArea']);if(!house)throw new Error('LIVE House Wash field missing');await setDom(house,111);
    await sleep(200);
    await openTools(page);
    for(let i=0;i<30&&!await page.locator('input[type="file"]').count();i++)await sleep(100);
    const input=page.locator('input[type="file"]');if(!await input.count())throw new Error('LIVE restore input missing');
    const before={url:page.url(),name:'LIVE Reverse Guard',house:'111'};
    await input.first().setInputFiles({name:`FIRE_DR_${label}.json`,mimeType:'application/json',buffer:Buffer.from(backupText)});
    await sleep(1800);
    const status=((await page.locator('#backupStatus').innerText().catch(()=>''))||'').replace(/\s+/g,' ').trim();
    const postJob=await openJob(page);
    const postName=postJob.getByLabel('Customer / job name',{exact:true});
    const postHouse=await byIds(page,['houseWashArea']);
    const after={url:page.url(),name:await postName.first().inputValue(),house:await postHouse.inputValue(),status};
    const accepted=after.name==='DR Reverse Portability'&&after.house==='654';
    const preservedGuard=after.name==='LIVE Reverse Guard'&&after.house==='111';
    return {label,before,after,accepted,preservedGuard};
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const backup=await createDrBackup(browser);
  const nativeLive=await tryRestoreIntoLive(browser,backup.nativeText,'native-offline');
  const compatibilityLive=await tryRestoreIntoLive(browser,backup.compatibilityText,'live-v3-compatibility');
  const classify=x=>x.accepted?'ACCEPTED':x.preservedGuard?'REJECTED_SAFELY':'UNEXPECTED_STATE';
  const report={probe:'DR backup -> isolated LIVE restore',backup:backup.summary,native:{live:nativeLive,status:classify(nativeLive)},compatibility:{live:compatibilityLive,status:classify(compatibilityLive)}};
  fs.writeFileSync(`${OUT}/reverse-backup-portability.json`,JSON.stringify(report,null,2));
  console.log('REVERSE BACKUP PORTABILITY PROBE '+JSON.stringify(report));
} catch(e){
  const report={probe:'DR backup -> isolated LIVE restore',status:'PROBE_ERROR',message:e?.message||String(e),stack:e?.stack||null};
  fs.writeFileSync(`${OUT}/reverse-backup-portability.json`,JSON.stringify(report,null,2));
  console.error('REVERSE BACKUP PORTABILITY PROBE '+JSON.stringify(report));
} finally {await browser.close()}
