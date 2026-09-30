import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const TEST_NAME='Parity Test Customer';

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function openJob(page){
  if(!await clickVisibleText(page,'Job Math'))throw new Error('Job Math route control missing');
  await page.waitForTimeout(220);
  for(const s of ['#view-job','#job']){const root=page.locator(s);if(await root.count()){await root.first().locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(80);return root.first()}}
  throw new Error('Job Math route missing');
}
async function byLabel(root,text){const x=root.getByLabel(text,{exact:true});return await x.count()?x.first():null}
async function quoteText(root){
  const h=root.getByText('Customer quote',{exact:true});if(!await h.count())return '';
  const q=h.first().locator('xpath=following-sibling::*[contains(concat(" ",normalize-space(@class)," ")," quoteBox ")][1]');
  return await q.count()?(await q.first().innerText()).replace(/\s+/g,' ').trim():'';
}
async function inspect(base,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  let root=await openJob(page);
  const name=await byLabel(root,'Customer / job name');
  const desc=await byLabel(root,'Custom service description');
  const amount=await byLabel(root,'Custom service amount');
  const notes=await byLabel(root,'Customer-facing estimate notes');
  if(!name||!desc||!amount||!notes)throw new Error(`${base}: missing customer/custom estimate field`);
  const initial={name:await name.inputValue(),namePlaceholder:await name.getAttribute('placeholder'),desc:await desc.inputValue(),descPlaceholder:await desc.getAttribute('placeholder'),amount:await amount.inputValue(),notesPlaceholder:await notes.getAttribute('placeholder')};
  await name.fill(TEST_NAME);await name.dispatchEvent('change');
  const house=root.locator('#houseWashArea,#svcHouse').first();if(await house.count()){await house.fill('1000');await house.dispatchEvent('change')}
  await page.waitForTimeout(250);
  const quote=await quoteText(root),quoteIncludesName=quote.includes(TEST_NAME);
  await page.reload({waitUntil:'networkidle',timeout:60000});root=await openJob(page);
  const reloadedName=await byLabel(root,'Customer / job name');const persisted=reloadedName?await reloadedName.inputValue():null;
  await ctx.close();
  return {initial,quoteIncludesName,persisted};
}
const browser=await chromium.launch({headless:true});
try{
  const live=await inspect(LIVE,browser),staging=await inspect(STAGING,browser);
  console.log('LIVE CUSTOMER '+JSON.stringify(live));
  console.log('STAGING CUSTOMER '+JSON.stringify(staging));
  const fields=JSON.stringify(live.initial)===JSON.stringify(staging.initial);
  const quote=live.quoteIncludesName===staging.quoteIncludesName;
  const persistence=live.persisted===staging.persisted;
  console.log(`CUSTOMER FIELD PARITY ${fields?'PASS':'FAIL'}`);
  console.log(`CUSTOMER QUOTE NAME PARITY ${quote?'PASS':'FAIL'} live=${live.quoteIncludesName} staging=${staging.quoteIncludesName}`);
  console.log(`CUSTOMER RELOAD PARITY ${persistence?'PASS':'FAIL'} live=${JSON.stringify(live.persisted)} staging=${JSON.stringify(staging.persisted)}`);
  if(!fields||!quote||!persistence)process.exit(1);
  console.log('CUSTOMER/JOB LIVE PARITY PASS');
}finally{await browser.close()}
