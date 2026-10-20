/** Real shared customer history, Schedule and Dashboard components; synthetic localhost only. */
import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';import {createServer} from 'node:http';import {resolve,join} from 'node:path';import ts from 'typescript';
const require=createRequire(import.meta.url),root=process.cwd(),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild'),postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),views=['CustomersView','ScheduleView','DashboardView'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)),tags=new Set();
function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,visit);}views.forEach(visit);
const fixture=`import React,{useState,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';import{Button}from'./components/ui/button';import{Input}from'./components/ui/input';import{Label}from'./components/ui/label';import{summarizeCustomerBalances}from'./lib/customer-balance-summary';import{messageHistoryEntries}from'./lib/message-history';import{completeEstimatePages}from'./lib/estimate-pagination';import{mayUseOfflinePhotoDirectory,mustClearOfflinePhotoDirectory}from'./lib/offline-photo-availability';
const money=c=>'$'+(c/100).toFixed(2),dateTime=v=>v,statusLabel=v=>v,paymentTypeLabel=v=>v,messageLabels={},resolvedBillingTotalCents=e=>e.invoiceTotalCents??e.totalCents,billingBalanceCents=e=>Math.max(0,resolvedBillingTotalCents(e)-e.paidCents),useCurrentTime=()=>Date.parse('2026-10-20T14:00:00Z');
const saveOfflinePhotoCustomerDirectory=async()=>{},loadOfflinePhotoCustomerDirectory=async()=>[],clearOfflinePhotoCustomerDirectory=async()=>{};
${[...tags].filter(t=>!['Button','Input','Label','ScheduleWeather'].includes(t)).map(t=>`const ${t}=()=>null;`).join('\n')}
${views.map(n=>n.getText(ast)).join('\n')}
const ScheduleWeather=({nextJobAt,requestedJobAt,reviewKey})=><output data-testid="schedule-weather-target" data-requested-job={requestedJobAt??""} data-review-key={reviewKey??0}>{nextJobAt??""}</output>;
function Screen(){const[query,setQuery]=useState(''),[focus,setFocus]=useState(null),[key,setKey]=useState(0);window.setQuery=setQuery;window.focusSavedRecord=(kind,id)=>{setFocus({kind,id,customerId:'first'});setKey(v=>v+1)};
return location.pathname==='/schedule'?<ScheduleView searchQuery={query}/>:['/dashboard','/dashboard-no-address','/dashboard-bad-contact'].includes(location.pathname)?<DashboardView userName="Synthetic owner" metrics={{estimates:2,openValue:0,outstanding:0}} estimates={[
{id:'later-dashboard-job',customer:'Later customer',service:'Second scheduled',status:'scheduled',createdAt:'2026-10-19T12:00:00Z',scheduledAt:'2026-10-20T20:00:00Z',totalCents:12000,paidCents:0},
{id:'declined-dashboard-job',customer:'Declined customer',service:'Cancelled',status:'declined',createdAt:'2026-10-19T12:00:00Z',scheduledAt:'2026-10-20T14:15:00Z',totalCents:8000,paidCents:0},
{id:'completed-dashboard-job',customer:'Finished customer',service:'Completed work',status:'completed',createdAt:'2026-10-19T12:00:00Z',scheduledAt:'2026-10-20T14:30:00Z',totalCents:9000,paidCents:0},
{id:'past-dashboard-job',customer:'Old customer',service:'Past appointment',status:'scheduled',createdAt:'2026-10-19T12:00:00Z',scheduledAt:'2026-10-19T18:00:00Z',totalCents:9500,paidCents:0},
{id:'exact-dashboard-job',customer:'Exact customer',service:'Exact job',status:'scheduled',createdAt:'2026-10-19T12:00:00Z',scheduledAt:'2026-10-20T15:00:00Z',address:location.pathname==='/dashboard-no-address'?'':'101 Exterior Ave, Tulsa, OK',phone:location.pathname==='/dashboard-bad-contact'?'not-a-phone':'(918) 555-0146',email:location.pathname==='/dashboard-bad-contact'?'customer@@example.invalid':'customer@example.invalid',totalCents:10000,paidCents:0}
]} onSaved={()=>{}} onNavigate={tab=>window.openedTab=tab} onOpenEstimate={id=>window.openedEstimate=id}/>:<CustomersView searchQuery="" onEstimateSaved={()=>{}} focusCustomerId={focus?.customerId} focusSection={focus?.kind==='payment'?'payments':'notes'} focusRecord={focus} recordRequestKey={key} onRecordFocusHandled={()=>setFocus(null)}/>;}
window.setTheme=t=>document.documentElement.dataset.theme=t;createRoot(document.getElementById('app')).render(<Screen/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});const css=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
if(process.argv.includes('--compile-only')){assert.ok(bundle.outputFiles[0].text.length>1000&&css.css.includes('.customer-history-tools'));console.log('PASS: connected records browser fixture compiles; no rendered assertions run.');process.exit(0);}
const stamp='2026-10-19T12:00:00Z',customer=id=>({id,name:'Fixture '+id,email:id+'@example.invalid',phone:'',address:'',createdAt:stamp,estimateCount:25,estimateTotal:250000,paidTotal:2500});
const estimates=Array.from({length:25},(_,i)=>({id:'job-first-'+i,customerId:'first',service:'Fixture Service '+i,status:'approved',totalCents:10000,depositCents:5000,paidCents:i===0?2500:0,createdAt:stamp}));estimates.push({...estimates[0],id:'foreign-job',customerId:'second',service:'SECOND PRIVATE JOB'});
const payload={customers:[customer('first'),customer('second')],estimates,invoices:['aa0000','bb0000','cc0000'].map((prefix,i)=>({id:prefix+'-invoice',customerId:'first',estimateId:'job-first-'+i,status:'sent',totalCents:10000,shareToken:'token-'+i,createdAt:stamp})),notes:Array.from({length:15},(_,i)=>({id:'note-first-'+i,customerId:'first',body:'Saved gate note '+i,createdAt:stamp})),payments:[{id:'payment-first',customerId:'first',estimateId:'job-first-0',type:'Cash',amountCents:2500,reference:'REF-PRIMARY-2500',createdAt:stamp}],photos:[],messages:[{id:'msg-a',customerId:'first',channel:'text_prepared',template:'estimate',body:'Appointment details confirmed by owner',createdAt:stamp},{id:'msg-a:owner-confirmed',customerId:'first',channel:'text_confirmed',template:'estimate',body:'Appointment details confirmed by owner',createdAt:stamp},{id:'msg-b',customerId:'first',channel:'email_prepared',template:'invoice',body:'Invoice reminder synthetic',createdAt:stamp}]};
const scheduleJob=(id,date,status='scheduled')=>({id,customer:id,customerId:'first',service:'Synthetic wash',address:'Address '+id,scheduledAt:date,status,totalCents:10000,depositCents:5000,paidCents:0,createdAt:stamp});
const scheduled=[{...scheduleJob('today-morning','2026-10-20T15:00:00Z'),phone:'(918) 555-0146',email:'first@example.invalid'}, {...scheduleJob('today-late','2026-10-21T04:30:00Z'),phone:'invalid-call-me',email:'bad@@example.invalid'},scheduleJob('tomorrow-midnight','2026-10-21T05:30:00Z'),{...scheduleJob('last-week-day','2026-10-26T15:00:00Z'),email:'valid@example.invalid'},scheduleJob('beyond-week','2026-10-27T15:00:00Z'),scheduleJob('overdue-open','2026-10-19T15:00:00Z'),{...scheduleJob('completed-before','2026-10-19T18:00:00Z','completed'),paidCents:10000},scheduleJob('declined-future','2026-10-20T16:00:00Z','declined')];
let reads=0,writes=0,mode='ok';const server=createServer((req,res)=>{res.setHeader('cache-control','no-store');const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);return;}if(req.url.startsWith('/api/')){if(req.method!=='GET'){writes++;send(400,{error:'Unexpected write'});return;}reads++;if(mode==='error'){send(503,{error:'Synthetic read interrupted'});return;}if(mode==='badCustomer'&&req.url==='/api/customers'){send(200,{...payload,customers:payload.customers.map((row,i)=>i===0?{...row,estimateTotal:'1.5'}:row)});return;}if(mode==='corrupt'&&req.url.startsWith('/api/estimate-history')){send(200,{estimates:[{...scheduled[0],totalCents:'1.75'}],nextCursor:null});return;}send(200,req.url.startsWith('/api/estimate-history')?{estimates:scheduled,nextCursor:null}:payload);return;}res.setHeader('content-type','text/html');res.end('<!doctype html><html data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser,checks=0;const errors=[],outside=[];const check=(ok,label)=>{assert.ok(ok,label);checks++;};
try{browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){outside.push(r.request().url());return r.abort();}return r.continue();});
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}])for(const theme of ['light','dark']){
  mode='ok';await page.setViewportSize(size);await page.goto(origin+'/customers');await page.evaluate(t=>window.setTheme(t),theme);await page.locator('.customer-card').filter({hasText:'Fixture first'}).click();await page.getByRole('heading',{name:'Fixture first',exact:true}).waitFor();const balances=await page.locator('.customer-snapshot').innerText(),startReads=reads;
  await page.getByRole('button',{name:'Customer history',exact:true}).click();check(await page.evaluate(()=>document.activeElement.id)==='customer-history-first','History shortcut moves focus');const sections=page.getByRole('navigation',{name:'Customer record sections'});
  for(const [name,query,selector,expected] of [['Estimates','service 24','.customer-record.record-button',1],['Invoices','bb0000','.customer-record.record-button',1],['Payments','REF-PRIMARY','.customer-payment-record',1],['Notes','gate note 14','.note-row',1],['Messages','appointment','.message-history',1]]){
   await sections.getByRole('button',{name:new RegExp('^'+name)}).click();const search=page.locator('.customer-history-tools input');await page.waitForFunction(()=>document.querySelector('.customer-history-tools input').value==='');await search.fill(query);await page.locator('.customer-records '+selector).first().waitFor();check(await page.locator('.customer-records '+selector).count()===expected,name+' searches all customer records');check(await page.locator('.customer-snapshot').innerText()===balances,name+' search never changes profile balances');check(!(await page.locator('.customer-records').innerText()).includes('SECOND PRIVATE JOB'),name+' never exposes another customer');
   if(name==='Invoices')check((await page.locator('.customer-records a').first().getAttribute('href')).includes('ownerPreview=1&from=customer'),'Filtered invoice retains owner preview target');
   if(name==='Messages')check((await page.locator('.message-history').innerText()).includes('2 audit events retained'),'Message search retains paired send audit events');
   await search.fill('no-match-anywhere');await page.getByText('No matching '+name.toLowerCase(),{exact:true}).waitFor();check(await page.getByRole('button',{name:'Clear history search',exact:true}).isVisible(),name+' miss offers recovery');await page.getByRole('button',{name:'Clear history search',exact:true}).click();
  }
  check(reads===startReads&&writes===0,'Profile searching/section changes are local reads and never send writes');await sections.getByRole('button',{name:/^Notes/}).click();await page.getByLabel('Customer note',{exact:true}).fill('Unsaved access notes');await page.locator('.customer-history-tools input').fill('no-match');await page.evaluate(()=>window.focusSavedRecord('note','note-first-14'));await page.waitForFunction(()=>document.activeElement.id==='customer-note-note-first-14');check(await page.locator('.customer-history-tools input').inputValue()==='','Focused search result clears hiding query');check(await page.getByLabel('Customer note',{exact:true}).inputValue()==='Unsaved access notes','History queries/navigation preserve note draft');
  const bounds=await page.locator('.customer-history-tools').evaluate(n=>({x:n.getBoundingClientRect().x,right:n.getBoundingClientRect().right,v:innerWidth}));check(bounds.x>=0&&bounds.right<=bounds.v,'Customer search controls fit viewport');if(process.env.FIRE_CONNECTED_UI_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_CONNECTED_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.FIRE_CONNECTED_UI_SCREENSHOT_DIR,`customer-history-${size.width}-${theme}.png`)});}
  await page.goto(origin+'/schedule');await page.evaluate(t=>window.setTheme(t),theme);await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();check(await page.locator('.schedule-job').count()===5,'All upcoming preserves full schedule');await page.getByRole('button',{name:'Today (2)',exact:true}).click();check(await page.locator('.schedule-job').count()===2,'Today includes Central late-night appointment');check(await page.locator('.needs-attention button').count()===1,'Today filter retains overdue work');check(!(await page.locator('.schedule-board').innerText()).includes('tomorrow-midnight'),'Central next-day appointment excluded from Today');let route=new URL(await page.locator('.route-day-button').getAttribute('href'));check(route.searchParams.get('destination')==='Address today-late'&&route.searchParams.get('waypoints')==='Address today-morning','Today route stays on one Central day');
  check(await page.locator('.schedule-job-inline-flags').count()===2,'Near-term jobs have compact timing and prep indicators');
  check(await page.locator('.schedule-job-needs-prep').count()===1,'Today job missing contact receives a visual highlight');
  check((await page.locator('.schedule-job-prep-chip').allTextContents()).includes('Review contact'),'Contact review cue is precise');
  await page.getByRole('button',{name:'Tomorrow (1)',exact:true}).click();
  check(await page.locator('.schedule-job').count()===1,'Tomorrow selects Tulsa next calendar day');
  check((await page.locator('.schedule-board').innerText()).includes('tomorrow-midnight')&&!(await page.locator('.schedule-board').innerText()).includes('today-late'),'Tomorrow excludes today late-night appointments');
  check((await page.locator('.route-day-button').innerText()).includes('Route tomorrow'),'Tomorrow-specific route label is displayed');
  route=new URL(await page.locator('.route-day-button').getAttribute('href'));
  check(route.searchParams.get('destination')==='Address tomorrow-midnight'&&!route.searchParams.has('waypoints'),'Tomorrow route contains only next-day address');
  check(await page.locator('.schedule-job-needs-prep').count()===1,'Tomorrow job missing contact is visually highlighted');
  await page.getByRole('button',{name:'Next 7 days (4)',exact:true}).click();check(await page.locator('.schedule-job').count()===4,'Seven-day window includes last calendar day only');
  const datePicker=page.getByRole('group',{name:'Browse a specific schedule date'});
  const exactInput=datePicker.getByLabel('Choose a work date',{exact:true});
  await exactInput.fill('2026-10-21');
  check(await page.locator('.schedule-job').count()===1,'Exact date selects next-day appointment but excludes prior Central evening');
  check((await page.locator('.schedule-board').innerText()).includes('tomorrow-midnight'),'Picked calendar day shows correct Central next-day appointment');
  route=new URL(await page.locator('.route-day-button').getAttribute('href'));
  check(route.searchParams.get('destination')==='Address tomorrow-midnight'&&!route.searchParams.has('waypoints'),'Directions contain only the chosen date');
  await datePicker.getByRole('button',{name:'Next work date',exact:true}).click();
  check(await exactInput.inputValue()==='2026-10-22','Next day advances calendar date without DST offset');
  check(await page.locator('.schedule-job,.route-day-button').count()===0,'Empty chosen day hides unrelated appointments and route');
  await datePicker.getByRole('button',{name:'Previous work date',exact:true}).click();
  check(await exactInput.inputValue()==='2026-10-21'&&await page.locator('.schedule-job').count()===1,'Previous day restores specific matching job');
  const dateControls=await datePicker.locator('button,input').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44&&n.getBoundingClientRect().width>0));
  check(dateControls,'Work-date calendar and previous/next buttons have touch-friendly controls');
  const dateBounds=await datePicker.evaluate(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,v:innerWidth}));
  check(dateBounds.left>=-1&&dateBounds.right<=dateBounds.v+1,'Work-date controls never exceed phone viewport');
  await exactInput.fill('2026-10-19');
  check(await page.locator('.schedule-job').count()===2,'Past date includes scheduled and completed jobs without showing declined work');
  check((await page.locator('.schedule-history-status').allTextContents()).includes('completed'),'Completed day history is visibly marked');
  check(await page.locator('.route-day-button').count()===0,'Historical jobs cannot be sent to live driving directions');
  check((await datePicker.innerText()).includes('scheduled and completed jobs'),'Exact date clearly describes schedule history');
  await exactInput.fill('');
  await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();
  check(await page.locator('.schedule-job').count()===5,'Clearing date selection restores all upcoming records');
  await page.evaluate(()=>window.setQuery('beyond-week'));await page.getByRole('button',{name:'Today (0)',exact:true}).click();await page.getByText('No upcoming jobs today',{exact:true}).waitFor();check(await page.locator('.route-day-button').count()===0,'Empty date window has no stale route');await page.getByRole('button',{name:'All upcoming (1)',exact:true}).click();check(await page.locator('.schedule-job').count()===1,'All upcoming recovers appointment outside current week');await page.evaluate(()=>window.setQuery(''));await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();check(await page.locator('.schedule-window-controls button').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)),'Schedule window controls have 44px targets');if(process.env.FIRE_CONNECTED_UI_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FIRE_CONNECTED_UI_SCREENSHOT_DIR,`schedule-${size.width}-${theme}.png`)});
  await page.goto(origin+'/schedule');await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();
  check(await page.locator('.schedule-job-weather-action').count()===5,'Every upcoming scheduled job has a direct weather review action');
  const prep=page.getByRole('group',{name:'Upcoming job details to review'});
  check((await prep.innerText()).includes('upcoming jobs')&&!(await prep.innerText()).includes('overdue-open'),'Job-prep summary uses upcoming verified jobs, not overdue or completed records');
  await prep.locator('summary').click();
  check(await prep.locator('.schedule-prep-items button').count()===3,'Only three upcoming jobs with no valid phone or email are flagged; valid email-only job is not');
  await prep.getByRole('button',{name:/today-late/}).click();
  check(await page.locator('.schedule-job').count()===5,'Opening a prep issue does not change schedule filters');
  await page.keyboard.press('Escape');
  check(await page.locator('.schedule-job-contact-toggle').count()===2,'Only records with valid phone or email expose the contact control');
  const contact=page.getByRole('button',{name:'Contact today-morning for scheduled job'});
  await contact.click();
  const contactPanel=page.getByRole('group',{name:'Contact options for today-morning'});
  check(await contactPanel.getByRole('link',{name:'Call today-morning about scheduled job'}).getAttribute('href')==='tel:+19185550146','Contact dial action uses normalized valid job number');
  check(await contactPanel.getByRole('link',{name:'Text today-morning about scheduled job'}).getAttribute('href')==='sms:+19185550146','Text action opens SMS without sending');
  check(await contactPanel.getByRole('link',{name:'Email today-morning about scheduled job'}).getAttribute('href')==='mailto:first%40example.invalid','Email action encodes selected job recipient');
  check((await contactPanel.innerText()).includes('nothing is sent automatically'),'Native actions explicitly avoid auto-sending');
  check(await page.locator('.schedule-job-contact-panel a').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)),'Contact options are touch-friendly');
  await contact.click();
  check(await contactPanel.count()===0,'Contact panel can be collapsed');
  check(await page.getByRole('button',{name:'Contact today-late for scheduled job'}).count()===0,'Malformed contact data never produces native links');
  check(await page.locator('.schedule-job-directions-action').count()===5,'Only current saved addresses receive Maps shortcuts');
  const firstWeatherShortcut=page.getByRole('button',{name:'Check hourly weather for today-morning job'});
  await firstWeatherShortcut.click();
  check(await page.getByTestId('schedule-weather-target').getAttribute('data-requested-job')==='2026-10-20T15:00:00Z','Weather review selects exact clicked job appointment');
  const individualDirections=page.getByRole('link',{name:'Directions to today-morning job'});
  const individualDirectionsUrl=new URL(await individualDirections.getAttribute('href'));
  check(individualDirectionsUrl.searchParams.get('destination')==='Address today-morning'&&individualDirectionsUrl.searchParams.get('travelmode')==='driving','Job Maps shortcut does not route another address');
  check(await individualDirections.getAttribute('target')==='_blank'&&(await individualDirections.getAttribute('rel')).includes('noopener'),'Per-job directions link opens safely');
  await page.getByRole('button',{name:'Today (2)',exact:true}).click();
  check(await page.getByTestId('schedule-weather-target').getAttribute('data-requested-job')==='','Date filter clears pinned job forecast');
  await page.getByLabel('Choose a work date',{exact:true}).fill('2026-10-19');
  check(await page.locator('.schedule-job-weather-action,.schedule-job-directions-action').count()===0,'Historical jobs never show future weather or navigation shortcuts');
  await page.goto(origin+'/dashboard');await page.evaluate(t=>window.setTheme(t),theme);const dashboardUpcoming=page.locator('.metric-card').filter({hasText:'Upcoming jobs'});
  check(await dashboardUpcoming.locator('strong').innerText()==='2','Dashboard only counts scheduled jobs, not finished or declined');
  check(await page.getByTestId('schedule-weather-target').textContent()==='2026-10-20T15:00:00Z','Weather targets earliest future scheduled appointment regardless of record order');
  const nextJob=page.getByRole('region',{name:'Next scheduled job'});
  check((await nextJob.innerText()).includes('Exact customer')&&!(await nextJob.innerText()).includes('Declined customer'),'Next appointment card identifies the correct active customer');
  check((await nextJob.innerText()).includes('Exact job'),'Next appointment card includes selected service');
  const call=nextJob.getByRole('link',{name:'Call next job customer',exact:true});
  const sms=nextJob.getByRole('link',{name:'Text next job customer',exact:true});
  const email=nextJob.getByRole('link',{name:'Email next job customer',exact:true});
  check(await call.getAttribute('href')==='tel:+19185550146','Dashboard call shortcut is a normalized native dial link');
  check(await sms.getAttribute('href')==='sms:+19185550146','Dashboard text shortcut only opens a draft in the native composer');
  check(await email.getAttribute('href')==='mailto:customer%40example.invalid','Dashboard email shortcut encodes its recipient');
  check(await nextJob.locator('.dashboard-next-contact').count()===3,'Valid phone and email show three usable actions');
  const directions=nextJob.getByRole('link',{name:'Directions to next job',exact:true});
  check(await directions.isVisible(),'Next scheduled job with address offers direct driving directions');
  const directionsUrl=new URL(await directions.getAttribute('href'));
  check(directionsUrl.origin==='https://www.google.com'&&directionsUrl.pathname==='/maps/dir/'&&directionsUrl.searchParams.get('destination')==='101 Exterior Ave, Tulsa, OK','Next job directions target exact service address, not a different customer');
  check(directionsUrl.searchParams.get('travelmode')==='driving'&&await directions.getAttribute('target')==='_blank'&&(await directions.getAttribute('rel')).includes('noopener'),'Directions safely open Google Maps driving navigation');
  await nextJob.getByRole('button',{name:'Open next job',exact:true}).click();
  check(await page.evaluate(()=>window.openedEstimate)==='exact-dashboard-job','Next job shortcut opens exact current appointment');
  await nextJob.getByRole('button',{name:'Full schedule',exact:true}).click();
  check(await page.evaluate(()=>window.openedTab)==='schedule','Secondary shortcut opens full Schedule');
  const nextBounds=await nextJob.evaluate(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,width:innerWidth}));
  check(nextBounds.left>=-1&&nextBounds.right<=nextBounds.width+1,'Next appointment card fits each phone and tablet viewport');
  check(await nextJob.locator('button,a').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)),'Next appointment shortcuts and driving directions remain touch friendly');
  await page.locator('.recent-estimate-row').filter({hasText:'Exact customer'}).click();check(await page.evaluate(()=>window.openedEstimate)==='exact-dashboard-job','Dashboard row chooses exact job identity');
  await page.goto(origin+'/dashboard-bad-contact');
  await page.getByRole('region',{name:'Next scheduled job'}).waitFor();
  check(await page.locator('.dashboard-next-contact').count()===0,'Malformed contact details cannot create dial, SMS or email links');
  await page.goto(origin+'/dashboard-no-address');
  await page.getByRole('region',{name:'Next scheduled job'}).waitFor();
  check(await page.getByRole('link',{name:'Directions to next job',exact:true}).count()===0,'Dashboard never offers directions for an unsaved job address');
  check((await page.getByRole('region',{name:'Next scheduled job'}).innerText()).includes('No job address saved'),'Dashboard explains why directions are unavailable');
 }
 mode='error';await page.goto(origin+'/schedule');await page.getByRole('alert').waitFor();check(await page.locator('.schedule-window-controls,.schedule-job,.route-day-button').count()===0,'Failed schedule read hides counts/routes/cards');mode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();check(await page.locator('.schedule-job').count()===5,'Explicit schedule retry restores all appointments');
 const freshButton=page.getByRole('button',{name:'Refresh schedule',exact:true});
 check(await freshButton.isEnabled(),'Owner can refresh the schedule without leaving the screen');
 check(await page.locator('.schedule-last-checked').innerText().then(t=>t.includes('Central Time')),'Schedule confirms last successful read in Central Time');
 const beforeRefreshReads=reads;
 scheduled.push(scheduleJob('just-added','2026-10-22T15:00:00Z'));
 await freshButton.click();
 await page.getByRole('button',{name:'All upcoming (6)',exact:true}).waitFor();
 check(await page.locator('.schedule-job').count()===6,'Explicit refresh discovers new booked job');
 check(reads===beforeRefreshReads+1,'Refresh performs one read, never a write');
 const refreshedGeometry=await page.locator('.schedule-header-actions').evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),width:innerWidth}));
 check(refreshedGeometry.rect.x>=-1&&refreshedGeometry.rect.x+refreshedGeometry.rect.width<=refreshedGeometry.width+1,'Refresh and directions stay within phone viewport');
 mode='error';await freshButton.click();await page.getByRole('alert').waitFor();
 check(await page.locator('.schedule-job,.route-day-button').count()===0,'Failed owner refresh hides stale schedule and route');
 mode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'All upcoming (6)',exact:true}).waitFor();
 check(await page.locator('.schedule-job').count()===6,'Recovered schedule refresh restores complete data');
 scheduled.pop();
 mode='corrupt';await page.getByRole('button',{name:'Refresh schedule',exact:true}).click();await page.getByRole('alert').filter({hasText:'Schedule amounts could not be verified.'}).waitFor();
 check(await page.locator('.schedule-job,.route-day-button').count()===0,'Malformed financial cents cannot display route or wrong totals');
 mode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'All upcoming (5)',exact:true}).waitFor();
 check(await page.locator('.schedule-job').count()===5,'Valid schedule returns after unsafe amount refusal');
 // Same-minute reservations are advisory, and never alter scheduled records.
 scheduled.push(scheduleJob('second-at-same-minute','2026-10-20T15:00:30Z'));
 const beforeCollisionReads=reads;
 await page.getByRole('button',{name:'Refresh schedule',exact:true}).click();
 const collision=page.getByRole('region',{name:'Appointments sharing a start time'});
 await collision.waitFor();
 check(reads===beforeCollisionReads+1,'Conflict review reads jobs without any write');
 check((await collision.innerText()).includes('2 jobs')&&(await collision.innerText()).includes('not a confirmed overlap'),'Potential collision wording is precise and non-alarmist');
 check(await page.locator('.schedule-conflict-chip').count()===2,'Both same-minute active jobs are visually flagged');
 await collision.getByRole('button',{name:/Review day/}).click();
 check(await page.getByLabel('Choose a work date',{exact:true}).inputValue()==='2026-10-20','Review day navigates to Tulsa appointment date');
 check(await page.locator('.schedule-conflict-chip').count()===2,'Conflict markers remain visible on the selected day');
 scheduled.pop();
 await page.getByRole('button',{name:'Refresh schedule',exact:true}).click();
 await collision.waitFor({state:'hidden'});
 check(await page.locator('.schedule-conflict-chip').count()===0,'Resolved time collision no longer shows an advisory');
 mode='badCustomer';await page.goto(origin+'/customers');await page.getByRole('alert').filter({hasText:'exact whole cents'}).waitFor();check(await page.locator('.customer-list,.customer-snapshot').count()===0,'Fractional customer account cents never render as valid profile totals');
 mode='ok';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.customer-card').first().waitFor();check(await page.locator('.customer-card').count()===2,'Read-only customer retry restores verified profiles');
 check(writes===0&&outside.length===0&&errors.length===0,'No customer writes, external requests or browser errors: '+errors.join(';'));console.log(JSON.stringify({passed:checks,actualCustomerHistory:true,actualScheduleWindows:true,actualDashboardRows:true,syntheticLocalhost:true,lightDark:true,hostedWrites:false,iPhoneAccepted:false}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
