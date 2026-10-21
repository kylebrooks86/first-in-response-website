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
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
const dayBefore=new Date(today+'T12:00:00Z');dayBefore.setUTCDate(dayBefore.getUTCDate()-1);
const yesterday=dayBefore.toISOString().slice(0,10);
const items={
 tasks:[{id:'task-due',title:'Pick up yard sign',status:'open',dueAt:new Date(Date.now()-86400000).toISOString(),createdAt:'2026-10-18T12:00:00Z'},{id:'task-closed',title:'Already finished',status:'completed',dueAt:new Date(Date.now()-86400000).toISOString(),createdAt:'2026-10-18T12:00:00Z'}],
 signs:[{customerId:'customer-sign',customerName:'Sign customer',location:'Driveway',pickupDate:yesterday,placedAt:'2026-10-01T12:00:00Z'},{customerId:'sign-later',customerName:'Later sign',location:'Lawn',pickupDate:'2099-12-31',placedAt:'2026-10-01T12:00:00Z'}],
 checks:[{customerId:'customer-review',customerName:'Review customer',requestedAt:'2026-10-01T12:00:00Z',elapsedDays:12}],
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
 let state=[],cursor=0,effect,clean,failed=null,refreshKey=0;const calls=[],nav=[],closed=[],summaries=[],documentListeners={},windowListeners={},savedRows={tasks:items.tasks.map(x=>({...x})),signs:items.signs.map(x=>({...x})),checks:items.checks.map(x=>({...x})),estimates:items.estimates.map(x=>({...x}))};
 const context={
  exports:{},require,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
  useEffect(fn){effect=fn;},taskDueBucket:taskLib.exports.taskDueBucket,
  document:{visibilityState:'visible',addEventListener(name,fn){documentListeners[name]=fn;},removeEventListener(name){delete documentListeners[name];}},AbortController,estimateAttentionItems:attentionLib.exports.estimateAttentionItems,
  window:{addEventListener(name,fn){windowListeners[name]=fn;},removeEventListener(name){delete windowListeners[name];},setInterval(){return 1;},clearInterval(){}},
  fetch:async(url,options)=>{calls.push({url,options});if(failed===url)return {ok:false,json:async()=>({error:'Synthetic outage'})};
    const name=url==='/api/tasks'?'tasks':url==='/api/dashboard-yard-signs'?'signs':url==='/api/dashboard-review-checks'?'checks':url==='/api/followups?limit=50'?'estimates':null;
    if(!name)throw Error('Unexpected endpoint '+url);
    return {ok:true,json:async()=>name==='estimates'?{estimates:savedRows.estimates,nextCursor:null}:{[name]:savedRows[name]}};},
  ...Object.fromEntries([...tags].map(name=>[name,()=>null]))
 };
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=0;return context.exports.renderAttention({onNavigate:(...args)=>nav.push(args),onClose:()=>closed.push(true),onSummary:value=>summaries.push(value),refreshKey});};
 return {render,get:name=>state[stateNames.indexOf(name)],calls,nav,closed,summaries,fail:url=>{failed=url;},mount:()=>{render();clean=effect();},refresh:()=>{clean?.();render();clean=effect();},openAgain:()=>{refreshKey++;clean?.();render();clean=effect();},visibleAgain:()=>documentListeners.visibilitychange?.(),confirmSaved:update=>{update(savedRows);windowListeners['fire:attention-saved']?.();},unmount:()=>clean?.(),buttons:()=>elements(render()).filter(n=>n.type==='button')};
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
 eq(f.calls.length,4,'Read-only fetch for four existing owner feeds');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Never submits writes or cached attention reads');
 const task=f.buttons().find(b=>b.props?.['aria-label']==='Open task: Pick up yard sign');
 assert.ok(task);task.props.onClick();
 eq(f.nav.at(-1).join('|'),'business||||task-due','Task shortcut passes exact saved task ID');
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
 eq(f.calls.length,8,'Opening bell again triggers uncached refresh of all four owner feeds');
 eq(f.get('status'),'ready','Reopened bell completes a fresh verified attention read');
 f.visibleAgain();await flush();await flush();
 eq(f.calls.length,12,'Returning to installed app through visibilitychange refreshes saved reminders');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Reopen and visibility refresh remain strictly read-only');
 f.confirmSaved(saved=>{saved.tasks[0].status='completed';saved.tasks[0].completedAt=new Date().toISOString();});
 await flush();await flush();
 eq(f.get('rows').some(x=>x.key==='task:task-due'),false,'Confirmed task completion disappears from bell without waiting 60 seconds');
 eq(f.summaries.at(-1).count,5,'Bell count reconciles after confirmed task completion');
 f.confirmSaved(saved=>{saved.signs[0].pickupDate='2099-12-31';saved.checks=[];saved.estimates[0].lastManualContactAt=new Date().toISOString();});
 await flush();await flush();
 eq(f.get('rows').some(x=>['sign:customer-sign','review:customer-review','followup:est-follow'].includes(x.key)),false,'Saved notes and confirmed follow-up clear corresponding attention items');
 eq(f.get('rows').length,2,'Unrelated invoice and job-preparation reminders remain visible');
 eq(f.calls.length,20,'Each owner-confirmed signal triggers one read of four feeds');
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
assert.ok(source.includes('id={["followUp1","followUp3","followUp7"].includes(template)?'),'Due follow-up has exact keyboard-focusable DOM target');
assert.ok(source.includes('target.scrollIntoView({block:"start",behavior:"instant"})'),'Flag jump scrolls to exact saved customer flag');
assert.ok(source.includes('target.focus({preventScroll:true})'),'Flag jump also supports keyboard focus');
assert.ok(source.includes('if(taskId){setPickupTaskDraft(null);setReviewTaskDraft(null);setFocusBusinessTaskId(taskId);setTab("business");}'),'Bell task click invokes focused Business navigation, not generic Business tab');
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
 const base={estimateSent:false,invoiceCreated:false,invoiceSendConfirmed:false,followupContactRecorded:false,
  followupSendConfirmed:false,reviewRequestRecorded:false,reviewSendConfirmed:false,reviewReceivedAt:null,
  sign:null,reviewDue:false,today:'2026-10-20'};
 eq(ctx.exports.flag(base).followup,'Not recorded','No follow-up action is assumed from drafts');
 eq(ctx.exports.flag({...base,followupContactRecorded:true}).followup,'Contact recorded','Owner contact log never claims a message was sent');
 eq(ctx.exports.flag({...base,followupSendConfirmed:true}).followup,'Send confirmed','Confirmed external send recorded separately');
 eq(ctx.exports.flag({...base,followupContactRecorded:true,followupSendConfirmed:true}).followup,'Send confirmed','Confirmed send is preferred over contact-only status');
 eq(ctx.exports.flag({...base,invoiceCreated:true}).invoice,'Created · send unconfirmed','Creating an invoice is not sending it');
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
