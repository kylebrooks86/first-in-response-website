/** Real SettingsView/sidebar JSX and compiled shared CSS; synthetic localhost only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const settings=section('function SettingsView(){','function EmptyView(');
const sidebar=section('<aside className={`sidebar ', '</aside>')+'</aside>';
const fixture=`import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';
import{FileText,MessageSquareText,ChevronRight,Save,X,Settings}from'lucide-react';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Input}from'./components/ui/input';import{Textarea}from'./components/ui/textarea';
import{PricingSettings}from'./components/service-pricing';
import{FIRE_TEMPLATES,type FireTemplate}from'./lib/fire-templates';import{GlobalSearch}from'./components/global-search';
const statusLabel=(v:string)=>v.replaceAll('_',' ').replace(/^./,v=>v.toUpperCase());
function FireMark(){return <span className="fire-mark">F</span>}
${settings}
function Fixture(){const[mobileMenu,setMobileMenu]=useState(false),[theme,setTheme]=useState(localStorage.getItem('fire-theme')||'light');
const interactive=true,tab='settings',setTab=()=>{},globalQuery='',setGlobalQuery=()=>{},openSearchResult=()=>{},liveMetrics={estimates:2},nav=[['settings','Templates',Settings]];
document.documentElement.dataset.theme=theme;window.fixtureTemplates=FIRE_TEMPLATES;
return <main className="app-shell">${sidebar}<section className="main-area"><button onClick={()=>setMobileMenu(!mobileMenu)}>Toggle menu</button><button onClick={()=>{const t=theme==='light'?'dark':'light';setTheme(t);localStorage.setItem('fire-theme',t)}}>Toggle theme</button><SettingsView/></section></main>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let saved,puts=0;
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/api/message-templates'){
  res.setHeader('content-type','application/json');
  if(req.method==='PUT'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{saved=JSON.parse(body);puts++;const agreement=saved.key==='contractTerms';res.end(JSON.stringify({template:{...saved,channel:agreement?'document':'both',category:agreement?'Documents':'Estimates',name:agreement?'Service agreement':'Estimate ready'}}));});}
  else res.end(JSON.stringify({}));
 }else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;let browser,count=0;
const check=(ok,label)=>{assert.ok(ok,label);count++;};const errors=[],outside=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(outside.push(r.request().url()),r.abort()));
 for(const width of [320,390,768,1024,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.locator('#templateBody').waitFor();
  await page.evaluate(t=>{localStorage.setItem('fire-theme',t)},theme);await page.reload();await page.locator('#templateBody').waitFor();
  check(await page.locator('html').getAttribute('data-theme')===theme,`${width}/${theme}: persisted theme applied`);
  for(const name of ['Service Agreement','Estimate Ready']){
   const choice=page.locator('.template-list button').filter({hasText:name});await choice.click();
   await page.locator('#templateBody').fill('Synthetic long unbroken URL https://example.invalid/'+('x'.repeat(1200))+'\n'+('Long agreement paragraph. '.repeat(400)));
   await page.locator('#templateBody').press('End');await page.locator('#templateBody').press('Enter');await page.locator('#templateBody').pressSequentially('Still editable');
   const geometry=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,boxes:[...document.querySelectorAll('.template-layout,.template-editor,.template-editor input,.template-editor textarea,.template-editor footer button,.merge-tags button')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right}})}));
   check(geometry.page<=width+1,`${width}/${theme}/${name}: no page-level horizontal overflow`);
   check(geometry.boxes.every(r=>r.left>=-1&&r.right<=width+1),`${width}/${theme}/${name}: editor fields/actions remain within viewport`);
   check((await page.locator('#templateBody').inputValue()).includes('Still editable'),`${name}: text editing preserved`);
   await page.getByRole('button',{name:'Save template',exact:true}).click();await page.getByText('Template saved.',{exact:true}).waitFor();
   check(saved.body.includes('x'.repeat(1200))&&saved.body.includes('Still editable'),`${name}: exact long text reaches save handler`);
  }
  if(width<=760)await page.getByRole('button',{name:'Toggle menu',exact:true}).click();
  await page.waitForTimeout(300);
  const colors=await page.locator('.sidebar').evaluate(n=>({bg:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,selected:getComputedStyle(n.querySelector('nav button.active')).backgroundColor}));
  check(colors.bg===(theme==='light'?'rgb(255, 255, 255)':'rgb(13, 27, 47)'),`${width}/${theme}: sidebar follows theme`);
  check(colors.selected!==colors.bg,`${width}/${theme}: selected navigation distinguishable`);
  check(await page.locator('.sidebar-foot').isVisible(),`${width}/${theme}: owner account retained`);
 }
 check(puts===20,'One save per explicit confirmation; no automatic saves');
 check(errors.length===0&&outside.length===0,`No runtime errors/external requests: ${errors}`);
 console.log(`PASS ${count} template/sidebar browser assertions; real shared JSX and compiled CSS. Chromium synthetic fixture, not native iOS or hosted acceptance.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
