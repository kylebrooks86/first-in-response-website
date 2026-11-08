/** FIRE New Estimate keyboard/open-viewport + CSS zoom rehearsal.
 * Synthetic localhost compiled CSS with the exact production class nesting;
 * NO source user/customer records, providers, native iOS/Safari or hosted QA.
 * Uses narrow CSS viewports and Chromium CSS zoom as a magnification proxy.
 * Does not claim physical browser-zoom or OS soft-keyboard equivalence.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const cssSource=readFileSync('app/globals.css','utf8');
const source=readFileSync('app/dashboard.tsx','utf8');
assert.ok(source.includes('className="new-estimate-dialog-scroll"'),
  'Real New Estimate dialog must have a dedicated inner scroller');
assert.ok(source.includes('new-estimate-dialog max-h-[92vh] overflow-hidden'),
  'Real New Estimate outer dialog must not scroll');
const css=(await postcss([tailwind({base:process.cwd()})]).process(
  cssSource,{from:resolve('app/globals.css')}
)).css;
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head>'+
'<body><main class="app-shell">'+
'<section data-slot="dialog-content" class="new-estimate-dialog max-h-[92vh] overflow-hidden border-0 p-0" style="position:fixed;z-index:50;top:50%;left:50%;transform:translate(-50%,-50%);width:min(620px,calc(100% - 32px));background:var(--background);border:1px solid var(--border)" aria-label="Synthetic New Estimate">'+
'<div class="new-estimate-dialog-scroll">'+
'<div class="estimate-head"><strong>Create estimate</strong><p>Step 2 of 2</p></div>'+
'<div class="estimate-new-services-step space-y-5 px-6 py-6">'+
'<label for="service">Service</label><input id="service" value="House washing" />'+
'<div style="height:950px" aria-hidden="true">Long synthetic estimate line items</div>'+
'<label for="details">Final customer notes</label><textarea id="details" style="min-height:100px" aria-label="Final customer notes"></textarea>'+
'<div class="estimate-new-save-actions flex gap-3"><button type="button">Back</button><button type="button" class="brand-button">Save estimate</button></div>'+
'</div></div>'+
'<button type="button" data-slot="dialog-close" aria-label="Close" class="absolute top-2 right-2 z-20 flex size-11 items-center justify-center rounded-md border-0 bg-transparent">×</button>'+
'</section></main></body>';
const server=createServer((req,res)=>{
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);}
  else{res.setHeader('content-type','text/html; charset=utf-8');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++};
try{
  browser=await chromium.launch({headless:true,
    executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  const outbound=[],pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){
      outbound.push(route.request().url);return route.abort();
    }
    return route.continue();
  });
  for(const width of [320,375,430,820]){
    for(const height of [320,568]){
      for(const zoom of [1,1.5]){
        await page.setViewportSize({width,height});
        await page.goto(origin);
        await page.evaluate(z=>{document.documentElement.style.zoom=String(z);},zoom);
        const ctx=width+'x'+height+' CSS zoom '+zoom;
        const close=page.getByRole('button',{name:'Close'});
        const before=await page.evaluate(()=>{
          const frame=document.querySelector('.new-estimate-dialog');
          const scrolling=frame.querySelector('.new-estimate-dialog-scroll');
          const close=frame.querySelector('[data-slot=dialog-close]');
          const f=frame.getBoundingClientRect(),b=close.getBoundingClientRect();
          const at=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
          return {frameTop:f.top,frameBottom:f.bottom,top:b.top,bottom:b.bottom,
            x:b.left,right:b.right,closeWidth:b.width,closeHeight:b.height,
            hit:at===close||close.contains(at),
            containerScroll:frame.scrollHeight-frame.clientHeight,
            innerScroll:scrolling.scrollHeight-scrolling.clientHeight,
            pageOverflow:document.documentElement.scrollWidth-innerWidth};
        });
        check(before.top>=Math.max(-1,before.frameTop-1)&&
              before.bottom<=Math.min(height+1,before.frameBottom+1)&&
              before.right<=width+1&&before.x>=-1,
          ctx+' modal Close remains on screen initially: '+JSON.stringify(before));
        check(before.closeWidth>=40&&before.closeHeight>=40&&before.hit,
          ctx+' 44px Close tappable after scaling: '+JSON.stringify(before));
        check(before.containerScroll<=2&&before.innerScroll>150,
          ctx+' only the inner form scrolls: '+JSON.stringify(before));
        await page.locator('.new-estimate-dialog-scroll').evaluate(
          el=>{el.scrollTop=el.scrollHeight;});
        const after=await close.evaluate(el=>{
          const b=el.getBoundingClientRect(),f=el.closest('.new-estimate-dialog').getBoundingClientRect();
          const at=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
          return {top:b.top,bottom:b.bottom,frameTop:f.top,frameBottom:f.bottom,
            visible:b.top>=f.top-1&&b.bottom<=f.bottom+1,
            hit:at===el||el.contains(at)};
        });
        check(after.visible&&after.hit&&after.top>=0&&after.bottom<=height+1,
          ctx+' Close stays above long scrolled form: '+JSON.stringify(after));
        const field=page.getByRole('textbox',{name:'Final customer notes'});
        await field.scrollIntoViewIfNeeded();
        await field.focus();
        const focused=await field.evaluate(el=>{
          const b=el.getBoundingClientRect(),f=el.closest('.new-estimate-dialog').getBoundingClientRect();
          return {active:document.activeElement===el,top:b.top,bottom:b.bottom,
            frameTop:f.top,frameBottom:f.bottom};
        });
        check(focused.active&&focused.bottom>0&&focused.top<height&&
              focused.bottom<=focused.frameBottom+1,
          ctx+' lower input remains focusable and in modal scroll area: '+JSON.stringify(focused));
        check(await close.evaluate(el=>{
          const b=el.getBoundingClientRect(),at=document.elementFromPoint(
            b.left+b.width/2,b.top+b.height/2);
          return at===el||el.contains(at);
        }),ctx+' Close remains tappable with lower field focused');
        check(before.pageOverflow<=1,ctx+' no full-document horizontal scroll');
      }
    }
  }
  check(outbound.length===0,'No external provider requests');
  check(pageErrors.length===0,'No browser JS errors');
  console.log('PASS '+checks+'/'+checks+
    ' FIRE New Estimate short viewport, inner scroll, zoom proxy, keyboard focus and fixed X (synthetic Chrome only).');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
