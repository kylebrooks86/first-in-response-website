/** FIRE owner action visual polish — compiled CSS/Chromium, synthetic localhost.
 * No customer data, provider calls, deployment, financial action or photo read.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const css=(await postcss([tailwind({base:process.cwd()})]).process(
  readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')}
)).css;
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head>'+
'<body><main class="app-shell"><section class="workspace-view">'+
'<div class="invoice-directory-tools"><button type="button">Open</button><button type="button" class="active">Due now</button></div>'+
'<div class="payment-balance-tools"><button type="button">Upcoming</button><button type="button">Review</button></div>'+
'<div class="followup-contact-actions"><a href="#call">Call</a><a href="#text">Text</a><a href="#email">Email</a></div>'+
'<div class="followup-optional-grid"><button type="button">Add a reminder with a long label</button><button type="button">History</button></div>'+
'<div class="schedule-day-actions"><button class="schedule-next-booked" type="button">Next booked visit</button></div>'+
'<div class="customer-property-research"><a href="#lookup">Review property</a></div>'+
'<details class="photo-backup-more"><summary>Photo backup options</summary><p>Local synthetic content</p></details>'+
'<details class="photo-comparison-more"><summary>Before-and-after options</summary></details>'+
'</section></main></body></html>';
const server=createServer((req,res)=>{
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);}
  else{res.setHeader('content-type','text/html;charset=utf-8');res.end(html);}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const check=(condition,label)=>{assert.ok(condition,'Owner control polish: '+label);checks++};
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){
    requests.push(r.request().url);return r.abort();
  }return r.continue()});
  const selectors=[
    '.invoice-directory-tools>button','.payment-balance-tools>button',
    '.followup-contact-actions>a','.followup-optional-grid>button',
    '.schedule-day-actions>.schedule-next-booked','.customer-property-research>a',
    '.photo-backup-more>summary','.photo-comparison-more>summary'
  ];
  for(const width of [320,375,390,430,820,1366]){
    for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:844});
      await page.goto(origin);
      await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);
      const state=await page.evaluate(list=>{
        const nodes=list.flatMap(s=>[...document.querySelectorAll(s)]);
        const buttons=nodes.map(n=>{
          const b=n.getBoundingClientRect();
          const st=getComputedStyle(n);
          return {label:n.textContent.trim(),left:b.left,right:b.right,width:b.width,
            height:b.height,minHeight:st.minHeight,border:st.borderTopColor};
        });
        return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,buttons};
      },selectors);
      const at=width+'px '+theme;
      check(state.buttons.length===13,at+' all action selectors remain represented');
      check(state.buttons.every(b=>b.width>=24&&b.height>=44),
        at+' controls have 44px minimum touch region '+JSON.stringify(state.buttons));
      check(state.buttons.every(b=>b.left>=-1&&b.right<=width+1),
        at+' actions fit viewport '+JSON.stringify(state.buttons));
      check(state.overflow<=1,at+' no horizontal scrolling: '+state.overflow);
    }
  }
  await page.setViewportSize({width:1366,height:844});
  for(const theme of ['light','dark']){
    await page.goto(origin);
    await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);
    const neutral=page.locator('.invoice-directory-tools>button:not(.active)').first();
    const base=await neutral.evaluate(n=>getComputedStyle(n).borderTopColor);
    await neutral.hover();
    await page.waitForTimeout(200);
    const after=await neutral.evaluate(n=>getComputedStyle(n).borderTopColor);
    const expected=theme==='dark'?'rgb(219, 131, 139)':'rgb(201, 135, 141)';
    check(after===expected,theme+' neutral hover has a subtle themed red edge');
    check(base!==after,theme+' hover remains distinct from neutral default');
    const active=page.locator('.invoice-directory-tools>button.active');
    const before=await active.evaluate(n=>getComputedStyle(n).backgroundColor);
    await active.hover();
    const afterActive=await active.evaluate(n=>getComputedStyle(n).backgroundColor);
    check(afterActive===before,theme+' selected state keeps its semantic color');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(origin);
  const duration=await page.locator('.payment-balance-tools>button').first()
    .evaluate(n=>getComputedStyle(n).transitionDuration);
  check(duration.split(',').every(x=>x.trim()==='0s'),
    'Reduced motion removes cosmetic transitions');
  check(requests.length===0,'All requests stay on synthetic localhost');
  check(errors.length===0,'No browser exceptions');
  console.log('PASS '+checks+'/'+checks+' FIRE owner control geometry, hover and reduced motion checks (localhost CSS).');
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
