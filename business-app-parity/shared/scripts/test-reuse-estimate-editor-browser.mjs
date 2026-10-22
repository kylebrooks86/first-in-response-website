/** Actual NewEstimate React UI; local synthetic HTTP only. */
import assert from 'node:assert/strict';import{createRequire}from'node:module';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{createServer}from'node:http';import{FIRE_SERVICES}from'../lib/fire-services.ts';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss'),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const bundle=await esbuild.build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{NewEstimate}from'./app/dashboard';createRoot(document.getElementById('app')).render(<NewEstimate/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'real-editor',setup(b){b.onLoad({filter:/app\/dashboard\.tsx$/},a=>({contents:readFileSync(a.path,'utf8')+'\nexport {NewEstimate};',loader:'tsx'}));}}]});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let previews=0,saves=0,hold=false,release,posted,receiptMismatch=null;
const server=createServer(async(req,res)=>{res.setHeader('content-type','application/json');
 if(req.url==='/api/service-pricing')return res.end(JSON.stringify({rates:FIRE_SERVICES.map(s=>({id:s.id,rateCents:s.rate,revision:null}))}));
 if(req.url.startsWith('/api/customers/lookup'))return res.end(JSON.stringify({customers:[]}));
 if(req.url==='/api/saved-promotions/preview'){previews++;let body='';for await(const c of req)body+=c;const v=JSON.parse(body);if(hold)await new Promise(r=>release=r);return res.end(JSON.stringify({revision:'synthetic',checkedOn:'2026-10-22',bookingConfirmedOn:null,eligible:[],pendingBooking:[],percentBasisPoints:0,dollarCents:0,blocked:null,previewTotalCents:Math.max(15000,v.subtotalCents),previewDepositCents:Math.round(Math.max(15000,v.subtotalCents)/2)}));}
 if(req.url==='/api/estimates'){saves++;let body='';for await(const c of req)body+=c;posted=JSON.parse(body);const total=posted.items.reduce((n,i)=>n+i.totalCents,0);const mismatch=receiptMismatch;receiptMismatch=null;return res.end(JSON.stringify({id:'synthetic',customerId:'synthetic-customer',address:posted.address,subtotalCents:total,discountCents:0,totalCents:total+(mismatch==='total'?1:0),depositCents:Math.round(total/2)+(mismatch==='deposit'?1:0),promotionAttributionSaved:true,bundleDiscountCents:0}));}
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css.css);}
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}res.statusCode=404;res.end('{}');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[],check=(v,s)=>{assert.ok(v,s);checks++;};
try{browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
for(const width of [320,390,768])for(const theme of ['light','dark']){
 const beforeSaveCount=saves;await page.setViewportSize({width,height:844});await page.goto(origin);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.getByRole('button',{name:'New estimate',exact:true}).click();await page.getByRole('button',{name:'Create New Customer',exact:false}).click();await page.getByLabel('Customer name',{exact:true}).fill('Synthetic Reuse');await page.getByLabel('Estimate service address').fill('100 Synthetic Lane, Tulsa');await page.getByRole('button',{name:'Continue to services'}).click();
 const lines=page.locator('.estimate-edit-service');await lines.nth(0).getByRole('combobox').click();await page.getByRole('option',{name:'House Wash',exact:true}).click();await lines.nth(0).locator('input[inputmode="decimal"]').first().fill('1000');await lines.nth(0).getByLabel('Service name',{exact:true}).fill('Front house');await lines.nth(0).locator('textarea').fill('Exact custom setup');
 const waitSave=amount=>page.waitForFunction(a=>[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Save $'+a+' estimate')&&!b.disabled),amount);await waitSave('220');const before=previews;hold=true;await page.getByRole('button',{name:'Reuse service setup from line 1',exact:true}).click();
 check(await lines.count()===2,'Second line inserted');check(await lines.nth(1).locator('textarea').inputValue()==='Exact custom setup','Description copied');check(await lines.nth(1).getByLabel('Service name',{exact:true}).inputValue()==='Front house','Name copied');check(await lines.nth(1).locator('input[inputmode="decimal"]').first().inputValue()==='','Blank quantity');check(await lines.nth(1).getByText('Line total $0',{exact:true}).count()===1,'Zero charge');check(await lines.nth(0).locator('input[inputmode="decimal"]').first().inputValue()==='1000','Original quantity retained');check(await page.getByRole('button',{name:'Save $220 estimate'}).isDisabled(),'Promotion recheck blocks stale save');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Saved promotion suggestions"]')?.textContent?.includes('Checking'));while(!release)await new Promise(r=>setTimeout(r,10));hold=false;release();release=null;await waitSave('220');check(previews>before,'Actual editor refetched eligibility');await page.getByRole('button',{name:'Save $220 estimate'}).click();await page.getByText('Every service needs a service, quantity, and valid price.',{exact:true}).waitFor();check(saves===beforeSaveCount,'Blank duplicate cannot save');await lines.nth(1).locator('input[inputmode="decimal"]').first().fill('500');await waitSave('330');check(await lines.nth(1).getByText('Line total $110',{exact:true}).count()===1,'Exact-cent copied rate');check(await lines.nth(1).getByLabel('Quantity',{exact:true}).count()===1,'Reused quantity label works for accessibility');const beforeScope=previews;await lines.nth(1).locator('textarea').fill('Second area revised expectations');check(await page.getByRole('button',{name:'Save $330 estimate'}).isDisabled(),'Description-only scope edit blocks previous verification');await waitSave('330');check(previews>beforeScope,'Same-total edit triggers renewed promotion verification');
 if(width===390&&theme==='light'){
  await lines.nth(1).getByLabel('Service name',{exact:true}).fill('Rear house');await waitSave('330');const orderReads=previews;
  await lines.nth(1).getByRole('button',{name:'Move service 2 up'}).click();
  check(await lines.nth(0).getByLabel('Service name',{exact:true}).inputValue()==='Rear house','Reordered copied service moves above original');
  check(await lines.nth(0).getByLabel('Quantity',{exact:true}).inputValue()==='500'&&await lines.nth(1).getByLabel('Quantity',{exact:true}).inputValue()==='1000','Reordering preserves both exact quantities');
  check(await page.getByRole('button',{name:'Save $330 estimate'}).isDisabled(),'A same-total reorder invalidates prior saved promotion approval');
  await waitSave('330');check(previews>orderReads,'Service reorder triggers promotion recheck without repricing');
  await lines.nth(0).getByRole('button',{name:'Move service 1 down'}).click();await waitSave('330');
  check(await lines.nth(1).getByLabel('Service name',{exact:true}).inputValue()==='Rear house','Move down restores service order');
 }
 check(await page.evaluate(()=>document.documentElement.scrollWidth)<=width,'No page overflow');await page.getByRole('button',{name:'Remove service 2',exact:true}).click();check(await lines.count()===1,'Remove copied line');await page.getByRole('button',{name:'Reuse service setup from line 1',exact:true}).click();await lines.nth(1).locator('input[inputmode="decimal"]').first().fill('500');await waitSave('330');await page.getByRole('button',{name:'Save $330 estimate'}).click();await page.getByText('Estimate ready',{exact:true}).waitFor();check(saves===beforeSaveCount+1&&posted.items.length===2&&posted.items[0].quantity===1000&&posted.items[1].quantity===500&&posted.items[0].totalCents===22000&&posted.items[1].totalCents===11000,'Valid reused setup saves exact original and additional amounts once');
}
// A 2xx response can still be an uncertain save. Show the user how to inspect
// stored estimates, and block duplicate retries even without a bundle discount.
for(const mismatch of ['total','deposit']){
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'New estimate',exact:true}).click();
 await page.getByRole('button',{name:'Create New Customer',exact:false}).click();
 await page.getByLabel('Customer name',{exact:true}).fill('Receipt Verification '+mismatch);
 await page.getByLabel('Estimate service address').fill('101 Receipt Check Lane, Tulsa');
 await page.getByRole('button',{name:'Continue to services'}).click();
 const first=page.locator('.estimate-edit-service').first();
 await first.getByRole('combobox').click();await page.getByRole('option',{name:'House Wash',exact:true}).click();
 await first.locator('input[inputmode="decimal"]').first().fill('1000');
 await page.getByRole('button',{name:'Save $220 estimate'}).waitFor({state:'visible'});
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent?.includes('Save $220 estimate'));return Boolean(b&&!b.disabled);});
 const before=saves;receiptMismatch=mismatch;
 await page.getByRole('button',{name:'Save $220 estimate'}).click();
 await page.getByRole('status').filter({hasText:'Save was not confirmed.'}).waitFor();
 check(saves===before+1,'Mismatch '+mismatch+' made a single server write attempt');
 check(await page.getByRole('button',{name:'Save $220 estimate'}).isDisabled(),'Mismatch '+mismatch+' blocks duplicate save');
 check(await page.getByText('Saved estimate amounts or 50% deposit did not match this reviewed quote.',{exact:false}).count()===1,'Mismatch '+mismatch+' shows correct safety warning');
 check(await page.getByRole('button',{name:'Review stored estimates'}).count()===1,'Mismatch '+mismatch+' provides recovery path');
}
check(errors.length===0,'No React errors '+errors.join(';'));console.log('PASS '+checks+' real NewEstimate reuse browser checks.');}finally{release?.();await browser?.close();await new Promise(r=>server.close(r));}
