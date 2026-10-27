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
const fixture=`import React,{Fragment,useState,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';
import{FileText,MessageSquareText,ChevronRight,ChevronDown,Save,X,Settings}from'lucide-react';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Input}from'./components/ui/input';import{Textarea}from'./components/ui/textarea';
import{PricingSettings}from'./components/service-pricing';import{BusinessPreferencesPanel}from'./components/business-preferences';
import{FIRE_TEMPLATES,type FireTemplate}from'./lib/fire-templates';import{GlobalSearch}from'./components/global-search';
const statusLabel=(v:string)=>v.replaceAll('_',' ').replace(/^./,v=>v.toUpperCase());
function FireMark(){return <span className="fire-mark">F</span>}
${settings}
function Fixture(){const[mobileMenu,setMobileMenu]=useState(false),[moreNavOpen,setMoreNavOpen]=useState(false),[theme,setTheme]=useState(localStorage.getItem('fire-theme')||'light');
const interactive=true,tab='settings',setTab=()=>{},globalQuery='',setGlobalQuery=()=>{},openSearchResult=()=>{},liveMetrics={estimates:2},nav=[['settings','Templates',Settings]];
document.documentElement.dataset.theme=theme;window.fixtureTemplates=FIRE_TEMPLATES;
return <main className="app-shell">${sidebar}<section className="main-area"><button onClick={()=>setMobileMenu(!mobileMenu)}>Toggle menu</button><button onClick={()=>{const t=theme==='light'?'dark':'light';setTheme(t);localStorage.setItem('fire-theme',t)}}>Toggle theme</button><SettingsView/></section></main>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const templateModule=await esbuild.build({stdin:{contents:"export{FIRE_TEMPLATES}from'./lib/fire-templates';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
const {FIRE_TEMPLATES}=await import('data:text/javascript;base64,'+Buffer.from(templateModule.outputFiles[0].text).toString('base64'));
let saved,puts=0;
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/api/business-preferences'){res.setHeader('content-type','application/json');res.end(JSON.stringify({preferences:{revision:null,blocks:[],repeatMonths:{}}}));}
 else if(req.url==='/api/message-templates'){
  res.setHeader('content-type','application/json');
  if(req.method==='PUT'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{saved=JSON.parse(body);puts++;const agreement=saved.key==='contractTerms';res.end(JSON.stringify({template:{...FIRE_TEMPLATES.find(item=>item.key===saved.key),...saved}}));});}
  else res.end(JSON.stringify({templates:FIRE_TEMPLATES}));
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
 for(const width of [320,375,390,430,768,1024,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.locator('#templateBody').waitFor();await page.waitForFunction(()=>!document.querySelector('#templateBody').disabled);
  await page.evaluate(t=>{localStorage.setItem('fire-theme',t)},theme);await page.reload();await page.locator('#templateBody').waitFor();await page.waitForFunction(()=>!document.querySelector('#templateBody').disabled);
  check(await page.locator('html').getAttribute('data-theme')===theme,`${width}/${theme}: persisted theme applied`);
  if(process.env.FIRE_UI_SCREENSHOT_DIR&&width===390)await page.screenshot({path:resolve(process.env.FIRE_UI_SCREENSHOT_DIR,`settings-${theme}.png`),fullPage:true});
  if(width<=760){
   check(await page.getByLabel('Template',{exact:true}).isVisible(),`${width}/${theme}: compact template picker visible`);
   check(!(await page.locator('.template-list').isVisible()),`${width}/${theme}: long template directory does not precede editor`);
   check((await page.locator('.template-editor').boundingBox()).y<400,`${width}/${theme}: editor starts in first screen`);
   const picker=page.getByLabel('Template',{exact:true}),original=await picker.inputValue();
   await page.locator('#templateBody').fill('Synthetic unsaved edit');
   page.once('dialog',dialog=>dialog.dismiss());await picker.selectOption('contractTerms');
   check(await picker.inputValue()===original&&(await page.locator('#templateBody').inputValue())==='Synthetic unsaved edit',`${width}/${theme}: cancel keeps both selection and unsaved text`);
   page.once('dialog',dialog=>dialog.accept());await picker.selectOption('contractTerms');
   check(await picker.inputValue()==='contractTerms',`${width}/${theme}: confirmed selection opens agreement`);
  }
  for(const name of ['Service Agreement','Estimate Ready']){
   if(width<=760){
    const key=await page.evaluate(name=>window.fixtureTemplates.find(t=>t.name.toLowerCase()===name.toLowerCase()).key,name);
    await page.getByLabel('Template',{exact:true}).selectOption(key);
   }else await page.locator('.template-list button').filter({hasText:name}).click();
   await page.locator('#templateBody').fill('Synthetic long unbroken URL https://example.invalid/'+('x'.repeat(1200))+'\n'+('Long agreement paragraph. '.repeat(400)));
   await page.locator('#templateBody').press('End');await page.locator('#templateBody').press('Enter');await page.locator('#templateBody').pressSequentially('Still editable');
   const geometry=await page.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,boxes:[...document.querySelectorAll('.template-layout,.template-editor,.template-editor input,.template-editor textarea,.template-editor footer button,.merge-tags button')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right}})}));
   check(geometry.page<=width+1,`${width}/${theme}/${name}: no page-level horizontal overflow`);
   check(geometry.boxes.every(r=>r.left>=-1&&r.right<=width+1),`${width}/${theme}/${name}: editor fields/actions remain within viewport`);
   if(width<=760)check(await page.locator('.template-editor footer button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.height<=80})),`${width}/${theme}: Save and Restore are compact tap targets, not 130px flex columns`);
   check((await page.locator('#templateBody').inputValue()).includes('Still editable'),`${name}: text editing preserved`);
   if(name==='Estimate Ready'){
    const fields=page.locator('.template-fields');check(!(await fields.getByRole('button').first().isVisible()),'Optional field tokens start collapsed');
    await fields.locator('summary').click();await fields.getByRole('button',{name:'@customer_first_name',exact:true}).click();
    check((await page.locator('#templateBody').inputValue()).includes('@customer_first_name'),'Personalized fields still insert into actual draft');
   }
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
 check(puts===28,'One save per explicit confirmation; no automatic saves');
 // Exercise actual SettingsView recovery instead of silently editing fallback defaults.
 await page.setViewportSize({width:390,height:844});
 let failLoad=true,pendingSave=null,wrongReceipt=false,saveRequests=0;
 await page.route('**/api/message-templates',async route=>{
  if(route.request().method()==='GET'){
   if(failLoad)return route.abort('failed');return route.continue();
  }
  saveRequests++;pendingSave=route;
 });
 await page.reload();await page.getByRole('alert').filter({hasText:'Templates could not be loaded'}).waitFor();
 check(await page.locator('#templateBody').isDisabled(),'Failed load prevents editing unknown saved template state');
 check(await page.getByRole('button',{name:'Save template',exact:true}).isDisabled(),'Failed load cannot overwrite templates with fallback defaults');
 failLoad=false;await page.getByRole('button',{name:'Retry templates',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#templateBody').disabled);
 check(await page.getByRole('alert').count()===0,'Explicit retry restores saved templates and clears load error');
 await page.locator('#templateBody').fill('Synthetic retry-safe template body');
 await page.getByRole('button',{name:'Save template',exact:true}).evaluate(button=>{button.click();button.click();});
 await page.waitForFunction(()=>document.querySelector('#templateBody').disabled);
 check(saveRequests===1,'Rapid same-tick template saves send one request');
 check(await page.getByLabel('Template',{exact:true}).isDisabled(),'Template selection is locked while saving the current record');
 check(await page.locator('#templateBody').isDisabled(),'In-flight save cannot overwrite newer typed text');
 for(let n=0;n<100&&!pendingSave;n++)await page.waitForTimeout(20);
 assert.ok(pendingSave,'Expected pending synthetic save');
 await pendingSave.fulfill({status:200,contentType:'application/json',body:JSON.stringify({template:{...FIRE_TEMPLATES.find(t=>t.key==='invoice')}})});
 await page.getByText('Template save could not be confirmed. Your edits are retained.',{exact:true}).waitFor();
 check(await page.locator('#templateBody').inputValue()==='Synthetic retry-safe template body','Wrong-template receipt retains the exact unsaved draft');
 check(await page.getByLabel('Template',{exact:true}).inputValue()==='estimate','Wrong receipt cannot switch the selected template');
 pendingSave=null;await page.getByRole('button',{name:'Save template',exact:true}).click();
 for(let n=0;n<100&&!pendingSave;n++)await page.waitForTimeout(20);
 assert.ok(pendingSave);await pendingSave.continue();await page.getByText('Template saved.',{exact:true}).waitFor();
 check(saveRequests===2,'Owner retry works after rejected receipt');
 check(await page.locator('#templateBody').inputValue()==='Synthetic retry-safe template body','Verified receipt preserves the saved content');
 await page.unroute('**/api/message-templates');

 check(errors.length===0&&outside.length===0,`No runtime errors/external requests: ${errors}`);
 console.log(`PASS ${count} template/sidebar browser assertions; real shared JSX and compiled CSS. Chromium synthetic fixture, not native iOS or hosted acceptance.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
