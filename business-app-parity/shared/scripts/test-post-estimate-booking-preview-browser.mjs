/** Live owner React amendment preview + real D1/SQLite read-only API in Chromium. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const r=stackedRuntime(),model=r.load('lib/saved-promotions.ts');
const api=r.load('app/api/estimates/[id]/promotion-amendment/route.ts').POST;
const today=model.fireDate(new Date()),gid=n=>'faba0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const bundle={id:gid(1),name:'House wash and gutter bundle',type:'dollar',valueCents:2500,enabled:true,autoApply:true,dateBasis:'estimate-created',startOn:null,endOn:null,requiredServiceIds:['house-wash','gutters']};
const booking={id:gid(2),name:'FIRE confirmed booking 15%',type:'percent',valueCents:1500,enabled:true,autoApply:true,dateBasis:'booking-confirmed',startOn:null,endOn:null,requiredServiceIds:[]};
const catalog={revision:gid(99),promotions:[bundle,booking]};
const store=(c)=>r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now') ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(model.SAVED_PROMOTIONS_KEY,JSON.stringify(c));
store(catalog);
const create=await r.post({customer:'React owner booking review synthetic',email:'react-booking-review@example.invalid',address:'123 Synthetic street',
 items:[{name:'House Wash',description:'Test',quantity:1,unit:'job',totalCents:40000},{name:'Gutter Cleaning + Flush',description:'Test',quantity:1,unit:'job',totalCents:6000}],
 additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:2500,
 promotionEvidence:{revision:catalog.revision,checkedOn:today,serviceIds:['house-wash','gutters'],ruleIds:[bundle.id]}});
assert.equal(create.status,201);const saved=await create.json();assert.equal(saved.totalCents,43500);
const fixture=String.raw`import React from 'react';import{createRoot}from'react-dom/client';import{BookingAmendmentPreview}from'./components/booking-amendment-preview';
createRoot(document.getElementById('app')).render(<main style={{maxWidth:620,margin:'auto',padding:12}}><BookingAmendmentPreview estimateId={window.estimateId} totalCents={window.totalCents}/></main>);`;
const bundleJS=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'booking-preview-ui.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let fail=false,requests=0;const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundleJS.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css.css);}
 if(req.url==='/api/estimates/'+saved.id+'/promotion-amendment'&&req.method==='POST'){
  requests++;res.setHeader('content-type','application/json');
  if(fail){res.statusCode=503;return res.end(JSON.stringify({error:'Read-only synthetic preview temporarily unavailable'}));}
  let data='';for await(const chunk of req)data+=chunk;
  const response=await api(new Request('https://synthetic.invalid'+req.url,{method:'POST',body:data}),{params:Promise.resolve({id:saved.id})});
  res.statusCode=response.status;return res.end(await response.text());
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script>window.estimateId='+JSON.stringify(saved.id)+';window.totalCents=43500;</script><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
const checks=[];let browser;const check=(ok,message)=>{assert.ok(ok,message);checks.push(message);};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(9000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',p=>new URL(p.request().url()).origin===origin?p.continue():p.abort());
 const baseline=JSON.stringify(r.db.prepare('SELECT * FROM estimates ORDER BY rowid').all());
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.evaluate(v=>document.documentElement.dataset.theme=v,theme);
  await page.getByRole('button',{name:'Preview booking adjustment'}).click();
  await page.getByText('Potential additional savings: $69.00').waitFor();
  check(await page.getByText('Agreed estimate').isVisible(),'Agreed estimate visible');
  check(await page.getByText('$435.00',{exact:true}).count()===1,'Original total visible');
  check(await page.getByText('$366.00',{exact:true}).count()===1,'New possible total visible');
  check(await page.getByText('FIRE confirmed booking 15%',{exact:false}).count()===1,'New rule identified');
  check(await page.getByText('No quote, contract, invoice',{exact:false}).count()>0,'Explicit no-change warning');
  const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('[aria-label="Booking promotion adjustment preview"] button')].map(x=>{const t=x.getBoundingClientRect();return{left:t.left,right:t.right,height:t.height}})}));
  check(bounds.scroll<=width+1&&bounds.buttons.every(x=>x.left>=0&&x.right<=width+1&&x.height>=42),'No overflow and usable touch at '+width+'/'+theme);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Preview booking adjustment'}).click();await page.getByText('Potential additional savings: $69.00').waitFor();
 await page.getByLabel('Booking date confirmed by owner (Tulsa)').fill('2026-02-30');
 check(await page.getByText('Potential additional savings: $69.00').count()===0,'Editing date removes stale preview immediately');
 await page.getByRole('button',{name:'Preview booking adjustment'}).click();
 await page.getByRole('alert').waitFor();check(await page.getByText('booking date must be a valid Tulsa-local date',{exact:false}).count()>0,'Invalid owner booking date fails closed');
 await page.getByLabel('Booking date confirmed by owner (Tulsa)').fill(today);
 fail=true;await page.getByRole('button',{name:'Preview booking adjustment'}).click();await page.getByRole('alert').waitFor();
 check(await page.getByText('Read-only synthetic preview temporarily unavailable').count()===1,'Network/server read failure visible');
 fail=false;await page.getByRole('button',{name:'Preview booking adjustment'}).click();await page.getByText('Potential additional savings: $69.00').waitFor();
 check(requests>=9,'Actual authenticated quote-preview endpoint read repeatedly');
 check(errors.length===0,'No Chrome runtime errors: '+errors.join(';'));
 check(JSON.stringify(r.db.prepare('SELECT * FROM estimates ORDER BY rowid').all())===baseline,'UI previews never change existing saved totals');
 console.log('PASS '+checks.length+' owner booking-amendment Chrome/SQLite, 320/390/768 light and dark, exact cents, invalid-date refusal, failed read recovery and no financial writes.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));r.db.close();}
