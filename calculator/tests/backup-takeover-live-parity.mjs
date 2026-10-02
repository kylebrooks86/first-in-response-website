import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const TEST_NAME='DR Takeover Test';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function bounded(label,promise,ms){
  console.log(`${label} START`);
  let timer;
  try{
    const result=await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms} ms`)),ms)})
    ]);
    console.log(`${label} PASS`);
    return result;
  } finally { clearTimeout(timer) }
}

async function closeBounded(label,thing){
  if(!thing)return;
  try{await bounded(label,thing.close(),5000)}catch(e){console.log(`${label} cleanup warning: ${e.message}`)}
}

async function clickVisible(page,text){
  const q=page.getByText(text,{exact:true});
  for(let i=0;i<await q.count();i++){
    const e=q.nth(i);
    if(await e.isVisible()){await e.evaluate(node=>node.click());return true}
  }
  return false
}
async function byIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function setDom(el,v){if(!el)throw new Error('Missing field');await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}
async function visibleRoot(page,sels){for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function openRoute(page,label,roots){for(let attempt=0;attempt<28;attempt++){await clickVisible(page,label).catch(()=>false);await sleep(100);const root=await visibleRoot(page,roots);if(root)return root}return null}
async function openJob(page){const root=await openRoute(page,'Job Math',['#view-job','#job']);if(!root)throw new Error('Job Math route missing after app settled');await root.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return root}
async function openTools(page){const root=await openRoute(page,'Field Tools',['#view-tools','#tools'])||await openRoute(page,'Tools',['#view-tools','#tools']);if(!root)throw new Error('Field Tools route missing after app settled');return root}

async function setLiveDisposableState(page){
  const job=await openJob(page);
  const name=job.getByLabel('Customer / job name',{exact:true});
  if(!await name.count())throw new Error('Live customer/job field missing');
  await setDom(name.first(),TEST_NAME);
  await setDom(await byIds(page,['houseWashArea']),321);
  await setDom(await byIds(page,['discountPct']),7.5);
  await setDom(await byIds(page,['jobArea']),2468);
  await sleep(200);
  await openTools(page);
  await setDom(await byIds(page,['inv_sh']),2.75);
  await sleep(180)
}

function shape(v,depth=0){
  if(v===null)return 'null';
  if(typeof v==='string'&&depth<2){try{return {type:'json-string',parsed:shape(JSON.parse(v),depth+1)}}catch{return 'string'}}
  if(Array.isArray(v))return {type:'array',length:v.length,itemKeys:v[0]&&typeof v[0]==='object'?Object.keys(v[0]).sort():[]};
  if(typeof v==='object'){if(depth>=3)return {type:'object',keys:Object.keys(v).sort()};const o={};for(const k of Object.keys(v).sort())o[k]=shape(v[k],depth+1);return o}
  return typeof v
}

async function copyLiveBackup(page){
  const btn=page.getByRole('button',{name:'Copy backup text',exact:true});
  for(let attempt=0;attempt<40;attempt++){if(await btn.count()&&await btn.first().isVisible().catch(()=>false))break;await sleep(200)}
  if(!await btn.count()||!await btn.first().isVisible().catch(()=>false))throw new Error('Live Copy backup text missing after readiness wait');
  await btn.first().evaluate(node=>node.click());
  await sleep(160);
  const text=await page.evaluate(()=>navigator.clipboard.readText());
  if(!text||text.length<20)throw new Error('Live backup clipboard was empty');
  let parsed;try{parsed=JSON.parse(text)}catch{throw new Error('Live backup clipboard was not valid JSON')}
  return {text,summary:{schema:parsed.schema||null,version:parsed.version||null,format:parsed.format||null,appVersion:parsed.appVersion||null,topLevelKeys:Object.keys(parsed).sort(),dataKeys:parsed.data&&typeof parsed.data==='object'?Object.keys(parsed.data).sort():[],dataShape:parsed.data&&typeof parsed.data==='object'?shape(parsed.data):null}}
}

async function gotoLive(page){
  page.setDefaultTimeout(3000);page.setDefaultNavigationTimeout(12000);
  let lastError=null;
  for(let attempt=0;attempt<4;attempt++){
    try{
      await bounded(`LIVE GOTO attempt ${attempt+1}`,page.goto(LIVE,{waitUntil:'commit',timeout:12000}),15000);
      await page.waitForLoadState('domcontentloaded',{timeout:4500}).catch(()=>{});
      await sleep(450);
      if((await page.locator('.tabs .tab, .bottom button').count())>0)return
    }catch(e){lastError=e}
    await sleep(300)
  }
  throw new Error(`Live calculator did not mount after retries${lastError?`: ${lastError.message}`:''}`)
}

async function readMigratedStorage(page){
  return page.evaluate(()=>{
    const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return{}}};
    const parity=parse('fireV18ParityDraft'),planning=parse('fireV18LivePlanningState'),specialty=parse('fireV18SpecialtyInventory'),full=parse('fireV18FullState');
    return {migratedAt:localStorage.getItem('fireV18LiveBackupMigratedAt'),hydratedAt:localStorage.getItem('fireV18LiveBackupHydratedAt'),name:parity.estimateJobName??parity.jobName??'',house:parity.svcHouse??full.svcHouse??'',discount:parity.fullDiscount??full.fullDiscount??'',area:planning.area??full.area??'',inventorySh:specialty.sh?.amount??full.invSH??''}
  })
}

async function restoreIntoStaging(backupText){
  let browser=null,ctx=null;
  try{
    console.log('DR RESTORE PHASE launch isolated browser');
    browser=await bounded('DR BROWSER LAUNCH',chromium.launch({headless:true}),15000);
    ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await ctx.route('**/*',route=>{const type=route.request().resourceType();return ['image','media','font'].includes(type)?route.abort():route.continue()});
    const page=await ctx.newPage();
    page.setDefaultTimeout(3000);page.setDefaultNavigationTimeout(15000);
    page.on('pageerror',e=>console.log('DR PAGE ERROR '+(e.stack||e.message)));
    page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('DR CONSOLE '+m.type()+': '+m.text())});
    console.log('DR RESTORE PHASE open staging');
    await bounded('DR GOTO COMMIT',page.goto(STAGING,{waitUntil:'commit',timeout:15000}),20000);
    console.log('DR RESTORE PHASE committed '+page.url());
    await bounded('DR DOMCONTENTLOADED',page.waitForLoadState('domcontentloaded',{timeout:4500}).catch(()=>null),7000);
    await sleep(1000);
    console.log('DR RESTORE PHASE read init state');
    const init=await bounded('DR INIT EVALUATE',page.evaluate(()=>({loader:!!window.__fireV18ModuleLoader,core:!!window.__fireFullV18,coreReady:!!window.__fireV18CoreReady,tools:!!document.querySelector('#tools'),priceEditor:!!document.querySelector('#priceEditor'),mixHistory:!!document.querySelector('#mixHistory'),importFile:!!document.querySelector('#importFile'),scripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-8)})),7000);
    console.log('DR INIT '+JSON.stringify(init));
    console.log('DR RESTORE PHASE activate tools');
    const tools=await bounded('DR OPEN TOOLS',openTools(page),12000);
    console.log('DR RESTORE PHASE tools visible '+await tools.isVisible());
    console.log('DR RESTORE PHASE locate import');
    await bounded('DR WAIT IMPORT',page.waitForFunction(()=>!!document.querySelector('#importFile'),null,{timeout:8000}),10000);
    const input=await byIds(page,['importFile']);if(!input)throw new Error('DR restore file input missing');
    console.log('DR RESTORE PHASE import file and await expected reload');
    const filePayload={name:'FIRE_live_takeover_test.json',mimeType:'application/json',buffer:Buffer.from(backupText)};
    const reloadPromise=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000});
    await bounded('DR IMPORT + RELOAD',Promise.all([reloadPromise,input.setInputFiles(filePayload)]),20000);
    await sleep(2200);
    console.log('DR RESTORE PHASE reloaded '+page.url());
    const stored=await bounded('DR READ MIGRATED STORAGE',readMigratedStorage(page),7000);
    console.log('DR RESTORE STORAGE '+JSON.stringify(stored));
    if(!stored.hydratedAt)throw new Error('DR live-backup hydration marker missing after reload');
    console.log('DR RESTORE PHASE open job');
    const job=await bounded('DR OPEN JOB',openJob(page),12000);
    const name=job.getByLabel('Customer / job name',{exact:true});
    const house=await byIds(page,['svcHouse']),discount=await byIds(page,['fullDiscount']),area=await byIds(page,['area']);
    if(!house||!discount||!area||!await name.count())throw new Error(`DR restored estimate fields missing name=${await name.count()} house=${!!house} discount=${!!discount} area=${!!area}`);
    const ui={name:await name.first().inputValue(),house:await house.inputValue(),discount:await discount.inputValue(),area:await area.inputValue()};
    console.log('DR RESTORE UI '+JSON.stringify(ui));
    return {storage:stored,ui}
  } finally {
    await closeBounded('DR CONTEXT CLOSE',ctx);
    await closeBounded('DR BROWSER CLOSE',browser)
  }
}

fs.mkdirSync(OUT,{recursive:true});
let liveBrowser=null,liveCtx=null;
try{
  liveBrowser=await bounded('LIVE BROWSER LAUNCH',chromium.launch({headless:true}),15000);
  liveCtx=await liveBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
  await liveCtx.route('**/*',route=>{const type=route.request().resourceType();return ['image','media','font'].includes(type)?route.abort():route.continue()});
  const live=await liveCtx.newPage();
  await gotoLive(live);
  await setLiveDisposableState(live);
  const backup=await copyLiveBackup(live);
  console.log('LIVE BACKUP SHAPE '+JSON.stringify(backup.summary));
  await closeBounded('LIVE CONTEXT CLOSE',liveCtx);liveCtx=null;
  await closeBounded('LIVE BROWSER CLOSE',liveBrowser);liveBrowser=null;
  const restored=await restoreIntoStaging(backup.text);
  const expected={name:TEST_NAME,house:'321',discount:'7.5',area:'2468',inventorySh:'2.75'};
  const result={backup:backup.summary,expected,restored};
  fs.writeFileSync(`${OUT}/backup-takeover.json`,JSON.stringify(result,null,2));
  console.log('BACKUP TAKEOVER '+JSON.stringify(result));
  const storageOk=Object.entries(expected).every(([k,v])=>String(restored.storage[k])===String(v));
  const uiExpected={name:TEST_NAME,house:'321',discount:'7.5',area:'2468'};
  const uiOk=Object.entries(uiExpected).every(([k,v])=>String(restored.ui[k])===String(v));
  if(!storageOk||!uiOk)throw new Error(`Backup takeover mismatch storageOk=${storageOk} uiOk=${uiOk}`);
  console.log('LIVE BACKUP TO DR RESTORE PASS')
}catch(e){
  const failure={status:'FAIL',message:e?.message||String(e),stack:e?.stack||null,at:new Date().toISOString()};
  fs.writeFileSync(`${OUT}/backup-takeover.json`,JSON.stringify(failure,null,2));
  console.error('BACKUP TAKEOVER FAILURE '+JSON.stringify(failure));
  process.exitCode=1
}finally{
  await closeBounded('LIVE CONTEXT FINAL CLOSE',liveCtx);
  await closeBounded('LIVE BROWSER FINAL CLOSE',liveBrowser)
}
