import { chromium } from 'playwright';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const routes=[
  {top:'SH Mix',labels:['Final SH strength']},
  {top:'Equipment',labels:['Pressure-washer flow']},
  {top:'Chemicals',labels:['Final amount','Water parts','Product parts']},
  {top:'Job Math',labels:['House wash area','Stackable discount total','Final-price override (0 = calculated)']},
  {top:'Field Tools',labels:['10% SH Out','Minutes','Temperature','Wind','Humidity','Dose or water parts']}
];
async function clickVisibleText(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
const clean=v=>v==null?null:String(v);
async function inputsByLabel(page,label){return page.evaluate(label=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const labelOf=e=>(e.closest('.field')?.querySelector('label')?.textContent||document.querySelector(`label[for="${e.id}"]`)?.textContent||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('input[type="number"]')].filter(e=>visible(e)&&labelOf(e)===label).map(e=>({type:e.type,min:e.getAttribute('min'),max:e.getAttribute('max'),step:e.getAttribute('step'),inputMode:e.getAttribute('inputmode'),value:e.value}));
},label)}
async function focusAudit(page,label){
  const q=page.locator('input[type="number"]');
  for(let i=0;i<await q.count();i++){
    const e=q.nth(i);if(!await e.isVisible())continue;
    const l=await e.evaluate(node=>(node.closest('.field')?.querySelector('label')?.textContent||document.querySelector(`label[for="${node.id}"]`)?.textContent||node.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim());
    if(l!==label)continue;
    await e.scrollIntoViewIfNeeded();await e.focus();await page.waitForTimeout(40);
    return e.evaluate(node=>{const r=node.getBoundingClientRect();return {focused:document.activeElement===node,top:r.top,bottom:r.bottom,viewport:innerHeight,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+1}});
  }
  return null;
}
async function snapshot(base){
  const browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await ctx.newPage();const out={};
  try{
    await page.goto(base,{waitUntil:'networkidle',timeout:60000});
    for(const route of routes){if(!await clickVisibleText(page,route.top))throw new Error(`Missing route ${route.top}`);await page.waitForTimeout(220);out[route.top]={};for(const label of route.labels){const inputs=await inputsByLabel(page,label);if(!inputs.length)throw new Error(`${route.top}: missing numeric input label ${label}`);out[route.top][label]={inputs:inputs.map(x=>({type:clean(x.type),min:clean(x.min),max:clean(x.max),step:clean(x.step),inputMode:clean(x.inputMode),value:clean(x.value)})),focus:await focusAudit(page,label)}}
    }
    return out;
  }finally{await ctx.close();await browser.close()}
}
const live=await snapshot(LIVE),staging=await snapshot(STAGING);let failed=false;
for(const route of routes){for(const label of route.labels){const a=live[route.top][label],b=staging[route.top][label];const am=a.inputs.map(x=>JSON.stringify({type:x.type,min:x.min,max:x.max,step:x.step,inputMode:x.inputMode,value:x.value}));const bm=b.inputs.map(x=>JSON.stringify({type:x.type,min:x.min,max:x.max,step:x.step,inputMode:x.inputMode,value:x.value}));const meta=JSON.stringify(am)===JSON.stringify(bm);const bothCollapsed=!a.focus&&!b.focus;const bothFocused=!!a.focus&&!!b.focus&&a.focus.focused===b.focus.focused&&a.focus.noHorizontalOverflow===b.focus.noHorizontalOverflow&&a.focus.top>=-1&&b.focus.top>=-1&&a.focus.bottom<=a.focus.viewport+1&&b.focus.bottom<=b.focus.viewport+1;const focus=bothCollapsed||bothFocused;const ok=meta&&focus;console.log(`${ok?'PASS':'FAIL'} ${route.top} / ${label}: live=${JSON.stringify(a)} staging=${JSON.stringify(b)}`);if(!ok)failed=true}}
if(failed)process.exit(1);console.log('MOBILE INPUT LIVE PARITY PASS');