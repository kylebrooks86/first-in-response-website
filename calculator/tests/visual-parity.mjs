import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
fs.mkdirSync(OUT,{recursive:true});

const states=[
  {name:'01-sh-mix',top:'SH Mix',views:['#view-mix','#mix']},
  {name:'02-equipment',top:'Equipment',views:['#view-delivery','#equipment']},
  {name:'03-chemicals',top:'Chemicals',views:['#view-chemicals','#chemicals']},
  {name:'04-chemical-index',top:'Chemical Index',views:['#view-index','#index']},
  {name:'05-job-math',top:'Job Math',views:['#view-job','#job']},
  {name:'06-field-guide',top:'Field Guide',views:['#view-guide','#guide']},
  {name:'07-tools',top:'Field Tools',views:['#view-tools','#tools']}
];

async function clickText(page,text){
  const exact=page.getByText(text,{exact:true});
  for(let i=0;i<await exact.count();i++){const el=exact.nth(i);if(await el.isVisible()){await el.click();return true}}
  return false;
}
async function visibleSelector(page,state){
  for(const selector of state.views){const loc=page.locator(selector);if(await loc.count()&&await loc.first().isVisible())return selector}
  return null;
}
async function normalize(page){await page.addStyleTag({content:'*,*::before,*::after{caret-color:transparent!important;animation:none!important;transition:none!important}html{scroll-behavior:auto!important}'})}
async function auditRoute(page,selector){
  return page.locator(selector).first().evaluate((root,routeSelector)=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const controls=[...root.querySelectorAll('input,select,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>({
      tag:e.tagName.toLowerCase(),id:e.id||null,type:e.type||null,value:e.value,
      label:clean(e.closest('.field')?.querySelector('label')?.textContent||document.querySelector(`label[for="${e.id}"]`)?.textContent||''),
      placeholder:e.getAttribute('placeholder')||null,
      rowText:clean(e.closest('.pricegrid,.field,.listrow')?.innerText||''),
      dataRateId:e.getAttribute('data-rate-id')||null
    }));
    const buttons=[...root.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>({id:e.id||null,text:clean(e.textContent),class:e.className||null}));
    const cards=[...root.querySelectorAll('.card')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map((c,i)=>({index:i,kicker:clean(c.querySelector('.kicker,.eyebrow')?.textContent),heading:clean(c.querySelector('h2,h3')?.textContent),text:clean(c.innerText)}));
    return {selector:routeSelector,innerText:clean(root.innerText),controls,buttons,cards};
  },selector);
}
async function capture(base,label,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),audit={};
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});await normalize(page);
  await page.screenshot({path:path.join(OUT,`${label}-00-launch.png`),fullPage:true});
  for(const state of states){
    if(!await clickText(page,state.top))throw new Error(`${label}: could not activate route ${state.top}`);
    await page.waitForTimeout(180);
    const selector=await visibleSelector(page,state);if(!selector)throw new Error(`${label}: ${state.top} click did not expose the expected route`);
    audit[state.name]=await auditRoute(page,selector);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(OUT,`${label}-${state.name}.png`),fullPage:true});
  }
  fs.writeFileSync(path.join(OUT,`${label}-dom-audit.json`),JSON.stringify(audit,null,2));
  await ctx.close();
}

const browser=await chromium.launch({headless:true});
try{await capture(LIVE,'live',browser);await capture(STAGING,'staging',browser)}finally{await browser.close()}
const manifest={generated_at:new Date().toISOString(),live:LIVE,staging:STAGING,viewport:{width:390,height:844,deviceScaleFactor:1},states:['00-launch',...states.map(s=>s.name)],status:'PAIRED_SCREENSHOTS_AND_DOM_AUDIT_CREATED_NOT_AUTOMATICALLY_CERTIFIED',rule:'Human/pixel and state review is required before VERIFIED IDENTICAL.'};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Created paired FIRE screenshots and DOM audits in ${OUT}`);
