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
  if(await exact.count()){await exact.first().click();return true}
  return false;
}

async function routeVisible(page,state){
  for(const selector of state.views){
    const loc=page.locator(selector);
    if(await loc.count() && await loc.first().isVisible()) return true;
  }
  return false;
}

async function normalize(page){
  await page.addStyleTag({content:`
    *,*::before,*::after{caret-color:transparent!important;animation:none!important;transition:none!important}
    html{scroll-behavior:auto!important}
  `});
}

async function capture(base,label,browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  await normalize(page);
  await page.screenshot({path:path.join(OUT,`${label}-00-launch.png`),fullPage:true});
  for(const state of states){
    const clicked=await clickText(page,state.top);
    if(!clicked) throw new Error(`${label}: could not activate route ${state.top}`);
    await page.waitForTimeout(180);
    if(!await routeVisible(page,state)) throw new Error(`${label}: ${state.top} click did not expose the expected route`);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(OUT,`${label}-${state.name}.png`),fullPage:true});
  }
  await ctx.close();
}

const browser=await chromium.launch({headless:true});
try{
  await capture(LIVE,'live',browser);
  await capture(STAGING,'staging',browser);
}finally{await browser.close()}

const manifest={
  generated_at:new Date().toISOString(),
  live:LIVE,
  staging:STAGING,
  viewport:{width:390,height:844,deviceScaleFactor:1},
  states:['00-launch',...states.map(s=>s.name)],
  status:'PAIRED_SCREENSHOTS_CREATED_NOT_AUTOMATICALLY_CERTIFIED',
  rule:'A human or pixel-diff review is still required before any state may be marked VERIFIED IDENTICAL.'
};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Created paired FIRE calculator screenshots in ${OUT}`);
