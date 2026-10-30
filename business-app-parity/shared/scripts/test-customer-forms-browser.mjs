/** Actual AddCustomer/EditCustomer, Radix and shared CSS; synthetic HTTP doubles only. */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';

const require=createRequire(import.meta.url), root=process.cwd();
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=name=>{const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n,name);return n.getText(ast);};
const fixture=`import React,{useEffect,useRef,useState}from'react';import{createRoot}from'react-dom/client';
import{UserPlus,PenLine}from'lucide-react';import{Button}from'./components/ui/button';import{Input}from'./components/ui/input';import{Label}from'./components/ui/label';
import{Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger}from'./components/ui/dialog';
import{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from'./components/ui/select';
import{loadCustomerCreateRequest,saveCustomerCreateRequest,clearCustomerCreateRequest,loadCustomerEstimateHandoff,saveCustomerEstimateHandoff,clearCustomerEstimateHandoff,confirmedCreatedCustomer,sameCustomerCreateInput}from'./lib/customer-create-retry';
${fn('AddCustomer')}\n${fn('EditCustomer')}
document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')||'light';
window.added=[];window.updated=[];
createRoot(document.getElementById('app')).render(<main style={{padding:12}}><AddCustomer onAdded={(customer,startEstimate)=>window.added.push({customer,startEstimate})}/><EditCustomer customer={{id:'synthetic-edit',name:'Synthetic existing',email:'existing@example.invalid',phone:'9185550100',address:'123 Synthetic Road',leadSource:'Referral'}} onUpdated={customer=>window.updated.push(customer)}/></main>);`;
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const bundle=(await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0].text;
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const css=(await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')})).css;
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript; charset=utf-8');return res.end(bundle);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css; charset=utf-8');return res.end(css);}
 res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
let browser,checks=0;const observations=[],errors=[],outside=[];
const check=(v,m)=>{assert.ok(v,m);checks++;};
const customer=(id,input)=>({id,...input,createdAt:'2026-10-29T12:00:00Z',estimateCount:0,estimateTotal:0,paidTotal:0});
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===320?568:844},hasTouch:true}),page=await context.newPage(),pending=[],requests=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){outside.push(u.origin);return route.abort();}if(u.pathname.startsWith('/api/')){const req={route,method:route.request().method(),path:u.pathname,query:u.searchParams,body:route.request().postDataJSON()};requests.push(req);pending.push(req);return;}return route.continue();});
  const answer=async(method,status,data)=>{for(let i=0;i<200&&!pending.some(r=>r.method===method);i++)await new Promise(r=>setTimeout(r,10));const index=pending.findIndex(r=>r.method===method);assert.ok(index>=0,'Expected synthetic '+method);const req=pending.splice(index,1)[0];await req.route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});return req;};
  const sample=async(dialog,state)=>{
   const geometry=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,controls:[...el.querySelectorAll('input,button[role=combobox],button.brand-button')].filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return{label:n.id||n.textContent.trim(),height:b.height,left:b.left,right:b.right};})};});
   if(process.env.FIRE_CUSTOMER_FORMS_DIR&&width===320){mkdirSync(process.env.FIRE_CUSTOMER_FORMS_DIR,{recursive:true});await dialog.screenshot({path:resolve(process.env.FIRE_CUSTOMER_FORMS_DIR,`${theme}-${state}.png`)});}
   observations.push({width,theme,state,...geometry});check(geometry.left>=-1&&geometry.right<=width+1,'Dialog fits '+JSON.stringify({width,theme,state}));
   for(const c of geometry.controls){check(c.height>=(width<=760?43.9:31.9),'Customer form target in phone/desktop context '+JSON.stringify({width,theme,state,c}));check(c.left>=geometry.left-1&&c.right<=geometry.right+1,'Field fits dialog '+JSON.stringify(c));}
  };
  const focusLabels=async dialog=>{for(const label of ['Customer name','Email','Phone','Service address']){await dialog.getByText(label,{exact:true}).click();check(await dialog.getByLabel(label,{exact:true}).evaluate(n=>document.activeElement===n),'Label focuses exact '+label);}};
  const reachable=async button=>{await button.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));check(await button.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(hit===n||n.contains(hit));}),'Final action receives pointer in short dialog');};
  await page.goto(origin+'/?theme='+theme);await page.getByRole('button',{name:'Add customer',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Add customer',exact:true});await dialog.waitFor();
  await dialog.locator('.customer-create-source>summary').click();const source=dialog.getByRole('combobox',{name:'How they found FIRE',exact:true});check(await source.count()===1,'Add customer dropdown has its visible label as accessible name');await dialog.getByText('How they found FIRE',{exact:true}).click();await page.getByRole('listbox').waitFor();check(true,'Add source label activates the associated dropdown');await page.getByRole('option',{name:'Google',exact:true}).click();check((await source.innerText()).includes('Google'),'Lead source choice retained');await focusLabels(dialog);await sample(dialog,'add-ready');
  await dialog.getByRole('button',{name:'Save customer',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Customer name is required'}).waitFor();check(requests.length===0,'Invalid create makes no API request');
  const input={name:'Synthetic created',email:'created@example.invalid',phone:'9185550147',address:'456 Synthetic Street',leadSource:'Google'};
  for(const [label,value] of [['Customer name',input.name],['Email',input.email],['Phone',input.phone],['Service address',input.address]])await dialog.getByLabel(label,{exact:true}).fill(value);
  const save=dialog.getByRole('button',{name:'Save & estimate',exact:true});await reachable(save);await save.evaluate(n=>{n.click();n.click();});await page.waitForFunction(()=>document.querySelector('#newCustomerName')?.disabled);check(requests.filter(r=>r.method==='POST').length===1,'Rapid create taps submit once');check(await dialog.locator('input,button[role=combobox]').evaluateAll(ns=>ns.every(n=>n.matches(':disabled'))),'Pending create freezes all editable fields');await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Escape');check(await dialog.isVisible(),'Pending create cannot close');
  const post=await answer('POST',503,{error:'Synthetic acknowledgement lost'}),id=post.body.requestId;check(post.path==='/api/customers'&&Object.entries(input).every(([key,value])=>post.body[key]===value),'Create uses exact selected details');const initialReceipt=await answer('GET',200,{requestId:id,confirmed:false,customer:null});check(initialReceipt.query.get('requestId')===id,'Initial readback uses exact create request ID');await dialog.getByRole('alert').filter({hasText:'SAME save'}).waitFor();await reachable(dialog.getByRole('button',{name:'Check / retry same customer save',exact:true}));await sample(dialog,'add-uncertain');
  const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));check(!JSON.stringify(stored).includes(input.name)&&!JSON.stringify(stored).includes(input.email),'Recovery storage contains no contact details');
  await page.reload();await page.getByRole('button',{name:'Check previous customer save',exact:true}).click();dialog=page.getByRole('dialog',{name:'Add customer',exact:true});check(await dialog.getByLabel('Customer name',{exact:true}).isDisabled(),'Reloaded uncertain save keeps fields locked');await dialog.getByRole('button',{name:'Check previous save',exact:true}).click();const recoveredReceipt=await answer('GET',200,{requestId:id,confirmed:true,customer:customer(id,input)});check(recoveredReceipt.query.get('requestId')===id,'Reload reconciliation uses original request ID');await dialog.waitFor({state:'hidden'});
  check(requests.filter(r=>r.method==='POST').length===1,'Receipt recovery never creates another customer');const added=await page.evaluate(()=>window.added);check(added.length===1&&added[0].customer.id===id&&added[0].startEstimate===true,'Verified receipt retains deliberate Save & estimate handoff');check(await page.evaluate(()=>localStorage.length)===0,'Only completed recovery clears request markers');
  await page.getByRole('button',{name:'Edit customer',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit customer',exact:true});await focusLabels(dialog);check(await dialog.getByRole('combobox',{name:'How they found FIRE',exact:true}).count()===1,'Edit source retains accessible label');await dialog.getByText('How they found FIRE',{exact:true}).click();await page.getByRole('listbox').waitFor();await page.getByRole('option',{name:'Referral',exact:true}).click();check(true,'Edit source label activates associated dropdown');await sample(dialog,'edit-ready');
  await dialog.getByLabel('Customer name',{exact:true}).fill('Synthetic changed');const update=dialog.getByRole('button',{name:'Save changes',exact:true});await reachable(update);await update.evaluate(n=>{n.click();n.click();});await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled);check(requests.filter(r=>r.method==='PATCH').length===1,'Rapid edit taps submit once');check(await dialog.locator('input,button[role=combobox]').evaluateAll(ns=>ns.every(n=>n.matches(':disabled'))),'Pending edit freezes every field');await page.keyboard.press('Escape');check(await dialog.isVisible(),'Pending edit cannot close');
  const attempt=requests.findLast(r=>r.method==='PATCH');check(attempt?.body.id==='synthetic-edit','Edit request targets exactly the selected customer');
  await answer('PATCH',200,{customer:customer('different-customer',{...input,name:'Synthetic changed'})});await dialog.getByRole('alert').filter({hasText:'Save confirmation was interrupted'}).waitFor();check(await page.evaluate(()=>window.updated.length)===0,'Foreign edit receipt cannot update profile');check(await dialog.getByLabel('Customer name',{exact:true}).inputValue()==='Synthetic changed','Unconfirmed edit preserves draft');check(await update.isDisabled(),'Uncertain edit cannot be sent again blindly');await sample(dialog,'edit-error');
  await dialog.getByRole('button',{name:'Check saved details',exact:true}).click();
  const verify=await answer('GET',200,{customer:customer('synthetic-edit',attempt.body)});
  check(verify.query.get('confirmEdit')==='synthetic-edit','Confirmation reads only selected customer by ID');
  await dialog.waitFor({state:'hidden'});check(await page.evaluate(()=>window.updated.length)===1,'Matching read-back acknowledges saved edit without new PATCH');
  check(requests.filter(r=>r.method==='PATCH').length===1,'Uncertain edit recovery never resends PATCH');
  check(requests.every(r=>r.path==='/api/customers'||r.path==='/api/customers/confirmation'),'Only synthetic customer endpoints exercised');await context.close();
 }
 check(!errors.length&&!outside.length,'No browser errors or external requests');console.log(JSON.stringify({passed:checks,measuredStates:observations.length,actualAddCustomer:true,actualEditCustomer:true,actualRadix:true,syntheticResponsesOnly:true,hostedWrites:false,physicalIPhone:false}));
}finally{
 if(process.env.FIRE_CUSTOMER_FORMS_DIR){mkdirSync(process.env.FIRE_CUSTOMER_FORMS_DIR,{recursive:true});writeFileSync(resolve(process.env.FIRE_CUSTOMER_FORMS_DIR,'customer-forms-geometry.json'),JSON.stringify({checks,observations,errors,outside},null,2));}
 await browser?.close();await new Promise(r=>server.close(r));
}
