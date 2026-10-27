/** Actual PaymentsView + CloseoutHistory over actual owner APIs and synthetic SQLite. No hosted services. */
import assert from'node:assert/strict';import{readFileSync,readdirSync,mkdirSync}from'node:fs';import{DatabaseSync}from'node:sqlite';import{createRequire}from'node:module';import{createServer}from'node:http';import{resolve,join}from'node:path';import vm from'node:vm';import ts from'typescript';import{shouldOfferReviewAfterPayment}from'../lib/customer-review-invite.mjs';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild'),postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');const{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PaymentsView'),helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['resolvedBillingTotalCents','billingBalanceCents'].includes(d.name.getText(ast)))),tags=new Set();
function walk(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,walk);}walk(view);const composer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MessageComposer');
const fixture=`import React,{useState,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';import{Button}from'./components/ui/button';import{JobCloseoutHistory}from'./components/job-closeout-history';import{hasCollectibleJobValue,summarizeCustomerBalances}from'./lib/customer-balance-summary';import{completeEstimatePages}from'./lib/estimate-pagination';import{Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger}from'./components/ui/dialog';import{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from'./components/ui/select';import{Label}from'./components/ui/label';import{Textarea}from'./components/ui/textarea';import{MessageSquareText,Copy,Mail,Send}from'lucide-react';import{FIRE_TEMPLATES,fillTemplate}from'./lib/fire-templates';const reviewLink='https://firstinresponseexteriors.com/review',dateTime=v=>v;const money=c=>'$'+(c/100).toFixed(2),statusLabel=x=>x;
${[...tags].filter(t=>!['Button','JobCloseoutHistory'].includes(t)).map(t=>`const ${t}=()=>null;`).join('\n')}
${helpers.map(n=>n.getText(ast)).join('\n')}
${view.getText(ast)}
${composer.getText(ast).replaceAll('window.location.href=', 'window.syntheticExternalHandoff=')}
function ComposerHarness(){const[customerId,setCustomerId]=useState('ready');window.switchComposerCustomer=setCustomerId;return <MessageComposer customer={{id:customerId,name:'Synthetic '+customerId,phone:'5550100999',email:'synthetic@example.invalid',address:'Synthetic address'}} estimate={{id:'job-'+customerId,shareToken:'estimate-'+customerId,invoiceShareToken:'invoice-'+customerId,status:'completed',totalCents:10000,paidCents:10000,service:'Synthetic wash'}} initialTemplate="review" triggerLabel="Prepare review request" onLogged={m=>window.loggedMessage=m} onSent={()=>{window.confirmedSend=true;if(window.failRefresh)throw Error('Synthetic refresh failure')}}/>;}
window.setTheme=t=>document.documentElement.dataset.theme=t;createRoot(document.getElementById('app')).render(location.pathname==='/composer'?<ComposerHarness/>:<PaymentsView searchQuery="" onOpenEstimate={id=>window.openedJob=id} onOpenCustomerReview={id=>window.openedCustomer=id}/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}}),css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
if(process.argv.includes('--compile-only')){assert.ok(bundle.outputFiles[0].text.length>1000);console.log('PASS: real Payments and Job Closeout History browser fixture compiles; rendered assertions not run.');process.exit(0);}
let db,requests=[],mode='ok',postMode='ok',owner={email:'kylebrooks8605@gmail.com'},held,release;
const now=Date.now(),stamp=n=>new Date(now-n*86400000).toISOString();
function seed(){db?.close();db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));requests=[];mode='ok';postMode='ok';owner={email:'kylebrooks8605@gmail.com'};let messageId=0;
 const job=(id,paid=10000)=>{db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(id,'Synthetic '+id,stamp(30));db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)').run('job-'+id,id,'completed',10000,10000,5000,stamp(20));db.prepare('INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)').run('paid-'+id,'job-'+id,'Cash',paid,'paid',stamp(2));};
 const msg=(id,channel,template,at,body='SYNTHETIC PRIVATE MESSAGE')=>db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)').run('message-'+(++messageId),id,'job-'+id,channel,template,body,at);
 for(const id of ['a-due','b-waiting','c-received','d-check-snoozed','e-request-snoozed','ready','prepared','unpaid','overage'])job(id,id==='unpaid'?5000:10000);
 msg('a-due','text_confirmed','review',stamp(10));msg('b-waiting','email_confirmed','review',stamp(2));msg('c-received','text_confirmed','review',stamp(12));db.prepare('INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)').run('review-received','c-received','[FIRE FLAG] REVIEW_RECEIVED',stamp(1));
 msg('d-check-snoozed','text_confirmed','review',stamp(10));msg('d-check-snoozed','review_check_snoozed','reviewCheckSnooze',stamp(1),stamp(-6));msg('e-request-snoozed','review_snoozed','reviewSnooze',stamp(1),stamp(-6));msg('prepared','text_prepared','review',stamp(1));
 db.prepare("INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) VALUES('overage','payment_overage','Synthetic hold','Synthetic only','overage','job-overage',?)").run(stamp(1));
 db.prepare("UPDATE payments SET created_at=? WHERE id='paid-prepared'").run(stamp(1));
 for(let n=0;n<201;n++){const id='history-'+String(n).padStart(3,'0');job(id);msg(id,'text_confirmed','review',stamp(1));}
 for(let n=0;n<201;n++)job('ready-'+String(n).padStart(3,'0'));
}
const env={DB:{prepare(sql){
 return {all:async()=>({results:db.prepare(sql).all()}),bind(...args){return {
  all:async()=>({results:db.prepare(sql).all(...args)}),
  first:async()=>db.prepare(sql).get(...args)??null,
  run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})
 };}};
},batch:async statements=>{db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}}};
function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:k=>{assert.ok(k in imports,'Unexpected dependency '+k);return imports[k]},Response,URL,Date,crypto});return exports;}
const flags=load('lib/customer-activity-flags.ts',{}),historyLib=load('lib/job-closeout-history.ts',{'./customer-activity-flags':flags}),paymentLib=load('lib/payment-closeout-actions.ts',{}),auth={'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>owner}};
const history=load('app/api/job-closeout-history/route.ts',{...auth,'../../../lib/job-closeout-history':historyLib}),ready=load('app/api/payment-closeouts/route.ts',{...auth,'../../../lib/payment-closeout-actions':paymentLib}),snooze=load('app/api/dashboard-review-checks/snooze/route.ts',{'cloudflare:workers':{env},'../../../chatgpt-auth':{getChatGPTUser:async()=>owner}});seed();
const messages=load('app/api/customer-messages/route.ts',{...auth,'../../../lib/customer-review-invite.mjs':{shouldOfferReviewAfterPayment}}),notes=load('app/api/customer-notes/route.ts',auth),checkLib=load('lib/dashboard-review-checks.ts',{'./customer-activity-flags':flags}),reviewChecks=load('app/api/dashboard-review-checks/route.ts',{...auth,'../../../lib/dashboard-review-checks':checkLib});let messageMode='ok';
async function readAllReady(){
 const actions=[];let cursor=null;const visited=new Set();
 do{assert.ok(!visited.has(cursor),'Ready cursor advances');visited.add(cursor);const response=await ready.GET(new Request('http://fixture.local/api/payment-closeouts'+(cursor?'?cursor='+encodeURIComponent(cursor):'')));assert.equal(response.status,200);const data=await response.json();actions.push(...data.actions);cursor=data.nextCursor;}while(cursor);
 return {actions};
}
async function readAllHistory(){
 const items=[];let cursor=null;const visited=new Set();
 do{assert.ok(!visited.has(cursor),'History cursor advances');visited.add(cursor);const response=await history.GET(new Request('http://fixture.local/api/job-closeout-history'+(cursor?'?cursor='+encodeURIComponent(cursor):'')));assert.equal(response.status,200);const data=await response.json();items.push(...data.items);cursor=data.nextCursor;}while(cursor);
 return {items};
}
if(process.argv.includes('--api-only')){
 const historyData=readAllHistory;
 const post=async(method,data)=>await messages[method](new Request('http://fixture.local/api/customer-messages',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
 const prepared=await post('POST',{customerId:'ready',estimateId:'job-ready',template:'review',channel:'text_prepared',body:'Synthetic review URL https://firstinresponseexteriors.com/review',requestId:crypto.randomUUID()});
 assert.equal(prepared.status,201);let draft=(await prepared.json()).message;
 const cancelled=await post('PATCH',{customerId:'ready',preparedMessageId:draft.id,ownerConfirmedNotSent:true});assert.equal(cancelled.status,200);
 assert.equal((await readAllReady()).actions.find(x=>x.customerId==='ready').state,'ready');
 const replacement=await post('POST',{customerId:'ready',estimateId:'job-ready',template:'review',channel:'text_prepared',body:'Synthetic review URL https://firstinresponseexteriors.com/review',requestId:crypto.randomUUID()});assert.equal(replacement.status,201);draft=(await replacement.json()).message;
 assert.equal((await historyData()).items.some(x=>x.customerId==='ready'),false);
 const payload={customerId:'ready',preparedMessageId:draft.id,ownerConfirmedSent:true};
 const sent=await post('PATCH',payload);assert.equal(sent.status,200);assert.equal((await sent.json()).message.id,draft.id+':owner-confirmed');
 assert.equal((await post('PATCH',payload)).status,200);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id='ready' AND channel='text_confirmed'").get().n,1);
 assert.equal((await readAllReady()).actions.some(x=>x.customerId==='ready'),false);
 assert.equal((await historyData()).items.find(x=>x.customerId==='ready').state,'waiting');
 db.prepare("UPDATE customer_messages SET created_at=? WHERE customer_id='ready' AND channel='text_confirmed'").run(stamp(8));
 assert.equal((await(await reviewChecks.GET()).json()).checks.some(x=>x.customerId==='ready'),true);
 assert.equal((await historyData()).items.find(x=>x.customerId==='ready').state,'due');
 assert.equal((await notes.POST(new Request('http://fixture.local/api/customer-notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:'ready',body:'[FIRE FLAG] REVIEW_RECEIVED'})}))).status,201);
 assert.equal((await(await reviewChecks.GET()).json()).checks.some(x=>x.customerId==='ready'),false);
 assert.equal((await historyData()).items.find(x=>x.customerId==='ready').state,'received');
 db.close();console.log('PASS actual SQLite/API closeout lifecycle: prepare, confirm, idempotent retry, waiting, due, received and cleared reminder. No browser assertions executed.');process.exit(0);
}
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://fixture.local'),send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};try{
 if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css.css);return;}
 if(url.pathname.startsWith('/api/')){let body='';for await(const c of req)body+=c;requests.push({path:req.url,method:req.method,body:body?JSON.parse(body):null});
  if(url.pathname==='/api/message-templates'){send(200,{});return;}
  if(url.pathname==='/api/estimate-history'){send(200,{estimates:[],nextCursor:null});return;}if(url.pathname==='/api/payments'){send(200,{payments:mode==='ledger'?Array.from({length:12},(_,i)=>({id:'synthetic-ledger-'+i,customer:'Synthetic Customer '+i,service:'Synthetic wash',type:'Cash',status:'refunded',amountCents:1000+i,createdAt:stamp(i)})):[]});return;}
  if(mode==='offline'&&url.pathname==='/api/job-closeout-history'){send(503,{error:'Synthetic history interruption'});return;}
  if(url.pathname==='/api/job-closeout-history'&&mode==='bad'){send(200,{items:[{customerId:'foreign',state:'received'}],nextCursor:null});return;}
  if(url.pathname==='/api/payment-closeouts'&&(mode==='bad-ready'||mode==='bad-ready-older'&&url.searchParams.has('cursor'))){send(200,{actions:[{estimateId:'bad'}],mayHaveMore:false,nextCursor:null});return;}
  if(url.pathname==='/api/dashboard-review-checks/snooze'&&postMode==='offline'){send(503,{error:'Synthetic save interruption'});return;}
  const request=new Request(url,{method:req.method,headers:{'Content-Type':'application/json'},...(body?{body}:{})});
  const response=url.pathname==='/api/customer-messages'?await messages[req.method](request):url.pathname==='/api/customer-notes'?await notes.POST(request):url.pathname==='/api/dashboard-review-checks'?await reviewChecks.GET():url.pathname==='/api/job-closeout-history'?await history.GET(request):url.pathname==='/api/payment-closeouts'?await ready.GET(request):url.pathname==='/api/dashboard-review-checks/snooze'?await snooze.POST(request):Response.json({error:'Unexpected request'},{status:400});const data=await response.json();
  if(url.pathname==='/api/job-closeout-history'&&mode==='hold'){mode='ok';data.items[0].customerName='STALE CUSTOMER RESPONSE';held=new Promise(r=>{release=r});await held;}
  if(url.pathname==='/api/dashboard-review-checks/snooze'&&postMode==='lost'){postMode='ok';send(200,{saved:true,customerId:'wrong-customer',snoozeUntil:'bad'});return;}
  if(url.pathname==='/api/customer-messages'&&req.method==='PATCH'&&data.message){if(messageMode==='lost'){send(503,{error:'Synthetic confirmation reply lost'});return;}if(messageMode!=='ok'){data.message[messageMode]='mismatched-receipt';}}
  send(response.status,data);return;
 }res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><main style="padding:16px"><div id="app"></div></main><script type="module" src="/bundle.js"></script></html>');
 }catch(error){send(500,{error:String(error)});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[],outside=[],check=(v,label)=>{assert.ok(v,label);checks++;};
try{browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){outside.push(r.request().url());return r.abort();}return r.continue();});
 const stage=()=>page.getByRole('group',{name:'Job closeout stage',exact:true});
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}])for(const theme of ['light','dark']){
  await page.goto('about:blank');seed();await page.setViewportSize(size);await page.goto(origin);await page.evaluate(t=>window.setTheme(t),theme);await page.getByRole('heading',{name:'Review requests',exact:true}).waitFor();const readyPanel=page.getByRole('region',{name:'Paid jobs ready for review follow-up',exact:true});
  const primaryTotals=page.locator('.payments-primary-metrics article');
  check(await primaryTotals.count()===3,'Payments keeps balance, deposit and collected totals visible');
  const otherTotals=page.locator('details.payments-secondary-metrics');
  check(await otherTotals.evaluate(n=>!n.open),'Nonurgent payment totals begin collapsed');
  await otherTotals.locator('summary').click();
  check(await otherTotals.locator('article').count()===3,'Other payment totals remain accessible with one tap');
  check(await otherTotals.locator('summary').evaluate(n=>n.getBoundingClientRect().height>=44),'Additional totals summary is touch friendly');
  await otherTotals.locator('summary').click();

  check(!(await readyPanel.getByRole('group',{name:'Sort paid review requests',exact:true}).isVisible()),'Review sorting stays collapsed initially');await readyPanel.locator('.payment-review-options>summary').click();check(await readyPanel.getByRole('button',{name:'Customer A–Z',exact:true}).isVisible(),'Review filter and sort actions remain reachable');await readyPanel.locator('.payment-review-options>summary').click();
  check((await readyPanel.innerText()).includes('Review message prepared · sending not confirmed'),'Prepared drafts remain unconfirmed');check(!(await readyPanel.innerText()).includes('Synthetic unpaid')&&!(await readyPanel.innerText()).includes('Synthetic overage'),'Unpaid and billing holds never enter verified ready queue');
  await readyPanel.getByRole('link',{name:'Open job',exact:true}).first().click();check(await page.evaluate(()=>window.openedJob)==='job-prepared','Ready action opens exact prepared job without reload');
  mode='bad-ready-older';await page.getByRole('button',{name:'Load older paid jobs',exact:true}).click();await page.getByRole('alert').filter({hasText:'Older review follow-ups could not be loaded'}).waitFor();check((await readyPanel.innerText()).includes('Previously loaded jobs are still available'),'Malformed older ready page preserves verified jobs');mode='ok';await page.getByRole('button',{name:'Load older paid jobs',exact:true}).click();await page.getByRole('status').filter({hasText:'203 jobs'}).waitFor();const refreshedReady=page.waitForResponse(r=>r.url().includes('/api/payment-closeouts?cursor=')&&r.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event('fire:attention-saved')));await refreshedReady;await page.getByRole('status').filter({hasText:'203 jobs'}).waitFor();check(requests.filter(r=>r.path.startsWith('/api/payment-closeouts?cursor=')).length>=2,'Confirmed changes refresh every previously loaded ready page');
  await stage().getByRole('button',{name:'Review progress',exact:true}).click();const progress=page.getByRole('region',{name:'Review closeout progress',exact:true});await progress.getByRole('button',{name:'Check due (1)',exact:true}).waitFor();const due=progress.locator('#closeout-progress-a-due');check(await due.count()===1,'Seven-day checks are customer-deduplicated');await due.getByRole('button',{name:'Check customer review status',exact:true}).click();check(await page.evaluate(()=>window.openedCustomer)==='a-due','Check opens exact existing customer review activity');await due.getByRole('button',{name:'Open exact job',exact:true}).click();check(await page.evaluate(()=>window.openedJob)==='job-a-due','Tracked request opens its actual completed job');
  await progress.getByRole('button',{name:'Load older review progress',exact:true}).click();await progress.getByRole('status').filter({hasText:'206 loaded records'}).waitFor();await progress.getByRole('button',{name:'Refresh review progress',exact:true}).click();await progress.getByRole('status').filter({hasText:'206 loaded records'}).waitFor();check(requests.filter(r=>r.path.startsWith('/api/job-closeout-history?cursor=')).length>=2,'Tracking refresh preserves all verified loaded pages');
  await progress.getByRole('button',{name:/^Review received \(/}).click();check((await progress.locator('.closeout-progress-list').innerText()).includes('Review received logged'),'Received state comes from existing owner flag');await progress.getByRole('button',{name:/^Snoozed \(/}).click();check((await progress.locator('.closeout-progress-list').innerText()).includes('Review request deferred · sending remains unconfirmed'),'Request snooze remains distinct from confirmed send');
  await progress.getByRole('button',{name:/^Awaiting review \(/}).click();await page.getByLabel('Find a customer or job',{exact:true}).fill('job-b-waiting');check(await progress.locator('.closeout-progress-card').count()===1,'Search finds exact saved job');check((await progress.locator('.closeout-progress-card').innerText()).includes('Check review status after'),'Waiting status shows next check time');await page.getByLabel('Find a customer or job',{exact:true}).fill('missing-synthetic');await progress.getByText('No matching customers or jobs in loaded review progress.',{exact:true}).waitFor();await progress.getByRole('button',{name:'Reset review progress view',exact:true}).click();check(await page.getByLabel('Find a customer or job',{exact:true}).inputValue()==='','Reset clears review search');check(await progress.getByRole('button',{name:'Check due (1)',exact:true}).getAttribute('aria-pressed')==='true','Reset restores due status');check((await progress.getByRole('status').allTextContents()).some(text=>text.includes('206 loaded records')),'Review progress retains loaded pages after reset');
  mode='offline';await progress.getByRole('button',{name:'Refresh review progress',exact:true}).click();await progress.getByRole('alert').waitFor();check(await due.getByRole('button',{name:'Snooze status check 7 days',exact:true}).isDisabled(),'Failed refresh blocks stale review-check writes');mode='ok';await progress.getByRole('button',{name:'Retry review progress',exact:true}).click();await progress.getByRole('button',{name:'Check due (1)',exact:true}).waitFor();
  await due.getByRole('button',{name:'Snooze status check 7 days',exact:true}).click();const confirmation=page.getByRole('region',{name:'Confirm review check snooze',exact:true});check(requests.every(r=>r.method==='GET'),'Opening records, searching and preparing confirmation never write');check(await confirmation.evaluate(n=>document.activeElement===n),'Confirmation receives mobile/keyboard focus');db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)").run('changed-review-flag','a-due','[FIRE FLAG] REVIEW_RECEIVED',stamp(0));
  await progress.getByRole('button',{name:'Refresh review progress',exact:true}).click();await progress.getByRole('button',{name:'Check due (0)',exact:true}).waitFor();
  await confirmation.getByRole('button',{name:'Confirm check snooze',exact:true}).click();
  await progress.getByRole('alert').filter({hasText:'This review check changed since it was opened'}).waitFor();
  check(requests.every(r=>r.method==='GET'),'A stale review confirmation cannot write after received-review status changes');
  db.prepare("DELETE FROM customer_notes WHERE id='changed-review-flag'").run();
  await progress.getByRole('button',{name:'Refresh review progress',exact:true}).click();await progress.getByRole('button',{name:'Check due (1)',exact:true}).waitFor();
  await due.getByRole('button',{name:'Snooze status check 7 days',exact:true}).click();
  await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();check(await due.evaluate(n=>document.activeElement===n),'Cancel restores exact card focus');await due.getByRole('button',{name:'Snooze status check 7 days',exact:true}).click();await confirmation.getByRole('button',{name:'Confirm check snooze',exact:true}).evaluate(n=>{n.click();n.click()});await progress.getByRole('button',{name:'Check due (0)',exact:true}).waitFor();check(requests.filter(r=>r.method==='POST').length===1,'Rapid confirmation posts once');check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id='a-due' AND template='reviewCheckSnooze'").get().n===1,'Native SQLite contains exactly one snooze receipt');await progress.getByRole('button',{name:'Snoozed (3)',exact:true}).click();check((await progress.locator('.closeout-progress-list').innerText()).includes('Synthetic a-due'),'Confirmed deferral stays visible in tracked history');
  await page.waitForFunction(()=>{const n=document.querySelector('.closeout-status-controls button[aria-pressed="true"]');if(!n)return false;const c=getComputedStyle(n);const lum=s=>{const v=s.match(/[0-9.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722};const a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;});check(true,'Selected status text retains readable contrast in each theme');
  check(await progress.locator('.closeout-status-controls button,.closeout-card-actions button').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)),'Mobile controls have 44px touch targets');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Light/dark view fits narrow and landscape screens');
  if(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR,{recursive:true});await progress.scrollIntoViewIfNeeded();await progress.screenshot({path:join(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR,`closeout-${size.width}-${theme}.png`)});}
 }
 // Long payment history starts with eight visible entries; every older entry stays one tap away.
 await page.goto('about:blank');seed();mode='ledger';await page.setViewportSize({width:390,height:844});await page.goto(origin);
 const historyDisclosure=page.locator('details.payments-history-disclosure');
 await historyDisclosure.locator('summary').waitFor();
 check(!(await page.locator('.payment-history>article').first().isVisible()),'Payment history is initially collapsed to keep the iPhone balances simple');
 await historyDisclosure.locator('summary').click();
 check(await historyDisclosure.evaluate(n=>n.open),'One tap reveals complete saved payment history and refund actions');
 const ledgerButton=page.getByRole('button',{name:'View all 12 payments',exact:true});await ledgerButton.waitFor();
 check(await page.locator('.payment-history>article').count()===8,'Payments shows only eight latest history entries initially on iPhone');
 check(await page.locator('.payment-history>article').first().innerText().then(t=>t.includes('Synthetic Customer 0')),'Most recent ledger record stays first');
 await ledgerButton.click();
 check(await page.locator('.payment-history>article').count()===12,'View all payments exposes every older saved transaction without deleting data');
 check(await page.locator('.payment-history>article').last().innerText().then(t=>t.includes('Synthetic Customer 11')),'Oldest payment remains reachable');
 await page.getByRole('button',{name:'Show recent 8 payments',exact:true}).click();
 check(await page.locator('.payment-history>article').count()===8,'Owner can collapse payment history again');
 check(requests.every(r=>r.method==='GET'),'Expanding payment history makes no payment or refund writes');mode='ok';
 // Customer switches must replace edited private drafts and job-scoped links.
 for(const theme of ['light','dark']){
 await page.goto('about:blank');seed();await page.setViewportSize({width:390,height:844});await page.goto(origin+'/composer');await page.evaluate(t=>window.setTheme(t),theme);await page.getByRole('button',{name:'Prepare review request',exact:true}).click();
 let scopeDialog=page.getByRole('dialog',{name:'Message Synthetic ready',exact:true});await scopeDialog.getByLabel('Personalized message',{exact:true}).fill('PRIVATE UNSAVED TEXT FOR FIRST CUSTOMER');
 await page.evaluate(()=>window.switchComposerCustomer('prepared'));scopeDialog=page.getByRole('dialog',{name:'Message Synthetic prepared',exact:true});
 await page.waitForFunction(()=>document.querySelector('#customerMessage')?.value.includes('Synthetic'));
 check(!(await scopeDialog.getByLabel('Personalized message',{exact:true}).inputValue()).includes('PRIVATE UNSAVED'),'Switching customer clears an edited prior-customer draft');
 check((await scopeDialog.getByLabel('Personalized message',{exact:true}).inputValue()).includes('Hi Synthetic'),'New customer receives a fresh personalized template');
 await scopeDialog.getByLabel('Message type',{exact:true}).click();await page.getByRole('option',{name:'Estimate ready',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#customerMessage')?.value.includes('/estimate/estimate-prepared'));
 check(!(await scopeDialog.getByLabel('Personalized message',{exact:true}).inputValue()).includes('/estimate/estimate-ready'),'Template uses new job link, never prior customer link');
 check(await scopeDialog.evaluate(n=>n.scrollWidth<=n.clientWidth),'Pending saved drafts and template controls fit the iPhone composer');
 check(await scopeDialog.getByRole('button',{name:/^Resume text/}).evaluate(n=>n.getBoundingClientRect().height>=44&&n.getBoundingClientRect().right<=innerWidth),'Long saved-draft recovery control wraps inside viewport with a 44px target');
 check(requests.every(r=>r.method==='GET'),'Customer switch never saves or sends the discarded draft');
 if(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR)await scopeDialog.screenshot({path:join(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR,`closeout-customer-scope-${theme}.png`)});
 }
 // Committed write + malformed response: an explicit retry reuses the original receipt ID.
 await page.goto('about:blank');seed();await page.goto(origin);await stage().getByRole('button',{name:'Review progress',exact:true}).click();await page.locator('#closeout-progress-a-due').waitFor();postMode='lost';await page.getByRole('button',{name:'Snooze status check 7 days',exact:true}).click();await page.getByRole('button',{name:'Confirm check snooze',exact:true}).click();await page.getByRole('alert').filter({hasText:'Retry this same confirmation'}).waitFor();check(requests.filter(r=>r.method==='POST').length===1,'Lost reply never auto-retries');await page.getByRole('button',{name:'Confirm check snooze',exact:true}).click();await page.getByRole('button',{name:'Check due (0)',exact:true}).waitFor();const posts=requests.filter(r=>r.method==='POST');check(posts.length===2&&posts[0].body.operationId===posts[1].body.operationId,'Retry uses exact original operation ID');check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id='a-due' AND template='reviewCheckSnooze'").get().n===1,'Retry cannot append duplicate real SQL history');
 for(const failure of ['offline','bad']){mode=failure;await page.getByRole('button',{name:'Refresh review progress',exact:true}).click();await page.getByRole('alert').filter({hasText:'Previously shown records may be out of date'}).waitFor();check(await page.getByRole('button',{name:'Snooze status check 7 days',exact:true}).count()===0,'Failed read never invents fresh due actions');mode='ok';await page.getByRole('button',{name:'Retry review progress',exact:true}).click();await page.getByRole('button',{name:'Check due (0)',exact:true}).waitFor();}
 // A response released after leaving/reopening Review progress cannot overwrite the new screen.
 await stage().getByRole('button',{name:'Needs request',exact:true}).click();mode='hold';await stage().getByRole('button',{name:'Review progress',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.closeout-history [role="status"]')?.textContent.includes('Checking'));const deadline=Date.now()+5000;while(!release&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(release,'History hold was reached');await stage().getByRole('button',{name:'Needs request',exact:true}).click();await stage().getByRole('button',{name:'Review progress',exact:true}).click();await page.getByRole('button',{name:'Check due (0)',exact:true}).waitFor();release();await page.getByRole('button',{name:/^All progress \(/}).click();check(!(await page.locator('.closeout-history').innerText()).includes('STALE CUSTOMER RESPONSE'),'Unmounted late read cannot replace current customer data');
 owner=null;await page.getByRole('button',{name:'Refresh review progress',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unauthorized'}).waitFor();check(await page.locator('.closeout-history').getByRole('button',{name:'Refresh review progress',exact:true}).isEnabled(),'Owner can explicitly recover unauthorized/outage state');check(await page.locator('.closeout-progress-card').count()===0,'Session expiry clears private cached review cards');check(errors.length===0&&outside.length===0,'No browser errors or external requests: '+errors.join(';'));owner={email:'kylebrooks8605@gmail.com'};db.prepare('INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)').run('cross-view-review','b-waiting','[FIRE FLAG] REVIEW_RECEIVED',new Date().toISOString());await page.getByRole('button',{name:'Retry review progress',exact:true}).click();await page.getByRole('button',{name:'Review received (2)',exact:true}).waitFor();check(true,'Existing review flag changes reconcile after authenticated refresh');check(requests.filter(r=>r.method==='POST').every(r=>r.path==='/api/dashboard-review-checks/snooze'),'Only explicit review-check snoozes wrote synthetic data'); // Whole closeout transition: actual MessageComposer/Radix, actual APIs and isolated SQLite.
 // Completion/payment transitions below are synthetic ledger setup, not payment UI acceptance.
 for(const theme of ['light','dark']){
  await page.goto('about:blank');seed();messageMode='ok';await page.setViewportSize({width:390,height:844});
  db.prepare("UPDATE estimates SET status='scheduled' WHERE id='job-ready'").run();
  check(!(await readAllReady()).actions.some(x=>x.estimateId==='job-ready'),'A paid but unfinished job is not eligible');
  db.prepare("UPDATE estimates SET status='completed' WHERE id='job-ready'").run();
  db.prepare("UPDATE payments SET amount_cents=5000 WHERE id='paid-ready'").run();
  check(!(await readAllReady()).actions.some(x=>x.estimateId==='job-ready'),'Completion with only deposit cannot request a review');
  db.prepare("UPDATE payments SET amount_cents=10000 WHERE id='paid-ready'").run();
  check((await readAllReady()).actions.some(x=>x.estimateId==='job-ready'&&x.state==='ready'),'Confirmed exact payment makes completed job eligible');
  await page.goto(origin+'/composer');await page.evaluate(t=>window.setTheme(t),theme);await page.getByRole('button',{name:'Prepare review request',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Message Synthetic ready',exact:true});await dialog.getByRole('button',{name:'Text',exact:true}).click();await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).waitFor();
  check(await page.evaluate(()=>window.syntheticExternalHandoff?.startsWith('sms:5550100999')),'External SMS handoff captured without opening or sending to another app');
  check((await dialog.getByLabel('Personalized message',{exact:true}).inputValue()).includes('https://firstinresponseexteriors.com/review'),'Existing review URL is used in actual personalized template');
  check((await readAllReady()).actions.some(x=>x.estimateId==='job-ready'&&x.state==='prepared'),'Preparation remains eligible and unconfirmed');
  check(!(await readAllHistory()).items.some(x=>x.customerId==='ready'),'Preparing a message never starts a review-received clock');
  page.once('dialog',event=>event.accept());await dialog.getByRole('button',{name:'Discard unsent draft',exact:true}).click();
  await dialog.getByRole('status').filter({hasText:'Marked not sent.'}).waitFor();
  check((await readAllReady()).actions.find(x=>x.estimateId==='job-ready')?.state==='ready','Discarded draft clears misleading prepared reminder');
  check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id='ready' AND channel='send_cancelled'").get().n===1,'Discard keeps immutable cancellation evidence');
  await dialog.getByRole('button',{name:'Text',exact:true}).click();
  try{await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).waitFor();}
  catch(error){throw Error('Synthetic reprepare diagnostic: '+JSON.stringify({statuses:await dialog.getByRole('status').allTextContents(),browserErrors:errors,requests:requests.slice(-4).map(r=>({method:r.method,path:r.path,channel:r.body?.channel,operation:r.body?.requestId}))}),{cause:error});}
  for(const field of ['id','customerId','estimateId','template','body','channel','createdAt','lost']){
   messageMode=field;const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/customer-messages'&&r.request().method()==='PATCH');await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).click();await reply;await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.textContent==='I sent the prepared message'&&!n.disabled));
   await dialog.getByRole('status').filter({hasText:field==='lost'?'Synthetic confirmation reply lost':'The send receipt does not match'}).waitFor();
   check(await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).isEnabled(),'Unverified '+field+' keeps exact prepared message recoverable');
   check(await page.evaluate(()=>window.confirmedSend!==true),'Unverified '+field+' cannot invoke confirmed-save callbacks');
  }
  check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id='ready' AND channel='text_confirmed'").get().n===1,'Retries preserve one immutable send confirmation');
  messageMode='ok';await page.evaluate(()=>window.failRefresh=true);const before=requests.filter(x=>x.method==='PATCH').length;
  await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).evaluate(n=>{n.click();n.click()});
  await dialog.getByRole('status').filter({hasText:'Send confirmation saved. Customer records could not be refreshed'}).waitFor();
  check(requests.filter(x=>x.method==='PATCH').length===before+1,'Rapid duplicate taps issue exactly one confirmation');
  check(await page.evaluate(()=>window.confirmedSend===true),'Only verified saved receipt invokes confirmed callback');
  check(!(await readAllReady()).actions.some(x=>x.customerId==='ready'),'Confirmed send clears paid request queue');
  check((await readAllHistory()).items.find(x=>x.customerId==='ready')?.state==='waiting','Confirmed send advances review progress to awaiting review');
  check(await dialog.locator('.message-actions button').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)),'Actual composer controls preserve 44px touch targets');
  check(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth),'Composer fits iPhone width in both themes');
  // Move only synthetic confirmation time to exercise the real seven-day check.
  db.prepare("UPDATE customer_messages SET created_at=? WHERE customer_id='ready' AND channel='text_confirmed'").run(stamp(8));
  check((await (await reviewChecks.GET()).json()).checks.some(x=>x.customerId==='ready'),'Seven-day owner check appears after confirmed send');
  check((await readAllHistory()).items.find(x=>x.customerId==='ready')?.state==='due','Closeout progress and Dashboard agree on due state');
  const received=await notes.POST(new Request('http://fixture.local/api/customer-notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:'ready',body:'[FIRE FLAG] REVIEW_RECEIVED'})}));
  check(received.status===201,'Explicit owner note records review receipt via existing writer');
  check(!(await (await reviewChecks.GET()).json()).checks.some(x=>x.customerId==='ready'),'Received flag clears outstanding Dashboard review check');
  check((await readAllHistory()).items.find(x=>x.customerId==='ready')?.state==='received','Same saved flag updates closeout progress');
  check(!(await readAllReady()).actions.some(x=>x.customerId==='ready'),'Received flag cannot reintroduce an outreach request');
  if(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR)await dialog.screenshot({path:join(process.env.FIRE_CLOSEOUT_SCREENSHOT_DIR,`closeout-message-${theme}.png`)});
 }
check(errors.length===0&&outside.length===0,'Lifecycle has no browser errors or external HTTP requests: '+errors.join(';'));console.log(JSON.stringify({passed:checks,actualMessageComposer:true,actualPaymentsView:true,actualCloseoutHistory:true,actualSqliteAndOwnerApis:true,lightDark:true,hostedWrites:false,physicalIPhone:false}));
}finally{release?.();await browser?.close();await new Promise(r=>server.close(r));db?.close();}
