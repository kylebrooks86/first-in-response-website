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
async function setDom(el,v){await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}

async function liveTemplate(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(LIVE,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);await openTools(page);
    const b=page.getByRole('button',{name:'Copy backup text',exact:true});await b.waitFor({state:'visible'});await b.evaluate(n=>n.click());await sleep(200);
    const parsed=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
    if(parsed.format!=='FIRE Field Calculator Backup'||Number(parsed.version)!==3||Number(parsed.appVersion)!==18)throw new Error('Unexpected LIVE backup envelope');
    return parsed;
  } finally {await ctx.close()}
}

async function drNative(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.addInitScript(()=>{window.__dualCopied=[];try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__dualCopied.push(String(t))}})}catch{}});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    const job=await openJob(page);
    await setDom(job.getByLabel('Customer / job name',{exact:true}).first(),'DR Dual Portability');
    await setDom(page.locator('#svcHouse'),654);
    await setDom(page.locator('#fullDiscount'),12.5);
    await sleep(300);await openTools(page);
    const b=page.locator('#copyBackupText');await b.waitFor({state:'attached'});await b.evaluate(n=>n.click());
    await page.waitForFunction(()=>window.__dualCopied?.length>0,{timeout:5000});
    const parsed=JSON.parse(await page.evaluate(()=>window.__dualCopied.at(-1)));
    if(parsed.schema!=='FIRE-Field-Calculator-v18-offline'||!parsed.stores)throw new Error('Unexpected DR native backup envelope');
    return parsed;
  } finally {await ctx.close()}
}

function buildDual(live,dr){
  const out=JSON.parse(JSON.stringify(live));
  out.exportedAt=new Date().toISOString();
  const estimate=JSON.parse(out.data.fireEstimateDraft);
  estimate.fields={...(estimate.fields||{}),estimateJobName:'DR Dual Portability',houseWashArea:'654',discountPct:'12.5'};
  estimate.savedAt=Date.now();
  out.data.fireEstimateDraft=JSON.stringify(estimate);
  for(const [k,v] of Object.entries(dr.stores||{})){if(typeof k==='string'&&typeof v==='string')out.data[k]=v}
  return out;
}

async function restoreDual(browser,dual,dr){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    const page=await ctx.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
    const dialogs=[];page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});await d.accept().catch(()=>{})});
    await page.goto(LIVE,{waitUntil:'domcontentloaded',timeout:15000});await sleep(900);
    const job=await openJob(page);
    await setDom(job.getByLabel('Customer / job name',{exact:true}).first(),'LIVE Dual Guard');
    await setDom(page.locator('#houseWashArea'),111);
    const disc=page.locator('#discountPct');if(await disc.count())await setDom(disc,3);
    await sleep(250);await openTools(page);
    const input=page.locator('#importFieldBackup');await input.waitFor({state:'attached'});
    const nav=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:6000}).catch(()=>null);
    await input.setInputFiles({name:'FIRE_Dual_Compatibility.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(dual,null,2))});
    const navigation=!!(await nav);await sleep(1400);
    const post=await openJob(page);
    const ui={
      name:await post.getByLabel('Customer / job name',{exact:true}).first().inputValue(),
      house:await page.locator('#houseWashArea').inputValue(),
      discount:await page.locator('#discountPct').inputValue()
    };
    const extras=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(dr.stores||{}));
    const extraMatches=Object.keys(dr.stores||{}).filter(k=>extras[k]===dr.stores[k]);
    const extraMissingOrChanged=Object.keys(dr.stores||{}).filter(k=>extras[k]!==dr.stores[k]);
    return {
      accepted:ui.name==='DR Dual Portability'&&ui.house==='654'&&ui.discount==='12.5',
      navigation,dialogs,ui,
      extraStoreCount:Object.keys(dr.stores||{}).length,
      extraMatches,extraMissingOrChanged,
      allExtraStoresPreserved:extraMissingOrChanged.length===0
    };
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const live=await liveTemplate(browser);
  const dr=await drNative(browser);
  const dual=buildDual(live,dr);
  const restore=await restoreDual(browser,dual,dr);
  const report={
    probe:'LIVE v3 envelope with embedded DR-only stores',
    liveDataKeysBefore:Object.keys(live.data||{}).sort(),
    drStoreKeys:Object.keys(dr.stores||{}).sort(),
    dualDataKeys:Object.keys(dual.data||{}).sort(),
    restore,
    verdict:restore.accepted&&restore.allExtraStoresPreserved?'DUAL_FORMAT_VIABLE':restore.accepted?'LIVE_ACCEPTS_BUT_DR_STORES_NOT_PRESERVED':'LIVE_REJECTS_DUAL_FORMAT'
  };
  fs.writeFileSync(`${OUT}/dual-v3-extra-stores.json`,JSON.stringify(report,null,2));
  console.log('DUAL V3 EXTRA STORES PROBE '+JSON.stringify(report));
}catch(e){
  const report={probe:'LIVE v3 envelope with embedded DR-only stores',verdict:'PROBE_ERROR',message:e?.message||String(e),stack:e?.stack||null};
  fs.writeFileSync(`${OUT}/dual-v3-extra-stores.json`,JSON.stringify(report,null,2));
  console.error('DUAL V3 EXTRA STORES PROBE '+JSON.stringify(report));
}finally{await browser.close()}
