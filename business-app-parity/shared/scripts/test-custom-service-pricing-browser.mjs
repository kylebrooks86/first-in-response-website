/** Actual owner pricing components + actual API on disposable SQLite; Chrome only. */
import assert from 'node:assert/strict';import{createRequire}from'node:module';import{readFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{createServer}from'node:http';import{pricingRuntime}from'./pricing-test-runtime.mjs';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss'),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PricingSettings,useServicePricing}from'./components/service-pricing';import{EstimateLinePricing}from'./components/estimate-line-pricing';import{editMoneyLine,editableLineTotalCents}from'./lib/editable-line-totals';
function Fixture(){const[theme,setTheme]=useState('light'),[open,setOpen]=useState(false),[line,setLine]=useState({quantity:1660,unitRateCents:22});const pricing=useServicePricing(open);document.documentElement.dataset.theme=theme;window.line=line;return <main style={{padding:12,maxWidth:1000,margin:'auto'}}><button onClick={()=>setTheme(theme==='light'?'dark':'light')}>Toggle theme</button><button onClick={()=>setOpen(!open)}>Open quote</button>{open&&<section aria-label="Synthetic quote"><button disabled={!pricing.rates||pricing.loading||Boolean(pricing.error)} onClick={()=>setLine({quantity:1660,unitRateCents:pricing.services.find(s=>s.id==='house-wash').rate})}>Add house wash</button><EstimateLinePricing label="test-line" item={line} standardRate={pricing.rates?pricing.services.find(s=>s.id==='house-wash').rate:undefined} onChange={patch=>setLine(current=>editMoneyLine(current,patch))}/><label htmlFor="test-quantity">Measured quantity</label><input id="test-quantity" value={line.quantity} onChange={e=>setLine(current=>editMoneyLine(current,{quantity:Number(e.target.value)}))}/><output aria-label="Line total">{editableLineTotalCents(line)}</output></section>}<PricingSettings/></main>};createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const runtime=pricingRuntime();let mode='normal',puts=0,release,onHeld;const server=createServer(async(req,res)=>{res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css.css);}
 if(req.url==='/api/service-pricing'){
  if(req.method==='PUT'){puts++;let body='';for await(const chunk of req)body+=chunk;const response=await runtime.api.PUT(new Request('https://synthetic.invalid/api/service-pricing',{method:'PUT',body}));const raw=await response.text();if(mode==='hold')await new Promise(r=>{release=r;onHeld?.();});res.setHeader('content-type','application/json');res.statusCode=response.status;return res.end(mode==='lost'?'not-json':raw);}
  const response=await runtime.api.GET();res.setHeader('content-type','application/json');res.statusCode=response.status;return res.end(await response.text());
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}res.statusCode=404;res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[];const check=(ok,label)=>{assert.ok(ok,label);checks++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.locator('#standard-house-wash').waitFor();if(theme==='dark')await page.getByRole('button',{name:'Toggle theme'}).click();
  check(await page.locator('.pricing-grid article').count()===58,'All 58 services visible');
  await page.locator('#pricing-search').fill('house');check(await page.locator('.pricing-grid article').count()===1,'Service search narrows choices');await page.locator('#pricing-search').fill('');
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.pricing-grid input,.pricing-grid button')].map(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,height:r.height,font:parseFloat(getComputedStyle(n).fontSize)}})}));check(geometry.scroll<=width+1,'No horizontal overflow');check(geometry.controls.every(r=>r.left>=0&&r.right<=width+1&&r.height>=43),'Inputs and buttons fit and have touch targets');
  if(process.env.FIRE_PRICING_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_PRICING_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FIRE_PRICING_SCREENSHOT_DIR,`pricing-${width}-${theme}.png`),fullPage:false});}
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.locator('#standard-house-wash').waitFor();await page.getByRole('button',{name:'Open quote',exact:true}).click();const quote=page.getByRole('region',{name:'Synthetic quote'});await quote.getByRole('button',{name:'Add house wash'}).click();await page.getByLabel('Line total').filter({hasText:'36520'}).waitFor();
 const rate=page.locator('#standard-house-wash'),card=page.locator('.pricing-grid article').filter({has:rate});await rate.fill('0.25');mode='hold';const before=puts;const held=new Promise(r=>onHeld=r);await card.getByRole('button',{name:'Save standard'}).evaluate(button=>{button.click();button.click();});await page.waitForFunction(()=>document.querySelector('#standard-house-wash')?.disabled);await held;check(puts===before+1,'Double tap submits once');release();mode='normal';await card.getByRole('status').waitFor();await page.locator('#pricing-search').fill('fence');await page.locator('#pricing-search').fill('');check(await rate.inputValue()==='0.25','Saved standard survives filtering');check(await page.getByLabel('Line total').innerText()==='36520','Confirmed standard change never reprices selected draft');
 await page.getByRole('button',{name:'Open quote',exact:true}).click();await page.getByRole('button',{name:'Open quote',exact:true}).click();await quote.getByRole('button',{name:'Add house wash'}).click();check(await page.getByLabel('Line total').innerText()==='41500','Future selection uses current saved standard');
 const price=page.locator('#test-line-price');await price.fill('.20');await page.getByLabel('Line total').filter({hasText:'33200'}).waitFor();check(await page.getByLabel('Line total').innerText()==='33200','Reduced one-time rate');await quote.getByRole('button',{name:'Flat service price',exact:true}).click();await price.fill('300.01');await page.locator('#test-quantity').fill('2000');await page.getByLabel('Line total').filter({hasText:'30001'}).waitFor();check(await page.getByLabel('Line total').innerText()==='30001','Flat price independent of measurement');await quote.getByRole('button',{name:'Reset to standard'}).click();await page.getByLabel('Line total').filter({hasText:'50000'}).waitFor();check(await page.getByLabel('Line total').innerText()==='50000','Reset uses current standard and retained quantity');
 await price.fill('1.005');check(await price.getAttribute('aria-invalid')==='true','Fractional cents refused');await quote.getByRole('button',{name:'Reset to standard'}).click();
 mode='lost';await rate.fill('0.27');await card.getByRole('button',{name:'Save standard'}).click();await card.getByRole('alert').waitFor();check(await rate.inputValue()==='0.27','Interrupted response retains entry');check(await card.getByRole('button',{name:'Save standard'}).isDisabled(),'Unconfirmed save blocks blind retry');mode='normal';await page.getByRole('button',{name:'Refresh standard prices'}).click();await card.getByText('currently $0.27',{exact:false}).waitFor();check(await card.getByRole('button',{name:'Save standard'}).isDisabled(),'Readback recognizes committed value');
 const other=await browser.newPage();await other.goto(origin);await other.locator('#standard-house-wash').waitFor();check(await other.locator('#standard-house-wash').inputValue()==='0.27','Independent page sees confirmed default');await other.locator('#standard-house-wash').fill('0.31');await other.locator('.pricing-grid article').filter({has:other.locator('#standard-house-wash')}).getByRole('button',{name:'Save standard'}).click();await other.locator('.pricing-grid article').filter({has:other.locator('#standard-house-wash')}).getByRole('status').waitFor();await other.close();
 await page.getByRole('button',{name:'Refresh standard prices'}).click();await card.getByText('currently $0.31',{exact:false}).waitFor();check(await rate.inputValue()==='0.31','External-device refresh updates editable amount, not only current label');check(await card.getByRole('button',{name:'Save standard'}).isDisabled(),'Refreshed amount cannot accidentally save a stale old default');
 // Real catalog metadata and custom-service management on narrow light/dark screens.
 for(const theme of ['light','dark']){
  await page.setViewportSize({width:320,height:844});await page.goto(origin);await page.locator('#standard-deck').waitFor();if(theme==='dark')await page.getByRole('button',{name:'Toggle theme'}).click();
  await page.locator('#pricing-search').fill('deck');const deckCard=page.locator('.pricing-grid article').filter({has:page.locator('#standard-deck')});
  await deckCard.locator('summary').click();await page.locator('#catalog-name-deck').fill('Deck Cleaning '+theme);await page.locator('#catalog-unit-deck').selectOption('each');await page.locator('#catalog-description-deck').fill('Owner reviewed '+theme);await page.locator('#standard-deck').fill('0.45');await deckCard.getByRole('button',{name:'Save standard'}).click();await deckCard.getByRole('status').waitFor();
  check((await runtime.get()).data.rates.find(s=>s.id==='deck').details.unit==='each','Saved editable master unit '+theme);
  check(await page.evaluate(()=>document.documentElement.scrollWidth)<=320,'Expanded metadata fits narrow '+theme);
  await deckCard.getByRole('checkbox').uncheck();await deckCard.getByRole('button',{name:'Save standard'}).click();await page.waitForFunction(()=>!document.querySelector('#standard-deck'));
  await page.locator('#pricing-category').selectOption('inactive');await page.locator('#standard-deck').waitFor();check(await page.locator('#standard-deck').inputValue()==='0.45','Inactive master keeps saved rate');
  await page.locator('.pricing-grid article').locator('summary').click();await page.locator('.pricing-grid article').getByRole('checkbox').check();await page.locator('.pricing-grid article').getByRole('button',{name:'Save standard'}).click();await page.waitForFunction(()=>!document.querySelector('#standard-deck'));
  await page.locator('#pricing-category').selectOption('all');await page.locator('#standard-deck').waitFor();check(await page.locator('#standard-deck').inputValue()==='0.45','Reactivation preserves identity and rate');
 }
 await page.locator('#pricing-search').fill('');await page.getByRole('button',{name:'Add service',exact:true}).click();
 const added=page.locator('.pricing-settings>article');await added.getByLabel('Name',{exact:true}).fill('Synthetic new catalog service');await added.getByLabel('Billing unit').selectOption('linear ft');await added.locator('input[inputmode="decimal"]').fill('2.25');mode='lost';await added.getByRole('button',{name:'Save service',exact:true}).click();await added.getByRole('alert').waitFor();check(await added.getByRole('button',{name:'Save service',exact:true}).isDisabled(),'Lost custom creation response blocks blind second creation');mode='normal';const savedWrites=puts;await page.getByRole('button',{name:'Refresh standard prices'}).click();await added.waitFor({state:'detached'});await page.locator('#pricing-search').fill('Synthetic new catalog');
 check(await page.locator('.pricing-grid article').count()===1,'Readback finds exactly one custom service after lost creation receipt');check(puts===savedWrites,'Readback creates no duplicate write');
 const custom=(await runtime.get()).data.rates.find(s=>s.details?.name==='Synthetic new catalog service');check(custom.rateCents===225&&custom.details.unit==='linear ft','Exact custom default retained');
 // Explicit owner Delete/Restore applies to original catalog services, not just custom entries.
 await page.locator('#pricing-search').fill('Window Frame Oxidation Removal');
 const obsoleteCard=page.locator('.pricing-grid article').filter({has:page.locator('#standard-window-oxidation')});
 page.once('dialog',d=>d.dismiss());
 await obsoleteCard.getByRole('button',{name:'Delete service'}).click();
 check(await page.locator('#standard-window-oxidation').count()===1,'Cancel deletion retains original service');
 page.once('dialog',d=>d.accept());
 await obsoleteCard.getByRole('button',{name:'Delete service'}).click();
 await page.locator('#standard-window-oxidation').waitFor({state:'detached'});
 check(!(await runtime.get()).data.rates.find(x=>x.id==='window-oxidation').details.active,'Generic window oxidation removed from active catalog');
 check(await page.locator('#standard-window-oxidation-1f').count()===1&&await page.locator('#standard-window-oxidation-2f').count()===1,'Distinct first and second floor services retained');
 await page.locator('#pricing-category').selectOption('inactive');
 await page.locator('#standard-window-oxidation').waitFor();
 await obsoleteCard.getByRole('button',{name:'Restore service'}).click();
 await page.locator('#standard-window-oxidation').waitFor({state:'detached'});
 await page.locator('#pricing-category').selectOption('all');
 await page.locator('#standard-window-oxidation').waitFor();
 check((await runtime.get()).data.rates.find(x=>x.id==='window-oxidation').details.active,'Deleted original service restores under same ID');
 // Owner can delete even a numbered QuoteIQ entry without deleting its historical identity.
 await page.locator('#pricing-search').fill('1st Floor Window Frame Oxidation Removal');
 const numberedCard=page.locator('.pricing-grid article').filter({has:page.locator('#standard-window-oxidation-1f')});
 page.once('dialog',d=>d.accept());await numberedCard.getByRole('button',{name:'Delete service'}).click();
 await page.locator('#standard-window-oxidation-1f').waitFor({state:'detached'});
 check((await runtime.get()).data.rates.find(x=>x.id==='window-oxidation-1f').details.active===false,'Numbered QuoteIQ entry can be deleted');
 await page.locator('#pricing-category').selectOption('inactive');
 await page.locator('#standard-window-oxidation-1f').waitFor();
 await numberedCard.getByRole('button',{name:'Restore service'}).click();
 await page.locator('#pricing-category').selectOption('all');
 await page.locator('#standard-window-oxidation-1f').waitFor();
 check((await runtime.get()).data.rates.find(x=>x.id==='window-oxidation-1f').details.active,'Numbered QuoteIQ entry can be restored');
 // Owner-created custom items expose identical lifecycle controls.
 await page.locator('#pricing-search').fill('Synthetic new catalog service');
 const addedCard=page.locator('.pricing-grid article').filter({has:page.locator('#standard-'+custom.id)});
 page.once('dialog',d=>d.accept());await addedCard.getByRole('button',{name:'Delete service'}).click();
 await page.locator('#standard-'+custom.id).waitFor({state:'detached'});
 check((await runtime.get()).data.rates.find(x=>x.id===custom.id).details.active===false,'Custom service can be deleted');
 await page.locator('#pricing-category').selectOption('inactive');
 await page.locator('#standard-'+custom.id).waitFor();
 await addedCard.getByRole('button',{name:'Restore service'}).click();
 await page.locator('#pricing-category').selectOption('all');
 await page.locator('#standard-'+custom.id).waitFor();
 check((await runtime.get()).data.rates.find(x=>x.id===custom.id).details.active,'Custom service can be restored');
 check(await page.evaluate(()=>document.documentElement.scrollWidth)<=320,'Delete and restore controls fit 320px');
 check(errors.length===0,'No browser exceptions: '+errors.join(';'));console.log('PASS '+checks+' actual pricing mobile light/dark checks with SQLite API: defaults, search, touch geometry, duplicate taps, future-only rates, flat/reset and interrupted-save readback.');
}finally{await browser?.close();await new Promise(r=>server.close(r));runtime.db.close();}
