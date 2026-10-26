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
const scheduleMarkup=view.getText(ast);
assert.ok(!scheduleMarkup.includes('Jobs and routes · Central Time.'),'No redundant schedule subtitle');
assert.ok(!scheduleMarkup.includes('Last checked'),'No oversized last-check timestamp above calendar');
assert.ok(scheduleMarkup.includes('aria-label="Refresh schedule"'),'Small refresh control remains accessible');
assert.ok(scheduleMarkup.includes('ScheduleMonthCalendar'),'Real monthly calendar remains in schedule');
assert.ok(scheduleMarkup.includes('className="workspace-view schedule-view"'),'Compact Schedule layout uses its own styles');
assert.ok(scheduleMarkup.indexOf('ScheduleMonthCalendar')<scheduleMarkup.indexOf('className="schedule-day-actions"'),'Selected-day actions follow the calendar');
assert.ok(scheduleMarkup.indexOf('className="schedule-day-actions"')<scheduleMarkup.indexOf('className="schedule-board"'),'Schedule and route buttons appear before long job lists on iPhone');
assert.ok(scheduleMarkup.includes('selectedDaySavedJobs.length===1?"job":"jobs"'),'Compact selected-day count has correct singular/plural text');
const actualMonth=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleMonthCalendar');
assert.ok(actualMonth,'Test actual monthly calendar and its saved dates');
const monthlyComponent=actualMonth.getText(ast);
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
const getScheduleVariable=name=>{
 const values=[];
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)values.push(node);
  ts.forEachChild(node,visit);
 }
 visit(view);
 assert.equal(values.length,1,'Exactly one real ScheduleView variable '+name);
 return 'const '+values[0].getText(ast)+';';
};
const savedDaySource=getScheduleVariable('selectedDaySavedJobs');
const nextDaySource=getScheduleVariable('nextBookedJob');
const readySource=getScheduleVariable('readyToBook');
const filteredReadySource=getScheduleVariable('filteredReadyToBook');
assert.match(markup,/schedule-day-buttons/);
assert.match(markup,/route-day-button/);
assert.match(markup,/schedule-choose-job/);
const fixture=[
 "import React,{useState,useEffect} from 'react';",
 "import {createRoot} from 'react-dom/client';",
 "import {Navigation,ChevronRight} from 'lucide-react';",
 monthlyComponent,
 "function Fixture(){",
 " const [showBookingOptions,setShowBookingOptions]=useState(false);",
 " const [bookingSearch,setBookingSearch]=useState(''); const [bookingLimit,setBookingLimit]=useState(20);",
 " const [selected,setSelected]=useState(null);",
 " const [bookingDate,setBookingDate]=useState(null);",
 " const [scenario,setScenario]=useState('normal');",
 " window.__setScenario=setScenario;",
 " window.__navigation=[];",
 " const onNavigate=tab=>window.__navigation.push(tab);",
 " const [selectedDate,setSelectedDate]=useState('2026-10-24');",
 " const loading=false,error='';",
 " const rows=scenario==='empty'?[]:scenario==='bulk'?[...Array.from({length:55},(_,i)=>({id:'approved-'+i,customer:'Synthetic candidate '+i,service:i===47?'Gutter service':'House wash',address:i===47?'Owasso unique street':'Tulsa',status:'approved',scheduledAt:null})),{id:'scheduled-1',customer:'Synthetic scheduled customer',service:'Concrete wash',status:'scheduled',scheduledAt:'2026-10-24T16:00:00Z'}]:[",
 "  {id:'approved-1',customer:'Synthetic ready customer',service:'House wash',status:'approved',scheduledAt:null},",
 "  {id:'scheduled-1',customer:'Synthetic scheduled customer',service:'Concrete wash',status:'scheduled',scheduledAt:'2026-10-24T16:00:00Z'},",
 "  {id:'scheduled-2',customer:'Synthetic future customer',service:'Window cleaning',status:'scheduled',scheduledAt:'2026-11-12T16:00:00Z'}",
 " ];",
 " const routeUrl=scenario==='empty'?'':'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=123%20Synthetic%20Rd';",
 " const routeLabel='Route today';",
 " const searchQuery='';",
 " const tulsaDay=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});",
 " const dayFilter='date';",
 " const allVerifiedUpcoming=rows.filter(row=>row.status==='scheduled'&&row.scheduledAt&&Date.parse(row.scheduledAt)>=Date.parse('2026-10-23T00:00:00Z')).sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt));",
 " const setDayFilter=()=>{}; const setWeatherReview=()=>{};",
 savedDaySource,nextDaySource,readySource,filteredReadySource,
 " const routeJobs=[rows[1]].filter(Boolean),routeWithAddress=routeJobs;",
 " return <main className='workspace-view'>",
 " <ScheduleMonthCalendar jobs={rows} selectedDate={selectedDate} onSelectDate={date=>{setSelectedDate(date);setShowBookingOptions(false)}}/>",
 markup,
 " <output id='selection'>{JSON.stringify({selected:selected?.id||null,bookingDate,showBookingOptions,selectedDate})}</output>",
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
  const calendar=page.getByRole('region',{name:'Monthly job calendar'});
  await calendar.getByRole('heading',{name:'October 2026'}).waitFor();
  const original=calendar.getByRole('button',{name:/October 24, 2026, 1 jobs: 1 scheduled, 0 completed/});
  check(await original.getAttribute('aria-pressed')==='true'&&await original.locator('.schedule-month-dots i.booked').count()===1,width+': real October job dot and selected day preserved');
  await calendar.getByRole('button',{name:'Next month'}).click();
  await calendar.getByRole('heading',{name:'November 2026'}).waitFor();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#selection')?.textContent||'{}').selectedDate==='2026-11-01');
  check(await calendar.getByRole('button',{name:/November 1, 2026/}).getAttribute('aria-pressed')==='true',width+': month arrow also changes selected booking date to November 1');
  const jump=page.getByRole('button',{name:'Jump to next booked day'});
  await jump.waitFor({state:'visible'});
  check((await jump.innerText()).includes('Nov 12'),width+': empty day offers next booked date without showing permanent clutter');
  check(await jump.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.left>=-1&&r.right<=innerWidth+1}),width+': conditional next-job shortcut is phone-safe');
  await jump.click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#selection')?.textContent||'{}').selectedDate==='2026-11-12');
  check(await calendar.getByRole('button',{name:/November 12, 2026, 1 jobs: 1 scheduled/}).getAttribute('aria-pressed')==='true',width+': next booked shortcut selects the correct saved job dot');
  check(await jump.count()===0,width+': shortcut disappears once a booked day is selected');
  await calendar.getByRole('button',{name:/November 18, 2026/}).click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#selection')?.textContent||'{}').selectedDate==='2026-11-18');
  check(await calendar.getByRole('button',{name:/November 18, 2026/}).getAttribute('aria-pressed')==='true',width+': explicit day selection remains functional');
  await calendar.getByRole('button',{name:'Next month'}).click();
  await calendar.getByRole('heading',{name:'December 2026'}).waitFor();
  await calendar.getByRole('button',{name:'Next month'}).click();
  await calendar.getByRole('heading',{name:'January 2027'}).waitFor();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#selection')?.textContent||'{}').selectedDate==='2027-01-01');
  check(await calendar.getByRole('button',{name:/January 1, 2027/}).getAttribute('aria-pressed')==='true',width+': December to January year boundary selects correct date');
  await calendar.getByRole('button',{name:'Previous month'}).click();
  await calendar.getByRole('heading',{name:'December 2026'}).waitFor();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#selection')?.textContent||'{}').selectedDate==='2026-12-01');
  check(await calendar.getByRole('button',{name:/December 1, 2026/}).getAttribute('aria-pressed')==='true',width+': backward month browsing updates booking date too');
  await book.click();
  await page.getByRole('button',{name:/Synthetic ready customer/}).click();
  const rebook=JSON.parse(await page.locator('#selection').textContent());
  check(rebook.bookingDate==='2026-12-01',width+': approved job picker uses December not stale October date');
 }
 await page.evaluate(()=>window.__setScenario('bulk'));
 await page.getByRole('button',{name:'+ Schedule job'}).click();
 const picker=page.getByRole('region',{name:'Choose an approved job to schedule'});
 await picker.waitFor();
 check(await picker.locator(':scope > button').filter({hasText:'Synthetic candidate'}).count()===20,'Large approved queues initially show twenty exact jobs');
 check(await picker.getByText('55 of 55 ready to schedule').count()===1,'Loaded booking count stays visible');
 await picker.getByRole('button',{name:/Show next 20 jobs/}).click();
 check(await picker.locator(':scope > button').filter({hasText:'Synthetic candidate'}).count()===40,'Next batch exposes the next twenty approved jobs');
 await picker.getByRole('button',{name:/Show next 15 jobs/}).click();
 check(await picker.locator(':scope > button').filter({hasText:'Synthetic candidate'}).count()===55,'Last batch retains every remaining approved job');
 await picker.getByLabel('Find approved job').fill('Owasso unique');
 check(await picker.locator(':scope > button').filter({hasText:'Synthetic candidate'}).count()===1,'Unique service address narrows to the exact saved approved job');
 await picker.getByRole('button',{name:/Synthetic candidate 47/}).click();
 check(JSON.parse(await page.locator('#selection').textContent()).selected==='approved-47','Search opens exact saved job, not first result or false creation');
 await page.getByRole('button',{name:'+ Schedule job'}).click();
 check(await picker.getByLabel('Find approved job').inputValue()==='', 'Opening the chooser resets old search for the next booking');
 await page.evaluate(()=>window.__setScenario('empty'));

 await page.waitForFunction(()=>!document.querySelector('.schedule-day-buttons>.route-day-button'));
 check(await page.locator('.schedule-day-buttons>.route-day-button').count()===0,'No misleading Maps route when there are no stops');
 await page.getByRole('button',{name:'+ Schedule job'}).click();
 check(await page.getByText(/No approved jobs waiting for a date/).count()===1,'Empty queue tells owner to approve an estimate first');
 await page.getByRole('button',{name:/Open estimates/}).click();
 check(await page.evaluate(()=>window.__navigation.includes('estimates')),'Open estimates keeps native app navigation');
 await page.getByRole('button',{name:/Add customer/}).click();
 check(await page.evaluate(()=>window.__navigation.includes('customers')),'Add customer keeps native app navigation');
 check(errors.length===0&&outside.length===0,'No browser errors or external traffic: '+errors.join(', '));
 console.log('PASS '+checks+' real daily Schedule JSX Chrome checks at 320/375/390/430/768px. Synthetic localhost only; no hosting, customer data or messages.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
