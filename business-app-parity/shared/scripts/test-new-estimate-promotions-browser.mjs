/** Actual NewEstimatePromotions React component in Chrome with simulated owner-only preview. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
assert.match(source,/NewEstimatePromotions active=\{open&&step===2/,'New estimate renders actual promotion assistant');
assert.match(source,/promotionsVerifiedFor!==promotionQuoteKey/,'Quote save requires current eligibility verification');
assert.match(source,/setPromotionOwnerOverride\(true\)/,'Manual owner discount overrides exist');
assert.match(source,/promotionServiceIds=\[\.\.\.new Set\(/,'Repeated service lines must not break promotion verification');
assert.match(source,/promotionQuoteKey=JSON\.stringify\(\{services:promotionServiceIds,subtotal,appreciationDiscount,bookingConfirmedOn,lineCount:items\.length,lineScope:items\.map/,'Booking date, line-count and scope-only changes invalidate prior quote verification');
const fixture=String.raw`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{NewEstimatePromotions}from'./components/new-estimate-promotions';
function Fixture(){const[items,setItems]=useState(['house-wash','gutters']),[subtotal,setSubtotal]=useState(46000),[override,setOverride]=useState(false);
const[percent,setPercent]=useState(''),[bundle,setBundle]=useState(''),[verified,setVerified]=useState(null),[active,setActive]=useState(true),[bookingConfirmedOn,setBookingConfirmedOn]=useState(null);
const key=JSON.stringify({services:items,subtotal,appreciationDiscount:false,bookingConfirmedOn});
return <main style={{maxWidth:650,margin:'auto',padding:12}}>
 <button onClick={()=>setItems(['house-wash'])}>Remove gutters</button>
 <button onClick={()=>setItems(['house-wash','gutters'])}>Restore gutters</button>
 <button onClick={()=>setSubtotal(50000)}>Change scope</button>
 <button onClick={()=>setActive(false)}>Close draft</button>
 <label htmlFor="manual-percent">Promotion percentage</label><input id="manual-percent" value={percent} onChange={e=>{setPercent(e.target.value);setOverride(true);}}/>
 <output aria-label="Percentage chosen">{percent}</output><output aria-label="Bundle chosen">{bundle}</output>
 <button disabled={verified!==key}>Save synthetic estimate</button>
 <NewEstimatePromotions active={active} quoteKey={key} serviceIds={items} subtotalCents={subtotal} appreciationDiscount={false} bookingConfirmedOn={bookingConfirmedOn} onBookingConfirmedOn={setBookingConfirmedOn} manualOverride={override}
 onVerified={setVerified} onApply={(bp,dollars)=>{setPercent(bp?String(bp/100):'');setBundle(dollars?(dollars/100).toFixed(2):'');setOverride(false);}}/>
 </main>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'promotions-new-quote.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let fail=false,reads=0,held=null;const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css.css);}
 if(req.url==='/api/saved-promotions/preview'&&req.method==='POST'){
  reads++;let input='';for await(const p of req)input+=p;
  const value=JSON.parse(input);res.setHeader('content-type','application/json');
  if(fail){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic catalog unavailable'}));}
  const qualifies=value.serviceIds.includes('house-wash')&&value.serviceIds.includes('gutters');
  const bookingApplies=typeof value.bookingConfirmedOn==='string'&&value.bookingConfirmedOn>='2026-10-01'&&value.bookingConfirmedOn<='2026-10-31';
  const dollars=qualifies?2500:0;
  const pendingBooking=typeof value.bookingConfirmedOn==='string'?[]:[{id:'promo-oct',name:'October 15% booking offer',type:'percent',valueCents:1500,startOn:'2026-10-01',endOn:'2026-10-31'}];
  const percent=bookingApplies?1500:0;
  const resultTotal=Math.max(15000,value.subtotalCents-Math.round(value.subtotalCents*percent/10000)-dollars);
  return res.end(JSON.stringify({revision:'synthetic-revision',checkedOn:'2026-10-22',bookingConfirmedOn:value.bookingConfirmedOn??null,
   eligible:qualifies?[{id:'bundle',name:'House and gutters $25 bundle',type:'dollar',valueCents:2500}]:[],
   pendingBooking,percentBasisPoints:percent,dollarCents:dollars,blocked:null,
   previewTotalCents:resultTotal,
   previewDepositCents:Math.round(resultTotal/2)}));
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const errors=[];const check=(ok,label)=>{assert.ok(ok,label);checks++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  await page.getByText('House and gutters $25 bundle',{exact:false}).waitFor();
  check(await page.getByLabel('Bundle chosen').textContent()==='25.00','Auto-selected exact $25 bundle');
  check(await page.getByLabel('Percentage chosen').textContent()==='','Booking-only percent not auto-applied');
  check(await page.getByText('Booking required',{exact:false}).count()>0,'Booking condition prominent');
  const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('[aria-label="Saved promotion suggestions"] button')].map(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,height:r.height};})}));
  check(bounds.scroll<=width+1&&bounds.buttons.every(b=>b.left>=0&&b.right<=width+1&&b.height>=42),'Buttons fit '+width+'/'+theme);
  if(process.env.FIRE_PROMOTION_ESTIMATE_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_PROMOTION_ESTIMATE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FIRE_PROMOTION_ESTIMATE_SCREENSHOT_DIR,'quote-'+width+'-'+theme+'.png'),fullPage:false});}
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByLabel('Bundle chosen').filter({hasText:'25.00'}).waitFor();
 await page.getByLabel('Customer booking already confirmed').check();
 await page.getByLabel('Percentage chosen').filter({hasText:'15'}).waitFor();
 check(await page.getByLabel('Bundle chosen').textContent()==='25.00','Verified booking 15% stacks with $25 bundle');
 check(await page.getByText('Owner-confirmed booking:',{exact:false}).count()>0,'Owner-attested date is explicitly shown');
 check(await page.getByText('Booking required:',{exact:false}).count()===0,'Confirmed date unlocks booking-only offer');
 check(await page.getByRole('button',{name:'Save synthetic estimate'}).isEnabled(),'Confirmed booking preview unlocks current scope save');
 await page.getByLabel('Owner-confirmed booking date (Tulsa)').fill('2026-09-30');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Percentage chosen"]')?.textContent==='');
 await page.getByText('Owner-confirmed booking:',{exact:false}).waitFor();
 check(await page.getByLabel('Percentage chosen').textContent()==='','Date before promotion window does not earn October 15%');
 check(await page.getByText('Booking required:',{exact:false}).count()===0,'A confirmed but ineligible date is not falsely described as unconfirmed');
 await page.getByLabel('Owner-confirmed booking date (Tulsa)').fill('2026-10-20');
 await page.getByLabel('Percentage chosen').filter({hasText:'15'}).waitFor();
 check(await page.getByLabel('Percentage chosen').textContent()==='15','October booking restored on verified date');
 await page.getByLabel('Customer booking already confirmed').uncheck();
 await page.getByText('Booking required:',{exact:false}).waitFor();
 check(await page.getByLabel('Percentage chosen').textContent()==='','Removing owner booking assertion removes booking-only savings');
 await page.getByRole('button',{name:'Remove gutters'}).click();
 await page.getByText('No saved promotions qualify',{exact:false}).waitFor();
 check(await page.getByLabel('Bundle chosen').textContent()==='','Removing qualifying service clears automatic bundle');
 await page.getByRole('button',{name:'Restore gutters'}).click();
 await page.getByLabel('Bundle chosen').filter({hasText:'25.00'}).waitFor();
 await page.locator('#manual-percent').fill('37');
 await page.getByRole('button',{name:'Change scope'}).click();
 await page.getByText('Your custom amount is preserved',{exact:false}).waitFor();
 check(await page.getByLabel('Percentage chosen').textContent()==='37','Custom user-entered promotion preserved across scope changes');
 await page.getByRole('button',{name:'Use saved offers'}).click();
 check(await page.getByLabel('Percentage chosen').textContent()==='','Explicit owner choice replaces custom with saved rules');
 fail=true;await page.getByRole('button',{name:'Refresh offers'}).click();
 await page.getByText('Saved promotions were not verified',{exact:false}).waitFor();
 check(await page.getByLabel('Bundle chosen').textContent()==='','Unverified refresh clears previous auto bundle');
 check(await page.getByRole('button',{name:'Save synthetic estimate'}).isDisabled(),'Failed current rule read blocks save');
 await page.getByRole('button',{name:'Continue without automatic promotions'}).click();
 check(await page.getByRole('button',{name:'Save synthetic estimate'}).isEnabled(),'Owner may explicitly bypass unavailable rules');
 check(reads>5,'Multiple scoped preview reads verified');
 check(errors.length===0,'No browser runtime errors '+errors.join(';'));
 console.log('PASS '+checks+' actual React promotions on 320/390/768 light/dark, automatic savings, booking hold, manual edits, service changes and read-error bypass.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
