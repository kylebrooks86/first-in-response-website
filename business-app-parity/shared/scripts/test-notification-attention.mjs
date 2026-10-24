/** Exercise actual NotificationAttention source with synthetic, read-only owner feeds. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NotificationAttention');
assert.ok(fn,'Real notification attention view exists');
// The bell shows actionable reminders, not implementation tutorials. Retain
// incomplete-coverage warnings and error/refresh actions when actually needed.
const attentionMarkup=fn.getText(ast);
for(const obsolete of [
 'All available estimate pages checked in this view',
 'Matching open due tasks consolidate duplicate sign and review reminders',
 'Live reminders are separate from unread activity'
])assert.ok(!attentionMarkup.includes(obsolete),'Remove redundant bell prose: '+obsolete);
for(const essential of [
 'Older estimates remain outside', // checked below via concise replacement
 'Attention items couldn',
 'Refresh attention items',
 'hasOlder',
 'hasMoreReviewCloseouts'
]){
 if(essential==='Older estimates remain outside')continue;
 assert.ok(attentionMarkup.includes(essential),'Retain important failure/partial coverage behavior: '+essential);
}
assert.ok(attentionMarkup.includes('older ones not included'),'Older estimate counts must remain qualified');
assert.ok(attentionMarkup.includes('older reviews not included'),'Older paid review counts must remain qualified');
const tags=new Set(),stateNames=[];
function visit(node){
 if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&/^[A-Z]/.test(node.tagName.getText(ast)))tags.add(node.tagName.getText(ast));
 if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(ast)==='useState')stateNames.push(node.name.elements[0].getText(ast));
 ts.forEachChild(node,visit);
}
visit(fn);
const compiled=ts.transpileModule(fn.getText(ast)+'\nexports.renderAttention=NotificationAttention;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const taskSrc=ts.transpileModule(readFileSync('lib/task-due.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const taskLib={exports:{}};vm.runInNewContext(taskSrc,taskLib);
const followSource=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const followLib={exports:{}};vm.runInNewContext(followSource,followLib);
const attentionSource=ts.transpileModule(readFileSync('lib/attention-estimates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const attentionLib={exports:{},require:()=>followLib.exports};vm.runInNewContext(attentionSource,attentionLib);
const taskContext={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync('lib/business-task-context.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:taskContext.exports,Date});
const flagDedupe={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync('lib/attention-flag-dedupe.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:flagDedupe.exports,Date,Set});
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
const dayBefore=new Date(today+'T12:00:00Z');dayBefore.setUTCDate(dayBefore.getUTCDate()-1);
const yesterday=dayBefore.toISOString().slice(0,10);
const items={
 tasks:[{id:'task-due',title:'Pick up yard sign',status:'open',dueAt:new Date(Date.now()-86400000).toISOString(),createdAt:'2026-10-18T12:00:00Z'},{id:'task-closed',title:'Already finished',status:'completed',dueAt:new Date(Date.now()-86400000).toISOString(),createdAt:'2026-10-18T12:00:00Z'}],
 signs:[{customerId:'customer-sign',customerName:'Sign customer',location:'Driveway',pickupDate:yesterday,placedAt:'2026-10-01T12:00:00Z'},{customerId:'sign-later',customerName:'Later sign',location:'Lawn',pickupDate:'2099-12-31',placedAt:'2026-10-01T12:00:00Z'}],
 checks:[{customerId:'customer-review',customerName:'Review customer',requestedAt:'2026-10-01T12:00:00Z',elapsedDays:12}],
 closeouts:[],
 estimates:[
 {id:'est-follow',customer:'Quote customer',status:'sent',createdAt:new Date(Date.now()-4*86400000).toISOString(),firstEstimateSentAt:new Date(Date.now()-4*86400000).toISOString(),lastEstimateSentAt:new Date(Date.now()-4*86400000).toISOString()},
 {id:'est-invoice',customer:'Invoice customer',status:'accepted',createdAt:'2026-10-10T12:00:00Z',invoiceId:'inv-exact',totalCents:20000,paidCents:0},
 {id:'est-prep',customer:'Prep customer',status:'scheduled',createdAt:'2026-10-10T12:00:00Z',scheduledAt:new Date(Date.now()+3600000).toISOString(),address:'',phone:'',email:''}
 ]
};
let checks=0;function eq(value,expected,reason){assert.deepEqual(value,expected,reason);checks++;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function elements(node){
 const all=[];function walk(n){if(Array.isArray(n)){for(const x of n)walk(x);return;}if(!n||typeof n!=='object')return;all.push(n);walk(n.props?.children);}walk(node);return all;
}
function fixture(){
 let state=[],cursor=0,effect,clean,failed=null,refreshKey=0,firstCursor=null,firstReviewCursor=null,firstReviewMore=false;const olderPages=new Map(),olderReviews=new Map();const calls=[],nav=[],closed=[],summaries=[],documentListeners={},windowListeners={},savedRows={tasks:items.tasks.map(x=>({...x})),signs:items.signs.map(x=>({...x})),checks:items.checks.map(x=>({...x})),closeouts:items.closeouts.map(x=>({...x})),estimates:items.estimates.map(x=>({...x}))};
 const context={
  exports:{},require,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
  useEffect(fn){effect=fn;},taskDueBucket:taskLib.exports.taskDueBucket,flagHasMatchingDueTask:flagDedupe.exports.flagHasMatchingDueTask,taskLinkedFlag:taskContext.exports.taskLinkedFlag,
  document:{visibilityState:'visible',addEventListener(name,fn){documentListeners[name]=fn;},removeEventListener(name){delete documentListeners[name];}},AbortController,estimateAttentionItems:attentionLib.exports.estimateAttentionItems,
  window:{addEventListener(name,fn){windowListeners[name]=fn;},removeEventListener(name){delete windowListeners[name];},setInterval(){return 1;},clearInterval(){}},
  fetch:async(url,options)=>{calls.push({url,options});if(failed===url)return {ok:false,json:async()=>({error:'Synthetic outage'})};
    if(url.startsWith('/api/followups?limit=50&cursor=')){
      const cursor=decodeURIComponent(url.split('cursor=')[1]||'');
      if(!olderPages.has(cursor))throw Error('Unexpected synthetic cursor: '+cursor);
      return {ok:true,json:async()=>olderPages.get(cursor)};
    }
    if(url.startsWith('/api/payment-closeouts?cursor=')){
     const cursor=decodeURIComponent(url.split('cursor=')[1]||'');
     if(!olderReviews.has(cursor))throw Error('Unexpected review cursor '+cursor);
     return {ok:true,json:async()=>olderReviews.get(cursor)};
    }
    const name=url==='/api/tasks'?'tasks':url==='/api/dashboard-yard-signs'?'signs':url==='/api/dashboard-review-checks'?'checks':url==='/api/followups?limit=50'?'estimates':url==='/api/payment-closeouts'?'closeouts':null;
    if(!name)throw Error('Unexpected endpoint '+url);
    return {ok:true,json:async()=>name==='estimates'?{estimates:savedRows.estimates,nextCursor:firstCursor}:name==='closeouts'?{actions:savedRows.closeouts,mayHaveMore:firstReviewMore,nextCursor:firstReviewCursor}:{[name]:savedRows[name]}};},
  ...Object.fromEntries([...tags].map(name=>[name,()=>null]))
 };
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=0;return context.exports.renderAttention({onNavigate:(...args)=>nav.push(args),onClose:()=>closed.push(true),onSummary:value=>summaries.push(value),refreshKey});};
 return {render,get:name=>state[stateNames.indexOf(name)],calls,nav,closed,summaries,initialCursor:value=>{firstCursor=value;},olderPage:(cursor,value)=>olderPages.set(cursor,value),reviewCursor:(value,more=true)=>{firstReviewCursor=value;firstReviewMore=more;},olderReview:(cursor,value)=>olderReviews.set(cursor,value),fail:url=>{failed=url;},mount:()=>{render();clean=effect();},refresh:()=>{clean?.();render();clean=effect();},openAgain:()=>{refreshKey++;clean?.();render();clean=effect();},visibleAgain:()=>documentListeners.visibilitychange?.(),confirmSaved:update=>{update(savedRows);windowListeners['fire:attention-saved']?.();},unmount:()=>clean?.(),buttons:()=>elements(render()).filter(n=>n.type==='button')};
}
{
 const f=fixture();f.mount();await flush();await flush();
 eq(f.get('status'),'ready','All three owner feeds verified');
 eq(f.get('rows').length,6,'Tasks, signs, review checks, follow-up, invoice and appointment');
 eq(f.summaries.at(-1).status,'ready','Bell is notified that attention read succeeded');
 eq(f.summaries.at(-1).count,6,'Bell receives exact action count independent of unread activity');
 eq(f.get('rows').map(item=>item.key).slice(0,3).join('|'),'task:task-due|sign:customer-sign|appointment:est-prep','Overdue task and overdue sign sort ahead of job-prep attention');
 eq(f.get('rows').every((row,index,list)=>index===0||list[index-1].priority>=row.priority),true,'Reminder sorting uses business priority, not alphabetic record IDs');
 const priorityFilter=f.buttons().find(b=>b.props?.['aria-pressed']===false&&String(b.props.children).includes('Priority'));
 assert.ok(priorityFilter,'Owner can filter to immediate priorities on iPhone');
 priorityFilter.props.onClick();
 eq(f.get('view'),'priority','Priority filter activates without a network write');
 eq(elements(f.render()).filter(e=>e.type==='button'&&String(e.props?.['aria-label']??'').startsWith('Open ')).length,3,'Priority filter displays only overdue and near-term items');
 const allFilter=f.buttons().find(b=>b.props?.['aria-pressed']===false&&String(b.props.children).includes('All'));
 assert.ok(allFilter);allFilter.props.onClick();
 eq(f.get('view'),'all','All reminders can be restored in one tap');
 eq(f.get('rows').some(i=>i.key==='task:task-closed'),false,'Completed task never appears');
 eq(f.get('rows').some(i=>i.key==='sign:sign-later'),false,'Future pickup is not falsely overdue');
 eq(f.calls.length,5,'Read-only fetch for five owner feeds, including verified paid closeouts');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Never submits writes or cached attention reads');
 const task=f.buttons().find(b=>b.props?.['aria-label']==='Open task: Pick up yard sign');
 assert.ok(task);task.props.onClick();
 eq(f.nav.at(-1).join('|'),'business||||task-due|','Task shortcut passes exact saved task ID and optional owner-scoped fallback metadata');
 const sign=f.buttons().find(b=>b.props?.['aria-label']==='Open yard sign: Sign customer');
 assert.ok(sign);sign.props.onClick();eq(f.nav.at(-1).join('|'),'customers|||customer-sign||sign','Yard sign shortcut targets saved customer flag');
 const review=f.buttons().find(b=>b.props?.['aria-label']==='Open review check: Review customer');
 assert.ok(review);review.props.onClick();eq(f.nav.at(-1).join('|'),'customers|||customer-review||review','Review check shortcut targets saved review status');
 const invoice=f.buttons().find(b=>b.props?.['aria-label']==='Open invoice: Invoice customer');
 assert.ok(invoice);invoice.props.onClick();eq(f.nav.at(-1).join('|'),'invoices||inv-exact','Invoice shortcut opens exact invoice');
 const quote=f.buttons().find(b=>b.props?.['aria-label']==='Open follow-up: Quote customer');
 assert.ok(quote);quote.props.onClick();eq(f.nav.at(-1).join('|'),'followups|est-follow','Due quote shortcut opens exact Follow-ups action');
 const prep=f.buttons().find(b=>b.props?.['aria-label']==='Open appointment: Prep customer');
 assert.ok(prep);prep.props.onClick();eq(f.nav.at(-1).join('|'),'estimates|est-prep','Prep shortcut opens exact estimate');
 eq(f.closed.length,6,'Each shortcut closes bell for focused navigation');
 f.openAgain();await flush();await flush();
 eq(f.calls.length,10,'Opening bell again triggers uncached refresh of all five owner feeds');
 eq(f.get('status'),'ready','Reopened bell completes a fresh verified attention read');
 f.visibleAgain();await flush();await flush();
 eq(f.calls.length,15,'Returning to installed app through visibilitychange refreshes saved reminders');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Reopen and visibility refresh remain strictly read-only');
 f.confirmSaved(saved=>{saved.tasks[0].status='completed';saved.tasks[0].completedAt=new Date().toISOString();});
 await flush();await flush();
 eq(f.get('rows').some(x=>x.key==='task:task-due'),false,'Confirmed task completion disappears from bell without waiting 60 seconds');
 eq(f.summaries.at(-1).count,5,'Bell count reconciles after confirmed task completion');
 f.confirmSaved(saved=>{saved.signs[0].pickupDate='2099-12-31';saved.checks=[];saved.estimates[0].lastManualContactAt=new Date().toISOString();});
 await flush();await flush();
 eq(f.get('rows').some(x=>['sign:customer-sign','review:customer-review','followup:est-follow'].includes(x.key)),false,'Saved notes and confirmed follow-up clear corresponding attention items');
 eq(f.get('rows').length,2,'Unrelated invoice and job-preparation reminders remain visible');
 eq(f.calls.length,25,'Each owner-confirmed signal triggers one read of five feeds');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Confirmed changes trigger GETs only, no duplicate writes');
 f.unmount();
}
{
 const f=fixture();f.fail('/api/dashboard-review-checks');f.mount();await flush();await flush();
 eq(f.get('status'),'error','A failed feed never reports clear status');
 eq(f.summaries.at(-1).status,'error','Bell is told its reminder count is unavailable, not falsely zero');
 eq(f.summaries.at(-1).count,0,'Failed feeds never claim verified action count');
 eq(f.get('rows').length,0,'Cannot show falsely complete partial attention results');
 const alert=elements(f.render()).find(n=>n.props?.role==='alert');
 assert.ok(alert&&String(alert.props.children).includes("couldn't be verified"));
 checks++;
 f.fail(null);f.refresh();await flush();await flush();
 eq(f.get('status'),'ready','Owner retry recovers all three verified feeds');
 eq(f.get('rows').length,6,'Recovered attention items reappear');
 f.unmount();
}
// Paid closeouts enter the notification bell without automatic sends.
{
 const f=fixture();f.mount();await flush();await flush();
 const paid=new Date(Date.now()-3600000).toISOString();
 f.confirmSaved(saved=>{saved.closeouts=[
  {estimateId:'paid-job',customerId:'paid-customer',customerName:'Paid customer',totalCents:18000,lastPaidAt:paid,state:'ready',reviewPreparedAt:null},
  {estimateId:'prepared-job',customerId:'prepared-customer',customerName:'Prepared customer',totalCents:24500,lastPaidAt:paid,state:'prepared',reviewPreparedAt:paid}
 ];});await flush();await flush();
 eq(f.get('rows').length,8,'Verified paid review requests appear alongside current reminders');
 eq(f.summaries.at(-1).count,8,'Bell badge reflects paid closeout requests');
 eq(f.get('rows').some(row=>row.key==='closeout:paid-job'&&row.detail.includes('request an honest review')),true,'Ready job identifies an honest review request');
 eq(f.get('rows').some(row=>row.key==='closeout:prepared-job'&&row.detail.includes('sending not confirmed')),true,'Prepared review is never counted as sent');
 const button=f.buttons().find(row=>row.props?.['aria-label']==='Open review request: Paid customer');
 assert.ok(button,'Review request button exists');button.props.onClick();
 eq(f.nav.at(-1).join('|'),'estimates|paid-job','Bell opens the exact completed paid job');
 f.confirmSaved(saved=>{saved.closeouts=saved.closeouts.filter(row=>row.estimateId!=='paid-job');});await flush();await flush();
 eq(f.get('rows').some(row=>row.key==='closeout:paid-job'),false,'Confirmed review request disappears after saved refresh');
 eq(f.get('rows').some(row=>row.key==='closeout:prepared-job'),true,'Prepared unconfirmed message remains actionable');
 f.unmount();
}
{
 const f=fixture();f.fail('/api/payment-closeouts');f.mount();await flush();await flush();
 eq(f.get('status'),'error','Unavailable closeout feed cannot falsely clear bell attention');
 eq(f.summaries.at(-1).status,'error','Failed payment-closeout feed cannot publish a verified reminder count');
 f.fail(null);f.refresh();await flush();await flush();
 eq(f.get('status'),'ready','Refresh restores closeout reminder verification');
 f.unmount();
}
// Older review queue is scanned by owner and exact-job navigation remains intact.
{
 const f=fixture(),at=new Date(Date.now()-3600000).toISOString();
 const closeout=(id,state='ready')=>({estimateId:id,customerId:'customer-'+id,customerName:'Customer '+id,totalCents:12000,lastPaidAt:at,state,reviewPreparedAt:state==='prepared'?at:null});
 f.reviewCursor('cursor-1');
 f.olderReview('cursor-1',{actions:[closeout('older-1','prepared')],mayHaveMore:true,nextCursor:'cursor-2'});
 f.olderReview('cursor-2',{actions:[closeout('older-2')],mayHaveMore:false,nextCursor:null});
 f.mount();await flush();await flush();
 eq(f.get('hasMoreReviewCloseouts'),true,'First review page flags unscanned older jobs');
 let older=f.buttons().find(b=>b.props?.children==='Check 200 older paid jobs');assert.ok(older);
 older.props.onClick();f.refresh();await flush();await flush();
 eq(f.get('checkedReviewCount'),1,'Owner tap verifies older prepared review job');
 eq(f.get('rows').some(x=>x.key==='closeout:older-1'&&x.detail.includes('sending not confirmed')),true,'Prepared older review not called sent');
 const target=f.buttons().find(b=>b.props?.['aria-label']==='Open review request: Customer older-1');assert.ok(target);
 target.props.onClick();eq(f.nav.at(-1).join('|'),'estimates|older-1','Bell opens exact older job');
 older=f.buttons().find(b=>b.props?.children==='Check 200 older paid jobs');older.props.onClick();f.refresh();await flush();await flush();
 eq(f.get('hasMoreReviewCloseouts'),false,'Verified end of older pages clears truncated warning');
 eq(f.get('checkedReviewCount'),2,'Bell includes all scanned paid jobs');
 eq(f.calls.filter(x=>x.url.startsWith('/api/payment-closeouts?cursor=')).length,3,'Older pages fetched only after owner taps');
 eq(f.calls.every(x=>!x.options.method&&x.options.cache==='no-store'),true,'Paging makes only private read requests');
 f.unmount();
}
{
 const f=fixture(),at=new Date(Date.now()-3600000).toISOString();
 f.reviewCursor('cursor-loop');
 f.olderReview('cursor-loop',{actions:[{estimateId:'broken',customerId:'customer-broken',customerName:'Broken',totalCents:12000,lastPaidAt:at,state:'ready'}],mayHaveMore:true,nextCursor:'cursor-loop'});
 f.mount();await flush();await flush();
 f.buttons().find(b=>b.props?.children==='Check 200 older paid jobs').props.onClick();f.refresh();await flush();await flush();
 eq(f.get('status'),'error','Repeated review cursor fails closed');
 eq(f.get('rows').length,0,'Malformed older page never publishes misleading reminder count');
 eq(f.summaries.at(-1).status,'error','Broken page marks summary unavailable');
 f.unmount();
}
// Existing due task replaces its exact customer flag in bell, but future or completed
// task never suppresses physical pickup/review status.
{
 const f=fixture();f.mount();await flush();await flush();
 f.confirmSaved(saved=>{
  saved.tasks[0].customerId='customer-sign';
  saved.tasks[0].notes='FIRE yard sign placement: 2026-10-01T12:00:00Z';
 });await flush();await flush();
 eq(f.get('rows').some(r=>r.key==='task:task-due'),true,'Linked due task retains exact saved task shortcut');
 eq(f.get('rows').some(r=>r.key==='sign:customer-sign'),false,'Same sign event is not a duplicate bell item');
 const task=f.buttons().find(b=>b.props?.['aria-label']==='Open task: Pick up yard sign');task.props.onClick();
 eq(f.nav.at(-1).join('|'),'business|||customer-sign|task-due|sign','Consolidated sign reminder preserves exact saved task and fallback customer flag');
 f.confirmSaved(saved=>{saved.tasks[0].status='completed';saved.tasks[0].completedAt=new Date().toISOString();});await flush();await flush();
 eq(f.get('rows').some(r=>r.key==='sign:customer-sign'),true,'Completed task does not falsely claim sign was physically picked up');
 f.unmount();
}
// One bell scan checks bounded older pages, does not send, and preserves the
// incomplete-coverage warning until it reaches a verified final cursor.
{
 const f=fixture();
 f.initialCursor('p1');
 f.olderPage('p1',{estimates:[{...items.estimates[0],id:'older-follow'}],nextCursor:'p2'});
 f.olderPage('p2',{estimates:[],nextCursor:null});
 f.mount();await flush();await flush();
 eq(f.get('hasOlder'),true,'First page reveals older unscanned follow-up records');
 const action=f.buttons().find(b=>b.props?.children==='Check up to 200 older estimates');assert.ok(action);
 action.props.onClick();f.refresh();await flush();await flush();
 eq(f.get('status'),'ready','Multiple page scan reaches a verified ready state');
 eq(f.get('hasOlder'),false,'True end cursor clears the older-record warning');
 eq(f.get('checkedEstimateCount'),4,'Coverage counts three original and one distinct old estimate');
 eq(f.get('rows').some(x=>x.key==='followup:older-follow'),true,'Old due follow-up enters bell with exact estimate ID');
 eq(f.calls.filter(x=>x.url.includes('&cursor=')).length,2,'Scan reads only two older pages before end, not 200 blindly');
 eq(f.calls.every(c=>!c.options.method&&c.options.cache==='no-store'),true,'Scanning never writes customer records');
 f.unmount();
}
{
 const f=fixture();
 f.initialCursor('broken-p1');
 f.olderPage('broken-p1',{estimates:[{...items.estimates[0],id:'partial-item'}],nextCursor:'broken-p2'});
 f.olderPage('broken-p2',{estimates:{bad:true},nextCursor:null});
 f.mount();await flush();await flush();
 f.buttons().find(b=>b.props?.children==='Check up to 200 older estimates').props.onClick();
 f.refresh();await flush();await flush();
 eq(f.get('status'),'error','Unverified second page fails closed');
 eq(f.get('rows').length,0,'Partial scan does not publish unverified reminder count');
 eq(f.summaries.at(-1).status,'error','Bell count becomes unavailable, never false zero');
 eq(f.calls.every(c=>!c.options.method),true,'Failure and retry produce no POST or PATCH');
 f.unmount();
}
assert.ok(source.includes('<NotificationAttention onNavigate={onNavigate} onClose={()=>setOpen(false)} onSummary={setAttentionSummary} refreshKey={attentionRefreshKey}/>'),'Bell mounts and forwards refresh generation to its read-only attention feed');
assert.ok(source.includes('setAttentionRefreshKey(n=>n+1)'),'Opening bell forces new saved reminder verification');
assert.ok(source.includes('thisRequest===requestId'),'Earlier overlapping reads cannot replace fresher reminder results');
assert.ok(source.includes('document.addEventListener("visibilitychange",refresh)'),'iPhone Home Screen resume refreshes saved reminders');
assert.ok(source.includes('window.addEventListener("fire:attention-saved",refresh)'),'Live reminder feed listens for confirmed saved changes');
assert.ok(source.includes('window.removeEventListener("fire:attention-saved",refresh)'),'Live reminder feed unsubscribes on teardown');
assert.ok(source.includes('setTaskStatusMessage("Task status confirmed.")'),'Task status changes still require confirmed save before refresh');
assert.ok(source.includes('setNoteFeedback({customerId,kind:"success",text:"Note saved."})'),'Customer activity flags only refresh after verified note save');
assert.ok(source.includes('<PopoverContent forceMount className="notification-popover"'),'Bell reminder feed remains mounted while popover is closed');
assert.ok(source.includes('className="notification-attention-dot"'),'Bell shows attention separately from unread events');
assert.ok(source.includes('aria-label={unread?\`${unread} unread notifications\`:"Notifications"}'),'Legacy Notifications accessible button label remains stable for end-to-end navigation');
assert.ok(source.includes('aria-description={attentionDescription}'),'Business reminder count remains accessible without renaming the bell');
assert.ok(source.includes('activityFocus={customerActivityFocus}'),'Customer page accepts exact flag navigation');
assert.ok(source.includes('onNavigate(item.kind==="followup"?"followups":"estimates",item.estimateId)'),'Only due estimate follow-ups switch to the actionable Follow-ups screen');
assert.ok(source.includes('onOpenEstimate={id=>{setFocusFollowupEstimateId(null);'),'Missing/changed follow-ups retain a shortcut to the exact saved estimate');
assert.ok(source.includes('id={cardTarget(estimate.id,template)}')&&source.includes('["followUp1","followUp3","followUp7"].includes(template)?"followup-action-"+id'),'Due follow-up retains exact keyboard-focusable DOM target through shared ID helper');
assert.ok(source.includes('target.scrollIntoView({block:"start",behavior:"instant"})'),'Flag jump scrolls to exact saved customer flag');
assert.ok(source.includes('target.focus({preventScroll:true})'),'Flag jump also supports keyboard focus');
assert.ok(source.includes('if(taskId){setPickupTaskDraft(null);setReviewTaskDraft(null);setFocusBusinessTaskHint({customerId:customerId??null,activity:customerActivity??null});setFocusBusinessTaskId(taskId);setTab("business");}'),'Bell task click invokes focused Business navigation, not generic Business tab');
{
 const now=Date.parse('2026-10-20T18:00:00Z'),ago=d=>new Date(now-d*86400000).toISOString();
 const sent={id:'safe',customer:'Synthetic',status:'sent',createdAt:ago(10),firstEstimateSentAt:ago(10),lastEstimateSentAt:ago(10)};
 eq(attentionLib.exports.estimateAttentionItems([{...sent,stage7At:ago(2)}],now).length,0,'No duplicate seven-day reminder');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,snoozeUntil:ago(-2)}],now).length,0,'Snoozed quote remains quiet');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,lastManualContactAt:ago(.5)}],now).length,0,'Confirmed contact cooldown respected');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'draft',createdAt:ago(0)}],now).length,0,'Fresh draft remains quiet');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'completed',createdAt:ago(3),totalCents:20000,paidCents:20000,lastReviewRequestAt:ago(2)}],now).length,0,'Recorded review request not duplicated');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'completed',createdAt:ago(3),totalCents:20000,paidCents:20000}],now)[0]?.kind,'review-request','Unrequested paid work flagged');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'accepted',invoiceId:'paid',totalCents:20000,paidCents:20000}],now).length,0,'Paid invoice not flagged');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'scheduled',scheduledAt:ago(-1),address:'123 Main',phone:'9185551234'}],now).length,0,'Prepared appointment stays quiet');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'accepted',invoiceId:'unpaid',totalCents:20000,paidCents:0}],now)[0]?.priority,55,'Unpaid invoice appears after immediate concerns');
 eq(attentionLib.exports.estimateAttentionItems([{...sent,status:'accepted',paymentOverageOpen:1,totalCents:20000,paidCents:21000}],now)[0]?.priority,120,'Payment overage reconciliation is highest attention priority');
}
// Exercise the actual Dashboard priority action callbacks, not just string matches.
const dashboardFn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='DashboardView');
assert.ok(dashboardFn);
const priorityActions={};
function collectDashboardActions(n){
 if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
  const aria=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='aria-label');
  const click=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='onClick');
  if(aria&&click&&ts.isStringLiteral(aria.initializer)&&click.initializer&&ts.isJsxExpression(click.initializer)){
   const label=aria.initializer.text;
   if(['Review overdue yard sign pickup','Review customer review-status checks'].includes(label))priorityActions[label]=click.initializer.expression.getText(ast);
  }
 }
 ts.forEachChild(n,collectDashboardActions);
}
collectDashboardActions(dashboardFn);
function invokeDashboardPriority(label,values){
 const expression=priorityActions[label];assert.ok(expression,label+' source callback must exist');
 const code=ts.transpileModule('exports.action='+expression+';',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const captured=[],fallback=[];
 const context={exports:{},...values,
   onOpenCustomerActivity:(...args)=>captured.push(args),
   onOpenCustomer:id=>fallback.push(id),
   onNavigate:tab=>fallback.push(tab)};
 vm.runInNewContext(code,context);context.exports.action();
 return {captured,fallback};
}
{
 const s=invokeDashboardPriority('Review overdue yard sign pickup',{dueSign:{customerId:'sign-older',pickupDate:'2026-10-10'}});
 eq(s.captured[0]?.join('|'),'sign-older|sign','Dashboard due pickup opens its actual customer flag');
 eq(s.fallback.length,0,'Dashboard does not go to generic Customers when flag navigation exists');
 const r=invokeDashboardPriority('Review customer review-status checks',{oldestReviewCheck:{customerId:'review-longest',elapsedDays:19,requestedAt:'2026-10-01'}});
 eq(r.captured[0]?.join('|'),'review-longest|review','Dashboard review check opens its actual customer review flag');
 eq(r.fallback.length,0,'Review shortcut does not lose the exact customer destination');
 assert.ok(source.includes('onOpenCustomerActivity={(id,kind)=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus({customerId:id,kind,request:++customerActivityRequest.current})'),
  'Dashboard wires direct flag focus into the existing CustomersView request');
 checks++;
 assert.ok(source.includes('signs.filter(sign=>sign.pickupDate<=localDay)'),'Only due pickups qualify for Dashboard action');
 assert.ok(source.includes('b.elapsedDays-a.elapsedDays'),'Oldest review requests take priority independent of API order');
  assert.ok(source.includes('preparedPaidReviewCount>0&&oldestPaidReview&&<button'), 'Only already-prepared paid review messages get the confirmation shortcut; unprepared reviews have their own action');
  assert.ok(source.includes('unsentPaidReviewCount>0&&oldestUnpreparedReview&&<button'), 'Unprepared review work must not appear twice on Home');
  checks+=2;
 checks+=2;
}
console.log('PASS '+(checks+2)+' notification and Dashboard attention checks; exact customer flags, safe priority callbacks and recovery.');


// Validate the three actual Dashboard attention effects using synthetic HTTP only.
// A confirmed save must trigger fresh GETs without extra writes. Late GETs cannot
// revert a verified cleanup or falsely show zero after a read outage.
{
 const effects={};
 function captureEffects(n){
   if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]){
     const code=n.arguments[0].getText(ast);
     for(const endpoint of ['/api/tasks','/api/dashboard-yard-signs','/api/dashboard-review-checks']){
       if(code.includes('fetch("'+endpoint+'"'))effects[endpoint]=code;
     }
   }
   ts.forEachChild(n,captureEffects);
 }
 captureEffects(dashboardFn);
 eq(Object.keys(effects).length,3,'All three real Dashboard due-item effects are testable');
 const syntheticFor={
   '/api/tasks':{tasks:[{id:'due-task',title:'Call customer',status:'open',dueAt:new Date(Date.now()-3600000).toISOString()}]},
   '/api/dashboard-yard-signs':{signs:[{customerId:'sign-a',customerName:'Sign A',pickupDate:yesterday,location:'Front'}]},
   '/api/dashboard-review-checks':{checks:[{customerId:'review-a',customerName:'Review A',requestedAt:'2026-10-01T12:00:00Z',elapsedDays:12}]}
 };
 const propFor={
   '/api/tasks':['priorityTasks','priorityTaskStatus'],
   '/api/dashboard-yard-signs':['signs','signStatus'],
   '/api/dashboard-review-checks':['reviewChecks','reviewChecksStatus']
 };
 const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
 function dashboardFixture(endpoint){
   const changes={},requests=[],events={},docEvents={},intervals=new Map(),saved=structuredClone(syntheticFor[endpoint]);let fail=false,delayed=null;
   const [rowsName,statusName]=propFor[endpoint];changes[rowsName]=[];changes[statusName]='loading';
   const setters={
     setPriorityTasks:v=>changes.priorityTasks=v,setPriorityTaskStatus:v=>changes.priorityTaskStatus=v,
     setSigns:v=>changes.signs=v,setSignStatus:v=>changes.signStatus=v,
     setReviewChecks:v=>changes.reviewChecks=v,setReviewChecksStatus:v=>changes.reviewChecksStatus=v
   };
   const js=ts.transpileModule('exports.effect='+effects[endpoint]+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
   const context={exports:{},AbortController,...setters,
      window:{addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name],
        setInterval:(fn,ms)=>{intervals.set(1,{fn,ms});return 1;},clearInterval:id=>intervals.delete(id)},
      document:{visibilityState:'visible',addEventListener:(name,fn)=>docEvents[name]=fn,removeEventListener:name=>delete docEvents[name]},
      fetch:async(url,options)=>{
        requests.push({url,options});assert.equal(url,endpoint);
        if(delayed){const hold=delayed;delayed=null;return hold.promise;}
        if(fail)return {ok:false,json:async()=>({error:'Synthetic read outage'})};
        const snapshot=structuredClone(saved);
        return {ok:true,json:async()=>snapshot};
      }
   };
   vm.runInNewContext(js,context);
   const cleanup=context.exports.effect();
   return {saved,changes,requests,events,docEvents,intervals,
     refresh:()=>events['fire:attention-saved']?.(),focus:()=>events.focus?.(),resume:()=>docEvents.visibilitychange?.(),
     hide:()=>context.document.visibilityState='hidden',show:()=>context.document.visibilityState='visible',
     fail:value=>fail=value,delay:()=>{delayed=pause();return delayed;},cleanup};
 }
 for(const endpoint of Object.keys(effects)){
   const f=dashboardFixture(endpoint),[rowsName,statusName]=propFor[endpoint];
   await flush();await flush();
   eq(f.changes[statusName],'ready',endpoint+' initial load confirmed');
   eq(f.changes[rowsName].length,1,endpoint+' initial due item visible');
   eq(f.requests.length,1,endpoint+' one initial GET');
   eq(f.requests[0].options.cache,'no-store',endpoint+' cached attention reads disabled');
   eq(f.intervals.get(1)?.ms,60000,endpoint+' periodic verification while dashboard remains open');
   f.saved[rowsName==='priorityTasks'?'tasks':rowsName==='signs'?'signs':'checks']=[];
   f.refresh();await flush();await flush();
   eq(f.changes[rowsName].length,0,endpoint+' saved completion clears Dashboard due item');
   eq(f.changes[statusName],'ready',endpoint+' reports confirmed empty state only on verified read');
   eq(f.requests.length,2,endpoint+' confirmed event prompts exactly one GET');
   f.fail(true);f.refresh();await flush();await flush();
   eq(f.changes[statusName],'error',endpoint+' failed read does not claim all clear');
   f.fail(false);f.saved[rowsName==='priorityTasks'?'tasks':rowsName==='signs'?'signs':'checks'].push(structuredClone(syntheticFor[endpoint][rowsName==='priorityTasks'?'tasks':rowsName==='signs'?'signs':'checks'][0]));
   f.resume();await flush();await flush();
   eq(f.changes[rowsName].length,1,endpoint+' app-resume refresh recovers saved due item');
   const delayed=f.delay();f.focus();await flush();
   f.saved[rowsName==='priorityTasks'?'tasks':rowsName==='signs'?'signs':'checks']=[];
   f.refresh();await flush();await flush();
   eq(f.changes[rowsName].length,0,endpoint+' newer GET updates owner view');
   delayed.resolve({ok:true,json:async()=>structuredClone(syntheticFor[endpoint])});
   await flush();await flush();
   eq(f.changes[rowsName].length,0,endpoint+' stale late response cannot resurrect resolved reminder');
   f.hide();f.refresh();f.resume();await flush();
   eq(f.requests.length,6,endpoint+' hidden app never polls confirmed-save or visibility events');
   f.cleanup();
   eq(Boolean(f.events['fire:attention-saved']),false,endpoint+' event unsubscribed on unmount');
   eq(Boolean(f.docEvents.visibilitychange),false,endpoint+' visibility listener cleaned');
   eq(f.intervals.size,0,endpoint+' interval cleaned');
   eq(f.requests.every(x=>x.url===endpoint&&!x.options.method&&x.options.cache==='no-store'),true,endpoint+' all refreshes remain GET-only');
 }
}

// The actual customer status helper distinguishes recorded contact from confirmed
// sending and never makes unsaved drafts or future pickups "due".
{
 const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
 let fn=null;
 function findHelper(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='customerFlagPresentation')fn=node;ts.forEachChild(node,findHelper);}
 findHelper(component);
 assert.ok(fn,'Customer flags helper belongs to the CustomersView extracted by isolated regression suites');
 const compiled=ts.transpileModule(fn.getText(ast)+'\nexports.flag=customerFlagPresentation;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const ctx={exports:{}};vm.runInNewContext(compiled,ctx);
 const base={estimateSent:false,estimateMarkedSent:false,hasDraftEstimate:false,invoiceCreated:false,invoiceSendConfirmed:false,followupContactRecorded:false,
  followupSendConfirmed:false,reviewRequestRecorded:false,reviewSendConfirmed:false,reviewReceivedAt:null,
  sign:null,reviewDue:false,today:'2026-10-20'};
 eq(ctx.exports.flag(base).followup,'Not recorded','No follow-up action is assumed from drafts');
  eq(ctx.exports.flag({...base,hasDraftEstimate:true}).estimate,'Draft · not sent','Draft estimate is not presented as sent');
  eq(ctx.exports.flag({...base,estimateMarkedSent:true}).estimate,'Marked sent · verify','Legacy status alone is not proof of sending');
  eq(ctx.exports.flag({...base,estimateSent:true}).estimate,'Sent recorded','Saved send evidence is distinct from a status label');
 eq(ctx.exports.flag({...base,followupContactRecorded:true}).followup,'Contact recorded','Owner contact log never claims a message was sent');
 eq(ctx.exports.flag({...base,followupSendConfirmed:true}).followup,'Send confirmed','Confirmed external send recorded separately');
 eq(ctx.exports.flag({...base,followupContactRecorded:true,followupSendConfirmed:true}).followup,'Send confirmed','Confirmed send is preferred over contact-only status');
 eq(ctx.exports.flag({...base,invoiceCreated:true}).invoice,'Created · send not confirmed','Creating an invoice is not sending it');
 eq(ctx.exports.flag({...base,invoiceCreated:true,invoiceSendConfirmed:true}).invoice,'Send confirmed','Confirmed invoice send preserved');
 eq(ctx.exports.flag({...base,reviewRequestRecorded:true}).reviewRequest,'Request recorded','Saved review-request marker is not claimed as delivered');
 eq(ctx.exports.flag({...base,reviewSendConfirmed:true}).reviewRequest,'Send confirmed','Confirmed review send is distinct from owner marker');
 eq(ctx.exports.flag({...base,reviewReceivedAt:'2026-10-20T12:00:00Z'}).reviewReceived,'Owner logged','Review receipt remains owner-reported');
 eq(ctx.exports.flag({...base,sign:{state:'out',pickupDate:'2026-10-19'}}).needs.join('|'),'Yard sign pickup is due','Only overdue saved pickup generates sign action');
 eq(ctx.exports.flag({...base,sign:{state:'out',pickupDate:'2026-10-21'}}).needs.length,0,'Future pickup is not due');
 eq(ctx.exports.flag({...base,sign:{state:'picked_up',pickupDate:'2026-10-19'}}).needs.length,0,'Picked-up yard sign stays cleared');
 eq(ctx.exports.flag({...base,reviewDue:true}).needs.join('|'),'Review status needs checking','Due review status appears as a read-only check');
 eq(ctx.exports.flag({...base,reviewDue:true,reviewReceivedAt:'2026-10-20T12:00:00Z'}).needs.length,0,'Logged review receipt ends the check');
 eq(ctx.exports.flag({...base,reviewDue:true,sign:{state:'out',pickupDate:'2026-10-19'}}).needs.length,2,'Two distinct real customer needs are counted once each');
}
// Confirm the actual manual-flag button callback opens the existing Notes save
// field. A conflicting unsaved note is protected, and no POST occurs on prepare.
{
 const customers=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
 assert.ok(customers);
 let prepare=null;
 function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='prepareManualFlag')prepare=n.initializer.getText(ast);ts.forEachChild(n,find);}
 find(customers);assert.ok(prepare);
 const code=ts.transpileModule('exports.action='+prepare+';',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const record=[],frames=[];
 let savedDraft='',draft='',accepted=true;
 const ctx={exports:{},selected:{id:'customer-a'},savingNote:false,noteText:'',noteDrafts:{current:{}},
  setNoteText:v=>{draft=v;record.push('prepare');},setNoteFeedback:()=>record.push('reset'),setRecordSearch:()=>record.push('search'),
  setSection:v=>record.push('section:'+v),
  window:{confirm:()=>accepted,requestAnimationFrame:fn=>{frames.push(fn);}},
  document:{getElementById:id=>{record.push('input:'+id);return {scrollIntoView:()=>record.push('scroll'),focus:()=>record.push('focus')};}}
 };
 vm.runInNewContext(code,ctx);ctx.exports.action('[FIRE FLAG] REVIEW_RECEIVED');
 eq(draft,'[FIRE FLAG] REVIEW_RECEIVED','Flag action prepares a note without saving or sending');
 eq(ctx.noteDrafts.current['customer-a'],draft,'Existing per-customer draft is preserved');
 eq(record.includes('section:notes'),true,'Flag action switches to existing Notes tab');
 eq(frames.length,1,'Flag action schedules native in-app focus');
 frames[0]();
 eq(record.slice(-3).join('|'),'input:customer-note-draft-customer-a|scroll|focus','Flag action scrolls and focuses Add note field');
 accepted=false;ctx.noteText='Existing important unsaved note';ctx.exports.action('[FIRE FLAG] YARD_SIGN_PICKED_UP');
 eq(frames.length,1,'Declining draft replacement preserves unsaved user input');
 eq(draft,'[FIRE FLAG] REVIEW_RECEIVED','Declined action makes no unexpected replacement');
}
console.log('PASS customer Activity & Flags presentation: contact vs send, due signals, safe note preparation and mobile focus.');


// Real CustomersView helper: confirmed-vs-prepared audit and dated, safe timeline.
// No customer note text or payment references may leak into the summary.
{
 const customer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
 let helper=null;function locate(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='buildCustomerTimeline')helper=node;ts.forEachChild(node,locate);}
 locate(customer);assert.ok(helper,'Source-extracted CustomersView contains its own timeline builder');
 const code=ts.transpileModule(helper.getText(ast)+'\nexports.timeline=buildCustomerTimeline;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 // The isolated helper needs the immutable lead flag markers normally imported
 // by dashboard.tsx. No VM code may invent contact or message delivery.
 const ctx={exports:{},LEAD_NO_ANSWER_NOTE:'[FIRE FLAG] LEAD_NO_ANSWER',
  LEAD_CONTACTED_NOTE:'[FIRE FLAG] LEAD_CONTACT_RECORDED'};
 vm.runInNewContext(code,ctx);
 const base={estimates:[],invoices:[],messages:[],notes:[],payments:[]};
 const iso='2026-10-20T12:00:00Z';
 const dated=[
  {id:'n1',customerId:'c1',body:'Gate code 1234',createdAt:'2026-10-20T19:00:00Z'},
  {id:'sign',customerId:'c1',body:'[FIRE FLAG] YARD_SIGN_PICKED_UP',createdAt:'2026-10-20T18:00:00Z'},
  {id:'review',customerId:'c1',body:'[FIRE FLAG] REVIEW_RECEIVED',createdAt:'2026-10-20T17:00:00Z'}
 ];
 const timeline=ctx.exports.timeline({
  estimates:[{id:'e1',service:'House wash',createdAt:iso,firstEstimateSentAt:'2026-10-20T12:20:00Z',acceptedAt:'2026-10-20T16:00:00Z'}],
  invoices:[{id:'i1',createdAt:'2026-10-20T15:00:00Z'}],
  payments:[{id:'p1',createdAt:'2026-10-20T14:00:00Z',type:'Card',status:'pending',reference:'SECRET-REFERENCE'}],
  messages:[
   {message:{id:'m1:owner-confirmed',estimateId:'e1',template:'estimate',channel:'text_confirmed',createdAt:'2026-10-20T12:20:00Z'}},
   {message:{id:'m2',estimateId:'e1',template:'review',channel:'text_prepared',createdAt:'2026-10-20T13:00:00Z'}},
   {message:{id:'m3',estimateId:'e1',template:'followUp1',channel:'contact_recorded',createdAt:'2026-10-20T14:30:00Z'}}
  ],notes:dated
 });
 const snoozes=ctx.exports.timeline({...base,messages:[
  {message:{id:'s1',channel:'review_snoozed',template:'reviewSnooze',createdAt:iso,body:'PRIVATE'}},
  {message:{id:'s2',channel:'review_check_snoozed',template:'reviewCheckSnooze',createdAt:iso,body:'PRIVATE'}}]});
 eq(snoozes.some(x=>x.title==='Review request snoozed'&&x.detail==='Request deferred · no message sent'),true,'Request deferral never claims a send');
 eq(snoozes.some(x=>x.title==='Review status check snoozed'&&x.detail.includes('no message sent or review received')),true,'Review check deferral never claims receipt');
 eq(snoozes.every(x=>x.section==='messages')&&!JSON.stringify(snoozes).includes('PRIVATE'),true,'Deferrals open exact message records without exposing bodies');
 const titles=timeline.map(x=>x.title);
 eq(titles[0],'Customer note saved','Latest saved note appears first, not last inserted');
 eq(timeline.some(x=>x.title==='Yard sign pickup logged'),true,'Owner-logged sign pickup appears in timeline');
 eq(timeline.some(x=>x.title==='Review received (owner logged)'),true,'Review receipt makes no claim of external verification');
 eq(timeline.some(x=>x.title==='Customer contact recorded'),true,'Contact recording is not a message send');
 eq(timeline.some(x=>x.title==='Review request prepared'),true,'Prepared review request does not imply a send');
 eq(timeline.some(x=>x.title==='Estimate send confirmed'),true,'Owner-confirmed estimate send appears as one audited event');
 eq(timeline.some(x=>x.title==='Estimate send recorded'),false,'Estimate send marker is not duplicated beside confirmed message');
 eq(timeline.some(x=>x.title==='Invoice created'&&x.detail==='Created · send not confirmed'),true,'Invoice creation is not a sent invoice');
 eq(timeline.some(x=>x.title==='Payment entry recorded'&&x.detail.includes('pending')),true,'Pending payment entry never claims settlement');
 eq(timeline.every((x,i)=>i===0||timeline[i-1].timestamp>=x.timestamp),true,'Events sort newest first deterministically');
 eq(timeline.find(x=>x.title==='Customer note saved').section,'notes','Note opens exact Notes record');
 eq(timeline.find(x=>x.title==='Estimate send confirmed').id,'m1:owner-confirmed','Message target retains saved audit identity');
 eq(JSON.stringify(timeline).includes('Gate code'),false,'Private free-form note body never appears in timeline');
 eq(JSON.stringify(timeline).includes('SECRET-REFERENCE'),false,'Payment reference is not exposed in activity summary');
 // Saved follow-up/history markers supplement communication receipts without
 // inventing external delivery, exposing private text, or breaking exact jumps.
 const stageEstimate={id:'e-history',service:'Gutters',createdAt:iso,
  stage1At:'2026-10-20T13:00:00Z',stage3At:'2026-10-20T14:00:00Z',
  stage7At:'invalid-time',lastManualContactAt:'2026-10-20T15:00:00Z',
  lastReviewRequestAt:'2026-10-20T16:00:00Z'};
 const markers=ctx.exports.timeline({...base,estimates:[stageEstimate],
  messages:[{message:{id:'prepared',estimateId:'e-history',template:'review',channel:'text_prepared',createdAt:iso}}]});
 eq(markers.some(x=>x.title==='Day 1 follow-up milestone'),true,'Saved follow-up milestones remain visible without a confirmed message');
 eq(markers.some(x=>x.title==='Day 3 follow-up milestone'),true,'Historical stage-three action appears');
 eq(markers.some(x=>x.title==='Day 7 follow-up milestone'),false,'Bad milestone timestamp cannot invent history');
 eq(markers.some(x=>x.title==='Manual contact logged'),true,'Manual contact fallback appears when message history is unavailable');
 eq(markers.some(x=>x.title==='Review request recorded'),true,'Prepared review message does not hide saved request marker');
 eq(markers.filter(x=>x.title.includes('milestone')||x.title==='Review request recorded').every(x=>x.section==='estimates'&&x.id==='e-history'),true,'Historical markers navigate to their exact saved estimate');
 eq(markers.every(x=>!x.detail.includes('delivered')&&!x.detail.includes('Gate code')),true,'History never claims delivery or exposes note text');
 const receiptBacked=ctx.exports.timeline({...base,estimates:[stageEstimate],messages:[
  {message:{id:'m-stage',estimateId:'e-history',template:'followUp1',channel:'text_confirmed',createdAt:'2026-10-20T13:00:00Z'}},
  {message:{id:'m-contact',estimateId:'e-history',template:'followUp3',channel:'contact_recorded',createdAt:'2026-10-20T14:00:00Z'}},
  {message:{id:'m-manual',estimateId:'e-history',template:'followUp3',channel:'contact_recorded',createdAt:'2026-10-20T15:00:00Z'}},
  {message:{id:'m-review',estimateId:'e-history',template:'review',channel:'email_confirmed',createdAt:'2026-10-20T16:00:00Z'}}
 ]});
 eq(receiptBacked.some(x=>x.title==='Day 1 follow-up milestone'),false,'Confirmed follow-up receipt replaces legacy stage marker');
 eq(receiptBacked.some(x=>x.title==='Day 3 follow-up milestone'),false,'Logged contact replaces matching legacy stage marker');
 eq(receiptBacked.some(x=>x.title==='Manual contact logged'),false,'Saved contact message avoids duplicate manual contact timeline row');
 eq(receiptBacked.some(x=>x.title==='Review request recorded'),false,'Confirmed review message replaces saved request marker');
 eq(ctx.exports.timeline({...base,notes:[{id:'bad',body:'X',createdAt:'not-a-date'}]}).length,0,'Invalid timestamps do not invent activity');
 eq(ctx.exports.timeline({...base,messages:[{message:{id:'legacy',template:'estimate',channel:'copy',createdAt:iso}}]})[0].detail,'Sending unconfirmed','Copied message is not counted as delivered');
 eq(ctx.exports.timeline({...base,messages:[{message:{id:'legacy',template:'estimate',channel:'text',createdAt:iso}}]})[0].detail,'Legacy entry · delivery unverified','Unverified legacy message stays unverified');
 eq(ctx.exports.timeline({...base,estimates:[{id:'e',createdAt:iso,service:'Test',firstEstimateSentAt:iso}]}).find(x=>x.title==='Estimate send recorded')?.section,'estimates','Unconfirmed historical estimate marker links to actual record');
 eq(ctx.exports.timeline({...base,notes:Array.from({length:120},(_,i)=>({id:'n'+i,body:'note',createdAt:new Date(Date.parse(iso)+i*1000).toISOString()}))}).length,100,'Large timelines are capped at 100 recent source records');
 const source=readFileSync('app/dashboard.tsx','utf8');
 for(const [anchor,label] of [
  ['aria-label="Recent customer activity"','Accessible read-only timeline region'],
  ['id={"customer-message-"+message.id}','Source message rows accept exact timeline focus'],
  ['id={"customer-estimate-"+estimate.id}','Estimate history accepts exact timeline focus'],
  ['id={"customer-invoice-"+invoice.id}','Invoice history accepts exact timeline focus'],
  ['setTimelineTarget({customerId:selected.id,section:entry.section,id:entry.id})','Timeline jump retains exact customer, record and section'],
  ['target.focus({preventScroll:true})','Timeline moves keyboard focus to saved record'],
  ['setTimelineShown(current=>Math.min(current+6,filteredTimelineEntries.length))','Progressive reveal avoids long mobile timelines']
 ]){assert.ok(source.includes(anchor),label);}
}
console.log('PASS customer timeline: chronology, private note restraint, confirmed vs prepared messaging, bounded mobile record navigation.');


// Actual self-contained CustomersView review queue: read-only, no false sends.
{
 const customer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
 let fn;function findActions(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='buildCustomerNextActions')fn=n;ts.forEachChild(n,findActions);}
 findActions(customer);assert.ok(fn);
 const compiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8')+'\n'+fn.getText(ast)+'\nexports.review=buildCustomerNextActions;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const ctx={exports:{}};vm.runInNewContext(compiled,ctx);
 const now=Date.parse("2026-10-20T12:00:00Z");
  const base={today:"2026-10-20",now,sign:null,reviewDue:false,estimates:[],invoices:[],messages:[]};
 eq(ctx.exports.review(base).length,0,'Empty verified customer records create no review actions');
 const both=ctx.exports.review({...base,sign:{state:"out",pickupDate:"2026-10-19"},reviewDue:true,
  invoices:[{id:"i1",estimateId:"e1",status:"sent"},{id:"i2",estimateId:"e2",status:"paid"},{id:"i3",estimateId:"e3",status:"draft"}]});
 eq(both.map(x=>x.kind).join('|'),'sign|review|invoice','Due sign and review precede unconfirmed active invoice');
 eq(both[2].invoiceId,'i1','Invoice action retains exact saved invoice ID');
  const sent={id:'estimate-sent',status:'sent',createdAt:'2026-10-07T12:00:00Z',firstEstimateSentAt:'2026-10-12T12:00:00Z',lastEstimateSentAt:'2026-10-12T12:00:00Z'};
  eq(ctx.exports.review({...base,estimates:[sent]})[0].kind,'followup','Saved day-seven timing feeds customer review');
  eq(ctx.exports.review({...base,estimates:[sent]})[0].estimateId,sent.id,'Follow-up opens the exact estimate');
  eq(ctx.exports.review({...base,estimates:[{...sent,snoozeUntil:'2026-10-22T12:00:00Z'}]}).length,0,'Future snooze suppresses routine follow-up');
  eq(ctx.exports.review({...base,estimates:[{...sent,lastManualContactAt:'2026-10-20T10:00:00Z'}]}).length,0,'Recent logged contact pauses reminders');
  eq(ctx.exports.review({...base,estimates:[{...sent,firstEstimateSentAt:null,lastEstimateSentAt:null}],messages:[{estimateId:sent.id,template:'estimate',channel:'text_prepared'}]})[0].title,'Verify estimate send','Prepared text cannot verify estimate send');
  eq(ctx.exports.review({...base,estimates:[{...sent,status:'draft',firstEstimateSentAt:null,lastEstimateSentAt:null}]})[0].title,'Review unsent estimate','Draft has one explicit action');
  eq(ctx.exports.review({...base,invoices:[{id:'i-review',estimateId:'e2',status:'paid',paymentReviewPending:true}]} )[0].kind,'billing','Refund/payment exception visible even on paid invoices');
  eq(ctx.exports.review({...base,invoices:[{id:'i-due',estimateId:'e3',status:'sent',dueAt:'2026-10-18T12:00:00Z',totalCents:10000,paidCents:1000}],messages:[{estimateId:'e3',template:'invoice',channel:'email_confirmed'}]})[0].kind,'billing','Confirmed past-due invoice gets balance verification');
  eq(ctx.exports.review({...base,invoices:[{id:'i-no-paid',estimateId:'e3',status:'sent',dueAt:'2026-10-18T12:00:00Z',totalCents:10000}],messages:[{estimateId:'e3',template:'invoice',channel:'email_confirmed'}]}).length,0,'Missing paid amount cannot invent a balance');
 eq(ctx.exports.review({...base,sign:{state:"picked_up",pickupDate:"2026-10-19"}}).length,0,'Picked up sign never remains actionable');
 eq(ctx.exports.review({...base,sign:{state:"out",pickupDate:"2026-10-21"}}).length,0,'Future pickup is not called overdue');
 eq(ctx.exports.review({...base,invoices:[{id:"i1",estimateId:"e1",status:"sent"}],
  messages:[{estimateId:"e1",template:"invoice",channel:"email_confirmed"}]}).length,0,'Confirmed invoice send clears its own action');
 eq(ctx.exports.review({...base,invoices:[{id:"i1",estimateId:"e1",status:"sent"}],
  messages:[{estimateId:"e1",template:"invoice",channel:"email_prepared"}]}).length,1,'Prepared invoice is not confirmed sent');
 eq(ctx.exports.review({...base,invoices:[{id:"i1",estimateId:"e1",status:"sent"}],
  messages:[{estimateId:"e2",template:"invoice",channel:"text_confirmed"}]}).length,1,'Another estimate send does not clear this invoice action');
 eq(ctx.exports.review({...base,invoices:[{id:"i1",estimateId:"e1",status:"void"}]}).length,0,'Void invoice is not presented for outreach');
 const many=ctx.exports.review({...base,invoices:Array.from({length:20},(_,i)=>({id:'invoice-'+i,estimateId:'e'+i,status:'sent'}))});
 eq(many.length,8,'Review queue is bounded on mobile');
 assert.ok(source.includes('role="group" aria-label="Filter customer activity"'));
 assert.ok(source.includes('aria-label="Search recent activity"'));
 assert.ok(source.includes('timelineEntries.filter(entry=>(timelineFilter==="all"||entry.category===timelineFilter)'));
 assert.ok(source.includes('entry.title,entry.detail,entry.day'));
 assert.ok(source.includes('visibleTimelineEntries[index-1].day!==entry.day'));
 assert.ok(source.includes('onClick={()=>openCustomerAction(action)}'));
 assert.ok(source.includes('setTimelineShown(6);setTimelineFilter("all");setTimelineSearch("")'));
}
console.log('PASS customer action review: due priority, confirmed sends, no false invoice outreach, privacy-first activity filtering.');


// Actual FollowUpsView source: saved milestones never claim external delivery.
// Category filters and exact estimate navigation are read-only owner controls.
{
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
 let helper=null;
 function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='followupMilestones')helper=n;ts.forEachChild(n,find);}
 find(fn);assert.ok(helper,'Follow-ups chronology helper is self-contained');
 const c=ts.transpileModule(helper.getText(ast)+'\nexports.milestones=followupMilestones;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const ctx={exports:{},Date};vm.runInNewContext(c,ctx);
 const e={id:'e1',createdAt:'2026-10-01T12:00:00Z',firstEstimateSentAt:'2026-10-01T13:00:00Z',
  lastEstimateSentAt:'2026-10-02T12:00:00Z',lastEstimateContactAt:'2026-10-05T12:00:00Z',
  lastManualContactAt:'2026-10-06T12:00:00Z',stage1At:'2026-10-05T12:00:00Z',
  stage3At:'2026-10-07T12:00:00Z',snoozeUntil:'2026-10-12T12:00:00Z'};
 const milestones=ctx.exports.milestones(e);
 eq(milestones.length,6,'Follow-up history stays compact on small phones');
 eq(milestones[0].key,'snooze','Latest saved milestone sorts to top');
 eq(milestones.some(x=>x.title.includes('Manual contact logged · no message send claimed')),true,'Manual contact never implies delivery');
 eq(milestones.some(x=>x.title.includes('delivery unverified')),true,'Estimate send timestamps do not claim external delivery');
 eq(ctx.exports.milestones({...e,snoozeUntil:'garbage'}).some(x=>x.key==='snooze'),false,'Invalid source timestamps skipped');
 eq(ctx.exports.milestones({id:'e',createdAt:'not-a-date'}).length,0,'Empty/invalid saved history does not invent events');
 const body=fn.getText(ast);
 for(const a of [
  'aria-label="Filter recommended follow-up actions"',
  'aria-label={"Filter follow-ups: "+label}',
  'const visibleActions=actions.filter(item=>(actionFilter==="all"',
  'if(actionFilter!=="all"||highPriorityOnly||urgencyFilter!=="all"){setActionFilter("all");setHighPriorityOnly(false);setUrgencyFilter("all");return;}',
  'aria-label={"Open saved estimate for "+estimate.customer}',
  'onOpenEstimate(estimate.id)',
  '<details className="followup-milestones">',
  'Show all follow-ups'
 ])assert.ok(body.includes(a),'Follow-up UI safety or deep link missing: '+a);
 const groupNode=fn.body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(x=>x.name.getText(ast)==='followupGroup'));
 assert.ok(groupNode);
 const g=ts.transpileModule(groupNode.getText(ast)+'\nexports.group=followupGroup;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const groups={exports:{}};vm.runInNewContext(g,groups);
 eq(groups.exports.group('followUp3','followup'),'quotes','Estimate follow-ups have own filter');
 eq(groups.exports.group('invoiceReminder','followup'),'billing','Billing reminders are distinguished');
 eq(groups.exports.group('appointmentReminder','followup'),'schedule','Appointment reminders are separate');
 eq(groups.exports.group('review','review'),'reviews','Review requests are separate');
 eq(groups.exports.group('winBack6','repeat'),'repeat','Repeat customers are distinct');
 eq(groups.exports.group('history','history'),'history','History needs manual review, never auto-sends');
}
console.log('PASS follow-up triage: verified estimate milestones, six categories, filtered empty state, safe exact-record navigation.');

// Owner-only contact history metadata contract: never expose private message bodies.
{
 const endpoint=readFileSync('app/api/followup-contact-history/route.ts','utf8');
 for(const needle of [
  'if(!user||user.email.toLowerCase()!==OWNER_EMAIL)',
  'SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1',
  'SELECT id,channel,template,created_at AS createdAt',
  'WHERE estimate_id=? AND customer_id=? ORDER BY created_at DESC,id DESC LIMIT 13',
  'result.results.slice(0,12)',
  '"Cache-Control":"no-store, private"'
 ])assert.ok(endpoint.includes(needle),'Required private read guard: '+needle);
 assert.ok(!/INSERT INTO|UPDATE |DELETE FROM|SELECT[^\n]*body/i.test(endpoint),'History endpoint does not write or select private message bodies');
 const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
 let fn;const find=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='contactLabel')fn=n;ts.forEachChild(n,find);};find(view);
 assert.ok(fn,'Contact presentation helper is self-contained in FollowUpsView');
 const code=ts.transpileModule(fn.getText(ast)+'\nexports.format=contactLabel;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const ctx={exports:{}};vm.runInNewContext(code,ctx);
 for(const [channel,result] of [
  ['text_confirmed','Owner confirmed send · delivery unverified'],['email_confirmed','Owner confirmed send · delivery unverified'],
  ['text_prepared','Sending unconfirmed'],['email_prepared','Sending unconfirmed'],['copy','Sending unconfirmed'],
  ['contact_recorded','Owner recorded contact · no send claimed'],['followup_snoozed','No customer message claimed'],
  ['legacy','Sending and delivery unverified']
 ])eq(ctx.exports.format({channel,template:'followUp3'}).detail,result,'Contact history never exaggerates '+channel);
}
console.log('PASS secure follow-up contact history: owner auth, exact estimate scope, bounded metadata, clear evidence labels.');
