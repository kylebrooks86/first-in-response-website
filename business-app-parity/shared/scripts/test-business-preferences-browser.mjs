/** Real repeat-service settings UI after removing the availability editor. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const require=createRequire(import.meta.url),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild'),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright'),postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const bundle=(await esbuild.build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{BusinessPreferencesPanel}from'./components/business-preferences';function Fixture(){const[theme,setTheme]=useState('light');document.documentElement.dataset.theme=theme;return <main style={{padding:12,maxWidth:900,margin:'auto'}}><button onClick={()=>setTheme(theme==='light'?'dark':'light')}>Theme</button><details open><summary>Repeat-service reminders</summary><BusinessPreferencesPanel mode="repeat"/></details></main>};createRoot(document.getElementById('app')).render(<Fixture/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0].text;
const css=(await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')})).css,r=stackedRuntime(),api=r.load('app/api/business-preferences/route.ts'),pricing=r.load('app/api/service-pricing/route.ts');let lost=false,puts=0;
const server=createServer(async(req,res)=>{if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle);}if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css);}if(req.url==='/api/service-pricing'){const response=await pricing.GET();res.setHeader('content-type','application/json');return res.end(await response.text());}if(req.url==='/api/business-preferences'){let response;if(req.method==='PUT'){puts++;let body='';for await(const c of req)body+=c;response=await api.PUT(new Request('https://synthetic.invalid/api/business-preferences',{method:'PUT',body}));}else response=await api.GET();res.setHeader('content-type','application/json');res.statusCode=response.status;return res.end(lost&&req.method==='PUT'?'lost receipt':await response.text());}res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;let browser,count=0;
const check=(v,m)=>{assert.ok(v,m);count++;};const evidence=[];
try{
 browser=await chromium.launch({executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,375,390,430,768,1366])for(const dark of [false,true]){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.getByLabel('Find service').waitFor();
  if(dark)await page.getByRole('button',{name:'Theme',exact:true}).click();
  check(await page.getByRole('button',{name:'Save settings',exact:true}).isDisabled(),'Unchanged repeat settings cannot write');
  check(await page.getByText('My availability').count()===0,'Retired availability panel absent');
  check(await page.locator('#availability-date,#availability-start,#availability-end,#availability-label').count()===0,'Retired availability inputs absent');
  const g=await page.evaluate(()=>{
   const rect=n=>{let b=n.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,height:b.height};};
   const input=document.querySelector('#repeat-service-search');
   return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,search:rect(input)};
  });
  check(g.pageWidth<=g.width+1,'Repeat settings fit at '+width+'/'+dark+': '+JSON.stringify(g));
  check(g.search.height>=44&&g.search.left>=0&&g.search.right<=g.width,'Repeat search touch and viewport fit '+width+'/'+dark);
  await page.getByLabel('Find service').fill('roof');await page.locator('#repeat-roof-wash').waitFor();
  const row=await page.locator('#repeat-roof-wash').evaluate(n=>{let b=n.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height};});
  check(row.height>=44&&row.left>=0&&row.right<=width+1,'Native repeat dropdown fits '+width+'/'+dark);
  evidence.push({width,dark,...g,row});
 }
 if(process.env.FIRE_UX_AUDIT_DIR){mkdirSync(process.env.FIRE_UX_AUDIT_DIR,{recursive:true});writeFileSync(resolve(process.env.FIRE_UX_AUDIT_DIR,'repeat-settings-control-bounds.json'),JSON.stringify(evidence,null,2));}
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByLabel('Find service').waitFor();
 await page.getByLabel('Find service').fill('roof');await page.locator('#repeat-roof-wash').selectOption('18');
 await page.getByRole('button',{name:'Save settings',exact:true}).evaluate(b=>{b.click();b.click();});
 await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();check(puts===1,'Double tap sends only one repeat-setting write');
 let stored=(await(await api.GET()).json()).preferences;check(stored.repeatMonths['roof-wash']===18&&stored.blocks.length===0,'Service interval saved with no availability blocks');
 await page.locator('#repeat-roof-wash').selectOption('0');lost=true;
 await page.getByRole('button',{name:'Save settings',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Save not confirmed'}).waitFor();check(await page.getByRole('button',{name:'Save settings',exact:true}).isDisabled(),'Uncertain receipt blocks blind replay');
 lost=false;const before=puts;page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Refresh settings',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#repeat-roof-wash')?.value==='0');
 await page.waitForFunction(()=>!document.querySelector('.business-preferences fieldset')?.disabled);
 check(puts===before,'Readback confirms saved off switch without duplicate write');
 check(await page.getByRole('alert').count()===0,'Readback clears uncertain save');
 check(errors.length===0,'No browser errors');
 console.log('PASS '+count+' repeat-only settings mobile, retired availability UI and save reconciliation checks.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));r.db.close();}
