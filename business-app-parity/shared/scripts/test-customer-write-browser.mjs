/** Actual CustomersView + EditCustomer, Radix, compiled CSS; synthetic localhost only. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {createServer} from 'node:http';import {resolve} from 'node:path';import ts from 'typescript';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=['CustomersView','EditCustomer'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name));const tags=new Set();
function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}functions.forEach(visit);
const actual=['EditCustomer','Button','Label','Input','Dialog','DialogTrigger','DialogContent','DialogHeader','DialogTitle','Select','SelectTrigger','SelectValue','SelectContent','SelectItem'];
const stubs=[...tags].filter(t=>!actual.includes(t)).map(t=>`const ${t}=()=>null;`).join('\n');
const fixture=`import React,{useState,useRef,useEffect}from'react';import{createRoot}from'react-dom/client';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Input}from'./components/ui/input';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';
import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'./components/ui/select';
import{summarizeCustomerBalances}from'./lib/customer-balance-summary';import{messageHistoryEntries}from'./lib/message-history';
import{mayUseOfflinePhotoDirectory,mustClearOfflinePhotoDirectory}from'./lib/offline-photo-availability';
const saveOfflinePhotoCustomerDirectory=async()=>{},loadOfflinePhotoCustomerDirectory=async()=>[],clearOfflinePhotoCustomerDirectory=async()=>{};
const money=c=>'$'+(c/100).toFixed(2),dateTime=v=>v,statusLabel=v=>v,resolvedBillingTotalCents=e=>e.invoiceTotalCents??e.totalCents,billingBalanceCents=e=>Math.max(0,resolvedBillingTotalCents(e)-e.paidCents);
${stubs}\n${functions.map(f=>f.getText(ast)).join('\n')}
window.setTheme=value=>document.documentElement.dataset.theme=value;
createRoot(document.getElementById('app')).render(<CustomersView searchQuery="" onEstimateSaved={()=>{}}/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
if(process.argv.includes('--compile-only')){assert.ok(bundle.outputFiles[0].text.length>1000&&css.css.includes('.customer-profile'));console.log('PASS: actual customer write browser fixture and shared CSS compile; browser assertions not executed.');process.exit(0);}
const customer=id=>({id,name:'Fixture '+(id==='first'?'First':'Second'),email:id+'@example.invalid',phone:'',address:'Synthetic only',leadSource:'Unknown',createdAt:'2026-10-19',estimateCount:0,estimateTotal:0,paidTotal:0});
let customers,notes,noteStatus=201,noteHold=false,customerHold=false,releaseNote,releaseCustomer,onNote,onCustomer,notePosts=0,customerPatches=0;
function reset(){customers=[customer('first'),customer('second')];notes=[];noteStatus=201;noteHold=false;customerHold=false;releaseNote=null;releaseCustomer=null;}
reset();const server=createServer((req,res)=>{res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);return;}
 if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script></html>');return;}
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(req.url==='/api/customers'&&req.method==='GET'){send(200,{customers,estimates:[],notes,invoices:[],photos:[],messages:[],payments:[]});return;}
 if((req.url==='/api/customers'&&req.method==='PATCH')||(req.url==='/api/customer-notes'&&req.method==='POST')){
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{const data=JSON.parse(body);
   if(req.method==='PATCH'){customerPatches++;const submit=()=>{const previous=customers.find(c=>c.id===data.id);assert.ok(previous);const updated={...previous,...data};customers=customers.map(c=>c.id===updated.id?updated:c);send(200,{customer:updated});};if(customerHold){releaseCustomer=submit;onCustomer?.();}else submit();}
   else{notePosts++;const submit=()=>{if(noteStatus!==201){send(noteStatus,{error:'Synthetic note failure'});return;}const note={id:'synthetic-note-'+notePosts,customerId:data.customerId,body:data.body,createdAt:'2026-10-19T12:00:00Z'};notes.unshift(note);send(201,{note});};if(noteHold){releaseNote=submit;onNote?.();}else submit();}
  });return;
 }
 res.statusCode=404;res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[],outside=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++;};async function accepted(promise){let timer;try{await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Synthetic request was not submitted')),5000))]);}finally{clearTimeout(timer);}}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){outside.push(r.request().url());return r.abort();}return r.continue();});
 const open=async name=>{await page.locator('.customer-card').filter({has:page.getByText(name,{exact:true})}).click();await page.getByRole('button',{name:/^Notes/}).click();};
 for(const width of [320,390])for(const theme of ['light','dark']){
  reset();await page.setViewportSize({width,height:700});await page.goto(origin);await page.evaluate(value=>window.setTheme(value),theme);await open('Fixture First');
  const noteInput=page.getByLabel('Customer note',{exact:true});await noteInput.fill('First gate note');noteHold=true;const noteAccepted=new Promise(r=>onNote=r),beforeNotes=notePosts;
  await page.getByRole('button',{name:'Add note',exact:true}).evaluate(n=>{n.click();n.click();});await accepted(noteAccepted);
  check(notePosts===beforeNotes+1,'Rapid note taps submit once');check(await noteInput.isDisabled(),'Saving note draft is frozen');
  await page.getByRole('button',{name:'← All customers',exact:true}).click();await open('Fixture Second');await noteInput.fill('Second customer draft');
  releaseNote();noteHold=false;await page.getByRole('button',{name:'Add note',exact:true}).waitFor();
  check(await noteInput.inputValue()==='Second customer draft','Late first save preserves second draft');check(await page.getByText('First gate note',{exact:true}).count()===0,'First note is not shown on second customer');
  await page.getByRole('button',{name:'← All customers',exact:true}).click();await open('Fixture First');await page.getByText('First gate note',{exact:true}).waitFor();check(await noteInput.inputValue()==='','Saved first draft clears only its customer');
  noteStatus=503;await noteInput.fill('Keep failure draft');await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByRole('alert').waitFor();check(await noteInput.inputValue()==='Keep failure draft','Failed note retains draft');check(await page.getByRole('button',{name:'Refresh saved notes'}).isVisible(),'Failed note offers read-only recovery');
  await page.getByRole('button',{name:'Edit customer',exact:true}).click();const dialog=page.locator('.customer-edit-dialog');await dialog.getByLabel('Customer name',{exact:true}).fill(' Fixture First Updated ');
  customerHold=true;const customerAccepted=new Promise(r=>onCustomer=r),beforeEdits=customerPatches;
  await dialog.getByRole('button',{name:'Save changes',exact:true}).evaluate(n=>{n.click();n.click();});await accepted(customerAccepted);
  check(customerPatches===beforeEdits+1,'Rapid edit taps submit once');check(await dialog.getByLabel('Customer name',{exact:true}).isDisabled(),'Pending customer fields are frozen');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Escape');check(await dialog.isVisible(),'Pending customer edit stays open');
  releaseCustomer();customerHold=false;await dialog.waitFor({state:'detached'});await page.getByRole('heading',{name:'Fixture First Updated',exact:true}).waitFor();check(true,'Confirmed edit updates correct profile');
  const bounds=await page.locator('.customer-profile').evaluate(n=>({width:n.scrollWidth,viewport:innerWidth}));check(bounds.width<=bounds.viewport,'Customer profile stays within narrow viewport');
 }
 check(errors.length===0,'No runtime errors: '+errors.join(';'));check(outside.length===0,'No external requests');
 console.log(JSON.stringify({passed:checks,actualCustomerNotes:true,actualEditCustomer:true,actualRadix:true,compiledTailwind:true,syntheticLocalhostOnly:true,hostedDataTouched:false,iPhoneTested:false}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
