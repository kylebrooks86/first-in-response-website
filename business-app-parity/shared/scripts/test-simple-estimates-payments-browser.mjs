/** Real Estimates/Payments JSX + compiled CSS on synthetic localhost Chromium only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function extract(name,cssClass){
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 assert.ok(fn,'Actual '+name+' function exists');
 const hits=[];
 function walk(node){
  if(ts.isJsxElement(node)){
   const attr=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='className');
   if(attr&&ts.isStringLiteral(attr.initializer)&&attr.initializer.text===cssClass)hits.push(node.getText(ast));
  }
  ts.forEachChild(node,walk);
 }
 walk(fn);assert.equal(hits.length,1,'One actual '+cssClass+' section');return hits[0];
}
const filters=extract('EstimatesView','filter-row estimate-simple-filters');
const estimateCard=extract('EstimatesView','estimate-card');
const estimatesFunction=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimatesView');
const cardLabel=estimatesFunction.body.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='savedCardStatus').getText(ast);
const history=extract('PaymentsView','business-panel payments-history-disclosure');
const paymentMetrics=extract('PaymentsView','business-metrics payments-primary-metrics');
assert.match(history,/RefundPayment/,'Preserve exact refund component');
assert.match(history,/ProcessingDetails/,'Preserve exact payment fee details');
assert.match(filters,/aria-pressed/,'Selected status remains accessible');
const fixture=[
 "import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CircleDollarSign,ChevronRight,CalendarDays}from'lucide-react';",
 "function ProcessingDetails({payment}){return <span className='synthetic-processing'>Fee {payment.id}</span>}",
 "function RefundPayment({payment}){return <button type='button' aria-label={'Refund action for '+payment.id}>Refund</button>}",
 "function Fixture(){",
 " const [filter,setFilter]=useState('all'),[showAllPayments,setShowAllPayments]=useState(false);",
 " const view='list',statusLabel=s=>s.slice(0,1).toUpperCase()+s.slice(1);",
 cardLabel,
 " const [selected,setSelected]=useState(null),setFocusError=()=>{},viewedOnly=false,dateTime=v=>v,resolvedBillingTotalCents=e=>e.totalCents;",
 " const base={service:'House wash',createdAt:'2026-10-24T12:00:00Z',totalCents:22000,paidCents:0};",
 " const examples=[{status:'sent',firstViewedAt:'2026-10-24T12:00:00Z'},{status:'approved',signedAt:'2026-10-24T12:00:00Z',signedName:'Synthetic Owner'},{status:'scheduled',scheduledAt:'2026-10-28T12:00:00Z',signedAt:'2026-10-24T12:00:00Z',signedName:'Synthetic Owner'},{status:'approved',acceptedAt:'2026-10-24T12:00:00Z'},{status:'scheduled',signedAt:'invalid',signedName:'Synthetic Owner'},{status:'draft',firstViewedAt:'invalid'},{status:'approved',signedName:'Synthetic Owner'},{status:'sent',signedAt:'2026-10-24T12:00:00Z',signedName:'Synthetic Owner'}].map((e,i)=>({...base,...e,id:'quote-'+i,customer:'Quote '+i}));",
 " const money=c=>'$'+(c/100).toFixed(2),load=()=>{},outstanding=20000,collected=24000,balanceSummary={depositRemainingCents:10000};",
 " const payments=Array.from({length:9},(_,i)=>({id:'synthetic-'+i,customer:'Customer '+i,type:'Job payment',status:'paid',service:'House wash',createdAt:'2026-10-24T12:00:00Z',amountCents:12500+i,grossReceivedCents:13000,processingMethod:'Cash App',reference:'test-ref-'+i}));",
 " return <main className='workspace-view payments-view'>",
 " <output id='selected-filter'>{filter}</output>",
 " <output id='opened-quote'>{selected?.id}</output>",
 filters,
 paymentMetrics,
 " <section className='estimate-list'>{examples.map(estimate=>(",estimateCard,"))}</section>",
 " <div className='payment-layout'>",history,"</div>",
 " </main>;",
 "}",
 "createRoot(document.getElementById('app')).render(<Fixture/>);"
].join('\n');
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const errors=[],outside=[];
function check(ok,label){assert.ok(ok,label);checks++;}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(outside.push(route.request().url()),route.abort()));
 for(const width of [320,375,390,430,768,1366]){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  const metrics=page.locator('.payments-primary-metrics');
  check(await metrics.locator('article').count()===3,width+': all three actual Payments totals render');
  const cardGeometry=await metrics.evaluate(n=>{const outer=n.getBoundingClientRect(),cards=[...n.querySelectorAll('article')].map(el=>el.getBoundingClientRect());return{left:outer.left,right:outer.right,cards:cards.map(r=>({left:r.left,right:r.right}))};});
  check(cardGeometry.cards.every(r=>r.left>=cardGeometry.left-1&&r.right<=cardGeometry.right+1),width+': no Payments total clips offscreen');
  if(width>=351&&width<=760)check(cardGeometry.cards[2].right>=cardGeometry.right-2&&cardGeometry.cards[2].left<=cardGeometry.left+2,width+': final Payments total fills mobile width');
  const group=page.getByRole('group',{name:'Filter saved estimates by status'});
  const more=group.locator('details.estimate-filter-more');
  const panel=page.locator('details.payments-history-disclosure');
  await more.waitFor();await panel.waitFor();
  const expected=['Sent · Viewed','Approved · Signed','Scheduled · Signed','Approved · Unsigned','Scheduled','Draft','Approved','Sent · Signed'];
  check(JSON.stringify(await page.locator('.estimate-card-state').allTextContents())===JSON.stringify(expected),width+': actual card labels distinguish status, view, acceptance and complete signature without inference');
  check(await page.locator('.estimate-card-state').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.height<=40})),width+': status text stays compact and visible on phones');
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const colors=await page.locator('.estimate-card-state').evaluateAll(ns=>ns.map(n=>({fg:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor})));
   const luminance=v=>{const c=v.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
   check(colors.every(c=>{const a=luminance(c.fg),b=luminance(c.bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5}),width+'/'+theme+': status labels have readable contrast');
  }
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await page.locator('.estimate-card').filter({hasText:'Quote 2'}).click();
  check(await page.locator('#opened-quote').textContent()==='quote-2',width+': labelled card opens the original exact estimate');
  check(await group.getByRole('button',{name:'All',exact:true}).isVisible(),width+': All quotes one tap');
  check(await group.getByRole('button',{name:'Draft',exact:true}).isVisible()&&await group.getByRole('button',{name:'Sent',exact:true}).isVisible()&&await group.getByRole('button',{name:'Approved',exact:true}).isVisible(),width+': primary statuses one tap');
  check(await group.getByRole('button',{name:'Scheduled',exact:true}).isVisible(),width+': Scheduled jobs one tap from primary filters');
  check(!(await group.getByRole('button',{name:'Completed',exact:true}).isVisible()),width+': less common statuses start collapsed');
  check(!(await page.locator('.payment-history article').first().isVisible()),width+': history initially tucked away');
  await group.getByRole('button',{name:'Scheduled',exact:true}).click();
  check(await page.locator('#selected-filter').textContent()==='scheduled',width+': scheduled primary filter still functional');
  check(await group.getByRole('button',{name:'Scheduled',exact:true}).getAttribute('aria-pressed')==='true',width+': scheduled status accessible');
  await more.locator('summary').click();
  await group.getByRole('button',{name:'Completed',exact:true}).click();
  check(await page.locator('#selected-filter').textContent()==='completed',width+': secondary Completed status still functional');
  check((await more.locator('summary').textContent()).includes('Completed'),width+': advanced selection stays named when opened');
  await more.locator('summary').click();
  check(!(await group.getByRole('button',{name:'Completed',exact:true}).isVisible()),width+': optional statuses collapse again');
  await panel.locator(':scope > summary').click();
  check(await page.locator('.payment-history article').count()===8,width+': original recent eight payment records retained');
  check(await page.getByRole('button',{name:'Refund action for synthetic-0'}).isVisible(),width+': refunds still reachable');
  const referenceCopy=page.getByRole('button',{name:'Copy full payment reference'}).first();
  check(await referenceCopy.isVisible()&&await referenceCopy.evaluate(n=>n.getBoundingClientRect().height>=44),width+': actual payment-reference copy action has a 44px target');
  check(!(await page.locator('.synthetic-processing').first().isVisible()),width+': fee breakdown starts collapsed');
  await page.locator('.payment-fee-details summary').first().click();
  check(await page.locator('.synthetic-processing').first().isVisible(),width+': full payment fee detail opens on demand');
  await page.getByRole('button',{name:/View all 9 payments/}).click();
  check(await page.locator('.payment-history article').count()===9,width+': full payment history available');
  await page.getByRole('button',{name:'Show recent 8 payments'}).click();
  check(await page.locator('.payment-history article').count()===8,width+': short history restored');
  const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('.estimate-simple-filters>button,.estimate-filter-more>summary,.payments-history-disclosure>summary')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));
  check(geo.scroll<=width+1,width+': no horizontal viewport overflow');
  check(geo.targets.every(x=>x.left>=-1&&x.right<=width+1&&x.height>=44),width+': controls stay within phone and have 44px targets');
 }
 check(errors.length===0&&outside.length===0,'No JavaScript errors or outside requests: '+errors.join(', '));
 console.log('PASS '+checks+' real JSX mobile Estimates and Payments Chrome assertions at 320/375/390/430/768/1366px. No D1, Stripe or hosted writes.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
