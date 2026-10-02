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
async function waitForBackupButton(page){const b=page.getByRole('button',{name:'Copy backup text',exact:true});for(let i=0;i<40;i++){if(await b.count()&&await b.first().isVisible().catch(()=>false))return b.first();await sleep(150)}throw new Error('Copy backup text missing')}

function parseStore(backup,key){const raw=backup?.data?.[key];if(typeof raw!=='string')throw new Error(`LIVE backup store ${key} missing`);return JSON.parse(raw)}
function summarizeLiveTemplate(backup){
  const estimate=parseStore(backup,'fireEstimateDraft');
  const calc=parseStore(backup,'fireFieldCalc');
  const inventory=parseStore(backup,'fireInventory');
  const rig=parseStore(backup,'fireRig');
  const xjet=parseStore(backup,'fireXjet');
  return {
    format:backup.format,version:backup.version,appVersion:backup.appVersion,
    estimateFieldCount:Object.keys(estimate.fields||{}).length,
    estimateDefaults:estimate.fields,
    fireFieldCalc:calc,
    fireInventory:inventory,
    fireRig:rig,
    fireXjet:xjet
  };
}

async function copyLiveBaseline(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'});
  try{
    await ctx.route('**/*',route=>['image','media','font'].includes(route.request().resourceType())?route.abort():route.continue());
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(LIVE,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    await openTools(page);
    const b=await waitForBackupButton(page);await b.evaluate(n=>n.click());await sleep(200);
    const text=await page.evaluate(()=>navigator.clipboard.readText());
    const parsed=JSON.parse(text);
    if(parsed.format!=='FIRE Field Calculator Backup'||parsed.version!==3||parsed.appVersion!==18)throw new Error('Unexpected LIVE backup envelope');
    return {text,parsed,summary:summarizeLiveTemplate(parsed)};
  } finally {await ctx.close()}
}

async function createDrNativeBackup(browser){
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
    const b=page.locator('#copyBackupText');for(let i=0;i<30&&!await b.count();i++)await sleep(100);if(!await b.count())throw new Error('DR Copy backup text missing');
    await b.evaluate(n=>n.click());await page.waitForFunction(()=>window.__reverseCopied?.length>0,{timeout:5000});
    const text=await page.evaluate(()=>window.__reverseCopied.at(-1));
    const parsed=JSON.parse(text);
    return {text,parsed,summary:{schema:parsed.schema||null,version:parsed.version||null,topLevelKeys:Object.keys(parsed).sort(),storeKeys:Object.keys(parsed.stores||{}).sort()}};
  } finally {await ctx.close()}
}

function buildFullLiveV3Compatibility(liveBaseline){
  const out=JSON.parse(JSON.stringify(liveBaseline));
  out.exportedAt=new Date().toISOString();
  const estimate=parseStore(out,'fireEstimateDraft');
  estimate.fields={...(estimate.fields||{}),estimateJobName:'DR Reverse Portability',houseWashArea:'654',discountPct:'12.5'};
  estimate.savedAt=Date.now();
  out.data.fireEstimateDraft=JSON.stringify(estimate);
  return JSON.stringify(out,null,2);
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
    const discount=await byIds(page,['discountPct']);if(discount)await setDom(discount,3);
    await sleep(200);await openTools(page);
    for(let i=0;i<30&&!await page.locator('input[type="file"]').count();i++)await sleep(100);
    const input=page.locator('input[type="file"]');if(!await input.count())throw new Error('LIVE restore input missing');
    const before={url:page.url(),name:'LIVE Reverse Guard',house:'111'};
    const navPromise=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:4500}).catch(()=>null);
    await input.first().setInputFiles({name:`FIRE_DR_${label}.json`,mimeType:'application/json',buffer:Buffer.from(backupText)});
    await navPromise;await sleep(1300);
    const status=((await page.locator('#backupStatus').innerText().catch(()=>''))||'').replace(/\s+/g,' ').trim();
    const postJob=await openJob(page);
    const postName=postJob.getByLabel('Customer / job name',{exact:true});
    const postHouse=await byIds(page,['houseWashArea']);
    const postDiscount=await byIds(page,['discountPct']);
    const after={url:page.url(),name:await postName.first().inputValue(),house:await postHouse.inputValue(),discount:postDiscount?await postDiscount.inputValue():null,status};
    const accepted=after.name==='DR Reverse Portability'&&after.house==='654'&&after.discount==='12.5';
    const preservedGuard=after.name==='LIVE Reverse Guard'&&after.house==='111';
    return {label,before,after,accepted,preservedGuard};
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const liveBaseline=await copyLiveBaseline(browser);
  const dr=await createDrNativeBackup(browser);
  const fullCompatibility=buildFullLiveV3Compatibility(liveBaseline.parsed);
  const nativeLive=await tryRestoreIntoLive(browser,dr.text,'native-offline');
  const fullLive=await tryRestoreIntoLive(browser,fullCompatibility,'full-live-v3-template');
  const classify=x=>x.accepted?'ACCEPTED':x.preservedGuard?'REJECTED_SAFELY':'UNEXPECTED_STATE';
  const report={
    probe:'DR backup -> isolated LIVE restore',
    drBackup:dr.summary,
    liveTemplate:liveBaseline.summary,
    native:{live:nativeLive,status:classify(nativeLive)},
    fullTemplateCompatibility:{live:fullLive,status:classify(fullLive)}
  };
  fs.writeFileSync(`${OUT}/reverse-backup-portability.json`,JSON.stringify(report,null,2));
  console.log('REVERSE BACKUP PORTABILITY PROBE '+JSON.stringify(report));
} catch(e){
  const report={probe:'DR backup -> isolated LIVE restore',status:'PROBE_ERROR',message:e?.message||String(e),stack:e?.stack||null};
  fs.writeFileSync(`${OUT}/reverse-backup-portability.json`,JSON.stringify(report,null,2));
  console.error('REVERSE BACKUP PORTABILITY PROBE '+JSON.stringify(report));
} finally {await browser.close()}
