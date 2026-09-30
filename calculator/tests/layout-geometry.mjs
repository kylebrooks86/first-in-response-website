import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LIVE=process.env.FIRE_LIVE_URL||'https://fire-field-calculator-fir.kylebrooks8605.chatgpt.site';
const STAGING=process.env.FIRE_STAGING_URL||'http://127.0.0.1:4173/calculator/';
const OUT=process.env.FIRE_VISUAL_OUT||'calculator/visual-parity';
fs.mkdirSync(OUT,{recursive:true});

const states=[
  {name:'01-sh-mix',top:'SH Mix',views:['#view-mix','#mix'],signature:'Final SH strength'},
  {name:'02-equipment',top:'Equipment',views:['#view-delivery','#view-equipment','#equipment'],signature:'X-Jet'},
  {name:'03-chemicals',top:'Chemicals',views:['#view-chemicals','#chemicals'],signature:'Ettore'},
  {name:'04-chemical-index',top:'Chemical Index',views:['#view-index','#index'],signature:'Chemical Use Index'},
  {name:'05-job-math',top:'Job Math',views:['#view-job','#job'],signature:'Price the whole job'},
  {name:'06-field-guide',top:'Field Guide',views:['#view-guide','#guide'],signature:'Quick safety order'},
  {name:'07-tools',top:'Field Tools',views:['#view-tools','#tools'],signature:'Chemical Inventory'}
];

async function clickVisibleText(page,text){const x=page.getByText(text,{exact:true});for(let i=0;i<await x.count();i++){const e=x.nth(i);if(await e.isVisible()){await e.click();return true}}return false}
async function visibleSelector(page,state){for(const s of state.views){const e=page.locator(s);if(await e.count()&&await e.first().isVisible())return s}const c=page.locator('[id^="view-"],#mix,#equipment,#chemicals,#index,#job,#tools,#guide');for(let i=0;i<await c.count();i++){const e=c.nth(i);if(!await e.isVisible())continue;const t=(await e.innerText()).replace(/\s+/g,' ');if(t.includes(state.signature)){const id=await e.getAttribute('id');if(id)return '#'+id}}return null}
async function activate(page,state){for(let a=0;a<4;a++){await clickVisibleText(page,state.top);for(let p=0;p<12;p++){await page.waitForTimeout(100);const s=await visibleSelector(page,state);if(s)return s}}throw new Error(`Could not activate ${state.top}`)}
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
async function snapshot(page,selector){return page.evaluate((routeSelector)=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return {top:+r.top.toFixed(2),height:+r.height.toFixed(2),bottom:+r.bottom.toFixed(2),marginTop:cs.marginTop,marginBottom:cs.marginBottom,paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom}};const route=document.querySelector(routeSelector);const cardData=route?[...route.querySelectorAll('.card')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map((e,i)=>({index:i,heading:(e.querySelector('h2,h3')?.textContent||'').replace(/\s+/g,' ').trim(),...rect(e)})):[];return {scrollHeight:document.documentElement.scrollHeight,bodyScrollHeight:document.body.scrollHeight,topbar:rect(document.querySelector('.topbar')),warning:rect(document.querySelector('.warn')),tabs:rect(document.querySelector('.tabswrap,.tabs')),route:rect(route),page:rect(document.querySelector('.page')),bottom:rect(document.querySelector('.bottom')),cards:cardData}},routeSelector)}
async function capture(base,label,browser){const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(base,{waitUntil:'networkidle',timeout:60000});const out={light:{},dark:{}};for(const state of states){const s=await activate(page,state);out.light[state.name]=await snapshot(page,s)}let theme=page.locator('#themeBtn');if(await theme.count())await theme.first().click();else{const x=page.getByLabel(/dark mode/i);if(await x.count())await x.first().click()}await page.waitForTimeout(180);for(const state of states){const s=await activate(page,state);out.dark[state.name]=await snapshot(page,s)}await ctx.close();return out}
const browser=await chromium.launch({headless:true});let live,staging;try{live=await capture(LIVE,'live',browser);staging=await capture(STAGING,'staging',browser)}finally{await browser.close()}
const report={generatedAt:new Date().toISOString(),viewport:{width:390,height:844},live,staging,differences:{}};for(const theme of ['light','dark'])for(const state of states){const a=live[theme][state.name],b=staging[theme][state.name];report.differences[`${theme}-${state.name}`]={scrollHeight:b.scrollHeight-a.scrollHeight,routeHeight:+((b.route?.height||0)-(a.route?.height||0)).toFixed(2),cardHeightDeltas:(a.cards||[]).map((c,i)=>({index:i,heading:c.heading,delta:+(((b.cards||[])[i]?.height||0)-c.height).toFixed(2)}))}}fs.writeFileSync(path.join(OUT,'layout-geometry.json'),JSON.stringify(report,null,2));console.log('Created live-vs-staging layout geometry audit');