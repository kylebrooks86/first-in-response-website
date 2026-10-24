/** Chromium regression: the ACTUAL daily booking JSX and compiled FIRE CSS. Synthetic localhost only. */
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
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleView');
assert.ok(view,'Actual ScheduleView must remain present');
const matches=[];
function scan(node){
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='section'){
  const attr=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='className');
  if(attr&&ts.isStringLiteral(attr.initializer)&&attr.initializer.text==='schedule-day-actions')matches.push(node);
 }
 ts.forEachChild(node,scan);
}
scan(view);
assert.equal(matches.length,1,'Render exactly one live calendar-day booking area');
const markup=matches[0].getText(ast);
assert.match(markup,/schedule-day-buttons/);
assert.match(markup,/route-day-button/);
assert.match(markup,/schedule-choose-job/);
const fixture=[
 "import React,{useState} from 'react';",
 "import {createRoot} from 'react-dom/client';",
 "import {Navigation,ChevronRight} from 'lucide-react';",
 "function Fixture(){",
 " const [showBookingOptions,setShowBookingOptions]=useState(false);",
 " const [selected,setSelected]=useState(null);",
 " const [bookingDate,setBookingDate]=useState(null);",
 " const [scenario,setScenario]=useState('normal');",
 " window.__setScenario=setScenario;",
 " window.__navigation=[];",
 " const onNavigate=tab=>window.__navigation.push(tab);",
 " const selectedDate='2026-10-24';",
 " const loading=false,error='';",
 " const rows=scenario==='empty'?[]:[",
 "  {id:'approved-1',customer:'Synthetic ready customer',service:'House wash',status:'approved',scheduledAt:null},",
 "  {id:'scheduled-1',customer:'Synthetic scheduled customer',service:'Concrete wash',status:'scheduled',scheduledAt:'2026-10-24T16:00:00Z'}",
 " ];",
 " const routeUrl=scenario==='empty'?'':'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=123%20Synthetic%20Rd';",
 " const routeLabel='Route today';",
 " const routeJobs=[rows[1]].filter(Boolean),routeWithAddress=routeJobs;",
 " return <main className='workspace-view'>",
 markup,
 " <output id='selection'>{JSON.stringify({selected:selected?.id||null,bookingDate,showBookingOptions})}</output>",
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
let browser,checks=0;
const errors=[],outside=[];
function check(value,label){assert.ok(value,label);checks++;}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(outside.push(route.request().url()),route.abort()));
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:844});
  await page.goto(origin);
  const book=page.getByRole('button',{name:'+ Schedule job'});
  const route=page.getByRole('link',{name:'Route today in Google Maps'});
  await book.waitFor();await route.waitFor();
  check(await route.count()===1,width+': exactly one direct daily route link');
  check((await route.getAttribute('href')).includes('destination=123%20Synthetic%20Rd'),width+': Maps destination preserved');
  check(!(await page.getByRole('region',{name:'Choose an approved job to schedule'}).count()),width+': booking picker initially closed');
  const geometry=await page.evaluate(()=>({
   page:document.documentElement.scrollWidth,width:window.innerWidth,
   actions:[...document.querySelectorAll('.schedule-day-buttons>button,.schedule-day-buttons>a')].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})
  }));
  check(geometry.page<=width+1,width+': no horizontal overflow');
  check(geometry.actions.length===2&&geometry.actions.every(r=>r.left>=-1&&r.right<=width+1&&r.height>=44),width+': booking and Maps are full, safe phone tap targets');
  await book.click();
  await page.getByRole('region',{name:'Choose an approved job to schedule'}).waitFor();
  check(await page.getByRole('button',{name:/Synthetic ready customer/}).count()===1,width+': only approved unscheduled job offered');
  await page.getByRole('button',{name:/Synthetic ready customer/}).click();
  const selection=JSON.parse(await page.locator('#selection').textContent());
  check(selection.selected==='approved-1'&&selection.bookingDate==='2026-10-24'&&selection.showBookingOptions===false,width+': exact approved job selected with calendar date, no write');
  check(await route.isVisible(),width+': route remains after booking selection');
 }
 await page.evaluate(()=>window.__setScenario('empty'));
 await page.waitForFunction(()=>!document.querySelector('.schedule-day-buttons>.route-day-button'));
 check(await page.locator('.schedule-day-buttons>.route-day-button').count()===0,'No misleading Maps route when there are no stops');
 await page.getByRole('button',{name:'+ Schedule job'}).click();
 check(await page.getByText('No approved jobs waiting for a date.').count()===0,'Empty-state message remains complete rather than fabricated');
 check(await page.getByText(/No approved jobs waiting for a date/).count()===1,'Empty queue tells owner to approve an estimate first');
 await page.getByRole('button',{name:/Open estimates/}).click();
 check(await page.evaluate(()=>window.__navigation.includes('estimates')),'Open estimates keeps native app navigation');
 await page.getByRole('button',{name:/Add customer/}).click();
 check(await page.evaluate(()=>window.__navigation.includes('customers')),'Add customer keeps native app navigation');
 check(errors.length===0&&outside.length===0,'No browser errors or external traffic: '+errors.join(', '));
 console.log('PASS '+checks+' real daily Schedule JSX Chrome checks at 320/375/390/430/768px. Synthetic localhost only; no hosting, customer data or messages.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
