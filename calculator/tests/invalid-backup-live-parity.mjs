import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BAD_FILE={name:'corrupt-fire-backup.json',mimeType:'application/json',buffer:Buffer.from('{ definitely not valid json')};

async function clickVisible(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.evaluate(n=>n.click());return true}}return false}
async function visibleRoot(page,sels){for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function openRoute(page,label,roots){for(let i=0;i<28;i++){await clickVisible(page,label).catch(()=>false);await sleep(100);const r=await visibleRoot(page,roots);if(r)return r}throw new Error(`Route missing: ${label}`)}
async function openJob(page){const r=await openRoute(page,'Job Math',['#view-job','#job']);await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r}
async function openTools(page){return await openRoute(page,'Field Tools',['#view-tools','#tools']).catch(()=>openRoute(page,'Tools',['#view-tools','#tools']))}
async function byIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function setDom(el,v){if(!el)throw new Error('Missing field');await el.evaluate((n,x)=>{n.value=String(x);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}))},v)}
async function controls(page){return page.evaluate(()=>({buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>(b.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean),files:[...document.querySelectorAll('input[type=file]')].map(e=>({id:e.id||null,hidden:e.hidden,className:e.className||'',display:getComputedStyle(e).display}))}))}
async function uploadBadBackup(page,label){
  for(let i=0;i<25;i++){
    const files=page.locator('input[type="file"]');
    if(await files.count()){await files.first().setInputFiles(BAD_FILE);return {method:'file-input',controls:await controls(page)}}
    await sleep(100)
  }
  const before=await controls(page);
  const buttons=page.locator('button');
  for(let i=0;i<await buttons.count();i++){
    const b=buttons.nth(i);if(!await b.isVisible().catch(()=>false))continue;
    const text=((await b.innerText().catch(()=>''))||'').replace(/\s+/g,' ').trim();
    if(!/restore/i.test(text))continue;
    const chooserPromise=page.waitForEvent('filechooser',{timeout:2500}).catch(()=>null);
    await b.evaluate(n=>n.click());
    const chooser=await chooserPromise;
    if(chooser){await chooser.setFiles(BAD_FILE);return {method:`filechooser:${text}`,controls:before}}
    const files=page.locator('input[type="file"]');if(await files.count()){await files.first().setInputFiles(BAD_FILE);return {method:`button-then-input:${text}`,controls:before}}
  }
  throw new Error(`${label}: no usable restore control ${JSON.stringify(before)}`)
}
async function statusText(page){
  const candidates=[];
  for(const sel of ['#backupStatus','[role="alert"]','.toast','.toast-message','.statuswarn','.dangerText']){
    const q=page.locator(sel);for(let i=0;i<await q.count();i++){const t=((await q.nth(i).innerText().catch(()=>''))||'').replace(/\s+/g,' ').trim();if(t)candidates.push(t)}
  }
  const heading=page.getByText('Backup or Restore Field Data',{exact:true});
  if(await heading.count()){const card=heading.first().locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');if(await card.count()){const t=((await card.innerText().catch(()=>''))||'').replace(/\s+/g,' ').trim();if(t)candidates.push(t)}}
  return [...new Set(candidates)]
}

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
    await openTools(page);await sleep(250);
    const beforeUrl=page.url();
    const restoreControl=await uploadBadBackup(page,label);
    await sleep(1000);
    const statuses=await statusText(page);
    const status=statuses.find(t=>/could not be restored|couldn.t be restored|invalid|unable/i.test(t))||'';
    const afterUrl=page.url();
    const restoredJob=await openJob(page);
    const restoredName=restoredJob.getByLabel('Customer / job name',{exact:true});
    const restoredHouse=await byIds(page,['houseWashArea','svcHouse']);
    const state={name:await restoredName.first().inputValue(),house:await restoredHouse.inputValue()};
    const result={label,status,statuses,beforeUrl,afterUrl,state,restoreControl};
    if(state.name!=='Invalid Backup Guard'||state.house!=='777')throw new Error(`${label}: corrupt backup changed current estimate ${JSON.stringify(result)}`);
    if(beforeUrl.split('#')[0]!==afterUrl.split('#')[0])throw new Error(`${label}: corrupt backup navigated away ${JSON.stringify(result)}`);
    if(!status)throw new Error(`${label}: corrupt backup did not show a safe error ${JSON.stringify(result)}`);
    return result;
  } finally {await ctx.close()}
}

fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const live=await run(LIVE,'LIVE',browser);
  const staging=await run(STAGING,'DR',browser);
  const normalizeStatus=s=>s.replace(/\s+/g,' ').trim();
  const normalized=x=>({status:normalizeStatus(x.status),state:x.state});
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
