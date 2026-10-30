/** Verify actual FollowUpsView reads, pagination, error recovery, and no false empty state.
 * Synthetic GETs only; no messages sent or actions recorded.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const required=['resolvedBillingTotalCents','billingBalanceCents'];
const helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>required.includes(d.name.getText(ast)))||ts.isFunctionDeclaration(n)&&['repeatCadenceMonths','addMonths'].includes(n.name?.text));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
assert.ok(view,'Actual FollowUpsView must exist');
const compiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8')+'\n'+readFileSync('lib/review-followup-eligibility.ts','utf8')+'\n'+helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=FollowUpsView;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const fixedTime=Date.parse('2026-10-09T12:00:00Z');
class FixedDate extends Date {static now(){return fixedTime;}}
const components=['GoogleVoiceCallAction','GoogleVoiceTextAction','PersonalPhoneBackupAction','EstimateDetail','Button','MessageComposer','Clock3','Star','CalendarDays','CheckCircle2','FileText','ChevronRight','Users','Phone','MessageSquareText','Mail','AlertTriangle'];
const job=(id='synthetic-job')=>({
 id,customerId:'synthetic-customer',customer:'Synthetic QA',email:'qa@example.test',phone:'9185550100',
 service:'House Wash',status:'sent',createdAt:'2026-10-01T12:00:00Z',
 firstEstimateSentAt:'2026-10-01T12:00:00Z',lastEstimateSentAt:'2026-10-01T12:00:00Z',
 totalCents:10000,depositCents:5000,paidCents:2000,paymentOverageOpen:0
});
const response=(estimates,nextCursor=null)=>({ok:true,json:async()=>({estimates,nextCursor})});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(done=>setImmediate(done));
function nodes(tree){
 const out=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;out.push(n);visit(n.props?.children);}visit(tree);return out;
}
let checks=0;
function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
function fixture(){
 let state=[],refs=[],cursor=0,refCursor=0,effect,focusEffect,cleanup,focusId=null,effectCursor=0,handler=async()=>response([job()]);const focusCalls=[],handled=[];
 const requests=[],stubs=Object.fromEntries(components.map(k=>[k,()=>null]));
 const context={exports:{},require,...stubs,Date:FixedDate,Math,Error,Array,Number,JSON,
  useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
  useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
  useEffect(fn){const slot=effectCursor++;if(slot===0)effect=fn;else if(slot===1)focusEffect=fn;},document:{getElementById(id){focusCalls.push(id);if(!["followup-action-synthetic-job","followup-action-older-due","followup-action-newer-due"].includes(id))return null;return {scrollIntoView(){focusCalls.push("scroll");},focus(){focusCalls.push("keyboard");}};}},useCurrentTime:()=>fixedTime,money:c=>'$'+(c/100).toFixed(2),
  fetch:(url,options)=>{requests.push({url,options});return handler(url,options);},
 };
 vm.runInNewContext(compiled,context);
 const render=(searchQuery='')=>{cursor=0;refCursor=0;effectCursor=0;return context.exports.view({searchQuery,focusEstimateId:focusId,onFocusHandled:id=>{handled.push(id);focusId=null;},onOpenEstimate:id=>handled.push("fallback:"+id),onOpenCustomer:id=>handled.push("customer:"+id)});};
 const lookup=(predicate)=>nodes(render()).find(predicate);
 return {component:name=>stubs[name],requests,render,nodes:()=>nodes(render()),lookup,focusCalls,handled,focus(id){focusId=id;render();focusEffect?.();},
  get:idx=>state[idx],
  response(fn){handler=fn;},
  mount(){render();cleanup=effect();},
  refresh(){render();effect();},
  unmount(){cleanup?.();},
  clickText(label){const button=lookup(n=>typeof n.props?.onClick==='function'&&n.props?.children===label);assert.ok(button,'Missing button '+label);button.props.onClick();},
  messageCards:()=>nodes(render()).filter(n=>n.type===stubs.MessageComposer),
 };
}
// Start with an unreachable server: never claim there are zero follow-ups.
for(const [name,handler] of [
 ['offline',async()=>{throw Error('Disconnected');}],
 ['unauthorized',async()=>({ok:false,json:async()=>({error:'Follow-up access denied'})})],
 ['malformed',async()=>({ok:true,json:async()=>({estimates:{}})})],
 ['bad-pagination',async()=>({ok:true,json:async()=>({estimates:[],nextCursor:{bad:true}})})],
]){
 const f=fixture();f.response(handler);f.mount();await flush();
 eq(f.get(0).length,0,name+' leaves synthetic rows empty');
 eq(f.get(1),false,name+' settles loading');
 eq(Boolean(f.get(2)),true,name+' exposes an error');
 eq(f.nodes().some(n=>n.props?.role==='alert'),true,name+' renders an accessible alert');
 eq(f.nodes().some(n=>n.props?.children==='You’re caught up'),false,name+' never claims all follow-ups complete');
 eq(f.nodes().some(n=>n.props?.className==='followup-summary'),false,name+' never publishes incomplete metrics');
 f.response(async()=>response([job()]));f.clickText('Try again');await flush();
 eq(f.get(2),'',name+' clears the error after retry');
 eq(f.get(0)[0].id,'synthetic-job',name+' loads actual saved rows after retry');
 eq(f.requests.at(-1).url,'/api/followups?limit=50',name+' requests the current paginated endpoint');
 eq(f.messageCards().length,1,name+' reopens the confirmed follow-up recommendation');
 f.unmount();
}
// Refresh fails after a successful load: preserve old recommendations but show the error.
{
 const f=fixture();f.mount();await flush();
 eq(f.get(0).length,1,'Initial list is loaded');
 f.response(async()=>{throw Error('Connection lost while refreshing');});f.refresh();await flush();
 eq(f.get(0).length,1,'Failed refresh retains prior customer follow-up rows');
 eq(Boolean(f.get(2)),true,'Failed refresh makes stale list status visible');
 eq(f.nodes().some(n=>n.props?.className==='followup-summary'),false,'Failed refresh does not publish a fresh summary');
 eq(f.nodes().some(n=>n.props?.role==='alert'),true,'Refresh failure gives a visible alert');
 f.response(async()=>response([job()]));f.clickText('Retry follow-up refresh');await flush();
 eq(f.get(2),'','Retry refresh clears failure');
 eq(f.get(0).length,1,'Retry refresh does not duplicate old rows');
 f.unmount();
}
// Append preserves the first page and prevents duplicate IDs.
{
 const f=fixture();
 f.response(async(url)=>url.includes('cursor=next')?response([job('synthetic-job'),job('older-job')]):response([job()], 'next'));
 f.mount();await flush();
 eq(f.get(0).length,1,'First page loads');
 eq(f.get(3),'next','Next cursor is retained');
 f.clickText('Scan next 200 older records');await flush();
 eq(f.get(0).length,2,'Append deduplicates the older page');
 eq(f.get(3),null,'End of paging is recognized');
 eq(f.requests.at(-1).url,'/api/followups?limit=50&cursor=next','Append uses the saved continuation cursor');
 f.unmount();
}

// Four sequential older-record pages per owner tap; scanning continues at the verified cursor.
{
 const f=fixture();const urls=[];
 f.response(async url=>{
  urls.push(url);
  const cursor=decodeURIComponent(url.split('cursor=')[1]??'');
  if(!cursor)return response([job('recent')],'page-1');
  const page=Number(cursor.split('-')[1]);
  return response([job('older-'+page)],page===6?null:'page-'+(page+1));
 });
 f.mount();await flush();
 eq(f.get(0).length,1,'Initial page contains one recent record');
 eq(f.get(3),'page-1','Older cursor is retained');
 eq(f.nodes().some(n=>n.props?.['aria-label']==='Older customer record coverage'),true,'Partial coverage is declared');
 f.clickText('Scan next 200 older records');await flush();
 eq(f.get(0).length,5,'Four historical pages append without replacing existing records');
 eq(f.get(3),'page-5','One tap stops at the four-page continuation cursor');
 eq(urls.length,5,'Bounded scan made exactly four older GET requests');
 eq(f.nodes().some(n=>n.props?.['aria-label']==='Older customer record coverage'),true,'Remaining historical pages are still flagged');
 f.clickText('Scan next 200 older records');await flush();
 eq(f.get(0).length,7,'Second scan reads final two pages');
 eq(f.get(3),null,'Verified server end clears the cursor');
 eq(urls.length,7,'Final scan does not request extra pages after the end');
 eq(f.nodes().some(n=>n.props?.className==='followup-coverage-complete'),true,'Last-page state displays as-of-read coverage');
 eq(f.requests.every(x=>x.options?.cache==='no-store'),true,'All scan reads bypass browser cache');
 eq(f.requests.some(x=>x.options?.method==='POST'),false,'Scanning cannot send or mutate');
 f.unmount();
}
// Failed second page must not commit the successful first page or advance cursor.
{
 const f=fixture();let fail=true;
 f.response(async url=>{
  const cursor=decodeURIComponent(url.split('cursor=')[1]??'');
  if(!cursor)return response([job('recent')],'next-1');
  if(cursor==='next-1')return response([job('old-1')],'next-2');
  if(cursor==='next-2'&&fail)throw Error('Temporary offline read failure');
  return response([job('old-2')]);
 });
 f.mount();await flush();
 f.clickText('Scan next 200 older records');await flush();
 eq(f.get(0).length,1,'Failed scan never publishes partial older page');
 eq(f.get(3),'next-1','Failed scan preserves exact original cursor');
 eq(Boolean(f.get(2)),true,'Failed scan shows error instead of completeness');
 eq(f.nodes().some(n=>n.props?.['aria-label']==='Older customer record coverage'),false,'Failed scan hides the fresh coverage claim');
 fail=false;f.clickText('Retry older-record scan');await flush();
 eq(f.get(0).length,3,'Explicit retry appends both records after successful scan');
 eq(f.get(3),null,'Recovered batch reaches verified end');
 eq(f.requests.some(x=>x.options?.method==='POST'),false,'Retries never create customer actions');
 f.unmount();
}

// An older server response cannot overwrite a later successful read.
{
 const f=fixture(),old=deferred();
 f.response(async(url)=>old.promise);
 f.mount();
 f.response(async()=>response([job('latest-job')]));
 f.refresh();await flush();
 eq(f.get(0)[0].id,'latest-job','Newer refresh wins before older pending GET');
 old.resolve(response([job('stale-job')]));await flush();
 eq(f.get(0)[0].id,'latest-job','Stale earlier GET never overwrites newer rows');
 f.unmount();
}
{
 const f=fixture();f.mount();await flush();
 f.focus('synthetic-job');
 eq(f.focusCalls.includes('followup-action-synthetic-job'),true,'Bell deep-link identifies the exact saved follow-up card');
 eq(f.focusCalls.includes('scroll'),true,'Focused follow-up scrolls into view on mobile');
 eq(f.focusCalls.includes('keyboard'),true,'Focused follow-up receives keyboard focus');
 eq(f.handled.at(-1),'synthetic-job','Focused action acknowledges navigation after rendering');
 f.response(async url=>url.startsWith('/api/followups?estimateId=missing-estimate')?
  {ok:true,json:async()=>({estimateId:'missing-estimate',estimates:[],nextCursor:null,pageSize:1})}:response([job()]));
 f.focus('missing-estimate');await flush();
 eq(f.nodes().some(n=>n.props?.className==='followup-focus-notice'),true,'Changed or completed follow-up shows honest fallback rather than a false card');
 const fallback=f.nodes().find(n=>n.props?.children==='Open saved estimate');
 eq(Boolean(fallback),true,'Fallback survives the parent clearing its consumed focus request');
 fallback.props.onClick();
 eq(f.handled.at(-1),'fallback:missing-estimate','Fallback navigates to the original exact estimate ID');
 f.unmount();
}


// Notification can open a due follow-up outside the initially loaded cursor page.
{
 const f=fixture(),old=job('older-due');
 f.response(async url=>url.startsWith('/api/followups?estimateId=older-due')?
  {ok:true,json:async()=>({estimateId:'older-due',estimates:[old],nextCursor:null,pageSize:1})}:
  response([job()], 'older-cursor'));
 f.mount();await flush();
 eq(f.get(0).length,1,'Initial page has one record');
 f.focus('older-due');await flush();
 eq(f.requests.at(-1).url,'/api/followups?estimateId=older-due','One exact GET replaces unbounded history scans');
 eq(f.requests.at(-1).options.cache,'no-store','Exact customer lookup uses no browser cache');
 eq(f.get(0).length,1,'Targeted record never changes loaded cursor-page count');
 eq(f.get(3),'older-cursor','Targeted record preserves historical continuation cursor');
 eq(f.messageCards().length,2,'Verified old due action appears alongside existing cards');
 f.focus('older-due');
 eq(f.focusCalls.includes('followup-action-older-due'),true,'Old notification targets the exact DOM card');
 eq(f.handled.at(-1),'older-due','Exact focus acknowledged only after card was verified');
 eq(f.requests.some(x=>x.options?.method==='POST'),false,'Deep link never records, sends or snoozes');
 f.unmount();
}
// Mismatched endpoint responses cannot inject an unrelated customer record.
{
 const f=fixture();
 f.response(async url=>url.includes('estimateId=wrong-target')?
  {ok:true,json:async()=>({estimateId:'other',estimates:[job('wrong-target')],nextCursor:null,pageSize:1})}:
  response([job()]));
 f.mount();await flush();f.focus('wrong-target');await flush();
 eq(f.nodes().some(n=>n.props?.className==='followup-focus-notice'),true,'Mismatched response displays review fallback');
 eq(f.messageCards().length,1,'Mismatched response never inserts a customer recommendation');
 eq(f.requests.some(x=>x.options?.method==='POST'),false,'Invalid lookup never writes');
 f.unmount();
}
// A delayed older notification reply must not replace the subsequent notification.
{
 const f=fixture(),pending=deferred();
 f.response(async url=>url.includes('estimateId=older-due')?pending.promise:
  url.includes('estimateId=newer-due')?{ok:true,json:async()=>({estimateId:'newer-due',estimates:[job('newer-due')],nextCursor:null,pageSize:1})}:
  response([job()]));
 f.mount();await flush();f.focus('older-due');f.focus('newer-due');await flush();
 pending.resolve({ok:true,json:async()=>({estimateId:'older-due',estimates:[job('older-due')],nextCursor:null,pageSize:1})});await flush();
 f.focus('newer-due');
 eq(f.focusCalls.includes('followup-action-newer-due'),true,'Newest notification focuses exact updated target');
 eq(f.messageCards().length,2,'Late obsolete lookup cannot inject another estimate');
 eq(f.handled.includes('older-due'),false,'Superseded lookup does not acknowledge obsolete notification');
 f.unmount();
}

// Actual JSX filter buttons retain exact estimate actions and never write on navigation.
{
 const f=fixture();
 const quote=job('synthetic-job');
 const billing={...job('invoice-job'),status:'accepted',invoiceId:'invoice-exact'};
 f.response(async()=>response([quote,billing]));
 f.mount();await flush();
 eq(f.messageCards().length,2,'Unfiltered follow-up view includes estimate and billing actions');
 const select=label=>{
   const b=f.lookup(n=>n.props?.['aria-label']==='Filter follow-ups: '+label&&typeof n.props?.onClick==='function');
   assert.ok(b,'Accessible '+label+' filter exists');b.props.onClick();
 };
 select('Billing');
 eq(f.get(9),'billing','Billing button updates explicit owner filter');
 eq(f.messageCards().length,1,'Billing filter shows one invoice action');
 eq(f.nodes().filter(n=>n.props?.className?.startsWith?.('followup-card ')).length,1,'Unrelated estimate cards are hidden');
 const target=f.lookup(n=>n.props?.['aria-label']==='Open saved estimate for Synthetic QA'&&typeof n.props?.onClick==='function');
 assert.ok(target,'Exact saved estimate navigation is present on billing card');
 target.props.onClick();
 eq(f.handled.at(-1),'fallback:invoice-job','Billing card navigates to exact linked estimate');
 select('Reviews');
 eq(f.messageCards().length,0,'Empty category does not display unrelated outreach');
 eq(f.nodes().some(n=>n.props?.children==='No matches in this filter'),true,'Empty category is not falsely called caught up');
 f.clickText('Show all follow-ups');
 eq(f.messageCards().length,2,'All control restores original actions without refresh');
 select('Billing');
 f.focus('synthetic-job');
 eq(f.get(9),'all','Exact bell deep link resets an old category filter safely');
 f.focus('synthetic-job');
 eq(f.focusCalls.includes('followup-action-synthetic-job'),true,'Reset filter allows exact quote focus');
 eq(f.requests.some(x=>x.options?.method==='POST'),false,'Filtering, history inspection and navigation are GET-only');
 f.unmount();
}

// Priority navigation is deterministic and never saves or sends.
// The source-extracted button callbacks target the same cards rendered below.
{
 const f=fixture();
 const quote=job('older-quote');
 const bill={...job('billing-job'),customerId:'billing-customer',status:'accepted',invoiceId:'invoice-bill',createdAt:'2026-10-02T12:00:00Z'};
 f.response(async()=>response([quote,bill]));
 f.mount();await flush();
 const priority=f.nodes().find(n=>n.props?.['aria-label']==='Top follow-up priorities in loaded records');
 eq(Boolean(priority),true,'Priority navigation region appears only after verified load');
 const buttons=f.nodes().filter(n=>n.props?.['aria-label']?.startsWith?.('Jump to '));
 eq(buttons.length,2,'The quick jump offers the two eligible saved actions, not duplicate action controls');
 eq(f.requests.every(x=>x.options?.cache==='no-store'),true,'Follow-up reads bypass stale browser cache');
 eq(f.requests.filter(x=>x.options?.method==='POST').length,0,'Priority display performs GET only');
 f.unmount();
}
{
 const f=fixture();f.mount();await flush();
 const prior=f.requests.length;
 // Source contains auto-resume, confirmed-save and cleanup semantics without
 // instantiating a real browser in this isolated component harness.
 const source=readFileSync('app/dashboard.tsx','utf8');
 for(const needle of ['window.addEventListener("fire:attention-saved",refresh)','document.addEventListener("visibilitychange",refresh)','window.setInterval(refresh,60000)','window.removeEventListener("fire:attention-saved",refresh)','!actionPending.current','node?.focus({preventScroll:true})']){
   eq(source.includes(needle),true,'Safe follow-up refresh/jump code exists: '+needle);
 }
 eq(f.requests.length,prior,'Browsing milestones does not issue additional GET or POST');
 f.unmount();
}
// High-priority owner triage and one-tap contact must be read-only and preserve the exact customer.
{
 const f=fixture();
 const lower={...job('lower-quote'),firstEstimateSentAt:'2026-10-08T12:00:00Z',lastEstimateSentAt:'2026-10-08T12:00:00Z'};
 const billing={...job('urgent-billing'),status:'accepted',invoiceId:'invoice-billing'};
 f.response(async()=>response([lower,billing]));
 f.mount();await flush();
 eq(f.messageCards().length,2,'All follow-up categories are shown by default');
 const high=f.lookup(n=>n.props?.['aria-label']==='Show high priority follow-ups'&&typeof n.props?.onClick==='function');
 assert.ok(high,'Accessible high-priority filter exists');
 high.props.onClick();
 eq(f.get(10),true,'Owner can switch to high priority actions');
 eq(f.messageCards().length,1,'Priority view excludes lower-ranked estimate without changing saved data');
 const customer=f.lookup(n=>n.props?.['aria-label']==='Open saved customer history for Synthetic QA'&&typeof n.props?.onClick==='function');
 assert.ok(customer,'Saved customer shortcut appears in priority card');
 customer.props.onClick();
 eq(f.handled.at(-1),'customer:synthetic-customer','Follow-up shortcut targets exact saved customer profile');
 const links=f.nodes().filter(n=>n.type==='a'&&typeof n.props?.href==='string').map(n=>n.props.href);
 eq(f.nodes().some(n=>n.type===f.component('GoogleVoiceCallAction')&&n.props.phone==='9185550100'&&n.props.customerName==='Synthetic QA'),true,'Primary Call retains exact saved recipient through business Voice');
 eq(f.nodes().some(n=>n.type===f.component('GoogleVoiceTextAction')&&n.props.phone==='9185550100'),true,'Primary Text retains exact saved recipient through business Voice');eq(f.nodes().filter(n=>n.type===f.component('PersonalPhoneBackupAction')&&n.props.phone==='9185550100').length,2,'Call/text personal backups remain separate from primary actions');eq(links.some(href=>/^(sms|tel):/.test(href)),false,'No silent primary personal-number route remains');
 eq(links.includes('mailto:qa@example.test'),true,'Manual email opens mail composer without sending');
 const posts=f.requests.filter(x=>x.options?.method==='POST');
 eq(posts.length,0,'Priority filter and contact navigation never POST');
 f.focus('lower-quote');
 eq(f.get(10),false,'Bell deep-link resets priority view to reveal exact due follow-up');
 f.focus('lower-quote');
 eq(f.focusCalls.includes('followup-action-lower-quote'),true,'Due estimate focus lookup uses exact saved ID after priority reset');
 f.unmount();
}
// Synthetic priority split: a past suggested target cannot be hidden as low priority.
{
 const f=fixture();
 const past=job('past-target-quote');
 const recent={...job('recent-target-quote'),firstEstimateSentAt:'2026-10-08T12:00:00Z',lastEstimateSentAt:'2026-10-08T12:00:00Z'};
 f.response(async()=>response([past,recent]));
 f.mount();await flush();
 eq(f.messageCards().length,2,'Due and missed-target actions both appear without filters');
 const high=f.lookup(n=>n.props?.['aria-label']==='Show high priority follow-ups');
 assert.ok(high,'High-priority owner filter remains accessible');
 high.props.onClick();
 eq(f.messageCards().length,1,'Past-target action stays high priority; routine day-one action does not');
 eq(f.messageCards()[0].props.estimate.id,'past-target-quote','High-priority filter preserves exact estimate ID');
 eq(f.requests.filter(req=>req.options?.method==='POST').length,0,'Filtering recommendations cannot record customer actions');
 f.unmount();
}
const source=readFileSync('app/dashboard.tsx','utf8');
assert.ok(source.includes('onOpenCustomer={id=>{setSearchQuery("");setGlobalQuery("");setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}}/>'),'Follow-up shortcut lands on the actual customer profile, not generic Customers list');

console.log('PASS '+checks+'/'+checks+': actual FollowUpsView paginated endpoint, failure/retry, priority navigation, refresh listeners and stale read protection. Mock GET only.');

// Real follow-up action card fetch: exact estimate, no writes, and strict response validation.
{
 const f=fixture();const events=[{id:'logged-1',channel:'contact_recorded',template:'followupContact',createdAt:'2026-10-08T12:00:00Z'}];
 f.response(async url=>url.startsWith('/api/followup-contact-history?')?
  {ok:true,json:async()=>({estimateId:'synthetic-job',customerId:'synthetic-customer',events,hasMore:false})}:response([job()]));
 f.mount();await flush();
 const trigger=()=>f.lookup(n=>n.props?.['aria-label']==='Toggle saved contact history for Synthetic QA followUp7');
 assert.ok(trigger(),'Saved contact history action is available on due estimate');
 const before=f.requests.length;trigger().props.onClick();await flush();await flush();
 eq(f.requests.length,before+1,'Only one read is started when history opens');
 eq(f.requests.at(-1).url,'/api/followup-contact-history?estimateId=synthetic-job&customerId=synthetic-customer','Exact saved estimate/customer pair is required');
 eq(f.requests.at(-1).options.cache,'no-store','Private contact history bypasses browser cache');
 eq(trigger().props['aria-expanded'],true,'Expanded state is accessible');
 eq(f.nodes().some(n=>n.props?.['aria-label']==='Saved contact history for Synthetic QA followUp7'),true,'Contact history visible in its own named region');
 trigger().props.onClick();
 eq(f.nodes().some(n=>n.props?.['aria-label']==='Saved contact history for Synthetic QA followUp7'),false,'Owner can collapse evidence without a write');
 eq(f.requests.filter(x=>x.options?.method==='POST').length,0,'Reviewing contact history never writes customer data');
 f.unmount();
}
{
 const f=fixture();
 f.response(async url=>url.startsWith('/api/followup-contact-history?')?
  {ok:true,json:async()=>({estimateId:'another-estimate',customerId:'synthetic-customer',events:[],hasMore:false})}:response([job()]));
 f.mount();await flush();
 f.lookup(n=>n.props?.['aria-label']==='Toggle saved contact history for Synthetic QA followUp7').props.onClick();await flush();await flush();
 eq(f.nodes().some(n=>n.props?.role==='alert'),true,'Wrong estimate identity fails closed');
 eq(f.nodes().some(n=>n.props?.children==='No saved activity for this estimate. Full customer history may contain other contact.'),false,'Bad response never claims no contact');
 f.unmount();
}


// Financial safety: a customer overpayment is owner review, never an automatic
// invoice-reminder suggestion. Normal collectible invoice reminders still work.
{
 const f=fixture();
 const overage={...job('overpaid-estimate'),status:'accepted',invoiceId:'overpaid-invoice',paidCents:14000,paymentOverageOpen:4000};
 const collectible={...job('collectible-estimate'),status:'accepted',invoiceId:'collectible-invoice',paidCents:2000,paymentOverageOpen:0};
 f.response(async()=>response([overage,collectible]));
 f.mount();await flush();
 eq(f.messageCards().length,1,'Payment overage never renders a customer reminder composer');
 eq(f.nodes().some(n=>n.props?.className==='followup-card history'&&n.props?.id==='followup-card-overpaid-estimate-invoiceReminder'),true,'Overpayment instead appears as an owner-only review card');
 eq(f.nodes().some(n=>n.props?.children==='Review estimate'),true,'Overpayment has an explicit saved-estimate review control');
 eq(f.nodes().some(n=>n.props?.className==='followup-card followup'&&n.props?.id==='followup-card-collectible-estimate-invoiceReminder'),true,'Normal collectible invoice reminder remains available');
 eq(f.requests.filter(x=>x.options?.method==='POST').length,0,'Showing exception makes no external request or financial write');
 f.unmount();
}
console.log('PASS follow-up billing exception: refund-review first, no outgoing payment reminder, ordinary invoices preserved.');
