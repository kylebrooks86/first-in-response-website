/** Actual dashboard header JSX and CSS, localhost-only synthetic navigation fixture. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const start=dashboard.indexOf('<header className={`topbar ');
assert.ok(start>=0);
const header=dashboard.slice(start,dashboard.indexOf('</header>',start)+9);
const fixture=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{ArrowLeft,House,Sun,Moon,Menu,Search}from'lucide-react';
import{GlobalSearch}from'./components/global-search';
function FireMark(){return <span>F</span>}
function StrideButton(){return <button className="top-stride-button" aria-label="Stride">S</button>}
function NotificationBell(){return <button className="notification-button" aria-label="Notifications">N</button>}
function Fixture(){const[tab,setTab]=useState('dashboard'),[theme,setTheme]=useState('light'),[interactive,ready]=useState(true),[searchQuery,setSearchQuery]=useState('');
const[globalQuery,setGlobalQuery]=useState(''),mobileMenu=false,openSearchResult=()=>{};
window.setReady=ready;window.setFixtureTab=setTab;window.setFixtureTheme=setTheme;
const goBack=()=>setTab('dashboard'),goHome=goBack,toggleTheme=()=>setTheme(theme==='dark'?'light':'dark'),setMobileMenu=()=>{},setEstimateRefreshKey=()=>{};
return <div className="app-shell" data-theme={theme}><main className="main-area">${header}<output data-tab={tab}>{tab}</output></main></div>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('app/globals.css','utf8').replace(/^@import[^;]+;/gm,''));}
 else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,errors=[],remote=[];
let browser,count=0;const check=(ok,label)=>{assert.ok(ok,label);count++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto(origin);await page.getByRole('button',{name:'Record payments',exact:true}).waitFor();
 for(const width of [320,390,768,1024,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1000});await page.evaluate(t=>window.setFixtureTheme(t),theme);
  await page.waitForFunction(t=>document.querySelector('.app-shell').dataset.theme===t,theme);
  const button=page.getByRole('button',{name:'Record payments',exact:true});
  check(await button.count()===1&&await button.isVisible(),`${width}/${theme}: exactly one visible payments entry`);
  check((await button.innerText()).trim()==='$',`${width}/${theme}: compact dollar glyph only`);
  const geometry=await button.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,bg:s.backgroundColor,color:s.color,overlap:[...n.parentElement.children].filter(x=>x!==n).some(x=>{const b=x.getBoundingClientRect();return b.width>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;})};});
  check(geometry.left>=0&&geometry.right<=width&&geometry.top>=0&&!geometry.overlap,`${width}/${theme}: reachable without overlap`);
  check(geometry.width===(width<=430?39:42)&&geometry.height===geometry.width,`${width}/${theme}: shared responsive dimensions`);
  check(geometry.color===(theme==='dark'?'rgb(250, 134, 139)':'rgb(195, 42, 50)'),`${width}/${theme}: shared theme colors`);
  await button.focus();check(await button.evaluate(n=>getComputedStyle(n).outlineStyle)==='solid',`${width}/${theme}: keyboard focus visible`);
  for(const tab of ['dashboard','estimates','schedule','customers']){
   await page.evaluate(t=>window.setFixtureTab(t),tab);await page.waitForFunction(t=>document.querySelector('output').dataset.tab===t,tab);
   await button.click();await page.waitForFunction(()=>document.querySelector('output').dataset.tab==='payments');count++;
  }
  await page.evaluate(()=>window.setReady(false));await page.waitForFunction(()=>document.querySelector('.payments-quick-action').disabled);
  check(await button.isDisabled(),`${width}/${theme}: loading protection preserved`);
  await page.evaluate(()=>window.setReady(true));await page.waitForFunction(()=>!document.querySelector('.payments-quick-action').disabled);
 }
 check(remote.length===0&&errors.length===0,'No outside requests or browser runtime errors');
 console.log(`PASS ${count} header browser assertions: phone/tablet/desktop, light/dark, navigation, keyboard and loading guards. Synthetic localhost fixture; no hosted/device acceptance or payments.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
