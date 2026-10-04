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
async function setDom(el,v){if(!el||!await el.count())throw new Error('Missing field');await el.first().evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}

async function createPortableDrBackup(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.addInitScript(()=>{window.__reverseCopied=[];try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__reverseCopied.push(String(t))}})}catch{}});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:15000});await sleep(1000);
    const job=await openJob(page);
    await setDom(job.getByLabel('Customer / job name',{exact:true}),'DR Reverse Portability');
    await setDom(page.locator('#svcHouse'),654);
    await setDom(page.locator('#svcGutter'),88);
    await setDom(page.locator('#fullDiscount'),12.5);
    await setDom(page.locator('#fullNotes'),'Reverse portability notes');
    await setDom(page.locator('#area'),2468);
    await sleep(350);
    await openTools(page);
    const b=page.locator('#copyBackupText');await b.waitFor({state:'attached'});await b.evaluate(n=>n.click());
    await page.waitForFunction(()=>window.__reverseCopied?.length>0,{timeout:5000});
    const text=await page.evaluate(()=>window.__reverseCopied.at(-1));
    const parsed=JSON.parse(text);
    const requiredDrStores=['fireV18ParityDraft','fireV18FullState','fireV18Rates','fireV18LivePlanningState'];
    if(parsed.format!=='FIRE Field Calculator Backup'||parsed.version!==3||parsed.appVersion!==18||typeof parsed.data?.fireEstimateDraft!=='string'||!requiredDrStores.every(k=>typeof parsed.data?.[k]==='string'))throw new Error('DR did not export the portable v3 backup contract');
    const projected=JSON.parse(parsed.data.fireEstimateDraft)?.fields||{};
    const expected={name:'DR Reverse Portability',house:'654',gutter:'88',discount:'12.5',notes:'Reverse portability notes',area:'2468'};
    if(projected.estimateJobName!==expected.name||projected.houseWashArea!==expected.house||projected.gutterFeet!==expected.gutter||projected.discountPct!==expected.discount||projected.estimateNotes!==expected.notes||projected.jobArea!==expected.area)throw new Error('DR portable backup LIVE projection is incomplete');
    return {text,parsed,requiredDrStores,expected};
  } finally {await ctx.close()}
}

async function restoreIntoLive(browser,backup){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    const dialogs=[];page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});await d.accept().catch(()=>{})});
    await page.goto(LIVE,{waitUntil:'domcontentloaded',timeout:15000});await sleep(950);
    const job=await openJob(page);
    await setDom(job.getByLabel('Customer / job name',{exact:true}),'LIVE Reverse Guard');
    await setDom(page.locator('#houseWashArea'),111);
    await setDom(page.locator('#gutterFeet'),22);
    await setDom(page.locator('#discountPct'),3);
    await sleep(250);await openTools(page);
    const input=page.locator('#importFieldBackup');await input.waitFor({state:'attached'});
    const nav=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:6000}).catch(()=>null);
    await input.setInputFiles({name:'FIRE_DR_Portable_Backup.json',mimeType:'application/json',buffer:Buffer.from(backup.text)});
    const navigation=!!(await nav);await sleep(1400);
    const post=await openJob(page);
    const ui={
      name:await post.getByLabel('Customer / job name',{exact:true}).first().inputValue(),
      house:await page.locator('#houseWashArea').inputValue(),
      gutter:await page.locator('#gutterFeet').inputValue(),
      discount:await page.locator('#discountPct').inputValue(),
      notes:await page.locator('#estimateNotes').inputValue(),
      area:await page.locator('#jobArea').inputValue()
    };
    const extras=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),backup.requiredDrStores);
    const extraMismatches=backup.requiredDrStores.filter(k=>extras[k]!==backup.parsed.data[k]);
    const e=backup.expected;
    const accepted=ui.name===e.name&&ui.house===e.house&&ui.gutter===e.gutter&&ui.discount===e.discount&&ui.notes===e.notes&&ui.area===e.area;
    return {accepted,navigation,dialogs,ui,extraMismatches,allRequiredDrStoresPreserved:extraMismatches.length===0};
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const backup=await createPortableDrBackup(browser);
  const live=await restoreIntoLive(browser,backup);
  const report={status:live.accepted&&live.allRequiredDrStoresPreserved?'PASS':'FAIL',probe:'actual DR portable backup -> isolated LIVE restore',backup:{format:backup.parsed.format,version:backup.parsed.version,appVersion:backup.parsed.appVersion,dataKeyCount:Object.keys(backup.parsed.data||{}).length,requiredDrStores:backup.requiredDrStores},live};
  fs.writeFileSync(`${OUT}/reverse-backup-portability.json`,JSON.stringify(report,null,2));
  console.log('REVERSE BACKUP PORTABILITY '+JSON.stringify(report));
  if(report.status!=='PASS')throw new Error('Actual DR backup did not round-trip into LIVE with DR stores preserved');
}catch(e){
  const path=`${OUT}/reverse-backup-portability.json`;if(!fs.existsSync(path))fs.writeFileSync(path,JSON.stringify({status:'FAIL',probe:'actual DR portable backup -> isolated LIVE restore',message:e?.message||String(e),stack:e?.stack||null},null,2));
  console.error(e);process.exitCode=1;
}finally{await browser.close()}
