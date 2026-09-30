import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function openJob(page){
  await clickVisibleText(page,'Job Math');await page.waitForTimeout(200);
  for(const s of ['#view-job','#job']){const r=page.locator(s);if(await r.count()){await r.first().locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.waitForTimeout(100);return r.first()}}
  throw new Error('Job Math route missing');
}
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
async function inspect(page){
  const root=await openJob(page);
  return root.evaluate(root=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const controls=[...root.querySelectorAll('input,textarea,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>({
      id:e.id||'',tag:e.tagName.toLowerCase(),type:e.type||'',value:e.value||'',placeholder:e.getAttribute('placeholder')||'',label:clean(e.closest('.field')?.querySelector('label')?.textContent||document.querySelector(`label[for="${e.id}"]`)?.textContent||e.getAttribute('aria-label')||'')
    }));
    const buttons=[...root.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>({id:e.id||'',text:clean(e.textContent)}));
    const relevantControls=controls.filter(x=>/customer|job|bundle|discount|promo|name|phone|email|address|note/i.test(`${x.id} ${x.label} ${x.placeholder}`));
    const relevantButtons=buttons.filter(x=>/bundle|discount|promo|customer|job|estimate|quote/i.test(`${x.id} ${x.text}`));
    return {relevantControls,relevantButtons,routeText:clean(root.innerText)};
  });
}
async function run(base,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});const data=await inspect(page);await ctx.close();return data}
const browser=await chromium.launch({headless:true});
try{
  const live=await run(LIVE,browser),staging=await run(STAGING,browser);
  console.log('LIVE RELEVANT CONTROLS '+JSON.stringify(live.relevantControls));
  console.log('STAGING RELEVANT CONTROLS '+JSON.stringify(staging.relevantControls));
  console.log('LIVE RELEVANT BUTTONS '+JSON.stringify(live.relevantButtons));
  console.log('STAGING RELEVANT BUTTONS '+JSON.stringify(staging.relevantButtons));
  const liveBundle=/bundle/i.test(live.routeText),stagingBundle=/bundle/i.test(staging.routeText);
  console.log(`BUNDLE TEXT live=${liveBundle} staging=${stagingBundle}`);
}finally{await browser.close()}
