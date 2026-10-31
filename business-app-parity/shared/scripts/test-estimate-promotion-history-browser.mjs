/** Real React owner estimate promotion history + owner-only API + synthetic SQLite in Chrome. */
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
const runtime=stackedRuntime(),promotion=runtime.load('lib/saved-promotions.ts');
const rule={id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',name:'FIRE Original 15% Special',type:'percent',valueCents:1500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:[]};
const catalog={revision:'aaaaaaaa-aaaa-4aaa-8aaa-000000000099',promotions:[rule]};
runtime.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now')").run(promotion.SAVED_PROMOTIONS_KEY,JSON.stringify(catalog));
const receipt={revision:catalog.revision,checkedOn:promotion.fireDate(new Date()),ruleIds:[rule.id],serviceIds:['house-wash']};
const result=await runtime.post({customer:'Synthetic history',email:'promo-history@example.invalid',items:[{name:'House Wash',quantity:1,unit:'job',totalCents:46000}],additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:0,promotionEvidence:receipt});
assert.equal(result.status,201);const estimate=await result.json(),id=estimate.id;
const fixture=String.raw`import React from 'react';import{createRoot}from'react-dom/client';import{EstimatePromotionHistory}from'./components/estimate-promotion-history';
createRoot(document.getElementById('app')).render(<main style={{maxWidth:650,margin:'auto',padding:12}}><EstimatePromotionHistory estimateId={window.estimateId} totalCents={window.totalCents}/></main>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'estimate-promo-history.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const styles=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let broken=false;const get=runtime.load('app/api/estimates/[id]/promotions/route.ts').GET;
const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(styles.css);}
 if(req.url==='/api/estimates/'+id+'/promotions'){
  res.setHeader('content-type','application/json');if(broken){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic unavailable'}));}
  const r=await get(new Request('https://synthetic.invalid'+req.url),{params:Promise.resolve({id})});
  res.statusCode=r.status;return res.end(await r.text());
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script>window.estimateId='+JSON.stringify(id)+';window.totalCents='+estimate.totalCents+'</script><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const check=(ok,name)=>{assert.ok(ok,name);checks++;},errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',request=>new URL(request.request().url()).origin===origin?request.continue():request.abort());
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const history=page.locator('[aria-label="Saved promotions on estimate"]');
  await history.locator('summary').first().waitFor();
  check(await history.getByText('Promotion history',{exact:true}).isVisible(),'Compact promotions summary appears before opening');
  await history.locator('summary').first().click();
  await page.getByText(rule.name,{exact:true}).waitFor();
  check(await page.getByText('$391.00',{exact:false}).count()>0,'Frozen 15% quote subtotal $460 total $391');
  check(await history.getByText('Review booking savings (optional)',{exact:true}).isVisible(),
    'Optional advanced booking controls are discoverable without occupying default quote detail');
  check(!(await history.getByLabel('Booking date confirmed by owner (Tulsa)').isVisible()),
    'Booking-date entry and internal amendment review stay collapsed during normal history check');
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,button:[...document.querySelectorAll('[aria-label="Saved promotions on estimate"] button')].filter(n=>n.getClientRects().length>0).map(n=>{const box=n.getBoundingClientRect();return{left:box.left,right:box.right,height:box.height};})}));
  check(geom.scroll<=width+1&&geom.button.every(b=>b.left>=0&&b.right<=width+1&&b.height>=42),'Owner history is usable at '+width+'/'+theme);
 }
 runtime.db.prepare("UPDATE message_templates SET body=? WHERE key=?").run(JSON.stringify({revision:'aaaaaaaa-aaaa-4aaa-8aaa-000000000098',promotions:[]}),promotion.SAVED_PROMOTIONS_KEY);
 await page.reload();await page.locator('[aria-label="Saved promotions on estimate"] summary').first().click();await page.getByText(rule.name,{exact:true}).waitFor();
 check(true,'Original saved name visible despite later catalog deletion');
 broken=true;await page.getByRole('button',{name:'Refresh history'}).click();
 await page.getByText('Promotion history unavailable.',{exact:false}).waitFor();
 check(await page.getByText('$391.00',{exact:false}).count()===0,'Failed history refresh never displays unverified saved rule');
 broken=false;await page.getByRole('button',{name:'Refresh history'}).click();
 await page.getByText(rule.name,{exact:true}).waitFor();
 check(await page.getByText('$391.00',{exact:false}).count()>0,'Read retry verifies original monetary snapshot');
 check(errors.length===0,'No browser exceptions: '+errors.join(';'));
 console.log('PASS '+checks+' mobile owner saved promotion history on actual API, original rules after catalog edits, failed-read hiding and retry.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));runtime.db.close();}
