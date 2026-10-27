/** Actual theme component + compiled shared CSS. Synthetic localhost only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{OwnerPreviewTheme}from'./components/owner-preview-theme';
createRoot(document.getElementById('app')).render(<main className={'pay-page owner-estimate-preview'+(location.pathname==='/invoice'?' invoice-page':'')}><OwnerPreviewTheme/>
<a className="owner-estimate-preview-close" href="/#synthetic" aria-label="Close customer view">×</a><section className="pay-card estimate-portal"><aside className="owner-preview-banner"><strong>Customer view</strong></aside>
<div className="pay-title"><h1>Synthetic customer</h1><span>Synthetic property</span></div><div className="pay-line"><div><strong>House wash</strong><p className="portal-service-description">Synthetic service description</p></div><strong>$220.00</strong></div>
<div className="pay-summary"><span><small>Total</small><strong>$220.00</strong></span><span><small>Deposit</small><strong className="red-text">$110.00</strong></span></div><div className="contract-box">{'Synthetic legal text. '.repeat(200)}</div><div style={{height:800}}/><div className="secure-note">Synthetic private link</div></section></main>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript; charset=utf-8');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css; charset=utf-8');res.end(css.css);}
 else{res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[];
const check=(value,label)=>{assert.ok(value,label);checks++;};
function contrast(a,b){const lum=v=>{const c=v.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const width of [320,375,390,430,768])for(const theme of ['light','dark'])for(const kind of ['invoice','estimate']){
  await page.setViewportSize({width,height:668});await page.goto(origin+'/'+kind);await page.evaluate(t=>localStorage.setItem('fire-theme',t),theme);await page.reload();
  await page.getByRole('button',{name:`Switch to ${theme==='dark'?'light':'dark'} mode`,exact:true}).waitFor();
  check(await page.locator('html').getAttribute('data-theme')===theme,`${width}/${kind}: saved ${theme} loaded`);
  const toggle=page.locator('.owner-preview-theme-toggle'),close=page.getByRole('link',{name:'Close customer view'}),a=await toggle.boundingBox(),b=await close.boundingBox();
  check(a.width>=44&&a.height>=44&&a.x>=0&&a.x+a.width<=b.x-4&&Math.abs(a.y-b.y)<1&&b.x+b.width<=width,`${width}/${kind}: separate visible theme/X touch targets`);
  const colors=await page.locator('.portal-service-description').evaluate(n=>({fg:getComputedStyle(n).color,bg:getComputedStyle(n.closest('.pay-card')).backgroundColor}));
  check(contrast(colors.fg,colors.bg)>=4.5,`${width}/${kind}/${theme}: service description contrast`);
  const before=await page.locator('.pay-summary').innerText();await toggle.click();const next=theme==='dark'?'light':'dark';await page.waitForFunction(t=>document.documentElement.dataset.theme===t,next);
  check(await page.evaluate(()=>localStorage.getItem('fire-theme'))===next&&(await page.locator('.pay-summary').innerText())===before,`${kind}: saved preference, unchanged totals`);
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));check(Math.abs((await toggle.boundingBox()).y-a.y)<1,`${kind}: control fixed during scroll`);
  await page.emulateMedia({media:'print'});check(!await toggle.isVisible()&&!await close.isVisible()&&await page.locator('.pay-card').evaluate(n=>getComputedStyle(n).backgroundColor)==='rgb(255, 255, 255)',`${kind}: print hides controls and uses white paper`);await page.emulateMedia({media:'screen'});
 }
 const denied=await browser.newContext({colorScheme:'light'});
 await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Synthetic storage denied')};Storage.prototype.setItem=()=>{throw Error('Synthetic storage denied')};});
 const fallback=await denied.newPage();fallback.on('pageerror',e=>errors.push(e.message));await fallback.goto(origin+'/invoice');await fallback.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await fallback.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor();
 check(await fallback.locator('html').getAttribute('data-theme')==='dark','Theme works with localStorage denied');await denied.close();
 check(errors.length===0,'No browser runtime errors: '+errors.join('; '));console.log(`PASS ${checks} estimate/invoice preview theme checks; actual component/CSS, synthetic localhost, no hosted writes or native iOS claim.`);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
