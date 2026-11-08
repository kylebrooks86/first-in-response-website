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
  // Contact methods vary by customer: one to five direct actions, sometimes
  // with long labels. The old fixed 3-column layout stranded 1-2 controls.
  for(const width of [320,375,390,430,820]){
    for(const count of [1,2,3,4,5]){
      await page.setViewportSize({width,height:720});
      await page.goto(origin);
      await page.evaluate(n=>{
        const group=document.querySelector('.followup-contact-actions');
        const labels=['Google Voice call','Phone backup','Prepare text message','Text backup','Open email app'];
        group.replaceChildren(...labels.slice(0,n).map((label,i)=>{
          const action=document.createElement(i%2===0?'a':'button');
          if(action.tagName==='A')action.href='#synthetic-'+i;
          else action.type='button';
          action.textContent=label;
          return action;
        }));
      },count);
      const state=await page.evaluate(()=>{
        const group=document.querySelector('.followup-contact-actions');
        const bounds=group.getBoundingClientRect();
        const items=[...group.children].map(n=>{
          const r=n.getBoundingClientRect();
          return {left:r.left,right:r.right,width:r.width,height:r.height,
            contentOverflow:n.scrollWidth-n.clientWidth};
        });
        return {width:bounds.width,left:bounds.left,right:bounds.right,
          overflow:document.documentElement.scrollWidth-innerWidth,items};
      });
      const at=width+'px '+count+' follow-up method(s)';
      check(state.items.length===count,at+' keeps every available contact action');
      check(state.overflow<=1,at+' no page-wide horizontal scroll');
      check(state.items.every(a=>a.left>=state.left-1&&a.right<=state.right+1&&
        a.height>=48&&a.contentOverflow<=1),
        at+' every touch control fits the row without clipped label: '+JSON.stringify(state));
      if(count===1)check(state.items[0].width>=state.width-1,
        at+' single method fills the row instead of a third-width slot');
      if(count===2)check(state.items.every(a=>a.width>=state.width*.4),
        at+' two available methods share the row');
      if(count===5&&width===320)check(state.items[4].width>=state.width*.95,
        at+' the fifth method fills its compact-screen final row');
    }
  }
  // The real contact row mixes direct links and component buttons. In both
  // themes, keyboard navigation must expose the same visible focus indicator.
  for(const theme of ['light','dark']){
    await page.setViewportSize({width:375,height:720});
    await page.goto(origin);
    await page.evaluate(v=>{
      document.documentElement.dataset.theme=v;
      const button=document.createElement('button');
      button.type='button';
      button.textContent='Text via saved composer';
      document.querySelector('.followup-contact-actions').append(button);
    },theme);
    for(const tag of ['a','button']){
      const target=page.locator('.followup-contact-actions>'+tag).first();
      await target.focus();
      const state=await target.evaluate(n=>{
        const s=getComputedStyle(n);
        return {outline:s.outlineStyle,width:parseFloat(s.outlineWidth),
          visible:n.matches(':focus-visible')};
      });
      check(state.visible&&state.outline==='solid'&&state.width>=3,
        theme+' contact '+tag+' has an explicit keyboard focus ring');
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
  // High-contrast mode must NOT rely on the FIRE-red hover effect alone;
  // selected filters are visibly selected and keyboard focus is outlined.
  for(const theme of ['light','dark']){
    for(const width of [320,820]){
      await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
      await page.setViewportSize({width,height:720});
      await page.goto(origin);
      await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);
      const contrast=await page.evaluate(()=>matchMedia('(forced-colors: active)').matches);
      check(contrast,theme+' '+width+' OS forced-colors mode is actually enabled');
      const active=await page.locator('.invoice-directory-tools>button.active').evaluate(n=>{
        const s=getComputedStyle(n);
        return {width:s.borderTopWidth,outline:s.outlineStyle,
          background:s.backgroundColor,color:s.color};
      });
      const inactive=await page.locator('.invoice-directory-tools>button:not(.active)').evaluate(n=>{
        const s=getComputedStyle(n);return{bg:s.backgroundColor,shadow:s.boxShadow};
      });
      check(parseFloat(active.width)>=2 && active.outline==='solid',
        theme+' '+width+' selected invoice filter has system-color border and outline');
      check(active.background!==inactive.bg,
        theme+' '+width+' selected filter differs from neutral in forced colors');
      check(inactive.shadow==='none',
        theme+' '+width+' decorative shadow does not obscure system colors');
      await page.evaluate(()=>{
        const button=document.createElement('button');
        button.type='button';
        button.textContent='Text via saved composer';
        document.querySelector('.followup-contact-actions').append(button);
      });
      for(const tag of ['a','button']){
        const contact=page.locator('.followup-contact-actions>'+tag).first();
        await contact.focus();
        const state=await contact.evaluate(n=>{
          const s=getComputedStyle(n);
          return {outline:s.outlineStyle,width:parseFloat(s.outlineWidth),
            visible:n.matches(':focus-visible'),shadow:s.boxShadow};
        });
        check(state.visible&&state.outline==='solid'&&state.width>=3&&state.shadow==='none',
          theme+' '+width+' forced-colors contact '+tag+' retains keyboard focus');
      }
      const target=page.locator('.followup-optional-grid>button').first();
      await target.focus();
      const focus=await target.evaluate(n=>{
        const s=getComputedStyle(n);
        return {style:s.outlineStyle,width:s.outlineWidth};
      });
      check(focus.style==='solid'&&parseFloat(focus.width)>=3,
        theme+' '+width+' keyboard focus remains distinct in forced colors');
      const state=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-innerWidth,
        all:[...document.querySelectorAll(
          '.invoice-directory-tools>button,.followup-optional-grid>button'
        )].map(n=>{const b=n.getBoundingClientRect();
          return{left:b.left,right:b.right,height:b.height};})
      }));
      check(state.overflow<=1&&state.all.every(r=>r.left>=-1&&r.right<=width+1&&r.height>=44),
        theme+' '+width+' high-contrast keeps mobile actions reachable');
    }
  }
  await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference',contrast:'more'});
  await page.setViewportSize({width:820,height:720});
  await page.goto(origin);
  check(await page.evaluate(()=>matchMedia('(prefers-contrast: more)').matches),
    'Increased-contrast media preference is supported');
  const increased=await page.locator('.invoice-directory-tools>button.active').evaluate(n=>{
    const s=getComputedStyle(n);return{style:s.outlineStyle,width:s.outlineWidth};
  });
  check(increased.style==='solid'&&parseFloat(increased.width)>=2,
    'Selected filter remains visually outlined in increased contrast mode');
  check(requests.length===0,'All requests stay on synthetic localhost');
  check(errors.length===0,'No browser exceptions');
  console.log('PASS '+checks+'/'+checks+' FIRE owner control geometry, hover and reduced motion checks (localhost CSS).');
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
