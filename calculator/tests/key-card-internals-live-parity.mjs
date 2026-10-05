import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const GROUP=(process.env.FIRE_KEY_CARD_GROUP||'all').toLowerCase();
const OUT=process.env.FIRE_KEY_CARD_OUT||'';
const equipmentRoots=['#view-delivery','#view-equipment','#equipment'];
const toolsRoots=['#view-tools','#tools'];
const allTargets=[
  {group:'equipment',name:'Equipment / main X-Jet',route:'Equipment',roots:equipmentRoots,heading:'X-Jet M5DS Twist — 3–7 GPM'},
  {group:'equipment',name:'Equipment / reverse mix',route:'Equipment',roots:equipmentRoots,heading:'Mix the X-Jet pickup bucket for a target strength'},
  {group:'equipment',name:'Equipment / proportioner',route:'Equipment',roots:equipmentRoots,heading:'Three-port proportioner planner'},
  {group:'jobmath',name:'Job Math / planning',route:'Job Math',roots:['#view-job','#job'],heading:'How much mix should I bring?'},
  {group:'jobmath',name:'Job Math / estimator',route:'Job Math',roots:['#view-job','#job'],heading:'Price the whole job'},
  {group:'tools',name:'Field Tools / compatibility',route:'Field Tools',roots:toolsRoots,marker:'#compatResult',heading:'Chemical Compatibility Checker'},
  {group:'tools',name:'Field Tools / timer',route:'Field Tools',roots:toolsRoots,marker:'#timerDisplay',heading:'Application Timer'},
  {group:'tools',name:'Field Tools / weather',route:'Field Tools',roots:toolsRoots,marker:'#weatherNote',heading:'Weather Adjustment Guide'},
  {group:'tools',name:'Field Tools / custom builder',route:'Field Tools',roots:toolsRoots,marker:'#customChemName',heading:'Custom Chemical Builder'},
  {group:'tools',name:'Field Tools / safety',route:'Field Tools',roots:toolsRoots,marker:'.fire-safety-list',heading:'Field Safety Card'}
];
const targets=GROUP==='all'?allTargets:allTargets.filter(t=>t.group===GROUP);
if(!targets.length)throw new Error(`Unknown FIRE_KEY_CARD_GROUP ${GROUP}`);

async function clickVisibleText(page,text){
  const q=page.getByText(text,{exact:true});
  for(let i=0;i<await q.count();i++){
    const el=q.nth(i);
    if(await el.isVisible()){await el.evaluate(node=>node.click());return true}
  }
  return false;
}
async function visibleRoot(page,sels){
  for(const s of sels){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return e.first()}
  return null;
}
async function openRoute(page,t){
  for(let attempt=0;attempt<28;attempt++){
    await clickVisibleText(page,t.route).catch(()=>false);
    await page.waitForTimeout(100);
    const root=await visibleRoot(page,t.roots);
    if(root)return root;
  }
  return null;
}
async function openSession(browser,base){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  if(base===LIVE)await ctx.route('**/*',route=>{const t=route.request().resourceType();return ['image','media','font'].includes(t)?route.abort():route.continue()});
  const page=await ctx.newPage();
  page.setDefaultTimeout(3000);
  page.setDefaultNavigationTimeout(12000);
  let root=null,lastError=null;
  for(let attempt=0;attempt<4&&!root;attempt++){
    try{
      await page.goto(base,{waitUntil:'commit',timeout:12000});
      await page.waitForLoadState('domcontentloaded',{timeout:4500}).catch(()=>{});
      await page.waitForTimeout(220);
      root=await openRoute(page,targets[0]);
    }catch(e){lastError=e}
  }
  if(!root){await ctx.close();throw new Error(`${base}: no ${GROUP} route after retries${lastError?` (${lastError.message})`:''}`)}
  await page.waitForTimeout(GROUP==='tools'?1200:950);
  return {ctx,page};
}
async function locateCard(root,page,t){
  if(t.marker){
    const marker=root.locator(t.marker).first();
    if(await marker.count()){
      const card=marker.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")]').first();
      if(await card.count())return card;
    }
  }
  if(t.heading){
    const heading=page.getByRole('heading',{name:t.heading,exact:true});
    return root.locator('.card').filter({has:heading}).first();
  }
  return root.locator('.card').filter({hasText:'__FIRE_PARITY_NO_MATCH__'}).first();
}
async function collect(browser,base){
  const session=await openSession(browser,base);
  const {ctx,page}=session;
  try{
    const out={};let activeRoute='';let activeRoot=null;
    for(const t of targets){
      if(t.route!==activeRoute){activeRoot=await openRoute(page,t);activeRoute=t.route;if(!activeRoot){out[t.name]={error:'missing route'};continue}}
      const card=await locateCard(activeRoot,page,t);
      if(!await card.count()){out[t.name]={error:'missing card'};continue}
      out[t.name]=await card.evaluate(card=>{
        const r=card.getBoundingClientRect();
        const text=(card.innerText||'').replace(/\s+/g,' ').trim();
        const children=[...card.children].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0}).map((el,index)=>{
          const b=el.getBoundingClientRect(),cs=getComputedStyle(el);
          return {index,tag:el.tagName.toLowerCase(),id:el.id||'',className:typeof el.className==='string'?el.className:'',text:(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,140),top:+(b.top-r.top).toFixed(1),height:+b.height.toFixed(1),marginTop:cs.marginTop,marginBottom:cs.marginBottom,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,gap:cs.gap};
        });
        return {height:+r.height.toFixed(1),textLength:text.length,children};
      });
    }
    return out;
  }finally{await ctx.close()}
}
function key(c){return `${c.tag}#${c.id}.${c.className}:${c.text}`}
function buildReport(live,staging){
  const cards={};
  for(const name of new Set([...Object.keys(live),...Object.keys(staging)])){
    const lcard=live[name],scard=staging[name];
    if(lcard?.error||scard?.error){cards[name]={liveError:lcard?.error||null,stagingError:scard?.error||null};continue}
    const children=[];const max=Math.max(lcard.children.length,scard.children.length);
    for(let i=0;i<max;i++){
      const l=lcard.children[i]||null,s=scard.children[i]||null;
      children.push({index:i,live:l?{key:key(l),top:l.top,height:l.height,marginTop:l.marginTop,marginBottom:l.marginBottom,paddingTop:l.paddingTop,paddingBottom:l.paddingBottom,gap:l.gap}:null,staging:s?{key:key(s),top:s.top,height:s.height,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,gap:s.gap}:null,heightDelta:l&&s?+(s.height-l.height).toFixed(1):null,topDelta:l&&s?+(s.top-l.top).toFixed(1):null});
    }
    cards[name]={liveHeight:lcard.height,stagingHeight:scard.height,delta:+(scard.height-lcard.height).toFixed(1),liveTextLength:lcard.textLength,stagingTextLength:scard.textLength,children};
  }
  return {generatedAt:new Date().toISOString(),group:GROUP,viewport:{width:390,height:844},cards};
}
function writeReport(report){if(OUT){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(report,null,2))}}
function print(report){
  console.log(`KEY CARD GROUP ${GROUP}`);
  for(const [name,c] of Object.entries(report.cards)){
    console.log('KEY CARD INTERNALS '+name);
    if(c.liveError||c.stagingError){console.log(JSON.stringify({live:c.liveError||null,staging:c.stagingError||null}));continue}
    console.log(JSON.stringify({liveHeight:c.liveHeight,stagingHeight:c.stagingHeight,delta:c.delta,liveTextLength:c.liveTextLength,stagingTextLength:c.stagingTextLength}));
    for(const child of c.children)console.log(JSON.stringify(child));
  }
}

const browser=await chromium.launch({headless:true});
try{
  const live=await collect(browser,LIVE);
  const staging=await collect(browser,STAGING);
  const report=buildReport(live,staging);writeReport(report);print(report);
}catch(error){
  const report={generatedAt:new Date().toISOString(),group:GROUP,error:String(error?.stack||error)};writeReport(report);console.error(report.error);process.exitCode=1;
}finally{await browser.close()}
