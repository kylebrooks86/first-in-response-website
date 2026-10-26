/** Real CustomersView JSX plus shared CSS in synthetic isolated Chromium. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const customerViewAst=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='CustomersView');
assert.ok(customerViewAst,'Find actual CustomersView source function');
const priorityFn=customerViewAst.body.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='pickCustomerNextEstimate');
assert.ok(priorityFn,'Extract the real customer next-job prioritizer, not a test reimplementation');
const priorityContext={exports:{},Date,resolvedBillingTotalCents:row=>row.totalCents};
const priorityJs=ts.transpileModule(priorityFn.getText(ast)+'\nexports.pick=pickCustomerNextEstimate;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
vm.runInNewContext(priorityJs,priorityContext);
const pick=priorityContext.exports.pick;
const now=Date.parse('2026-10-24T12:00:00Z');
const makePriorityJob=(id,status,scheduledAt=null,paidCents=0,totalCents=20000)=>({id,status,scheduledAt,paidCents,totalCents});
const older=makePriorityJob('older','scheduled','2026-11-09T15:00:00Z');
const sooner=makePriorityJob('sooner','scheduled','2026-10-25T15:00:00Z');
const overdue=makePriorityJob('overdue','scheduled','2026-10-23T15:00:00Z');
const missed=makePriorityJob('missed','scheduled','2026-10-12T15:00:00Z');
const bad=makePriorityJob('bad','scheduled','invalid-date');
const draft=makePriorityJob('draft','draft'),approved=makePriorityJob('approved','approved');
const unpaid=makePriorityJob('unpaid','completed',null,10000),paid=makePriorityJob('paid','completed',null,20000);
const priorityCases=[
 {rows:[older,sooner,overdue],want:'sooner',why:'next scheduled appointment wins regardless of API order'},
 {rows:[overdue,older,sooner],want:'sooner',why:'past-due job does not hide upcoming appointment'},
 {rows:[missed,overdue],want:'overdue',why:'latest missed appointment gets attention if no future booking'},
 {rows:[bad,older,sooner],want:'sooner',why:'malformed scheduled date never wins over verified future'},
 {rows:[bad,approved],want:'bad',why:'existing undated scheduled fallback remains reachable'},
 {rows:[approved,draft],want:'approved',why:'existing approved estimate fallback is retained'},
 {rows:[draft,unpaid],want:'draft',why:'draft and sent fallback order remains unchanged'},
 {rows:[paid,unpaid],want:'unpaid',why:'unpaid completed job remains actionable'},
 {rows:[paid],want:'paid',why:'fully paid saved history remains openable'},
 {rows:[],want:undefined,why:'no false shortcut for a new customer'}
];
for(const x of priorityCases){
 const original=x.rows.map(row=>row.id).join(',');
 assert.equal(pick(x.rows,now)?.id,x.want,x.why);
 assert.equal(x.rows.map(row=>row.id).join(','),original,'Never mutate the saved API order');
}
const view=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='CustomersView');
assert.ok(view,'Use the actual CustomersView instead of a reimplementation');
function exactlyOne(found,name){assert.equal(found.length,1,'One '+name+' in actual customer source');return found[0];}
const snippets={contact:[],activity:[],actions:[],job:[],contactOutcome:[]};
function scan(n){
 if(ts.isJsxElement(n)){
  const el=n.openingElement;
  const cls=el.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='className');
  if(cls&&ts.isStringLiteral(cls.initializer)){
   if(cls.initializer.text==='customer-contact')snippets.contact.push(n.getText(ast));
   if(cls.initializer.text==='customer-timeline-disclosure')snippets.activity.push(n.getText(ast));
  }
 }
 if(ts.isJsxExpression(n)&&n.expression){
  const t=n.getText(ast);
  if(t.startsWith('{nextCustomerActions.length>0&&<section className="customer-action-review"'))snippets.actions.push(t);
  if(t.startsWith('{activeCustomerEstimate&&<button')&&t.includes('className="customer-next-job"'))snippets.job.push(t);
  if(t.startsWith('{manualFlags.leadContact&&<p')&&t.includes('aria-label="Last lead contact"'))snippets.contactOutcome.push(t);
 }
 ts.forEachChild(n,scan);
}
scan(view);
const contact=exactlyOne(snippets.contact,'contact row');
const activity=exactlyOne(snippets.activity,'activity disclosure');
const actions=exactlyOne(snippets.actions,'conditional next actions');
const job=exactlyOne(snippets.job,'conditional current job shortcut including its no-job guard');
const contactOutcome=exactlyOne(snippets.contactOutcome,'owner-logged contact status with no empty placeholder');
assert.match(job,/^\{activeCustomerEstimate&&<button/,'Actual guard hides the shortcut when no customer estimate exists');
const profileSource=view.getText(ast);
assert.match(profileSource,/pickCustomerNextEstimate\(customerEstimates,Date\.now\(\)\)/,'Actual customer profile uses the tested next-job logic');
assert.ok(profileSource.indexOf('className="customer-contact"')<profileSource.indexOf('className="customer-next-job"')&&profileSource.indexOf('className="customer-next-job"')<profileSource.indexOf('className="record-tabs"'),'The current job shortcut is above records and after contacts');
assert.match(profileSource,/setSection\("photos"\)\}>Photos<\/button>/,'Photos tab uses short label');
assert.match(contact,/Google Maps/);
assert.match(contact,/Google Earth/);
assert.match(contact,/Zillow/);
assert.match(contact,/onOpenTerritory\(selected.address\)/,'Profile reuses exact saved address for Territory');
assert.match(activity,/customer-timeline-list/);
const fixture=[
 "import React,{useState}from'react';import{createRoot}from'react-dom/client';",
  "import {usableCustomerPhone,usableCustomerEmail} from './lib/customer-contact-links';",
 "import{Phone,Send,Mail,Navigation,Globe2,House,MapPin,ChevronRight,Sparkles}from'lucide-react';",
 "function Fixture(){",
 " const [selected,setSelected]=useState({id:'synthetic',name:'Synthetic customer',phone:'9185550101',email:'synthetic@example.invalid',address:'123 Synthetic Rd, Tulsa, OK'});",
  " const contactPhone=usableCustomerPhone(selected.phone),contactEmail=usableCustomerEmail(selected.email);",
 " const [timelineFilter,setTimelineFilter]=useState('all'),[timelineSearch,setTimelineSearch]=useState(''),[timelineShown,setTimelineShown]=useState(6);",
 " const [withActions,setWithActions]=useState(true);",
 " const [manualFlags,setManualFlags]=useState({leadContact:null});",
 " window.__setLeadContact=leadContact=>setManualFlags({leadContact});",
 " const [activeCustomerEstimate,setActiveCustomerEstimateState]=useState({id:'job-001',service:'Gutter cleaning',status:'scheduled',scheduledAt:'2026-10-30T14:00:00Z'});",
 " const setActiveEstimate=e=>{window.__openedJob=e};const onOpenTerritory=address=>{window.__openedTerritory=address};",
 " const statusLabel=status=>status;",
 " window.__setSelected=setSelected;window.__setWithActions=setWithActions;window.__setActiveCustomerEstimate=setActiveCustomerEstimateState;window.__clicked=[];",
 " const openCustomerAction=a=>window.__clicked.push('action:'+a.key),openTimelineEntry=e=>window.__clicked.push('activity:'+e.key);",
 " const dateTime=s=>s;",
 " const nextCustomerActions=withActions?[{key:'review-check',title:'Check review',detail:'Synthetic due review'}]:[];",
 " const timelineEntries=Array.from({length:8},(_,i)=>({key:'event-'+i,day:'Oct 24',title:(i%2?'Invoice':'Estimate')+' event '+i,detail:'Synthetic saved event',section:i%2?'billing':'estimates',at:'2026-10-24T12:00:00Z'}));",
 " const filteredTimelineEntries=timelineEntries.filter(e=>(timelineFilter==='all'||e.section===timelineFilter)&&e.title.toLowerCase().includes(timelineSearch.toLowerCase()));",
 " const visibleTimelineEntries=filteredTimelineEntries.slice(0,timelineShown);",
 " return <main className='customers-view'><section className='customer-profile'>",
 contact,job,contactOutcome,actions,activity,
 " </section></main>;",
 "}",
 "createRoot(document.getElementById('app')).render(<Fixture/>);"
].join('\n');
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const errors=[],outside=[];
function check(ok,reason){assert.ok(ok,reason);checks++;}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(outside.push(r.request().url()),r.abort()));
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  const row=page.getByRole('group',{name:'Customer contact and driving links'});
  const activityDisclosure=page.locator('details.customer-timeline-disclosure');
  await row.waitFor();await activityDisclosure.waitFor();
  check(await row.getByRole('link',{name:'Call customer'}).getAttribute('href')==='tel:+19185550101',width+': existing phone destination');
  check(await row.getByRole('link',{name:'Text customer'}).getAttribute('href')==='sms:+19185550101',width+': existing SMS destination');
  check(await row.getByRole('link',{name:'Email customer'}).getAttribute('href')==='mailto:synthetic@example.invalid',width+': existing mail destination');
  check((await row.getByRole('link',{name:'Directions to customer in Google Maps'}).getAttribute('href')).includes('destination=123%20Synthetic%20Rd'),width+': maps destination preserved');
  await row.getByRole('button',{name:'Show customer on Territory Map'}).click();
  check(await page.evaluate(()=>window.__openedTerritory)==='123 Synthetic Rd, Tulsa, OK',width+': territory shortcut reuses exact saved customer address without typing');
  check(await row.getByText('No phone').count()===0&&await row.getByText('No email').count()===0,width+': no dummy contact controls');
   if(width<=760){
    const layout=await row.evaluate(el=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,height:r.height}};
     return {columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,actions:[...el.querySelectorAll(':scope>a,:scope>button')].map(rect),property:rect(el.querySelector('.customer-property-research'))};
    });
    check(layout.columns===2&&layout.actions.length===5,width+': Call, Text, Email, Maps and Territory stay in compact iPhone grid');
    check(layout.actions.every(a=>a.height>=44&&a.left>=-1&&a.right<=width+1),width+': every contact action remains a full-height visible tap target');
    check(Math.abs(layout.actions[0].top-layout.actions[1].top)<3&&Math.abs(layout.actions[2].top-layout.actions[3].top)<3&&layout.actions[2].top>layout.actions[0].top+40&&layout.actions[4].top>layout.actions[2].top+40,width+': new Territory action adds only one compact row');
    check(layout.property.top>layout.actions[4].top&&layout.property.left>=-1&&layout.property.right<=width+1,width+': visible Earth and Zillow tools stay below quick actions without overflow');
   }
  check(await page.getByRole('status',{name:'Last lead contact'}).count()===0,width+': new lead has no unnecessary contact explanation');
  await page.evaluate(()=>window.__setLeadContact({state:'no_answer',unansweredAttempts:2,at:'2026-10-23T15:00:00Z'}));
  const lastContact=page.getByRole('status',{name:'Last lead contact'});
  await lastContact.waitFor({state:'visible'});
  check((await lastContact.innerText()).includes('No answer · not contacted · 2 unanswered attempts'),width+': actual profile shows precise no-answer count and no contact claim');
  await page.evaluate(()=>window.__setLeadContact({state:'contacted',unansweredAttempts:2,at:'2026-10-24T15:00:00Z'}));
  await page.waitForFunction(()=>document.querySelector('[aria-label="Last lead contact"]')?.textContent?.includes('Contacted · 2026-10-24T15:00:00Z'));
  check(!(await lastContact.innerText()).includes('No answer'),width+': contacted owner log supersedes missed call without erasing history');
  await page.evaluate(()=>window.__setLeadContact(null));
  await lastContact.waitFor({state:'detached'});
  const shortcut=page.locator('.customer-next-job');
  check(await shortcut.count()===1,width+': exactly one current job shortcut');
  check(await shortcut.getByText('Open scheduled job').isVisible(),width+': scheduled job label is truthful');
  check(await shortcut.getAttribute('aria-label')==='Open Gutter cleaning scheduled job',width+': scheduled VoiceOver action names saved job');
  await shortcut.click();
  check(await page.evaluate(()=>window.__openedJob?.id==='job-001'&&window.__openedJob?.customer==='Synthetic customer'),width+': original current job handler opens correct customer and job');
  check(await shortcut.evaluate(el=>{const p=el.getBoundingClientRect();return p.height>=44&&p.left>=-1&&p.right<=innerWidth+1}),width+': current job tap target stays within phone');
  check(await row.getByRole('link',{name:'Research customer property on Google Earth',exact:true}).isVisible()&&await row.getByRole('link',{name:'Research customer property on Zillow',exact:true}).isVisible(),width+': property tools are available without opening a disclosure');
  check(await page.getByRole('region',{name:'Review next customer actions'}).isVisible(),width+': actual due customer actions stay immediately visible');
  check(!(await page.getByRole('region',{name:'Recent customer activity'}).isVisible()),width+': long timeline initially tucked away');
  await activityDisclosure.locator('summary').click();
  check(await page.getByRole('region',{name:'Recent customer activity'}).isVisible(),width+': timeline opens on demand');
  check(await page.locator('.customer-timeline-list li').count()===6,width+': first six saved entries visible');
  await page.getByRole('button',{name:/Show next 2 events/}).click();
  check(await page.locator('.customer-timeline-list li').count()===8,width+': all saved entries reachable');
  await page.getByRole('button',{name:'Filter activity: Billing'}).click();
  check(await page.locator('.customer-timeline-list li').count()===4,width+': original category filter still works');
  await page.getByRole('button',{name:'Open Invoice event 1 in billing'}).click();
  check(await page.evaluate(()=>window.__clicked.includes('activity:event-1')),width+': saved entry navigation still invokes handler');
  const geo=await page.evaluate(()=>({total:document.documentElement.scrollWidth,width:innerWidth,targets:[...document.querySelectorAll('.customer-contact>a,.customer-property-research>a,.customer-timeline-disclosure>summary')].map(x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));
  check(geo.total<=width+1,width+': no horizontal scrolling');
  check(geo.targets.every(r=>r.left>=-1&&r.right<=width+1&&r.height>=44),width+': all contact and history taps at least 44px');
 }
 // Malformed fields must not become native phone or mail recipients.
 await page.evaluate(()=>window.__setSelected(s=>({...s,phone:'please call',email:'bad@@example.invalid'})));
 const guardedContacts=page.getByRole('group',{name:'Customer contact and driving links'});
 await guardedContacts.locator('.customer-contact-warning').waitFor();
 check(await guardedContacts.getByRole('link',{name:'Call customer'}).count()===0&&await guardedContacts.getByRole('link',{name:'Text customer'}).count()===0&&await guardedContacts.getByRole('link',{name:'Email customer'}).count()===0,'Invalid phone/email never creates unsafe recipient links');
 check((await guardedContacts.locator('.customer-contact-warning').innerText()).includes('Check phone and email in Edit customer'),'Invalid saved contact fields show a short correction prompt');
 check(await guardedContacts.getByRole('link',{name:'Directions to customer in Google Maps'}).isVisible(),'Bad contact data never hides saved directions');
 await page.evaluate(()=>window.__setSelected(s=>({...s,phone:'+1 (918) 555-0102',email:'contact@example.invalid'})));
 await guardedContacts.getByRole('link',{name:'Call customer'}).waitFor();
 check(await guardedContacts.getByRole('link',{name:'Call customer'}).getAttribute('href')==='tel:+19185550102','Formatted US phone normalizes to E.164 dial target');
 check(await guardedContacts.locator('.customer-contact-warning').count()===0,'Corrected customer contact clears warning');
 await page.evaluate(()=>{window.__setSelected(s=>({...s,phone:'',email:'',address:''}));window.__setWithActions(false)});
 for(const [status,label] of [['draft','Continue draft estimate'],['sent','Open estimate'],['completed','Open completed job']]){
  await page.evaluate(next=>window.__setActiveCustomerEstimate(s=>({...s,status:next,scheduledAt:null})),status);
  const jobButton=page.locator('.customer-next-job');
  await jobButton.getByText(label,{exact:true}).waitFor({state:'visible'});
  const ariaSuffix=status==='completed'?'completed job':status==='draft'?'draft estimate':'estimate';
  check(await jobButton.getAttribute('aria-label')==='Open Gutter cleaning '+ariaSuffix,status+': VoiceOver action matches saved job stage');
  check(true,status+': visible label matches saved estimate after React commit');
 }
 await page.evaluate(()=>window.__setActiveCustomerEstimate(null));
 await page.locator('.customer-next-job').waitFor({state:'detached'});
 check(true,'No fictional current job is shown when there are no estimates');
 await page.waitForFunction(()=>document.querySelector('.customer-contact-empty'));
 check(await page.locator('.customer-contact a').count()===0,'Missing customer contacts never create fake clickable links');
 check(await page.locator('.customer-contact-empty').isVisible(),'Missing contact summary stays available with Edit customer direction');
 check(await page.locator('.customer-property-research').count()===0,'No empty Earth or Zillow tools for missing address');
 check(await page.locator('.customer-action-review').count()===0,'Empty actionable section does not overwhelm new customer');
 check(await page.locator('.customer-timeline-disclosure').count()===1,'History remains accessible even without outstanding actions');
 check(errors.length===0&&outside.length===0,'No JS errors or external calls: '+errors.join('; '));
 console.log('PASS '+checks+' actual Customers JSX mobile tests at 320/375/390/430/768px; no real customer data or network writes.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
