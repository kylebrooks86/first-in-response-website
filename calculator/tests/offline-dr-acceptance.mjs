import { chromium } from 'playwright';
import fs from 'node:fs';

const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const swSource=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const expectedCache=swSource.match(/const CACHE='([^']+)'/)?.[1];
if(!expectedCache)throw new Error('Unable to read current service-worker cache name');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function clickVisible(page,text){
  const aria=page.locator(`[aria-label="${text.replace(/"/g,'\\"')}"]`);
  for(let i=0;i<await aria.count();i++){const e=aria.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}
  const exact=page.getByText(text,{exact:true});
  for(let i=0;i<await exact.count();i++){const e=exact.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}
  const contains=page.getByText(text,{exact:false});
  for(let i=0;i<await contains.count();i++){const e=contains.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}
  return false
}
async function openRoute(page,label,roots){
  const aliases={
    'Job Math':['Job Math','Job Plan'],
    'Chemicals':['Chemicals','Mixes'],
    'Chemical Index':['Chemical Index','Index'],
    'Equipment':['Equipment','Equipment / X-Jet'],
    'Field Guide':['Field Guide','Safety Guide']
  };
  const labels=aliases[label]||[label];
  const secondary=['Equipment','Field Tools','Field Guide'].includes(label);
  for(let i=0;i<24;i++){
    if(secondary)await clickVisible(page,'Tools').catch(()=>false);
    for(const text of labels)await clickVisible(page,text).catch(()=>false);await sleep(100);
    for(const s of roots){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}
  }
  throw new Error(`Offline route failed: ${label}`)
}
async function setDom(el,value){await el.evaluate((n,v)=>{n.value=String(v);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function byId(page,id){const e=page.locator('#'+id);if(!await e.count())throw new Error('Missing #'+id);return e.first()}
async function waitReady(page){await page.waitForFunction(()=>window.__fireV18ModuleLoader&&window.__fireV18CoreReady,{timeout:20000})}
async function state(page){
  await openRoute(page,'Job Math',['#view-job','#job']);
  return {
    name:await page.locator('#estimateJobName').inputValue().catch(()=>''),
    house:await byId(page,'svcHouse').then(e=>e.inputValue()),
    discount:await byId(page,'fullDiscount').then(e=>e.inputValue()),
    area:await byId(page,'area').then(e=>e.inputValue())
  }
}
function assertState(x,house='1234'){
  if(x.name!=='Offline DR Acceptance'||x.house!==house||x.discount!=='10'||x.area!=='2500')throw new Error('Offline state mismatch: '+JSON.stringify(x));
}
function watchExternal(page,requests){
  page.on('request',req=>{
    const url=req.url();
    if(/(?:openai\.com|chatgpt\.com|chatgpt\.site)/i.test(url))requests.push({url,method:req.method(),resourceType:req.resourceType()});
  });
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
let ctx,page;
const openAiRequests=[];
try{
  ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
  try{const stagingHost=new URL(STAGING).hostname;if(stagingHost==='raw.githack.com'||stagingHost==='rawcdn.githack.com')await ctx.addCookies([{name:'__Http-phish',value:'1',domain:stagingHost,path:'/'}]);}catch{}
  await ctx.addInitScript(()=>{
    window.__fireOfflineCopied=[];
    try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__fireOfflineCopied.push(String(text));}}})}catch{}
  });
  page=await ctx.newPage();watchExternal(page,openAiRequests);
  page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(20000);
  await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:20000});
  await waitReady(page);
  // Regression: theme initialization and toggling must never delete the moon icon.
  const themeCheck=await page.evaluate(()=>{
    const button=document.querySelector('#themeBtn');
    if(!button)throw new Error('Theme toggle missing');
    const moon=()=>button.querySelector('svg.bob-theme-moon');
    const initialDark=document.body.classList.contains('dark');
    if(initialDark)button.click();
    const lightMoon=moon();
    const lightVisible=!!lightMoon&&getComputedStyle(lightMoon).display!=='none'&&lightMoon.getBoundingClientRect().width>0;
    button.click();
    const darkMoonHidden=!!moon()&&getComputedStyle(moon()).display==='none';
    button.click();
    const lightAgain=!!moon()&&getComputedStyle(moon()).display!=='none';
    if(initialDark)button.click();
    return {lightVisible,darkMoonHidden,lightAgain,restoredDark:document.body.classList.contains('dark')===initialDark};
  });
  if(!Object.values(themeCheck).every(Boolean))throw new Error('Theme icon lifecycle regression: '+JSON.stringify(themeCheck));
  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){
    await page.reload({waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&window.__fireV18CoreReady,{timeout:20000});
  }

  const job=await openRoute(page,'Job Math',['#view-job','#job']);
  await job.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  const name=page.locator('#estimateJobName');if(await name.count())await setDom(name.first(),'Offline DR Acceptance');
  await setDom(await byId(page,'svcHouse'),1234);
  await setDom(await byId(page,'fullDiscount'),10);
  await setDom(await byId(page,'area'),2500);
  await page.waitForFunction(()=>{try{const s=JSON.parse(localStorage.getItem('fireV18LivePlanningState')||'{}');return String(s.area||'')==='2500'}catch{return false}},{timeout:5000});
  await sleep(150);

  const cacheState=await page.evaluate(async()=>{
    const keys=await caches.keys();
    const cacheName=keys.find(k=>k.startsWith('fire-field-calculator-'));
    const assets=cacheName?(await (await caches.open(cacheName)).keys()).map(x=>x.url):[];
    return {controller:!!navigator.serviceWorker.controller,keys,assets};
  });
  if(!cacheState.controller)throw new Error('Service worker never controlled DR page');
  if(!cacheState.keys.includes(expectedCache))throw new Error(`Expected current cache ${expectedCache} missing`);
  const expectedEntry=(swSource.match(/'(\.\/full-v18\.js\?v=\d+)'/)||[])[1];
  const expectedPortable=(swSource.match(/'(\.\/v18-live-portable-backup\.js\?v=\d+)'/)||[])[1];
  if(!expectedEntry||!cacheState.assets.some(u=>u.includes(expectedEntry.slice(1))))throw new Error('Shared loader missing from offline cache');
  if(!expectedPortable||!cacheState.assets.some(u=>u.includes(expectedPortable.slice(1))))throw new Error('Portable backup module missing from offline cache');

  await ctx.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:20000});
  await waitReady(page);
  const offlineState=await page.evaluate(()=>({online:navigator.onLine,controller:!!navigator.serviceWorker.controller,title:document.title,body:(document.body.innerText||'').slice(0,300)}));
  if(offlineState.online)throw new Error('Browser did not enter offline mode');
  if(!offlineState.controller)throw new Error('Offline reload lost service-worker control');

  // Capture persisted planning state immediately after offline boot, before any route
  // switches or UI actions can potentially overwrite it.
  const offlinePlanningBoot=await page.evaluate(()=>({
    area:document.getElementById('area')?.value??null,
    planning:localStorage.getItem('fireV18LivePlanningState')?.slice(0,350)??null
  }));
  console.log('OFFLINE PLANNING BOOT',JSON.stringify(offlinePlanningBoot));
  await openRoute(page,'SH Mix',['#view-mix','#mix']);
  const target=page.locator('#targetNum');
  if(!await target.count())throw new Error('SH Mix target field missing offline');
  const batchCost=page.locator('#batchCost');
  if(!await batchCost.count())throw new Error('SH Mix-linked calculation output missing offline');
  const mixBefore=await batchCost.innerText();
  const current=Number(await target.first().inputValue())||1;
  const next=current===1.25?1.5:1.25;
  await setDom(target.first(),next);await sleep(200);
  const mixAfter=await batchCost.innerText();
  if(mixAfter===mixBefore)throw new Error(`SH Mix-linked output did not change offline: ${mixBefore}`);
  await openRoute(page,'Equipment',['#view-equipment','#equipment']);
  await openRoute(page,'Chemicals',['#view-chemicals','#chemicals']);
  const chemicalIndex=await openRoute(page,'Chemical Index',['#view-index','#index']);
  const indexSearch=chemicalIndex.locator('#indexSearch');
  const indexResults=chemicalIndex.locator('#indexResults');
  if(!await indexSearch.count()||!await indexResults.count())throw new Error('Chemical Index search UI missing offline');
  await setDom(indexSearch,'rust');
  await page.waitForFunction(()=>document.querySelector('#indexResults')?.textContent?.trim().length>0,{timeout:5000});
  const rustResults=(await indexResults.innerText()).trim();
  if(!rustResults)throw new Error('Chemical Index returned no visible rust-search results offline');
  await setDom(indexSearch,'');
  const indexRank=chemicalIndex.locator('#indexRank');
  if(!await indexRank.count())throw new Error('Chemical Index rank filter missing offline');
  await setDom(indexRank,'Best uses');
  await sleep(150);
  const rankedResults=(await indexResults.innerText()).trim();
  if(!rankedResults)throw new Error('Chemical Index rank filter rendered empty offline');
  await setDom(indexRank,'All ranks');
  const offlineJob=await openRoute(page,'Job Math',['#view-job','#job']);
  await offlineJob.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  await openRoute(page,'Field Tools',['#view-tools','#tools']);
  await openRoute(page,'Field Guide',['#view-guide','#guide']);
  // Planning-state hydration is intentionally deferred after the shared core loads.
  // Wait for its persisted area to reach the DOM before judging offline persistence.
  try{
    await page.waitForFunction(()=>document.getElementById('area')?.value==='2500',null,{timeout:12000});
  }catch(error){
    const details=await page.evaluate(()=>{
      const read=key=>localStorage.getItem(key);
      return {area:document.getElementById('area')?.value??null,
        planning:read('fireV18LivePlanningState')?.slice(0,500)??null,
        parity:read('fireV18ParityDraft')?.slice(0,250)??null,
        coreReady:!!window.__fireV18CoreReady,
        loaderReady:!!window.__fireV18ModuleLoader,offlinePlanningBoot};
    });
    throw new Error('Offline planning hydration timeout: '+JSON.stringify(details),{cause:error});
  }
  const restored=await state(page);assertState(restored);

  await openRoute(page,'Field Tools',['#view-tools','#tools']);
  for(let i=0;i<20&&!await page.locator('#copyBackupText').count();i++)await sleep(100);
  const backupButton=page.locator('#copyBackupText');if(!await backupButton.count())throw new Error('Offline backup text control missing');
  await backupButton.evaluate(n=>n.click());
  await page.waitForFunction(()=>Array.isArray(window.__fireOfflineCopied)&&window.__fireOfflineCopied.length>0,{timeout:5000});
  const backupText=await page.evaluate(()=>window.__fireOfflineCopied.at(-1));
  let backup;try{backup=JSON.parse(backupText)}catch{throw new Error('Offline backup text was not valid JSON')}
  const requiredDrStores=['fireV18ParityDraft','fireV18FullState','fireV18Rates','fireV18LivePlanningState'];
  if(backup.format!=='FIRE Field Calculator Backup'||backup.version!==3||backup.appVersion!==18||typeof backup.data?.fireEstimateDraft!=='string'||!requiredDrStores.every(k=>typeof backup.data?.[k]==='string'))throw new Error('Portable offline backup payload incomplete');
  const liveEstimate=JSON.parse(backup.data.fireEstimateDraft);
  if(liveEstimate?.fields?.estimateJobName!=='Offline DR Acceptance'||liveEstimate?.fields?.houseWashArea!=='1234'||liveEstimate?.fields?.discountPct!=='10'||liveEstimate?.fields?.jobArea!=='2500')throw new Error('Portable backup LIVE estimate projection mismatch');
  const backupBytes=Buffer.byteLength(backupText,'utf8');

  await openRoute(page,'Job Math',['#view-job','#job']);
  await setDom(await byId(page,'svcHouse'),1000);await sleep(250);
  const total=await page.locator('#fullTotal').innerText();
  if(!/\$198\.00/.test(total))throw new Error('Offline calculator math failed after reload: '+total);

  await page.close();page=null;
  const reopened=await ctx.newPage();page=reopened;watchExternal(page,openAiRequests);
  page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(20000);
  await page.goto(STAGING,{waitUntil:'domcontentloaded',timeout:20000});
  await waitReady(page);
  const reopenedState=await state(page);assertState(reopenedState,'1000');
  const reopenedOffline=await page.evaluate(()=>({online:navigator.onLine,controller:!!navigator.serviceWorker.controller,title:document.title}));
  if(reopenedOffline.online||!reopenedOffline.controller)throw new Error('Closed/reopened DR page was not fully offline under service-worker control');
  const reopenedTotal=await page.locator('#fullTotal').textContent();
  if(!/\$198\.00/.test(reopenedTotal))throw new Error('Offline close/reopen math state failed: '+reopenedTotal);
  if(openAiRequests.length)throw new Error('Calculator attempted OpenAI/ChatGPT network requests: '+JSON.stringify(openAiRequests));
  const authText=(await page.locator('body').innerText()).toLowerCase();
  if(/sign in to (?:chatgpt|openai)|log in to (?:chatgpt|openai)/.test(authText))throw new Error('Calculator exposed an OpenAI/ChatGPT sign-in requirement');

  const report={status:'PASS',expectedCache,cacheState:{controller:cacheState.controller,keys:cacheState.keys,assetCount:cacheState.assets.length},offlineState,offlineRoutes:['SH Mix','Equipment','Chemicals','Chemical Index','Job Math','Field Tools','Field Guide'],shMixFunctional:{before:mixBefore,after:mixAfter},restored,total,offlineBackup:{format:backup.format,version:backup.version,appVersion:backup.appVersion,bytes:backupBytes,dataKeyCount:Object.keys(backup.data||{}).length,requiredDrStores},reopenedState,reopenedOffline,reopenedTotal,openAiRequests,openAiSignInRequired:false};
  fs.writeFileSync(`${OUT}/offline-dr-acceptance.json`,JSON.stringify(report,null,2));
  console.log('OFFLINE DR ACCEPTANCE PASS '+JSON.stringify(report));
}catch(e){
  const report={status:'FAIL',message:e?.message||String(e),stack:e?.stack||null,openAiRequests};
  fs.writeFileSync(`${OUT}/offline-dr-acceptance.json`,JSON.stringify(report,null,2));
  console.error('OFFLINE DR ACCEPTANCE FAIL '+JSON.stringify(report));process.exitCode=1;
}finally{await page?.close().catch(()=>{});await ctx?.close().catch(()=>{});await browser.close().catch(()=>{})}
