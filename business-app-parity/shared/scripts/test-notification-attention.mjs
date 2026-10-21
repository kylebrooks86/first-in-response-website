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
 let state=[],cursor=0,effect,clean,failed=null;const calls=[],nav=[],closed=[];
 const context={
  exports:{},require,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
  useEffect(fn){effect=fn;},taskDueBucket:taskLib.exports.taskDueBucket,
  document:{visibilityState:'visible'},AbortController,estimateAttentionItems:attentionLib.exports.estimateAttentionItems,
  window:{addEventListener(){},removeEventListener(){},setInterval(){return 1;},clearInterval(){}},
  fetch:async(url,options)=>{calls.push({url,options});if(failed===url)return {ok:false,json:async()=>({error:'Synthetic outage'})};
    const name=url==='/api/tasks'?'tasks':url==='/api/dashboard-yard-signs'?'signs':url==='/api/dashboard-review-checks'?'checks':url==='/api/followups?limit=50'?'estimates':null;
    if(!name)throw Error('Unexpected endpoint '+url);
    return {ok:true,json:async()=>name==='estimates'?{estimates:items.estimates,nextCursor:null}:{[name]:items[name]}};},
  ...Object.fromEntries([...tags].map(name=>[name,()=>null]))
 };
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=0;return context.exports.renderAttention({onNavigate:(...args)=>nav.push(args),onClose:()=>closed.push(true)});};
 return {render,get:name=>state[stateNames.indexOf(name)],calls,nav,closed,fail:url=>{failed=url;},mount:()=>{render();clean=effect();},refresh:()=>{clean?.();render();clean=effect();},unmount:()=>clean?.(),buttons:()=>elements(render()).filter(n=>n.type==='button')};
}
{
 const f=fixture();f.mount();await flush();await flush();
 eq(f.get('status'),'ready','All three owner feeds verified');
 eq(f.get('rows').length,6,'Tasks, signs, review checks, follow-up, invoice and appointment');
 eq(f.get('rows').some(i=>i.key==='task:task-closed'),false,'Completed task never appears');
 eq(f.get('rows').some(i=>i.key==='sign:sign-later'),false,'Future pickup is not falsely overdue');
 eq(f.calls.length,4,'Read-only fetch for four existing owner feeds');
 eq(f.calls.every(c=>c.options.cache==='no-store'&&!c.options.method),true,'Never submits writes or cached attention reads');
 const task=f.buttons().find(b=>b.props?.['aria-label']==='Open task: Pick up yard sign');
 assert.ok(task);task.props.onClick();
 eq(f.nav.at(-1).join('|'),'business||||task-due','Task shortcut passes exact saved task ID');
 const sign=f.buttons().find(b=>b.props?.['aria-label']==='Open yard sign: Sign customer');
 assert.ok(sign);sign.props.onClick();eq(f.nav.at(-1).join('|'),'customers|||customer-sign','Yard sign shortcut passes exact customer ID');
 const review=f.buttons().find(b=>b.props?.['aria-label']==='Open review check: Review customer');
 assert.ok(review);review.props.onClick();eq(f.nav.at(-1).join('|'),'customers|||customer-review','Review check shortcut passes correct customer');
 const invoice=f.buttons().find(b=>b.props?.['aria-label']==='Open invoice: Invoice customer');
 assert.ok(invoice);invoice.props.onClick();eq(f.nav.at(-1).join('|'),'invoices||inv-exact','Invoice shortcut opens exact invoice');
 const quote=f.buttons().find(b=>b.props?.['aria-label']==='Open follow-up: Quote customer');
 assert.ok(quote);quote.props.onClick();eq(f.nav.at(-1).join('|'),'estimates|est-follow','Quote shortcut opens exact estimate');
 const prep=f.buttons().find(b=>b.props?.['aria-label']==='Open appointment: Prep customer');
 assert.ok(prep);prep.props.onClick();eq(f.nav.at(-1).join('|'),'estimates|est-prep','Prep shortcut opens exact estimate');
 eq(f.closed.length,6,'Each shortcut closes bell for focused navigation');
 f.unmount();
}
{
 const f=fixture();f.fail('/api/dashboard-review-checks');f.mount();await flush();await flush();
 eq(f.get('status'),'error','A failed feed never reports clear status');
 eq(f.get('rows').length,0,'Cannot show falsely complete partial attention results');
 const alert=elements(f.render()).find(n=>n.props?.role==='alert');
 assert.ok(alert&&String(alert.props.children).includes("couldn't be verified"));
 checks++;
 f.fail(null);f.refresh();await flush();await flush();
 eq(f.get('status'),'ready','Owner retry recovers all three verified feeds');
 eq(f.get('rows').length,6,'Recovered attention items reappear');
 f.unmount();
}
assert.ok(source.includes('<NotificationAttention onNavigate={onNavigate} onClose={()=>setOpen(false)}/>'),'Bell mounts Needs Attention before activity');
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
}
console.log('PASS '+(checks+2)+' notification attention checks; existing feeds, new estimate reminders, exact record navigation, and recovery.');
