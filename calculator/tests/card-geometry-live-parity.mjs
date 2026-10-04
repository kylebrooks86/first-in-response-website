import { chromium } from 'playwright';
import fs from 'node:fs';
const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
const routes=[
  ['SH Mix',['#view-mix','#mix']],
  ['Equipment',['#view-delivery','#view-equipment','#equipment']],
  ['Chemicals',['#view-chemicals','#chemicals']],
  ['Chemical Index',['#view-index','#index']],
  ['Job Math',['#view-job','#job']],
  ['Field Tools',['#view-tools','#tools']],
  ['Field Guide',['#view-guide','#guide']]
];
async function clickVisible(page,text){const q=page.getByText(text,{exact:true});for(let i=0;i<await q.count();i++){const e=q.nth(i);if(await e.isVisible()){await e.evaluate(node=>node.click());return true}}return false}
async function rootFor(page,sels){for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}return null}
async function openRoute(page,name,sels){for(let attempt=0;attempt<16;attempt++){await clickVisible(page,name).catch(()=>false);await page.waitForTimeout(80);const root=await rootFor(page,sels);if(root)return root}throw new Error('Missing route '+name+' after app settled')}
async function settle(page,base){
  if(base===LIVE)await page.context().route('**/*',route=>{const t=route.request().resourceType();return ['image','media','font'].includes(t)?route.abort():route.continue()});
  page.setDefaultTimeout(3500);
  await page.goto(base,{waitUntil:'commit',timeout:12000});
  await page.waitForLoadState('domcontentloaded',{timeout:4500}).catch(()=>{});
  for(let i=0;i<24;i++){if(await page.locator('.tabs,.tabswrap').count())break;await page.waitForTimeout(100);if(i===23)throw new Error('Calculator navigation did not mount')}
  if(base===STAGING){
    await page.waitForFunction(()=>!!window.__fireV18CoreReady&&!!document.querySelector('#equipment [data-live-structure="1"]')&&!!document.querySelector('#xjetLiveResults')&&!!document.querySelector('#xjetModelNote'),null,{timeout:6500});
    await page.waitForTimeout(180);
  }
}
async function collect(base,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});try{const page=await ctx.newPage();await settle(page,base);await page.waitForTimeout(300);const out={};for(const [name,sels] of routes){try{const root=await openRoute(page,name,sels);out[name]=await root.locator('.card').evaluateAll(cards=>cards.filter(card=>{const r=card.getBoundingClientRect(),cs=getComputedStyle(card);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'}).map((card,index)=>{const r=card.getBoundingClientRect();const h=card.querySelector('h1,h2,h3,summary,strong');const text=(card.innerText||'').replace(/\s+/g,' ').trim();return {index,heading:(h?.textContent||'').replace(/\s+/g,' ').trim(),y:Math.round(r.y*10)/10,height:Math.round(r.height*10)/10,textLength:text.length,textStart:text.slice(0,120)}}))}catch(err){out[name]=[{error:err.message}]}}return out}finally{await ctx.close()}}
const browser=await chromium.launch({headless:true});try{const [live,staging]=await Promise.all([collect(LIVE,browser),collect(STAGING,browser)]);const report={generated_at:new Date().toISOString(),viewport:{width:390,height:844},live,staging};fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(`${OUT}/card-geometry.json`,JSON.stringify(report,null,2));for(const route of new Set([...Object.keys(live),...Object.keys(staging)])){console.log(`CARD GEOMETRY ${route}`);const la=live[route]||[],sa=staging[route]||[];const max=Math.max(la.length,sa.length);for(let i=0;i<max;i++){const l=la[i]||null,s=sa[i]||null;if(l?.error||s?.error){console.log(JSON.stringify({index:i,liveError:l?.error||null,stagingError:s?.error||null}));continue}console.log(JSON.stringify({index:i,live:l?{heading:l.heading,height:l.height,textLength:l.textLength}:null,staging:s?{heading:s.heading,height:s.height,textLength:s.textLength}:null,delta:l&&s?Math.round((s.height-l.height)*10)/10:null}))}}}finally{await browser.close()}
