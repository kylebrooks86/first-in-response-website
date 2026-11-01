/** FIRE pre-QA owner mobile spacing audit. Uses actual compiled app CSS and
 * class/DOM structure matched to app/dashboard.tsx's header/nav/notifications.
 * Synthetic localhost fixture; does NOT assert native Safari or hosted QA PASS.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),root=process.cwd();
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const cssSource=readFileSync('app/globals.css','utf8');
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const expected=[
 ['Notification refresh', '.notification-attention>header button', 'min-height:44px'],
 ['Notification filters', '.notification-attention-filters>button', 'min-height:44px'],
 ['Notification load more', '.notification-attention-more', 'min-height:44px'],
 ['Customer sign disclosure', '.customer-sign-form summary', 'min-height:44px'],
 ['Customer flag disclosure', '.customer-flag-panel>details.customer-sign-form>summary', 'min-height:44px'],
 ['Customer photo delete', '.photo-card>button', 'min-height:44px']
];
for(const [label,selector,minimum] of expected){
 const escaped=selector.replace(/[.*+?^\$\{\}()|[\]\\]/g,'\\$&');
 const rule=[...cssSource.matchAll(new RegExp(escaped+'\\{([^}]*)\\}','g'))].at(-1);
 assert.ok(rule&&rule[1].includes(minimum),label+' has 44px touch target declaration');
}
assert.ok(dashboard.includes('className="notification-attention"'), 'Actual owner reminder panel is covered');
assert.ok(dashboard.includes('className="mobile-primary-actions"'), 'Actual owner header is covered');
assert.ok(dashboard.includes('className="bottom-nav"'), 'Actual 5-tab navigation is covered');
const css=(await postcss([tailwind({base:root})]).process(cssSource,{from:resolve('app/globals.css')})).css;
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>
<main class="app-shell" data-app-ready="true"><section class="main-area">
<header class="topbar">
 <div class="mobile-brand"><span class="fire-logo small">FIRE</span><strong>FIRE</strong></div>
 <div class="mobile-primary-actions">
  <button class="mobile-back-button" aria-label="Back">‹</button>
  <button class="mobile-home-button active" aria-label="Home">⌂</button>
  <button class="mobile-theme-button" aria-label="Theme">◐</button>
  <button class="menu-button" aria-label="Open menu">☰</button>
 </div>
 <div class="global-search"><div class="search-box" style="height:40px">Search</div></div>
 <div class="top-actions"><button class="payments-quick-action" aria-label="Record payments">$</button><button class="top-stride-button" aria-label="Next work">✓<span>Next</span></button><button class="notification-button" aria-label="Notifications">♧</button></div>
</header>
<div class="dashboard-view">
 <h1>Home</h1><div style="height:440px">Daily work content</div>
 <section class="notification-attention" aria-label="Needs attention">
  <header><strong>Needs attention</strong><button aria-label="Refresh attention items">Refresh</button></header>
  <div class="notification-attention-filters"><button aria-pressed="true">All · 12</button><button aria-pressed="false">Priority · 3</button></div>
  <div class="notification-attention-list"><button>Review first saved reminder</button><button>Review last saved reminder</button></div>
  <button class="notification-attention-more">Show next 8 reminders · 4 remaining</button>
 </section>
 <section class="customer-flag-panel"><details class="customer-sign-form"><summary>Yard sign details</summary><p>Saved activity</p></details></section>
 <section class="customer-profile customers-view">
 <nav class="record-tabs" aria-label="Customer record sections" tabindex="-1">
  <button type="button" aria-current="page" class="active" onclick="this.dataset.tapped='yes'">Estimates <b>4</b></button>
  <button type="button" onclick="this.dataset.tapped='yes'">Payments</button>
  <button type="button" onclick="this.dataset.tapped='yes'">Invoices</button>
  <button type="button" onclick="this.dataset.tapped='yes'">Photos <b aria-label="12 on-device photos" title="Photos on this device only">12</b></button>
  <button type="button" onclick="this.dataset.tapped='yes'">Messages <b>7</b></button>
  <button type="button" onclick="this.dataset.tapped='yes'">Notes <b>3</b></button>
 </nav>
 <section class="photo-panel"><div class="photo-groups"><section><header><strong>Before</strong></header><div class="photo-grid">
 <article class="photo-card"><a aria-label="Synthetic photo A" href="#photo-a"><div style="width:100%;height:90px;background:#ccc"></div></a><div><p>Long siding caption for narrow photo A</p><small>October 31</small></div><button type="button" aria-label="Delete on-device photo" onclick="this.dataset.tapped='yes'">×</button></article>
 <article class="photo-card"><a aria-label="Synthetic photo B" href="#photo-b"><div style="width:100%;height:90px;background:#ddd"></div></a><div><p>Long gutter caption for narrow photo B</p><small>October 31</small></div><button type="button" aria-label="Delete on-device photo" onclick="this.dataset.tapped='yes'">×</button></article>
 </div></section></div></section></section>
 <div style="height:700px">Long business workflow content</div>
 <button class="brand-button" type="button" id="final-day-action" style="min-height:48px;width:100%">Final workflow action</button>
</div>
</section>
<nav class="bottom-nav"><button>Home</button><button>Customers</button><button>Estimates</button><button>Schedule</button><button>Follow-ups</button></nav>
</main></body></html>`;
const server=createServer((req,res)=>{res.setHeader('cache-control','no-store');if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);}else{res.setHeader('content-type','text/html');res.end(html);}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true});page.setDefaultTimeout(7500);
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[667,375]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.goto(url);
  if(theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  const label=width+'x'+height+' '+theme;
  const signHeight=await page.locator('.customer-flag-panel>details.customer-sign-form>summary').evaluate(e=>e.getBoundingClientRect().height);
  check(signHeight>=44,label+' customer sign disclosure is touch-sized');
  const all=await page.evaluate(()=>{
   const visible=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>0;};
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   const header=[...document.querySelectorAll('.topbar button')].filter(visible).map(e=>({name:e.getAttribute('aria-label')||e.textContent,rect:rect(e)}));
   const critical=[...document.querySelectorAll('.notification-attention>header button,.notification-attention-filters>button,.notification-attention-more')].map(e=>({name:e.textContent.trim(),rect:rect(e)}));
   return {header,critical,screen:innerWidth,docWidth:document.documentElement.scrollWidth};
  });
  check(all.critical.every(x=>x.rect.height>=44),label+' notification controls are at least 44px tall');
  check(all.critical.every(x=>x.rect.x>=-1&&x.rect.right<=width+1),label+' reminder buttons stay inside viewport');
  check(all.header.every(x=>x.rect.x>=-1&&x.rect.right<=width+1),label+' header actions stay inside viewport '+JSON.stringify(all.header));
  check(all.header.every((x,i)=>all.header.slice(i+1).every(y=>x.rect.right<=y.rect.x+1||y.rect.right<=x.rect.x+1||x.rect.bottom<=y.rect.y+1||y.rect.bottom<=x.rect.y+1)),label+' header actions do not overlap '+JSON.stringify(all.header));
  // Customer record sections carry six essential operations, including
  // local-only Photos and its numeric badge. Narrow-phone grid/scroll CSS must
  // keep ALL six reachable, including the final Notes action.
  const tabs=await page.locator('.record-tabs button').evaluateAll(buttons=>buttons.map(button=>{
   const r=button.getBoundingClientRect(),label=button.textContent.trim();
   const nav=button.closest('.record-tabs').getBoundingClientRect();
   const css=getComputedStyle(button);
   return {label,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,
     navLeft:nav.left,navRight:nav.right,minTouch:css.minHeight};
  }));
  check(tabs.length===6,label+' all six customer record sections are rendered');
  check(tabs.every(x=>x.height>=44),label+' record tabs have finger-sized vertical tap area '+JSON.stringify(tabs));
  check(tabs.every(x=>x.left>=-1&&x.right<=width+1),label+' customer record tabs have no clipped left/right edge '+JSON.stringify(tabs));
  const recordsNav=page.locator('.record-tabs');
  const photosBadge=recordsNav.getByRole('button',{name:/Photos/}).locator('b');
  check(await photosBadge.getAttribute('aria-label')==='12 on-device photos',label+' photo badge explicitly identifies on-device-only count');
  for(const name of ['Photos','Notes']){
   const tab=recordsNav.getByRole('button',{name:new RegExp(name)});
   await tab.scrollIntoViewIfNeeded();
   const reachable=await tab.evaluate(e=>{
    const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {hit:at===e||e.contains(at),inScreen:r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1};
   });
   check(reachable.hit&&reachable.inScreen,label+' '+name+' customer record tap is unobstructed '+JSON.stringify(reachable));
   await tab.tap();
   check(await tab.getAttribute('data-tapped')==='yes',label+' actual touch activates '+name+' record tab');
  }
  const photoControls=await page.locator('.photo-card').evaluateAll(cards=>cards.map(card=>{
   const action=card.querySelector('button'),footer=card.querySelector(':scope>div'),caption=footer?.querySelector('p');
   const rect=x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   const b=rect(action),c=rect(caption),f=rect(footer),a=rect(card);
   return {button:b,caption:c,footer:f,article:a,clear:b.left>=c.right-1||b.top>=c.bottom-1||b.bottom<=c.top+1};
  }));
  check(photoControls.every(x=>x.button.width>=44&&x.button.height>=44&&x.button.right<=x.article.right+1&&x.button.bottom<=x.article.bottom+1),label+' photo delete buttons are >=44px and inside card '+JSON.stringify(photoControls));
  check(photoControls.every(x=>x.clear),label+' caption/metadata does not cover photo delete controls '+JSON.stringify(photoControls));
  const photoButton=page.locator('.photo-card>button').last();
  await photoButton.scrollIntoViewIfNeeded();
  const photoHit=await photoButton.evaluate(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {reachable:at===e||e.contains(at),withinViewport:r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1};});
  check(photoHit.reachable&&photoHit.withinViewport,label+' last photo delete target is on-screen and unobstructed '+JSON.stringify(photoHit));
  await photoButton.tap();
  check(await photoButton.getAttribute('data-tapped')==='yes',label+' actual synthetic touch activates last photo card button');
  await page.locator('#final-day-action').scrollIntoViewIfNeeded();
  const hit=await page.locator('#final-day-action').evaluate(e=>{
   const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
   return{right:r.right,bottom:r.bottom,navTop:nav.top,top:r.top,ok:at===e||e.contains(at)};
  });
  check(hit.right<=width+1&&hit.top>=-1&&hit.bottom<=hit.navTop+1&&hit.ok,label+' final daily-workflow button remains visible and tappable above bottom tabs '+JSON.stringify(hit));
 }
 console.log('PASS '+checks+' synthetic owner mobile spacing checks with compiled real CSS; native iPhone still needed');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
