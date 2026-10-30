/** Real Chrome forecast layout: actual ScheduleWeather React + actual Tailwind CSS, synthetic NWS week only. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleWeather');
assert.ok(component,'Must execute actual ScheduleWeather, never a copied mock');
const fixture=`import React,{useEffect,useState,useRef}from'react';
import{createRoot}from'react-dom/client';
import{formatDailyTemperatures,weatherDayHeading,weatherIconKind,hourlyWorkCautions,dailyWorkCautions,weatherHourForJobStart}from'./lib/tulsa-weather';
const CloudRain=()=> <span aria-hidden="true">☔</span>,Wind=()=> <span aria-hidden="true">↗</span>;
const WeatherConditionIcon=({description})=> <span role="img" aria-label={description}>☀</span>;
${component.getText(ast)}
function Screen(){
 const[job,setJob]=useState('2026-10-25T18:00:00Z');
 const[review,setReview]=useState({at:null,key:0});
 window.changeWeatherJob=setJob;
 window.reviewWeatherJob=at=>setReview(current=>({at,key:current.key+1}));
 return <main style={{width:'100%',maxWidth:1250,margin:'0 auto',padding:'8px'}}><h1>FIRE owner weather</h1><ScheduleWeather compact nextJobAt={review.at??job} requestedJobAt={review.at} reviewKey={review.key}/><ScheduleWeather nextJobAt={review.at??job} requestedJobAt={review.at} reviewKey={review.key}/></main>;
}
createRoot(document.getElementById('app')).render(<Screen/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
assert.ok(css.css.includes('.weather-scroll-hint')&&css.css.includes('scroll-snap-type'));
const days=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+20).padStart(2,'0')}`,temperatureMax:i===5?98:i===6?86:70+i,temperatureMin:i===6?null:45+i,rainChance:i===5?75:15,windMax:i===4?25:5+i}));
const sample={location:'Tulsa',updatedAt:'2026-10-20T17:00:00.000Z',current:{temperature:66,description:'Sunny'},daily:days};
let requests=0,hourlyRequests=0,weatherOutage=false;const outageCounts=new Map();
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/styles.css'){res.writeHead(200,{'content-type':'text/css','cache-control':'no-store'});res.end(css.css);return;}
 if(req.url==='/api/weather'){requests++;if(weatherOutage){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'Synthetic NWS outage'}));return;}res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(sample));return;}
 if(req.url?.startsWith('/api/weather/hourly?')){
  hourlyRequests++;const day=new URL(req.url,'https://synthetic.invalid').searchParams.get('date');
  if(day==='2026-10-23'){const count=(outageCounts.get(day)||0)+1;outageCounts.set(day,count);if(count%2===1){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'NWS temporarily offline'}));return;}}
  const hours=Array.from({length:3},(_,i)=>({startTime:day+'T'+String(12+i).padStart(2,'0')+':00:00-05:00',temperature:i===0?30:i===2?97:60+i,description:i===1?'Rain Showers':'Partly Sunny',rainChance:i===1?65:null,windMph:i===0?null:i===2?22:12}));
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({date:day,location:'Tulsa',updatedAt:new Date(Date.parse('2026-10-20T17:00:00Z')+hourlyRequests*60_000).toISOString(),hours}));return;
 }
 if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
 res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="app"></div><script type="module" src="/bundle.js"></script></body></html>');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const address=`http://127.0.0.1:${server.address().port}`;
let browser,checks=0;
const check=(test,message)=>{assert.ok(test,message);checks++};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE||undefined,args:['--no-sandbox']});
 for(const width of [320,390,768,1200])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:800},colorScheme:theme==='dark'?'dark':'light'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(address);
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  await page.locator('.weather-simple:not(.loading):not(.unavailable) .weather-days article').first().waitFor();
  const widgets=page.locator('.weather-simple:not(.loading):not(.unavailable)');
  check(await widgets.count()===2,'Compact Dashboard and Schedule both show weather');
  for(let i=0;i<2;i++){
   const widget=widgets.nth(i),week=widget.getByRole('region',{name:'Seven-day Tulsa weather forecast'});
   const cards=week.locator('article');
   check(await cards.count()===7,'Exactly seven forecast days');
   check((await cards.evaluateAll(ns=>ns.map(n=>n.dataset.forecastDate))).join(',')===days.map(d=>d.date).join(','),'Chronological NWS dates');
   check((await widget.locator('.weather-current').innerText()).includes('66° · Sunny'),'Current weather remains visible');
   check(await week.locator('.job-day').count()===1&&await week.locator('.job-day').getAttribute('data-forecast-date')==='2026-10-25','Next job date highlighted without a large details section');
   check((await widget.locator('.weather-simple-cautions').innerText()).includes('Rain possible'),'Useful weekly rain caution remains concise');
   check(await widget.locator('.weather-hourly,.weather-radar-action,.weather-next-job,.weather-day-toggle,.weather-scroll-hint').count()===0,'No hourly, radar, bulky job or instruction panels');
   check(await widget.getByRole('link',{name:/radar/i}).count()===0,'No radar link');
   const geometry=await widget.evaluate(n=>({height:n.getBoundingClientRect().height,right:n.getBoundingClientRect().right,viewport:innerWidth,doc:document.documentElement.scrollWidth}));
   check(geometry.height<=275&&geometry.right<=width+1&&geometry.doc<=width+1,'Weather panel stays compact and within screen at '+width);
   const scroll=await week.evaluate(n=>({client:n.clientWidth,total:n.scrollWidth,scrollable:getComputedStyle(n).overflowX}));
   check(scroll.scrollable==='auto','Seven-day cards are swipeable');
   if(width<=390)check(scroll.total>scroll.client,'Week scrolls on iPhone without a tall stack');
   await week.evaluate(n=>n.scrollLeft=n.scrollWidth);
   check(await week.evaluate(n=>{const last=n.querySelector('article:last-child').getBoundingClientRect(),r=n.getBoundingClientRect();return last.right<=r.right+2;}),'Seventh day is reachable');
  }
  check(errors.length===0,'No browser errors: '+errors.join(';'));
  await page.evaluate(()=>window.reviewWeatherJob('2026-10-22T16:00:00Z'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.weather-simple .job-day')].every(n=>n.dataset.forecastDate==='2026-10-22'));
  check(await page.locator('.weather-simple .job-day').count()===2,'Requested job day highlights only daily forecast');
  await page.evaluate(()=>window.reviewWeatherJob('2026-11-12T15:00:00Z'));
  await page.locator('.weather-simple .job-day').first().waitFor({state:'hidden'});
  check(await page.locator('.weather-days article').count()===14,'Out-of-range job never fabricates or hides forecast days');
  if(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR,'weather-'+width+'-'+theme+'.png'),fullPage:true});}
  await context.close();
 }
 check(hourlyRequests===0,'Current-plus-seven-day UI never requests hourly endpoint');
 const recovery=await browser.newContext({viewport:{width:320,height:800}});
 const page=await recovery.newPage();await page.goto(address);
 const widget=page.locator('.weather-simple:not(.loading):not(.unavailable)').first();
 await widget.locator('.weather-days article').first().waitFor();
 weatherOutage=true;
 const readCount=requests;
 const refreshControl=widget.getByRole('button',{name:'Refresh seven-day Tulsa weather forecast'});
 check(await refreshControl.evaluate(n=>n.getBoundingClientRect().height>=44),'Actual seven-day forecast refresh has a 44px target');
 await refreshControl.click();
 await widget.getByRole('alert').waitFor();
 check(requests>readCount,'Refresh performs a new NWS daily request');
 check(await widget.locator('.weather-days article').count()===7,'Last known daily forecast preserved if update fails');
 weatherOutage=false;
 await widget.getByRole('button',{name:'Retry seven-day Tulsa forecast'}).click();
 await widget.getByRole('alert').waitFor({state:'hidden'});
 check(await widget.locator('.weather-days article').count()===7,'Daily forecast recovers after explicit retry');
 await recovery.close();
 weatherOutage=true;
 const cold=await browser.newContext({viewport:{width:390,height:800}});
 const coldPage=await cold.newPage();await coldPage.goto(address);
 await coldPage.locator('.weather-simple.unavailable').first().getByRole('button',{name:'Retry seven-day Tulsa forecast'}).waitFor();
 check(await coldPage.locator('.weather-days article').count()===0,'Cold weather outage never shows invented data');
 weatherOutage=false;
 await coldPage.locator('.weather-simple.unavailable').first().getByRole('button',{name:'Retry seven-day Tulsa forecast'}).click();
 await coldPage.waitForFunction(()=>document.querySelectorAll('.weather-simple:not(.loading):not(.unavailable) .weather-days article').length===7);
 check(await coldPage.locator('.weather-days article').count()===7,'Cold retry restores seven-day widget');
 await cold.close();
 console.log('PASS '+checks+' compact current weather and seven-day Chrome assertions: iPhone, tablet, desktop, light/dark, no hourly or radar, last-good recovery.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
