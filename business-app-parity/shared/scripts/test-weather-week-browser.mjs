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
const fixture=`import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{formatDailyTemperatures,weatherDayHeading,weatherIconKind}from'./lib/tulsa-weather';
const CloudRain=()=> <span aria-hidden="true">☔</span>,Wind=()=> <span aria-hidden="true">↗</span>;
const WeatherConditionIcon=({description})=> <span role="img" aria-label={description}>☀</span>;
${component.getText(ast)}
function Screen(){
 const[job,setJob]=useState('2026-10-25T18:00:00Z');
 window.changeWeatherJob=setJob;
 return <main style={{width:'100%',maxWidth:1250,margin:'0 auto',padding:'8px'}}><h1>FIRE owner weather</h1><ScheduleWeather compact nextJobAt={job}/><ScheduleWeather nextJobAt={job}/></main>;
}
createRoot(document.getElementById('app')).render(<Screen/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
assert.ok(css.css.includes('.weather-scroll-hint')&&css.css.includes('scroll-snap-type'));
const days=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+20).padStart(2,'0')}`,temperatureMax:70+i,temperatureMin:i===6?null:45+i,rainChance:i===5?75:15,windMax:5+i}));
const sample={location:'Tulsa',updatedAt:'2026-10-20T17:00:00.000Z',current:{temperature:66,description:'Sunny'},daily:days};
let requests=0,hourlyRequests=0;
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/styles.css'){res.writeHead(200,{'content-type':'text/css','cache-control':'no-store'});res.end(css.css);return;}
 if(req.url==='/api/weather'){requests++;res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(sample));return;}
 if(req.url?.startsWith('/api/weather/hourly?')){
  hourlyRequests++;const day=new URL(req.url,'https://synthetic.invalid').searchParams.get('date');
  if(day==='2026-10-23'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'NWS temporarily offline'}));return;}
  const hours=Array.from({length:3},(_,i)=>({startTime:day+'T'+String(12+i).padStart(2,'0')+':00:00-05:00',temperature:60+i,description:i===1?'Rain Showers':'Partly Sunny',rainChance:i===1?65:null,windMph:i===0?null:12}));
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({date:day,location:'Tulsa',updatedAt:'2026-10-20T17:00:00Z',hours}));return;
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
 for(const width of [320,390,768,1200]){
  for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:800},colorScheme:theme==='dark'?'dark':'light'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   await page.goto(address);
   await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
   await page.locator('.weather-strip:not(.loading) .weather-days article').first().waitFor();
   const widgets=page.locator('.weather-strip:not(.loading):not(.unavailable)');
   check(await widgets.count()===2,'Compact Dashboard and full Schedule weather are both mounted');
   for(let i=0;i<2;i++){
    const widget=widgets.nth(i),scroll=widget.getByRole('region',{name:'Seven-day Tulsa weather forecast'});
    const cards=scroll.locator('article');
    check(await cards.count()===7,'Every weather panel renders seven distinct calendar days');
    check((await cards.evaluateAll(ns=>ns.map(n=>n.dataset.forecastDate))).join(',')===days.map(d=>d.date).join(','),'All 7 calendar dates stay in order');
    check(await scroll.locator('.job-day').count()===1,'Week outlook retains the next-job marker');
    check((await scroll.locator('.job-day').getAttribute('data-forecast-date'))==='2026-10-25','Sixth day is next job, not artificially moved to front');
    check((await scroll.locator('.job-day').innerText()).toLowerCase().includes('next job'),'Job forecast is visibly labeled even when CSS uppercases day headings');
    check((await widget.locator('.weather-alert').innerText()).includes('Rain possible this week'),'Rain late in the week informs week-long alert');
    check((await widget.locator('.weather-days article').last().innerText()).includes('Low')===false,'Nighttime missing low does not invent values');
    const geometry=await scroll.evaluate(n=>({client:n.clientWidth,scroll:n.scrollWidth,scrollable:getComputedStyle(n).overflowX,focusable:n.tabIndex,viewport:innerWidth,bounds:n.getBoundingClientRect().toJSON()}));
    check(geometry.focusable===0&&geometry.scrollable==='auto','Seven-day row supports mouse, swipe and keyboard scrolling');
    check(geometry.bounds.left>=-1&&geometry.bounds.right<=width+1,'Week forecast cannot cause horizontal page clipping');
    if(width<=390)check(geometry.scroll>geometry.client,'Full week can swipe horizontally on narrow phones');
    await scroll.evaluate(n=>n.scrollLeft=n.scrollWidth);
    const visible=await scroll.evaluate(n=>{const card=n.querySelector('article:last-child').getBoundingClientRect(),rect=n.getBoundingClientRect();return card.right<=rect.right+2&&card.left>=rect.left-2;});
    check(visible,'Last forecast day is reachable by horizontal scroll');
    const radar=widget.getByRole('link',{name:'Open live National Weather Service radar'});
    check(await radar.getAttribute('href')==='https://radar.weather.gov/','Radar points to official interactive NWS radar');
    check(await radar.getAttribute('target')==='_blank'&&(await radar.getAttribute('rel')).includes('noopener'),"Radar safely opens separately from the owner\'s app");
    const buttons=scroll.getByRole('button',{name:/Show hourly forecast for/});
    check(await buttons.count()===7,'Each forecast day has an accessible tap-to-expand hourly action');
    const beforeHourly=hourlyRequests;
    await buttons.nth(1).click();
    const hourly=widget.getByRole('region',{name:'Hourly Tulsa weather forecast'});
    await hourly.locator('.weather-hour').first().waitFor();
    check(await hourly.locator('.weather-hour').count()===3,'Tapped day opens only its actual hourly breakdown');
    check((await hourly.innerText()).includes('Rain 65%')&&(await hourly.innerText()).includes('Wind 12 mph'),'Hourly panel shows temperature, conditions, rain and wind');
    check(await buttons.nth(1).getAttribute('aria-expanded')==='true','Selected forecast day advertises open state');
    check(hourlyRequests===beforeHourly+1,'Hourly endpoint is requested only after opening a day');
    await buttons.nth(2).click();
    await hourly.locator('.weather-hour').first().waitFor();
    check((await hourly.innerText()).includes('October 22'),'Changing day replaces old hourly heading and results');
    await buttons.nth(3).click();
    await hourly.getByRole('alert').waitFor();
    check((await hourly.getByRole('alert').innerText()).includes('seven-day forecast remains available'),'Hourly failure stays independent of the seven-day weather');
    check(await cards.count()===7,'Outage never hides the entire weather outlook');
    const bounds=await hourly.evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),width:innerWidth}));
    check(bounds.rect.left>=-1&&bounds.rect.right<=bounds.width+1,'Expanded hourly panel cannot overflow a phone viewport');
    await hourly.getByRole('button',{name:'Close hourly forecast'}).click();
    check(await widget.getByRole('region',{name:'Hourly Tulsa weather forecast'}).count()===0,'Close control hides hourly forecast without losing the seven-day panel');
   }
   check(errors.length===0,'No React browser errors while rendering the seven-day forecast: '+errors.join(';'));
   await page.evaluate(()=>window.changeWeatherJob('2026-11-12T15:00:00Z'));
   check(await page.locator('.weather-days article').count()===14,'Job outside week cannot hide available forecast days');
   check(await page.locator('.weather-days article.job-day').count()===0,'Job beyond NWS horizon is not given a fabricated forecast');
   if(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR){
    mkdirSync(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.FIRE_WEATHER_WEEK_SCREENSHOT_DIR,`weather-${width}-${theme}.png`),fullPage:true});
   }
   await context.close();
  }
 }
 check(requests>=16&&hourlyRequests>=48,'Both weather panels use only synthetic seven-day and hourly NWS responses');
 console.log(`PASS ${checks}/${checks}: actual seven-day Dashboard/Schedule, tapped hourly forecasts, outage fallback, official radar, iPhone and tablet light/dark and no overflow. Synthetic localhost only.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
