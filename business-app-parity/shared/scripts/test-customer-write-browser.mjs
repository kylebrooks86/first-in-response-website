/** Actual CustomersView + EditCustomer, Radix, compiled CSS; synthetic localhost only. */
import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';import {createServer} from 'node:http';import {resolve} from 'node:path';import ts from 'typescript';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=['CustomersView','EditCustomer','EstimatesView','InsightsView'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name));const tags=new Set();
function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}functions.forEach(visit);
const actual=['InsightsView','EstimatesView','EditCustomer','Button','Label','Input','Textarea','Dialog','DialogTrigger','DialogContent','DialogHeader','DialogTitle','Select','SelectTrigger','SelectValue','SelectContent','SelectItem'];
const stubs=[...tags].filter(t=>!actual.includes(t)).map(t=>`const ${t}=()=>null;`).join('\n');
const fixture=`import React,{useState,useRef,useEffect,useMemo}from'react';import{createRoot}from'react-dom/client';
import{Textarea}from'./components/ui/textarea';import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Input}from'./components/ui/input';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';
import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'./components/ui/select';
import{summarizeCustomerBalances}from'./lib/customer-balance-summary';import{messageHistoryEntries}from'./lib/message-history';
import{deriveCustomerManualFlags,REVIEW_RECEIVED_NOTE,LEAD_NO_ANSWER_NOTE,LEAD_CONTACTED_NOTE,LEAD_CALLBACK_HANDLED_NOTE,leadCallbackNote,SIGN_PICKED_UP_NOTE,signPlacedNote,reviewFollowupEligibility}from'./lib/customer-activity-flags';
import{mayUseOfflinePhotoDirectory,mustClearOfflinePhotoDirectory}from'./lib/offline-photo-availability';
import{usableCustomerPhone,usableCustomerEmail}from'./lib/customer-contact-links';
import{jobNumberLabel}from'./lib/job-numbering.mjs';
const saveOfflinePhotoCustomerDirectory=async()=>{},loadOfflinePhotoCustomerDirectory=async()=>[],clearOfflinePhotoCustomerDirectory=async()=>{};
const money=c=>'$'+(c/100).toFixed(2),dateTime=v=>v,statusLabel=v=>v,resolvedBillingTotalCents=e=>e.invoiceTotalCents??e.totalCents,billingBalanceCents=e=>Math.max(0,resolvedBillingTotalCents(e)-e.paidCents);
${stubs}\n${functions.map(f=>f.getText(ast)).join('\n')}
window.testReviewEligibility=()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),completed=[{status:'completed'}],date='2026-10-13T12:00:00Z';
 const due=reviewFollowupEligibility([{status:'completed',lastReviewRequestAt:date}],[],null,now);
 const waiting=reviewFollowupEligibility([{status:'completed',lastReviewRequestAt:'2026-10-14T12:00:00Z'}],[],null,now);
 const prepared=reviewFollowupEligibility(completed,[{template:'review',channel:'text_prepared',createdAt:date}],null,now);
 const confirmed=reviewFollowupEligibility(completed,[{template:'review',channel:'text_confirmed',createdAt:date}],null,now);
 const received=reviewFollowupEligibility([{status:'completed',lastReviewRequestAt:date}],[],'2026-10-19T12:00:00Z',now);
 const noJob=reviewFollowupEligibility([{status:'approved',lastReviewRequestAt:date}],[],null,now);
 const badDate=reviewFollowupEligibility([{status:'completed',lastReviewRequestAt:'bad-date'}],[],null,now);
 const futureDate=reviewFollowupEligibility([{status:'completed',lastReviewRequestAt:'2026-12-25T12:00:00Z'}],[],null,now);
 return {due:due.status,days:due.elapsedDays,waiting:waiting.status,prepared:prepared.status,confirmed:confirmed.status,received:received.status,noJob:noJob.status,badDate:badDate.status,futureDate:futureDate.status};
};
window.testCustomerFlags=()=>{
 const placement={id:'placed',createdAt:'2026-10-20T12:00:00Z',body:signPlacedNote('2026-10-27','Front lawn')};
 const review={id:'review',createdAt:'2026-10-20T13:00:00Z',body:REVIEW_RECEIVED_NOTE};
 const pickup={id:'pickup',createdAt:'2026-10-20T14:00:00Z',body:SIGN_PICKED_UP_NOTE};
 const out=deriveCustomerManualFlags([placement,review]);
 const retrieved=deriveCustomerManualFlags([pickup,review,placement]);
 const malformed=deriveCustomerManualFlags([{id:'bad',createdAt:'2026-10-20T15:00:00Z',body:'Customer mentioned a yard sign and Google review'}]);
 return {out:out.sign?.state,location:out.sign?.location,pickupDate:out.sign?.pickupDate,review:!!out.reviewReceivedAt,retrieved:retrieved.sign?.state,unverified:!malformed.sign&&!malformed.reviewReceivedAt};
};
window.setTheme=value=>document.documentElement.dataset.theme=value;
createRoot(document.getElementById('app')).render(location.pathname==='/insights'?<InsightsView/>:location.pathname==='/history'?<EstimatesView searchQuery="" onSaved={()=>{}}/>:<CustomersView searchQuery="" onEstimateSaved={()=>{}}/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
if(process.argv.includes('--compile-only')){assert.ok(bundle.outputFiles[0].text.length>1000&&css.css.includes('.customer-profile'));console.log('PASS: actual customer write browser fixture and shared CSS compile; browser assertions not executed.');process.exit(0);}
const customer=id=>({id,name:'Fixture '+(id==='first'?'First':'Second'),email:id+'@example.invalid',phone:'',address:'Synthetic only',leadSource:'Unknown',createdAt:'2026-10-19',estimateCount:0,estimateTotal:0,paidTotal:0});
let insightMode=false,insightPayload=null;
let historyFailure=false,historyReads=[];
let customers,notes,noteStatus=201,noteHold=false,noteLoseReply=false,customerHold=false,releaseNote,releaseCustomer,onNote,onCustomer,notePosts=0,customerPatches=0;
function reset(){customers=[customer('first'),customer('second')];notes=[];noteStatus=201;noteHold=false;customerHold=false;releaseNote=null;releaseCustomer=null;}
reset();const server=createServer((req,res)=>{res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);return;}
 if(req.url==='/'||req.url==='/history'||req.url==='/insights'){res.setHeader('content-type','text/html');res.end('<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script></html>');return;}
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(req.url.startsWith('/api/estimate-history?')){historyReads.push(req.url);if(historyFailure){send(503,{error:'Synthetic history refresh failed'});return;}const query=new URL(req.url, 'http://local.invalid').searchParams.get('q');send(200,{estimates:[{id:query?'new-history':'old-history',customer:query?'Latest query customer':'Prior query customer',service:'Synthetic wash',status:'approved',totalCents:10000,depositCents:5000,paidCents:0,createdAt:'2026-10-20'}],nextCursor:null});return;}
 if(req.url==='/api/customers'&&req.method==='GET'){if(insightMode){send(200,insightPayload);return;}send(200,{customers,estimates:[],notes,invoices:[],photos:[],messages:[],payments:[]});return;}
 if((req.url==='/api/customers'&&req.method==='PATCH')||(req.url==='/api/customer-notes'&&req.method==='POST')){
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{const data=JSON.parse(body);
   if(req.method==='PATCH'){customerPatches++;const submit=()=>{const previous=customers.find(c=>c.id===data.id);assert.ok(previous);const updated={...previous,...data};customers=customers.map(c=>c.id===updated.id?updated:c);send(200,{customer:updated});};if(customerHold){releaseCustomer=submit;onCustomer?.();}else submit();}
   else{notePosts++;const submit=()=>{if(noteStatus!==201){send(noteStatus,{error:'Synthetic note failure'});return;}const note={id:data.requestId,customerId:data.customerId,body:data.body,createdAt:new Date(Date.parse('2026-10-19T12:00:00Z')+notes.length*1000).toISOString()};const existing=notes.find(n=>n.id===data.requestId);if(existing){assert.equal(existing.body,data.body);assert.equal(existing.customerId,data.customerId);send(200,{note:existing});return;}notes.unshift(note);if(noteLoseReply){noteLoseReply=false;res.writeHead(201,{'content-type':'application/json'});res.end('not-json');return;}send(201,{note});};if(noteHold){releaseNote=submit;onNote?.();}else submit();}
  });return;
 }
 res.statusCode=404;res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[],outside=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++;};async function accepted(promise){let timer;try{await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Synthetic request was not submitted')),5000))]);}finally{clearTimeout(timer);}}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.goto(origin+'/');await page.locator('.customer-card').first().waitFor();
 const state=await page.evaluate(()=>window.testReviewEligibility());
 check(state.due==='due'&&state.days===7&&state.waiting==='waiting','Review eligibility waits seven full days after a real request');
 check(state.prepared==='not-recorded'&&state.confirmed==='due','Prepared review messages do not count as confirmed requests');
 check(state.received==='received'&&state.noJob==='not-applicable','A received review or unfinished job always suppresses status-check cue');
 check(state.badDate==='not-recorded'&&state.futureDate==='not-recorded','Malformed and future dates never create stale reminders');
 const lifecycle=await page.evaluate(()=>window.testCustomerFlags());
 check(lifecycle.out==='out'&&lifecycle.pickupDate==='2026-10-27'&&lifecycle.location==='Front lawn','Structured yard sign note records placement and pickup target');
 check(lifecycle.review&&lifecycle.retrieved==='picked_up'&&lifecycle.unverified,'Review and sign completion require exact owner-logged saved note markers');
 const open=async name=>{await page.locator('.customer-card').filter({has:page.getByText(name,{exact:true})}).click();await page.getByRole('button',{name:/^Notes/}).click();};
 // Real customer with ZERO estimates: explicit lead No answer note, without
 // sending a message or generating a quote, followed by directory filtering.
 await page.setViewportSize({width:390,height:700});
 check(await page.getByRole('group',{name:'Filter manually logged lead contact attempts'}).count()===0,'Unused zero-count lead filters do not clutter initial customer directory');
 await open('Fixture First');
 const originalDraft=page.getByLabel('Customer note',{exact:true});
 await originalDraft.fill('Unsent field note');
 await page.getByRole('button',{name:'Log lead no answer'}).evaluate(button=>{button.click();button.click();});
 await page.getByText('No answer logged.',{exact:true}).waitFor();
 await page.getByRole('status',{name:'Last lead contact'}).filter({hasText:/No answer · not contacted · 1 unanswered attempt/}).waitFor();
 check(notePosts===1&&notes.length===1&&notes[0].body==='[FIRE FLAG] LEAD_NO_ANSWER',
  'One-tap No answer persists once without an estimate, message or duplicate rapid submission');
 check(await originalDraft.inputValue()==='Unsent field note',
  'Direct lead logging preserves a separate unsaved customer note');
 await originalDraft.fill('');
 await page.getByRole('button',{name:'← All customers',exact:true}).click();
 await page.getByRole('button',{name:'No answer / not contacted (1)'}).click();
 check(await page.locator('.customer-card').count()===1&&
  await page.locator('.customer-card').first().getByText('Fixture First',{exact:true}).count()===1,
  'Directory No answer filter isolates the exact saved unanswered lead');
 await page.getByRole('button',{name:'Show all customers'}).click();
 check(await page.locator('.customer-card').count()===2,
  'Owner can clear the filter without deleting or contacting customers');
 await open('Fixture First');
 await page.getByText('Schedule or reschedule lead callback',{exact:true}).click();
 await page.getByLabel('Lead callback date',{exact:true}).fill('2026-10-22');
 const unsavedCustomerNote=page.getByLabel('Customer note',{exact:true});
 await unsavedCustomerNote.fill('Keep this unrelated customer note draft');
 await page.getByRole('button',{name:'Save lead callback'}).evaluate(button=>{button.click();button.click();});
 await page.getByText('Callback saved.',{exact:true}).waitFor();
 await page.getByRole('status').filter({hasText:'Callback due:'}).waitFor();
 check(notePosts===2&&notes.length===2&&notes[0].body==='[FIRE FLAG] LEAD_CALLBACK | due:2026-10-22',
  'One-tap callback persists exactly once using existing notes API, no estimate or messages needed');
 check(await unsavedCustomerNote.inputValue()==='Keep this unrelated customer note draft',
  'Saving callback does not replace an unrelated unsaved customer note');
 check(await page.getByRole('button',{name:'Save lead callback'}).isDisabled(),
  'Same pending callback date cannot be saved twice');
 await unsavedCustomerNote.fill('');
 await page.getByRole('button',{name:'← All customers',exact:true}).click();
 await page.getByRole('region',{name:'Due customer lead callbacks'}).waitFor();
 await page.getByRole('button',{name:'Callbacks due (1)'}).click();
 check(await page.locator('.customer-card').count()===1,'Due-date filter identifies only outstanding owner-saved callbacks');
 await page.locator('.customer-card').first().click();
 await page.getByRole('button',{name:'Mark callback done'}).evaluate(button=>{button.click();button.click();});
 await page.getByText('Callback marked done.',{exact:true}).waitFor();
 check(notes[0]?.body==='[FIRE FLAG] LEAD_CALLBACK_HANDLED'&&notes.length===3&&notePosts===3,
  'One-tap callback completion records one handled marker without claiming customer contact');
 await page.getByRole('button',{name:'← All customers',exact:true}).click();
 await page.getByText('No due callbacks match',{exact:true}).waitFor();
 check(notes.length===3&&notes[0].body==='[FIRE FLAG] LEAD_CALLBACK_HANDLED',
  'Handled callback leaves full append-only history and clears due queue without claiming contact');
 await page.getByRole('button',{name:'Show all customers',exact:true}).click();
 check(await page.getByRole('button',{name:'Callbacks due (0)'}).count()===0,'Cleared zero-count callback filter disappears after returning to all customers');
 check(await page.locator('.customer-card').count()===2,
  'After handling a due callback, reset the filter to restore the entire owner customer list');
 await open('Fixture First');
 const unsentBeforeContact=page.getByLabel('Customer note',{exact:true});
 await unsentBeforeContact.fill('Unsent quote detail');
 await page.getByRole('button',{name:'Log lead contacted'}).evaluate(button=>{button.click();button.click();});
 await page.getByText('Contact logged.',{exact:true}).waitFor();
 check(notes.length===4&&notePosts===4&&notes[0].body==='[FIRE FLAG] LEAD_CONTACT_RECORDED',
  'One-tap contacted creates one owner-recorded contact without messaging or quotes');
 check(await unsentBeforeContact.inputValue()==='Unsent quote detail',
  'Contact logging leaves unrelated customer note draft unchanged');
 await page.getByRole('button',{name:'← All customers',exact:true}).click();
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
  noteStatus=201;noteLoseReply=true;await noteInput.fill('Gate instructions\nKeep side gate closed');await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByRole('alert').waitFor();const committedCount=notes.length;check(await noteInput.inputValue()==='Gate instructions\nKeep side gate closed','Lost reply retains multiline draft');await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByText('Note saved.',{exact:true}).waitFor();check(notes.length===committedCount,'Same-text retry after a committed lost reply creates no duplicate');const savedNote=page.locator('.note-row p').filter({hasText:'Gate instructions'});check(await savedNote.evaluate(n=>getComputedStyle(n).whiteSpace)==='pre-wrap','Saved note line breaks are readable');check(await noteInput.inputValue()==='','Confirmed retry clears only the saved draft');const noteGeometry=await noteInput.boundingBox();const addGeometry=await page.getByRole('button',{name:'Add note',exact:true}).boundingBox();check(noteGeometry.width>0&&noteGeometry.x>=0&&noteGeometry.x+noteGeometry.width<=width&&noteGeometry.height>=100&&addGeometry.height>=44,'Multiline note and save control fit narrow screen with usable touch targets');if(process.env.FIRE_NOTE_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_NOTE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FIRE_NOTE_SCREENSHOT_DIR,`customer-notes-${width}-${theme}.png`),fullPage:true});}


  await page.locator('details.customer-header-more>summary').click();await page.getByRole('button',{name:'Edit customer',exact:true}).click();const dialog=page.locator('.customer-edit-dialog');await dialog.getByLabel('Customer name',{exact:true}).fill(' Fixture First Updated ');
  customerHold=true;const customerAccepted=new Promise(r=>onCustomer=r),beforeEdits=customerPatches;
  await dialog.getByRole('button',{name:'Save changes',exact:true}).evaluate(n=>{n.click();n.click();});await accepted(customerAccepted);
  check(customerPatches===beforeEdits+1,'Rapid edit taps submit once');check(await dialog.getByLabel('Customer name',{exact:true}).isDisabled(),'Pending customer fields are frozen');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Escape');check(await dialog.isVisible(),'Pending customer edit stays open');
  releaseCustomer();customerHold=false;await dialog.waitFor({state:'detached'});await page.getByRole('heading',{name:'Fixture First Updated',exact:true}).waitFor();check(true,'Confirmed edit updates correct profile');
  const bounds=await page.locator('.customer-profile').evaluate(n=>({width:n.scrollWidth,viewport:innerWidth}));check(bounds.width<=bounds.viewport,'Customer profile stays within narrow viewport');
 }
 for(const width of [320,390])for(const theme of ['light','dark']){
  historyFailure=false;await page.setViewportSize({width,height:700});await page.goto(origin+'/history');await page.evaluate(value=>window.setTheme(value),theme);await page.locator('.estimate-card').filter({hasText:'Prior query customer'}).waitFor();check(await page.locator('.pipeline-card').count()===0,'Simple list is the default estimate view; pipeline stays available by selection');
  for(const mode of ['Pipeline','List']){
   await page.getByRole('button',{name:mode,exact:true}).click();historyFailure=true;await page.getByLabel('Search estimate history',{exact:true}).fill('Latest '+mode);
   await page.getByRole('alert').filter({hasText:'Synthetic history refresh failed'}).waitFor();
   check(await page.locator('.pipeline-card,.estimate-card').count()===0,'Fresh failed search hides prior query cards in '+mode);check(await page.getByRole('status').count()===0,'Fresh failed search hides old totals/counts');
   historyFailure=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('status').filter({hasText:'1 estimate loaded'}).waitFor();check(await page.getByText('Latest query customer',{exact:true}).isVisible(),'Fresh search retry restores correct result');check(historyReads.at(-1).includes('q=Latest%20'+mode),'Retry preserves the entered query');
  }
 }
 insightMode=true;
 for(const width of [320,390])for(const theme of ['light','dark']){
  insightPayload={customers:[],estimates:[]};await page.setViewportSize({width,height:700});await page.goto(origin+'/insights');await page.evaluate(value=>window.setTheme(value),theme);await page.getByRole('alert').filter({hasText:'Insights unavailable'}).waitFor();check(await page.locator('.insight-kpis').count()===0,'Incomplete Insights response cannot show zero financial metrics');
  insightPayload={customers:[{id:'c',name:'Synthetic',createdAt:'2026-10-19T12:00:00Z',leadSource:'Referral'}],estimates:[{id:'e',status:'completed',service:'Synthetic wash',createdAt:'2026-10-19T12:00:00Z',totalCents:'20000',invoiceTotalCents:'18000',paidCents:'5000',items:[{name:'Synthetic wash',totalCents:'20000'}]}],invoices:[{id:'i',estimateId:'e',totalCents:'18000'}],payments:[{id:'p',estimateId:'e',type:'Cash',amountCents:'6000',createdAt:'2026-10-19T12:00:00Z'},{id:'r',estimateId:'e',type:'Refund',amountCents:'-1000',createdAt:'2026-10-19T12:00:00Z'},{id:'t',estimateId:'e',type:'Tip',amountCents:'500',createdAt:'2026-10-19T12:00:00Z'}]};
  await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.insight-kpis').waitFor();
  check(await page.getByText('$55.00',{exact:true}).isVisible(),'Insights retry preserves signed refunds and tips');check(await page.getByText('$130.00',{exact:true}).isVisible(),'Insights balance excludes tips from principal');check(await page.getByText('$180.00',{exact:true}).isVisible(),'Insights uses revised invoice job value');check(await page.getByRole('alert').count()===0,'Successful Insights retry clears error');
 }
 check(errors.length===0,'No runtime errors: '+errors.join(';'));check(outside.length===0,'No external requests');
 console.log(JSON.stringify({passed:checks,actualCustomerNotes:true,actualEditCustomer:true,actualEstimateHistory:true,actualInsights:true,actualRadix:true,compiledTailwind:true,syntheticLocalhostOnly:true,hostedDataTouched:false,iPhoneTested:false}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
