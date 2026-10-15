/** Actual FIRE CustomersView -> offline photo fallback and owner denial.
 * Native Chromium, synthetic IndexedDB and local 503/401, no remote data.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
if(!process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||!process.env.FIRE_BROWSER_TEST_EXECUTABLE)throw Error('Pinned browser runner required.');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE);
const base=resolve(new URL('..',import.meta.url).pathname);
const dashboard=readFileSync(join(base,'app/dashboard.tsx'),'utf8');
const a=dashboard.indexOf('function CustomersView('),b=dashboard.indexOf('\nfunction ',a+25);
if(a<0||b<0||!dashboard.slice(a,b).includes('if(offlinePhotoOnly)'))throw Error('Missing actual CustomersView offline source.');
const imports=[
"import React,{useState,useRef,useEffect} from 'react';",
"import {createRoot} from 'react-dom/client';",
"import {ChevronRight} from 'lucide-react';",
"import {OfflineCustomerPhotos} from './components/offline-customer-photos';",
"import {saveOfflinePhotoCustomerDirectory,loadOfflinePhotoCustomerDirectory} from './lib/offline-photo-customer-directory';",
"import {clearOfflinePhotoCustomerDirectory} from './lib/offline-photo-customer-directory';",
"import {mayUseOfflinePhotoDirectory,mustClearOfflinePhotoDirectory} from './lib/offline-photo-availability';",
"import {listOfflinePhotos} from './lib/local-photo-vault';",
"const Button=({children,onClick,disabled})=>React.createElement('button',{type:'button',onClick,disabled},children);",
"const messageHistoryEntries=()=>[];const billingBalanceCents=()=>0;",
"const resolvedBillingTotalCents=()=>0;const money=()=>'$0.00';"
].join('\n');
const tail=[
"window.fixturePhotoDirectory={seed:saveOfflinePhotoCustomerDirectory,read:loadOfflinePhotoCustomerDirectory,",
"photoCount:async()=> (await listOfflinePhotos('synthetic-customer-photo')).length};",
"const root=createRoot(document.querySelector('#app'));",
"window.mountCustomers=()=>root.render(React.createElement(CustomersView,{searchQuery:'',onEstimateSaved:()=>{}}));"
].join('\n');
const built=await esbuild.build({stdin:{contents:imports+'\n'+dashboard.slice(a,b)+'\n'+tail,resolveDir:base,sourcefile:'actual-customers-offline.tsx',loader:'tsx'},
 bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
let status=503,reads=0;
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(built.outputFiles[0].text);return;}
 if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/bundle.js"></script>');return;}
 if(req.url==='/api/customers'){reads++;res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:status===401?'Unauthorized':'Synthetic backend unavailable'}));return;}
 res.statusCode=404;res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,count=0;const errors=[],external=[];
const check=(value,description)=>{assert.ok(value,description);count++;console.log('PASS: '+description);};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await ctx.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
  return route.continue();
 });
 const page=await ctx.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);
 await page.evaluate(async()=>window.fixturePhotoDirectory.seed([{id:'synthetic-customer-photo',name:'Synthetic Authorized Customer'}]));
 await page.evaluate(()=>window.mountCustomers());
 await page.getByText('Offline customer photos').waitFor({timeout:15000});
 check(reads>=1,'Actual FIRE CustomersView attempts server API then shows cached photos after HTTP 503');
 check(await page.getByText(/Estimates, invoices, payments, messaging, and editing are unavailable/).count()===1,'Fallback hides financial and editing workflows');
 check(await page.getByRole('button',{name:/Synthetic Authorized Customer.*local photos/}).count()===1,'Previously authorized customer labels are available for offline photo navigation');
 await page.getByRole('button',{name:/Synthetic Authorized Customer.*local photos/}).click();
 await page.getByRole('button',{name:'Photo library'}).waitFor();
 check(await page.getByText('Private on-device photos').count()===1,'Actual offline CustomersView renders actual customer photo component');
 await page.locator('input[type="file"][multiple]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
 await page.getByText(/Photos verified on this device/).waitFor();
 check(await page.evaluate(()=>window.fixturePhotoDirectory.photoCount())===1,'Offline fallback adds actual synthetic image bytes to IndexedDB');
 await page.getByRole('button',{name:"Prepare this customer's photos ZIP"}).click();
 await page.getByText(/photo ZIP passed integrity checks/).waitFor();
 check(await page.getByRole('button',{name:'Download prepared ZIP'}).count()===1,'Actual offline customer dashboard prepares verified photo backup');
 status=401;
 await page.getByRole('button',{name:'Reconnect & refresh customer records'}).click();
 await page.getByText('Unauthorized').waitFor();
 check(await page.getByText('Synthetic Authorized Customer').count()===0,'HTTP 401 closes cached customer browser instead of showing old names');
 check((await page.evaluate(()=>window.fixturePhotoDirectory.read())).length===0,'HTTP 401 clears persistent customer directory');
 check(await page.evaluate(()=>window.fixturePhotoDirectory.photoCount())===1,'Auth denial does not destructively erase local photo bytes');
 status=503;
 await page.getByRole('button',{name:'Try again'}).click();
 await page.getByText('Synthetic backend unavailable').waitFor();
 check(await page.getByText('Offline customer photos').count()===0,'Subsequent server outage cannot resurrect names after auth denial');
 check(external.length===0,'No remote Stripe/R2/customer/cloud requests');
 check(errors.length===0,'No uncaught errors in real CustomersView or photo component: '+errors.join(' | '));
 await ctx.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
console.log('PASS '+count+' actual FIRE dashboard offline-photo fallback browser assertions. iOS and hosted authorization still pending.');
