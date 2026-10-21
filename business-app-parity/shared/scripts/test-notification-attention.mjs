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
 assert.ok(quote);quote.props.onClick();eq(f.nav.at(-1).join('|'),'estimates|est-follow','Quote shortcut opens exact estimate');
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
console.log('PASS '+(checks+2)+' notification attention checks; existing feeds, new estimate reminders, exact record navigation, and recovery.');
