import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimateDetail');assert.ok(fn);
const detailLayout=fn.getText(ast);
const actionsAt=detailLayout.indexOf('aria-label="Customer and estimate actions"');
const scopeAt=detailLayout.indexOf('Service scope & expectations');
const historyAt=detailLayout.indexOf('<EstimatePromotionHistory');
const toolsAt=detailLayout.indexOf('className="detail-more-tools"');
assert.ok(actionsAt>0&&scopeAt>actionsAt&&historyAt>scopeAt&&toolsAt>historyAt,
 'Primary estimate actions must precede service scope, promotion history and More tools.');
assert.ok(detailLayout.includes('jobNumberLabel(estimate.jobNumber)'),
 'Verified permanent Job # should appear in the selected estimate detail header.');

const names=[],tags=new Set();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}visit(fn);
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};const flush=()=>new Promise(r=>setImmediate(r));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};const ok=(complete,id,customerId='customer')=>({ok:true,json:async()=>({reports:[{estimateId:id,customerId,status:complete?'completed':'draft'}]})});
const job=id=>({id,customerId:'customer',customer:'Synthetic',service:'Wash',status:'scheduled',items:[],totalCents:20000,depositCents:10000,paidCents:0,createdAt:'2026-10-09',paymentOverageOpen:0});
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
function fixture(allowWrites=false){const changedRows=[];let state=[],cursor=0,effect,cleanup,estimate,fetcher;const refs=[];let refCursor=0,closed=0;const requests=[],writes=[];const context={exports:{},require,...Object.fromEntries([...tags].map(t=>[t,()=>null])),money:c=>String(c),dateTime:v=>v,statusLabel:v=>v,serviceDescriptionFor:()=>'',resolvedBillingTotalCents:e=>e.totalCents,
useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{writes.push(names[i]);state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect(fn){effect=fn;},fetch:(url,options)=>{if(allowWrites==='custom'&&options?.method)return fetcher(url,options);if(options?.method==='PATCH'){eq(allowWrites,true);eq(url,`/api/estimates/${estimate.id}`);eq(options.body,JSON.stringify({status:'completed'}));return Promise.resolve({ok:true,json:async()=>({estimate:{status:'completed'}})});}if(options!==undefined)eq(JSON.stringify(options),JSON.stringify({cache:'no-store'}),'Closeout report read bypasses cached responses');requests.push(url);return fetcher(url);}};
vm.runInNewContext(ts.transpileModule(fn.getText(ast)+'\nexports.view=EstimateDetail;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const render=()=>{cursor=0;refCursor=0;return context.exports.view({estimate,onClose(){closed++;},onChanged(row){if(!allowWrites)throw Error('No financial/job writes allowed in report-read tests');changedRows.push(row);}});};
return {changedRows,get closed(){return closed;},nodes:()=>nodes(render()),open(value){cleanup?.();estimate=value;render();cleanup=effect();},render,get:key=>state[names.indexOf(key)],setFetcher:f=>fetcher=f,unmount:()=>cleanup?.(),writes,requests,button:()=>nodes(render()).find(n=>n.type===context.Button&&[n.props.children].flat(Infinity).some(c=>c==='Mark job complete'||c==='Complete report first'))};}
for(const scenario of ['older success','older failure','delayed JSON']){
 const f=fixture(),old=deferred(),newer=deferred(),json=deferred();f.setFetcher(url=>url.endsWith('first')?old.promise:newer.promise);f.open(job('first'));
 if(scenario==='delayed JSON'){old.resolve({ok:true,json:()=>json.promise});await flush();}
 f.open(job('second'));eq(f.get('reportComplete'),false);newer.resolve(ok(false,'second'));await flush();eq(f.get('reportComplete'),false);const count=f.writes.length;
 if(scenario==='older failure')old.reject(Error('old offline'));else if(scenario==='delayed JSON')json.resolve({reports:[{estimateId:'first',customerId:'customer',status:'completed'}]});else old.resolve(ok(true,'first'));await flush();eq(f.get('reportComplete'),false,scenario+': old job must not mark new report complete');eq(f.writes.length,count,'Stale report must not write state');eq(f.button().props.disabled,true);eq(f.requests[1],'/api/job-reports?estimateId=second');
}
{
 const f=fixture();let next=deferred();f.setFetcher(()=>next.promise);f.open(job('loaded'));next.resolve(ok(true,'loaded'));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);next=deferred();f.open(job('pending'));eq(f.get('reportComplete'),false,'New job resets previous completion before read');eq(f.button().props.disabled,true);next.resolve(ok(true,'pending'));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);
}
for(const outcome of ['success','failure'])for(const close of ['unmount','no estimate']){
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);f.open(job('closed'));if(close==='unmount')f.unmount();else f.open(null);const count=f.writes.length;
 if(outcome==='success')pending.resolve(ok(true,'closed'));else pending.reject(Error('offline'));await flush();eq(f.get('reportComplete'),false,close+' invalidates '+outcome);eq(f.writes.length,count,'Closed detail cannot write state');if(close==='no estimate')eq(f.render(),null);
}
for(const response of [{ok:false,json:async()=>({reports:[{estimateId:'failed',customerId:'customer',status:'completed'}]})},{ok:true,json:async()=>null},{ok:true,json:async()=>({reports:{status:'completed'}})},{ok:true,json:async()=>{throw Error('bad JSON');}},{ok:true,json:async()=>({reports:[{status:'completed'}]})},{ok:true,json:async()=>({reports:[{estimateId:'other',customerId:'customer',status:'completed'}]})},{ok:true,json:async()=>({reports:[{estimateId:'failed',customerId:'other',status:'completed'}]})}]){
 const f=fixture();f.setFetcher(async()=>response);f.open(job('failed'));await flush();eq(f.get('reportComplete'),false,'HTTP/JSON/collection failures must not enable completion');eq(f.button().props.disabled,true);
 f.setFetcher(async()=>ok(true,'retry'));f.open(job('retry'));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);
}
for(const response of ['network','bad-json','http','wrong-job','wrong-customer','draft']){
 const f=fixture();f.setFetcher(async()=>ok(true,'closeout'));f.open({...job('closeout'),customerId:'customer'});await flush();
 const pending=deferred();f.setFetcher(()=>pending.promise);const button=f.button();const count=f.requests.length;
 button.props.onClick();button.props.onClick();eq(f.requests.length,count+1,'Repeated completion taps issue one read');
 if(response==='network')pending.reject(Error('Connection lost'));
 else if(response==='bad-json')pending.resolve({ok:true,json:async()=>{throw Error('bad JSON');}});
 else if(response==='http')pending.resolve({ok:false,json:async()=>({error:'Unavailable'})});
 else pending.resolve({ok:true,json:async()=>({reports:[{estimateId:response==='wrong-job'?'other':'closeout',customerId:response==='wrong-customer'?'other':'customer',status:response==='draft'?'draft':'completed'}]})});
 await flush();eq(f.get('checkingCloseout'),false,'Completion controls recover after failed verification');
 eq(f.get('reportComplete'),false);eq(Boolean(f.get('error')),true,'Failure is visible without an unhandled rejection');
 // No PATCH was allowed by this fixture: wrong or unverified reports cannot change the job.
}
{
 const f=fixture(true);f.setFetcher(async()=>ok(true,'finish'));f.open({...job('finish'),customerId:'customer'});await flush();
 f.setFetcher(async()=>({ok:true,json:async()=>({reports:[{estimateId:'finish',customerId:'customer',status:'completed'}]})}));
 const button=f.button();button.props.onClick();button.props.onClick();await flush();
 eq(f.changedRows.length,1,'One verified completion produces one status update');eq(f.changedRows[0].status,'completed');eq(f.get('checkingCloseout'),false);eq(f.get('error'),'');
}
for(const kind of ['schedule','invoice']){
 const f=fixture('custom');f.setFetcher(async()=>ok(true,'save'));f.open({...job('save'),status:kind==='invoice'?'completed':'scheduled'});await flush();
 let pending=deferred();const sent=[];f.setFetcher((url,options)=>{sent.push({url,options});return pending.promise;});
 if(kind==='schedule')f.nodes().find(n=>n.props?.id==='scheduleDate').props.onChange({target:{value:'2026-10-21T10:45'}});
 const button=f.nodes().find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.trim()===(kind==='invoice'?'Create invoice':'Save job date')));
 button.props.onClick();button.props.onClick();eq(sent.length,1,'Same-frame '+kind+' taps send one request');
 const dialog=f.render();dialog.props.onOpenChange(false);eq(f.closed,0,'Pending '+kind+' cannot be dismissed');
 eq(f.nodes().some(n=>n.props?.role==='status'),true,'Pending save has accessible feedback');
 pending.resolve({ok:false,json:async()=>({error:'Synthetic save failed'})});await flush();
 eq(f.get('saving'),false);eq(f.get('error'),'Synthetic save failed');eq(f.changedRows.length,0);
 dialog.props.onOpenChange(false);eq(f.closed,1,'Failed save releases dismissal guard');
 pending=deferred();button.props.onClick();eq(sent.length,2,'Failed save releases synchronous request lock');
 pending.resolve({ok:true,json:async()=>kind==='invoice'?{id:'synthetic-invoice'}:{estimate:{status:'scheduled'}}});await flush();eq(f.changedRows.length,1);eq(f.get('saving'),false);
}
for(const hasSavedAppointment of [false,true]){
 const f=fixture();f.setFetcher(async()=>ok(false));
 f.open({...job('date-selection'),scheduledAt:hasSavedAppointment?'2026-10-21T16:30:00.000Z':null});
 await flush();
 const dateField=f.nodes().find(n=>n.props?.id==='scheduleDate');
 eq(Boolean(dateField),true,'The job date field is present');
 dateField.props.onChange({target:{value:'2026-10-21T10:45'}});
 eq(f.get('schedule'),'2026-10-21T10:45','Selecting an appointment updates only the local draft');
 const clear=f.nodes().find(n=>n.props?.onClick&&n.props.children==='Clear date/time selection');
 eq(Boolean(clear),true,'The Clear selection action appears for an entered date');
 eq(clear.props.disabled,false,'Clear selection is available while no save is pending');
 const priorRequests=f.requests.length;
 clear.props.onClick();
 eq(f.get('schedule'),'','Clearing the draft resets the date/time field');
 eq(f.requests.length,priorRequests,'Clearing a draft sends no request to the database');
 eq(f.changedRows.length,0,'Existing saved appointment and estimate state remain unchanged');
 const save=f.nodes().find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.trim()==='Save job date'));
 eq(save.props.disabled,true,'Empty date cannot be saved as an accidental unscheduling');
 eq(f.nodes().some(n=>n.props?.onClick&&n.props.children==='Clear date/time selection'),false,'Clear option hides with empty selection');
 if(hasSavedAppointment)eq(f.nodes().some(n=>n.type==='small'&&n.props?.children==='Clearing this selection does not cancel the saved appointment.'),true,'Existing appointment is explicitly protected');
}

// Keep essential customer actions prominent while preserving every secondary job tool.
let moreNode;function findMore(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='details'&&n.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='className'&&p.initializer?.text==='detail-more-tools'))moreNode=n;ts.forEachChild(n,findMore);}findMore(fn);assert.ok(moreNode,'More tools disclosure exists');
const detailSource=fn.getText(ast),moreStart=moreNode.getStart(ast)-fn.getStart(ast),moreEnd=moreNode.end-fn.getStart(ast),mainStart=detailSource.indexOf('<div className="detail-actions" aria-label="Customer and estimate actions">');
eq(moreStart>mainStart&&moreEnd>moreStart,true,'Secondary job tools exist in their own expandable section');
const primary=detailSource.slice(mainStart,moreStart),secondary=detailSource.slice(moreStart,moreEnd);
for(const label of ['EditEstimateDialog','MessageComposer','RecordPayment','GoogleVoiceCallAction','PersonalPhoneBackupAction'])eq(primary.includes(label),true,'Daily customer action available: '+label);
eq(primary.includes('initialTemplate="custom" triggerLabel="Text"'),true,'Primary estimate Text opens editable saved/custom template composer');
eq(primary.includes('GoogleVoiceTextAction phone={estimate.phone}'),false,'No duplicate blank-only Text modal remains in estimate actions');
eq(primary.includes('tel:')||primary.includes('sms:'),false,'Primary estimate actions never directly launch personal Phone or Messages');
eq((primary.match(/PersonalPhoneBackupAction/g)||[]).length>=2,true,'Estimate detail keeps explicitly labeled personal call and text backup components');
 eq(primary.includes('sms:'),false,'Estimate detail never offers iPhone personal SMS sender');
eq(primary.includes('Estimate research')&&primary.includes('Google Earth')&&primary.includes('Zillow'),true,'Quote preparation presents Earth and Zillow together');
eq(primary.includes('Driving to job')&&primary.includes('Google Maps')&&!primary.includes('StrideButton'),true,'Scheduled work shows Maps without duplicating the Home Stride shortcut');
eq(secondary.includes('Google Maps')&&!secondary.includes('StrideButton'),true,'Directions remain available under More tools without another Stride button');
for(const label of ['Customer view','Google Earth','Zillow','OwnerJobTools'])eq(secondary.includes(label),true,'Existing research and job control retained: '+label);
eq(secondary.includes('More tools')&&!secondary.includes('Job report, costs & more'),true,'Expandable tools use one short label, with job reports directly accessible');
eq(ast.getText().includes('<StrideButton top/>'),true,'Home retains its single Stride button in the header');
// Stage-specific actions stay available without a duplicate mileage shortcut.
const researchJob=fixture();researchJob.setFetcher(()=>Promise.resolve(ok(false,'quote')));researchJob.open({...job('quote'),status:'draft',address:'123 Synthetic St'});await flush();
const researchNodes=researchJob.nodes();
eq(researchNodes.some(n=>n.props?.['aria-label']==='Estimate research'),true,'Quote stage exposes Earth and Zillow as research tools');
eq(researchNodes.some(n=>n.props?.['aria-label']==='Driving to job'),false,'Draft quote does not clutter the screen with travel shortcuts');
eq(researchNodes.some(n=>n.props?.className==='detail-more-tools'),true,'Secondary owner tools stay available for a draft quote');
const scheduledJob=fixture();scheduledJob.setFetcher(()=>Promise.resolve(ok(false,'booked')));scheduledJob.open({...job('booked'),address:'123 Synthetic St',scheduledAt:'2026-10-28T14:00:00.000Z'});await flush();
const scheduledNodes=scheduledJob.nodes();
eq(scheduledNodes.some(n=>n.props?.['aria-label']==='Driving to job'),true,'Booked job exposes Google Maps directly; Stride stays in Home');
eq(scheduledNodes.some(n=>n.props?.['aria-label']==='Job report and costs'),true,'Scheduled work surfaces Job report and Job costs directly, without a More tools tap');
eq(scheduledNodes.some(n=>n.props?.['aria-label']==='Estimate research'),false,'Booked job does not repeat pre-estimate research buttons up front');
eq(scheduledNodes.some(n=>n.props?.className==='detail-more-tools'),true,'Booked job retains extra research and customer-view tools under More tools');
const completedJob=fixture();completedJob.setFetcher(()=>Promise.resolve(ok(true,'completed')));completedJob.open({...job('completed'),status:'completed',address:'123 Synthetic St'});await flush();
const completedNodes=completedJob.nodes();
eq(completedNodes.some(n=>n.props?.['aria-label']==='Job report and costs'),true,'Completed job still exposes reports and costs without extra navigation');
eq(completedNodes.some(n=>n.props?.['aria-label']==='Driving to job'),false,'Completed job does not show an active driving shortcut');
const simpleJob=fixture();simpleJob.open(job('compact-scheduled'));await flush();
eq(simpleJob.nodes().some(n=>n.props?.className==='next-action'),false,'Routine booked work has no redundant next-step box');
eq(simpleJob.nodes().some(n=>n.type==='details'&&n.props?.className==='detail-scope detail-scope-optional'),true,'Booked job keeps complete service scope one tap away rather than forcing a long scroll');
const quoteScope=fixture();quoteScope.open({...job('scope-quote'),status:'draft'});await flush();
eq(quoteScope.nodes().some(n=>n.type==='div'&&n.props?.className==='detail-scope'),true,'Draft estimate shows service scope before customer approval');
const exceptionJob=fixture();exceptionJob.open({...job('held-billing'),paymentOverageOpen:1});await flush();
eq(exceptionJob.nodes().some(n=>n.props?.className==='change-alert'),true,'Unresolved overpayment keeps its actionable refund-or-retain controls');
eq(exceptionJob.nodes().some(n=>n.props?.className==='next-action'),false,'Overpayment does not repeat a second warning above its controls');
const pendingRefund=fixture();pendingRefund.open({...job('held-refund'),pendingRefundCount:1});await flush();
eq(pendingRefund.nodes().some(n=>n.props?.className==='next-action'&&n.props.role==='alert'),true,'Pending refund remains an immediate financial alert');

/* Regression: a FIRE job is scheduled in Tulsa/Central Time even when the
 * owner's phone is set to UTC, Korea, or Central. DST gaps/folds fail closed.
 * All checks use synthetic state and never write to a hosted database. */
const originalTimezone=process.env.TZ;
try{
 for(const zone of ['America/Chicago','UTC','Asia/Seoul']){
  process.env.TZ=zone;
  for(const [stored,wall] of [
   ['2026-07-15T15:45:00.000Z','2026-07-15T10:45'],
   ['2026-01-15T16:45:00.000Z','2026-01-15T10:45'],
   ['2026-03-08T08:30:00.000Z','2026-03-08T03:30'],
   ['2026-11-01T08:30:00.000Z','2026-11-01T02:30']]){
   const f=fixture();f.setFetcher(async()=>ok(false,'timezone'));
   f.open({...job('timezone'),scheduledAt:stored});await flush();
   eq(f.get('schedule'),wall,zone+': saved '+stored+' renders true Central clock time');
   const label=f.nodes().find(n=>n.props?.htmlFor==='scheduleDate');
   eq(label.props.children,'Job date and time (Tulsa / Central Time)');
  }
  for(const [wall,expected] of [
   ['2026-07-15T10:45','2026-07-15T15:45:00.000Z'],
   ['2026-01-15T10:45','2026-01-15T16:45:00.000Z'],
   ['2026-03-08T03:30','2026-03-08T08:30:00.000Z'],
   ['2026-11-01T02:30','2026-11-01T08:30:00.000Z']]){
   const f=fixture('custom');f.setFetcher(async()=>ok(false,'central-save'));
   f.open(job('central-save'));await flush();
   f.nodes().find(n=>n.props?.id==='scheduleDate').props.onChange({target:{value:wall}});
   const calls=[];f.setFetcher(async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({estimate:{status:'scheduled',scheduledAt:expected}})};});
   f.nodes().find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.trim()==='Save job date')).props.onClick();
   await flush();
   eq(calls.length,1,zone+': one appointment save');
   eq(calls[0].body.scheduledAt,expected,zone+': Tulsa clock time converted to correct UTC');
  }
  for(const [invalid,reason] of [
   ['2026-03-08T02:30','does not exist'],
   ['2026-11-01T01:30','occurs twice'],
   ['2026-02-30T10:45','real calendar date']]){
   const f=fixture('custom');f.setFetcher(async()=>ok(false,'invalid-schedule'));
   f.open(job('invalid-schedule'));await flush();
   f.nodes().find(n=>n.props?.id==='scheduleDate').props.onChange({target:{value:invalid}});
   const calls=[];f.setFetcher(async(url,options)=>{calls.push(url);return {ok:true,json:async()=>({estimate:{status:'scheduled'}})};});
   f.nodes().find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.trim()==='Save job date')).props.onClick();
   await flush();
   eq(calls.length,0,zone+': invalid '+invalid+' must never PATCH');
   eq(f.get('error').includes(reason),true,zone+': visible DST/calendar error');
  }
 }
}finally{
 if(originalTimezone===undefined)delete process.env.TZ;
 else process.env.TZ=originalTimezone;
}

console.log(`PASS ${checks}/${checks}: actual estimate-detail effect/button state guards report loads across estimate switches, pending reads, close/unmount, failed/malformed responses and retry; synthetic reads/PATCH only; closeout failures, ownership validation and duplicate taps.`);
