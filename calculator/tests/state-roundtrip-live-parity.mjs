import { chromium } from 'playwright';
import fs from 'node:fs';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const TEST_NAME='Parity Roundtrip';
const planFields={
  area:['jobArea','area'],coverage:['coverage'],reserve:['waste','reserve'],container:['jobBatchSize','planContainer'],
  length:['measureLength','areaLen'],height:['measureHeight','areaWid'],sections:['measureSections','areaSides'],subtract:['measureSubtract','areaSubtract'],
  calArea:['calArea'],calMix:['calMixUsed','calMix']
};

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function jobRoot(page){for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count())return r.first()}return null}
async function openJob(page){await clickVisibleText(page,'Job Math');await page.waitForTimeout(180);const r=await jobRoot(page);if(!r)throw new Error('Job Math route missing');await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));return r}
async function fieldByIds(page,ids){for(const id of ids){const e=page.locator('#'+id);if(await e.count())return e.first()}return null}
async function fieldByLabel(root,label){const e=root.getByLabel(label,{exact:true});return await e.count()?e.first():null}
async function setDom(el,value){if(!el)return;await el.evaluate((node,v)=>{node.value=String(v);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))},value)}
async function planningSnapshot(page){const out={};for(const [key,ids] of Object.entries(planFields)){const e=await fieldByIds(page,ids);out[key]=e?await e.inputValue():null}return out}
async function snapshot(page){const r=await jobRoot(page);if(!r)return null;await r.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));const name=await fieldByLabel(r,'Customer / job name');const house=await fieldByIds(page,['houseWashArea','svcHouse']);const notes=await fieldByLabel(r,'Customer-facing estimate notes');const discount=await fieldByIds(page,['discountPct','fullDiscount']);const houseRate=await fieldByIds(page,['price_houseWash']);return {name:name?await name.inputValue():null,house:house?await house.inputValue():null,notes:notes?await notes.inputValue():null,discount:discount?await discount.inputValue():null,houseRate:houseRate?await houseRate.inputValue():null,planning:await planningSnapshot(page)}}
async function clickClear(page){const r=await jobRoot(page);const buttons=r.locator('button');const clicked=await buttons.evaluateAll(bs=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();const b=bs.find(x=>norm(x.textContent)==='Clear this estimate');if(!b)return false;b.click();return true});if(!clicked)throw new Error('Clear this estimate missing')}
async function run(base,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();let clearDialog=null;
  page.on('dialog',async d=>{clearDialog=d.message();await d.accept()});
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});let r=await openJob(page);
  const name=await fieldByLabel(r,'Customer / job name'),house=await fieldByIds(page,['houseWashArea','svcHouse']),notes=await fieldByLabel(r,'Customer-facing estimate notes'),discount=await fieldByIds(page,['discountPct','fullDiscount']);if(!name||!house||!notes||!discount)throw new Error(`${base}: missing roundtrip field`);
  await setDom(name,TEST_NAME);await setDom(house,'1234.5');await setDom(notes,'Parity roundtrip notes');await setDom(discount,'10');
  const planValues={area:'2500',coverage:'350',reserve:'20',container:'5',length:'100',height:'10',sections:'2',subtract:'25',calArea:'1800',calMix:'5'};
  for(const [key,value] of Object.entries(planValues)){const e=await fieldByIds(page,planFields[key]);if(!e)throw new Error(`${base}: missing planning field ${key}`);await setDom(e,value)}
  await page.waitForTimeout(250);
  const beforeReload=await snapshot(page);
  await page.reload({waitUntil:'networkidle',timeout:60000});await openJob(page);const afterReload=await snapshot(page);
  await clickClear(page);await page.waitForTimeout(220);const afterClear=await snapshot(page);
  await ctx.close();return {beforeReload,afterReload,clearDialog,afterClear};
}
const browser=await chromium.launch({headless:true});try{const live=await run(LIVE,browser),staging=await run(STAGING,browser);const diagnostic={live,staging};fs.mkdirSync('calculator/visual-parity',{recursive:true});fs.writeFileSync('calculator/visual-parity/state-roundtrip.json',JSON.stringify(diagnostic,null,2));console.log('LIVE STATE '+JSON.stringify(live));console.log('STAGING STATE '+JSON.stringify(staging));const ok=JSON.stringify(live)===JSON.stringify(staging);console.log(`STATE ROUNDTRIP PARITY ${ok?'PASS':'FAIL'}`);if(!ok)process.exit(1);console.log('STATE ROUNDTRIP LIVE PARITY PASS')}finally{await browser.close()}
