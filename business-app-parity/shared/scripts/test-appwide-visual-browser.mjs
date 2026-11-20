/** FIRE app-wide visual primitives test: real compiled CSS, synthetic content,
 * isolated localhost Chromium. NOT hosted QA, customer data or physical Safari.
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
const ico='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12h18" stroke="currentColor"/></svg>';
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>'+
  '<main class="app-shell">'+
  '<aside class="sidebar"><nav><button class="active">'+ico+'Home</button><button>'+ico+'Customers</button></nav></aside>'+
  '<section class="main-area">'+
  '<div class="dashboard-view"><div class="welcome-row"><h1>Home</h1></div><section class="metric-grid">'+
  '<button class="metric-card accent"><span class="metric-icon red">'+ico+'</span><p>Due now</p><strong>$100.00</strong><small>Deposits and completed-job balances</small><svg class="metric-arrow" viewBox="0 0 24 24"><path d="m8 5 8 7-8 7"/></svg></button>'+
  '<button class="metric-card"><span class="metric-icon blue">'+ico+'</span><p>Upcoming jobs</p><strong>0</strong></button>'+
  '<button class="metric-card"><span class="metric-icon gold">'+ico+'</span><p>Saved estimates</p><strong>7</strong><small>$200.00 potential estimate value</small><svg class="metric-arrow" viewBox="0 0 24 24"><path d="m8 5 8 7-8 7"/></svg></button>'+
  '<button class="metric-card"><span class="metric-icon green">'+ico+'</span><p>Completed jobs</p><strong>1</strong></button></section></div>'+
  '<div class="workspace-view"><div class="workspace-head"><h1>Customers</h1></div>'+
  '<button class="customer-card"><span>Customer with an intentionally extremely long name and contact detail that should wrap without forcing horizontal scrolling</span></button>'+
  '<button class="estimate-card"><span>Customer estimate</span></button>'+
  '<article class="invoice-card"><div><strong>Invoice</strong><small>Billing information</small></div><div class="invoice-total"><strong>$12,345.67</strong></div></article>'+
  '<article class="followup-card"><span class="followup-icon">'+ico+'</span><div><strong>Follow-up contact</strong></div><button>Open</button></article>'+
  '<section class="business-panel"><header><h2>Business tasks</h2></header></section>'+
  '<section class="insight-kpis"><article><span>'+ico+'</span><small>Collected</small><strong>$12,345.67</strong></article></section>'+
  '<div class="record-tabs"><button class="active">Records</button><button>Payments</button></div>'+
  '</div></section><nav class="bottom-nav"><button class="active">'+ico+'<span>Home</span></button><button>'+ico+'<span>Customers</span></button></nav></main></body></html>';
const server=createServer((req,res)=>{if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}res.setHeader('content-type','text/html; charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
let browser,checks=0;
const ok=(test,label)=>{assert.ok(test,'FIRE visual browser: '+label);checks++};
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();page.setDefaultTimeout(6000);
  const widths=[320,350,375,390,430,667,760,768,820,1024,1366],errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==url){outside.push(r.request().url());return r.abort()}return r.continue()});
  for(const width of widths)for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:width===667?375:860});await page.goto(url);
    await page.evaluate(x=>document.documentElement.dataset.theme=x,theme);
    const result=await page.evaluate(()=>{
      const rect=selector=>[...document.querySelectorAll(selector)].map(n=>{const b=n.getBoundingClientRect(),st=getComputedStyle(n);return {x:b.x,right:b.right,width:b.width,height:b.height,shadow:st.boxShadow,border:st.borderColor}});
      return {cards:rect('.metric-card,.customer-card,.estimate-card,.invoice-card,.followup-card,.business-panel,.insight-kpis article'),
        metrics:rect('.metric-card'),nav:rect('.bottom-nav button'),
        sideIcon:getComputedStyle(document.querySelector('.sidebar nav button svg')).width,
        bottomIcon:getComputedStyle(document.querySelector('.bottom-nav button svg')).width,
        numbers:getComputedStyle(document.querySelector('.invoice-total>strong')).fontVariantNumeric,
        arrow:rect('.metric-card .metric-arrow'),desc:rect('.metric-card small'),descRightPadding:getComputedStyle(document.querySelectorAll('.metric-card small')[1]).paddingRight,
        activeNav:getComputedStyle(document.querySelector('.bottom-nav button.active')).fontWeight,
        inactiveNavColor:getComputedStyle(document.querySelector('.bottom-nav button:not(.active)')).color,
        inactiveNavSize:getComputedStyle(document.querySelector('.bottom-nav button:not(.active)')).fontSize,
        metricSubtitleColor:getComputedStyle(document.querySelector('.metric-card>small')).color,
        metricSubtitleSize:getComputedStyle(document.querySelector('.metric-card>small')).fontSize,
        metricColumns:getComputedStyle(document.querySelector('.metric-grid')).gridTemplateColumns.split(' ').filter(Boolean).length};
    });
    ok(result.cards.length===10,'All representative app section cards mounted '+width+'/'+theme);
    const expectedCols=width<=350?1:width<=1050?2:4;
    ok(result.metricColumns===expectedCols,'All four metrics use '+expectedCols+' responsive columns at '+width+'/'+theme);
    ok(result.cards.every(x=>x.width>0&&x.x>=-1&&x.right<=width+1),
      'Business cards fit without clipping '+width+'/'+theme+JSON.stringify(result.cards));
    ok(result.cards.every(x=>x.border!=='rgba(0, 0, 0, 0)'),'Business card borders visible '+width+'/'+theme);
    ok(result.sideIcon==='19px'&&result.bottomIcon==='20px','Navigation icon dimensions consistent '+width+'/'+theme);
    ok(result.numbers.includes('tabular-nums'),'Invoice amounts tabular '+width+'/'+theme);
    const expectedSecondary=theme==='dark'?'rgb(181, 199, 218)':'rgb(88, 107, 128)';
    ok(result.inactiveNavColor===expectedSecondary&&result.metricSubtitleColor===expectedSecondary,
      'Computed metric/nav subtitle colors follow theme-specific readable tokens '+width+'/'+theme);
    ok(result.inactiveNavSize==='11px'&&result.metricSubtitleSize==='12px',
      'Inactive nav labels are 11px and metric secondary copy is 12px '+width+'/'+theme);
    ok(result.metrics[2].width>100&&parseFloat(result.descRightPadding)>=30,
      'Metric description reserves 30px for bottom-right arrow '+width+'/'+theme);
  }
  ok(errors.length===0,'No browser runtime exceptions');
  ok(outside.length===0,'All browser requests remain on isolated localhost');
  console.log('PASS '+checks+'/'+checks+' compiled CSS FIRE section/navigation/card geometry checks');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
