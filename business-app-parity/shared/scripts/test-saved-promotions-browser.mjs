/** Real saved-promotion Settings component in Chrome with synthetic owner API; no hosted data. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss'),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const fixture=String.raw`import React from 'react';import{createRoot}from'react-dom/client';import{SavedPromotionsSettings}from'./components/saved-promotions';
createRoot(document.getElementById('app')).render(<main style={{maxWidth:800,margin:'auto',padding:12}}><SavedPromotionsSettings/></main>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'promo-fixture.tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const styles=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let stored={revision:null,promotions:[]},puts=0,mode='normal';
const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(styles.css);}
 if(req.url==='/api/saved-promotions'){
  res.setHeader('content-type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify({catalog:stored}));
  if(req.method==='PUT'){puts++;let payload='';for await(const chunk of req)payload+=chunk;
   const input=JSON.parse(payload);
   if(input.expectedRevision!==stored.revision){res.statusCode=409;return res.end(JSON.stringify({error:'Stale version'}));}
   stored={revision:randomUUID(),promotions:input.promotions};
   return res.end(mode==='lost'?'{bad':JSON.stringify({catalog:stored}));
  }
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const errors=[];const check=(value,label)=>{assert.ok(value,label);checks++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
 await page.route('**/*',request=>new URL(request.request().url()).origin===origin?request.continue():request.abort());
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  await page.getByRole('button',{name:'Add promotion'}).waitFor();
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.getByRole('button',{name:'Add promotion'}).click();
  const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.rounded-xl button')].map(x=>{const r=x.getBoundingClientRect();return{l:r.left,r:r.right,h:r.height};})}));
  check(bounds.scroll<=width+1,'No promotion editor overflow at '+width+'/'+theme);
  check(bounds.buttons.every(b=>b.l>=0&&b.r<=width+1&&b.h>=42),'Promotion touch controls fit mobile width at '+width+'/'+theme);
  if(process.env.FIRE_PROMOTION_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_PROMOTION_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FIRE_PROMOTION_SCREENSHOT_DIR,'saved-promo-'+width+'-'+theme+'.png'),fullPage:false});}
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Add promotion'}).click();
 await page.locator('#fire-promo-name').fill('October 15%');
 await page.locator('#fire-promo-start').fill('2026-10-01');
 await page.locator('#fire-promo-end').fill('2026-10-31');
 await page.locator('#fire-promo-date-basis').selectOption('booking-confirmed');
 check(await page.getByText('This offer is pending until booking is confirmed', {exact:false}).isVisible(),'Booking condition shown before save');
 await page.getByRole('button',{name:'Keep promotion in draft'}).click();
 const count=puts;await page.getByRole('button',{name:'Save promotion changes'}).evaluate(n=>{n.click();n.click();});
 await page.getByText('Saved promotion rules are verified', {exact:false}).waitFor();
 check(puts===count+1,'Fast repeated taps send only one owner settings write');
 check(stored.promotions.length===1&&stored.promotions[0].valueCents===1500,'October percentage saved in basis points');
 await page.reload();await page.getByText('October 15%',{exact:true}).waitFor();
 check(await page.getByText('Booking required',{exact:false}).isVisible(),'Saved booking rule reopens intact');
 await page.getByRole('button',{name:'Add promotion'}).click();
 await page.locator('#fire-promo-name').fill('House + gutters bundle');
 await page.locator('#fire-promo-type').selectOption('dollar');
 await page.locator('#fire-promo-amount').fill('25.00');
 await page.locator('details summary').click();
 await page.getByLabel('House Wash',{exact:true}).check();
 await page.getByLabel('Gutter Cleaning + Flush',{exact:true}).check();
 await page.getByRole('button',{name:'Keep promotion in draft'}).click();
 await page.getByRole('button',{name:'Save promotion changes'}).click();
 await page.getByText('Saved promotion rules are verified',{exact:false}).waitFor();
 check(stored.promotions.length===2,'Overlapping percentage and dollar promotions saved');
 check(stored.promotions[1].valueCents===2500&&stored.promotions[1].requiredServiceIds.length===2,'Flat bundle with both required services persisted');
 await page.reload();await page.getByText('House + gutters bundle',{exact:true}).waitFor();
 check(await page.getByText('25.00',{exact:false}).count()>0,'Saved flat discount visible after reopening');
 const article=page.locator('article').filter({hasText:'House + gutters bundle'});
 await article.getByRole('button',{name:'Pause'}).click();
 await page.getByRole('button',{name:'Save promotion changes'}).click();
 await page.getByText('Saved promotion rules are verified',{exact:false}).waitFor();
 check(stored.promotions[1].enabled===false,'Pause state persists without deleting a rule');
 await page.getByRole('button',{name:'Add promotion'}).click();
 await page.locator('#fire-promo-amount').fill('-1');
 check(await page.getByRole('button',{name:'Keep promotion in draft'}).isDisabled(),'Malformed discount disabled before save');
 stored={revision:null,promotions:[]};const beforePresets=puts;await page.goto(origin);
 await page.getByRole('button',{name:'Add FIRE October + bundle examples'}).click();
 check(puts===beforePresets,'Preset suggestions are drafts, not automatic server writes');
 check(await page.locator('article').count()===2,'Two familiar FIRE preset suggestions staged');
 await page.getByRole('button',{name:'Save promotion changes'}).click();
 await page.getByText('Saved promotion rules are verified',{exact:false}).waitFor();
 check(stored.promotions.length===2&&stored.promotions[0].dateBasis==='booking-confirmed','October preset keeps booking deadline rather than promising immediate savings');
 check(stored.promotions[1].valueCents===2500&&stored.promotions[1].requiredServiceIds.includes('gutters'),'Bundle preset requires house wash and gutters');
 check(errors.length===0,'No browser exceptions: '+errors.join(';'));
 console.log('PASS '+checks+' actual saved promotions Settings Chrome checks: mobile light/dark, add, save, duplicate tap, reload, booking, multi-rule services, pause and invalid entry.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
