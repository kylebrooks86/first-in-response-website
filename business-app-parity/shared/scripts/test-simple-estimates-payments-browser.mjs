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
const history=extract('PaymentsView','business-panel payments-history-disclosure');
assert.match(history,/RefundPayment/,'Preserve exact refund component');
assert.match(history,/ProcessingDetails/,'Preserve exact payment fee details');
assert.match(filters,/aria-pressed/,'Selected status remains accessible');
const fixture=[
 "import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CircleDollarSign}from'lucide-react';",
 "function ProcessingDetails({payment}){return <span className='synthetic-processing'>Fee {payment.id}</span>}",
 "function RefundPayment({payment}){return <button type='button' aria-label={'Refund action for '+payment.id}>Refund</button>}",
 "function Fixture(){",
 " const [filter,setFilter]=useState('all'),[showAllPayments,setShowAllPayments]=useState(false);",
 " const view='list',statusLabel=s=>s.slice(0,1).toUpperCase()+s.slice(1);",
 " const money=c=>'$'+(c/100).toFixed(2),load=()=>{};",
 " const payments=Array.from({length:9},(_,i)=>({id:'synthetic-'+i,customer:'Customer '+i,type:'Job payment',status:'paid',service:'House wash',createdAt:'2026-10-24T12:00:00Z',amountCents:12500+i,reference:'test-ref-'+i}));",
 " return <main className='workspace-view payments-view'>",
 " <output id='selected-filter'>{filter}</output>",
 filters,
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
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  const group=page.getByRole('group',{name:'Filter saved estimates by status'});
  const more=group.locator('details.estimate-filter-more');
  const panel=page.locator('details.payments-history-disclosure');
  await more.waitFor();await panel.waitFor();
  check(await group.getByRole('button',{name:'All',exact:true}).isVisible(),width+': All quotes one tap');
  check(await group.getByRole('button',{name:'Draft',exact:true}).isVisible()&&await group.getByRole('button',{name:'Sent',exact:true}).isVisible()&&await group.getByRole('button',{name:'Approved',exact:true}).isVisible(),width+': primary statuses one tap');
  check(!(await group.getByRole('button',{name:'Scheduled',exact:true}).isVisible()),width+': secondary statuses hidden initially');
  check(!(await page.locator('.payment-history article').first().isVisible()),width+': history initially tucked away');
  await more.locator('summary').click();
  await group.getByRole('button',{name:'Scheduled',exact:true}).click();
  check(await page.locator('#selected-filter').textContent()==='scheduled',width+': secondary filter still functional');
  check((await more.locator('summary').textContent()).includes('Scheduled'),width+': selected status stays named in summary');
  check(await group.getByRole('button',{name:'Scheduled',exact:true}).getAttribute('aria-pressed')==='true',width+': status accessible');
  await more.locator('summary').click();
  check(!(await group.getByRole('button',{name:'Completed',exact:true}).isVisible()),width+': optional statuses collapse again');
  await panel.locator('summary').click();
  check(await page.locator('.payment-history article').count()===8,width+': original recent eight payment records retained');
  check(await page.getByRole('button',{name:'Refund action for synthetic-0'}).isVisible(),width+': refunds still reachable');
  check(await page.locator('.synthetic-processing').first().isVisible(),width+': payment fee detail retained');
  await page.getByRole('button',{name:/View all 9 payments/}).click();
  check(await page.locator('.payment-history article').count()===9,width+': full payment history available');
  await page.getByRole('button',{name:'Show recent 8 payments'}).click();
  check(await page.locator('.payment-history article').count()===8,width+': short history restored');
  const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('.estimate-simple-filters>button,.estimate-filter-more>summary,.payments-history-disclosure>summary')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));
  check(geo.scroll<=width+1,width+': no horizontal viewport overflow');
  check(geo.targets.every(x=>x.left>=-1&&x.right<=width+1&&x.height>=44),width+': controls stay within phone and have 44px targets');
 }
 check(errors.length===0&&outside.length===0,'No JavaScript errors or outside requests: '+errors.join(', '));
 console.log('PASS '+checks+' real JSX mobile Estimates and Payments Chrome assertions at 320/375/390/430/768px. No D1, Stripe or hosted writes.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
