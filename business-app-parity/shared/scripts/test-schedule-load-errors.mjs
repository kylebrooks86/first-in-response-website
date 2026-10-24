import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helpers=['resolvedBillingTotalCents','billingBalanceCents'];
const declarations=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>helpers.includes(d.name.getText(ast))));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleView');
let state=[],cursor=0,effect,requests=[],fetchOptions=[],responder;let scheduleNow=Date.parse('2026-10-09T12:00:00Z');
const stubs=Object.fromEntries(['Button','EstimateDetail','ScheduleWeather','ScheduleMonthCalendar','Navigation','Clock3','ChevronRight','CalendarDays','CloudSun','AlertTriangle','Phone'].map(name=>[name,()=>null]));
const spacing={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/schedule-turnarounds.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,spacing);
const pagination={exports:{},require};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/estimate-pagination.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,pagination);
const context={exports:{},require,...pagination.exports,...spacing.exports,Error,Array,...stubs,
 useRef:initial=>({current:initial}),
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useEffect(fn){effect=fn;},useCurrentTime:()=>scheduleNow,fetch:async (url,options)=>{requests.push(url);fetchOptions.push(options);return responder(url);},money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s,dateTime:s=>s,
};
vm.runInNewContext(ts.transpileModule(declarations.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=ScheduleView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery=''){cursor=0;if(!(5 in state))state[5]='all';if(!(6 in state))state[6]='';return context.exports.view({searchQuery});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[2],false,'Load must settle');}
const job={id:'job-synthetic',customer:'Synthetic QA',service:'House Wash',status:'scheduled',scheduledAt:'2026-10-10T12:00:00Z',address:'123 A & B St, Tulsa',totalCents:10000,invoiceTotalCents:8000,depositCents:5000,paidCents:2000};
const ok=estimates=>({ok:true,json:async()=>({estimates,nextCursor:null})});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Schedule access denied'})}),'Schedule access denied'],
 [()=>({ok:false,json:async()=>({})}),'Schedule could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Schedule records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({estimates:{}})}),'Schedule records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Schedule could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true]){
 state=[populated?[job]:[],populated?job:null,true,''];responder=fail;requests=[];
 const initial=nodes(render());equal(initial.find(n=>n.type===stubs.EstimateDetail).props.estimate,null);equal(initial.some(n=>n.props?.className==='route-day-button'),false);equal(initial.some(n=>n.type===stubs.ScheduleWeather),false);equal(initial.some(n=>n.type===stubs.ScheduleMonthCalendar),false);
 effect();await settle();equal(state[3],message);equal(state[0].length,populated?1:0);equal(state[1],null);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);equal(all.some(n=>n.props?.className==='schedule-board'),false);equal(all.some(n=>n.props?.className==='schedule-turnaround-review'),false);equal(all.some(n=>n.props?.className==='route-day-button'),false);equal(all.some(n=>n.props?.children==='No upcoming jobs'),false);equal(all.some(n=>n.type===stubs.ScheduleWeather),false);equal(all.some(n=>n.type===stubs.ScheduleMonthCalendar),false);
 responder=()=>ok([job]);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[3],'');equal(requests.length,1);equal(requests[0],'/api/estimate-history?limit=50');equal(fetchOptions.at(-1)?.cache,'no-store');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);equal(recovered.some(n=>n.type===stubs.ScheduleMonthCalendar),true);equal(recovered.find(n=>n.type===stubs.ScheduleWeather).props.nextJobAt,job.scheduledAt);
 const card=recovered.find(n=>n.props?.className==='schedule-job');assert.ok(card);checks++;card.props.onClick();equal(state[1].id,job.id);
 const route=recovered.find(n=>n.props?.className==='route-day-button');equal(new URL(route.props.href).searchParams.get('destination'),job.address);
}
// Successful schedule retains sorted same-day routing and attention/balance rules.
const fixtures=[{...job,id:'later',scheduledAt:'2026-10-10T15:00:00Z',address:'456 Later Rd'},job,
 {...job,id:'next-day',scheduledAt:'2026-10-11T12:00:00Z'},
 {...job,id:'future-approved',status:'approved'},
 {...job,id:'past-open',scheduledAt:'2026-10-08T12:00:00Z',status:'completed'},
 {...job,id:'past-paid',scheduledAt:'2026-10-08T13:00:00Z',status:'completed',paidCents:8000},
 {...job,id:'past-declined',scheduledAt:'2026-10-08T14:00:00Z',status:'declined'}];
state=[[],null,true,''];responder=()=>ok(fixtures.map(e=>({...e,totalCents:String(e.totalCents),paidCents:String(e.paidCents),depositCents:String(e.depositCents)})));render();effect();await settle();equal(state[0][0].totalCents,10000);equal(state[0][0].depositCents,5000);equal(state[0][0].paidCents,2000);
const all=nodes(render());const cards=all.filter(n=>n.props?.className==='schedule-job');const rowShells=all.filter(n=>n.props?.className?.split(' ').includes('schedule-job-shell'));equal(cards.length,3);equal(rowShells.length,3);equal(rowShells[0].key,job.id);equal(rowShells[1].key,'later');equal(rowShells[2].key,'next-day');
const route=new URL(all.find(n=>n.props?.className==='route-day-button').props.href);equal(route.searchParams.get('destination'),'456 Later Rd');equal(route.searchParams.get('waypoints'),job.address);
const attention=all.find(n=>n.props?.className==='needs-attention');const overdue=nodes(attention).filter(n=>n.type==='button');equal(overdue.length,1);equal(overdue[0].key,'past-open');equal(nodes(overdue[0]).find(n=>n.type==='b').props.children.join(''),'$60.00 due');overdue[0].props.onClick();equal(state[1].id,'past-open');
const detail=nodes(render()).find(n=>n.type===stubs.EstimateDetail);detail.props.onChanged({...fixtures.find(e=>e.id==='past-open'),status:'completed',paidCents:8000});equal(state[0].find(e=>e.id==='past-open').paidCents,8000);equal(state[1].paidCents,8000);detail.props.onClose();equal(state[1],null);detail.props.onChanged({...job,status:'completed'});equal(state[1],null);equal(state[0].find(e=>e.id===job.id).status,'completed');cards[1].props.onClick();detail.props.onChanged({...job,status:'scheduled'});equal(state[1].id,'later');
equal(nodes(render('456 later')).filter(n=>n.props?.className==='schedule-job').length,1);equal(nodes(render('absent')).some(n=>n.props?.children==='No upcoming jobs'),true);
state=[[],null,true,''];responder=()=>ok([]);render();effect();await settle();equal(nodes(render()).some(n=>n.props?.children==='No upcoming jobs'),true);equal(nodes(render()).some(n=>n.props?.role==='alert'),false);
const midnight=[{...job,id:'central-late',scheduledAt:'2026-10-11T04:30:00Z',address:'Central Saturday stop'},{...job,id:'central-next',scheduledAt:'2026-10-11T05:30:00Z',address:'Central Sunday stop'}];
state=[[],null,true,''];responder=()=>ok(midnight);render();effect();await settle();
const midnightNodes=nodes(render()),midnightCards=midnightNodes.filter(n=>n.props?.className==='schedule-job');
equal(nodes(midnightCards[0]).find(n=>n.type==='b').props.children,'10');equal(nodes(midnightCards[1]).find(n=>n.type==='b').props.children,'11');
const midnightRoute=new URL(midnightNodes.find(n=>n.props?.className==='route-day-button').props.href);equal(midnightRoute.searchParams.get('destination'),'Central Saturday stop');equal(midnightRoute.searchParams.has('waypoints'),false);
// Calendar windows remain seven Tulsa days through both DST transitions.
for(const [clock,last,after] of [['2026-10-09T12:00:00Z','2026-10-15T15:00:00Z','2026-10-16T15:00:00Z'],['2026-10-31T05:30:00Z','2026-11-06T15:00:00Z','2026-11-07T15:00:00Z'],['2026-03-07T06:30:00Z','2026-03-13T15:00:00Z','2026-03-14T15:00:00Z']]){
 scheduleNow=Date.parse(clock);state=[[],null,true,''];responder=()=>ok([{...job,id:'today',scheduledAt:new Date(scheduleNow+3600000).toISOString()},{...job,id:'last',scheduledAt:last},{...job,id:'after',scheduledAt:after},{...job,id:'overdue',scheduledAt:new Date(scheduleNow-86400000).toISOString()}]);render();effect();await settle();
 const select=key=>nodes(render()).find(n=>n.type===stubs.Button&&n.key===key).props.onClick();
 equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,3);select('today');equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,1);equal(nodes(render()).some(n=>n.props?.className==='needs-attention'),true);select('week');equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,2);select('all');equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,3);
}
// Specific-day navigation uses Tulsa calendar days, including late-night jobs.
// Selection only changes local React state; no extra reads or writes are performed.
scheduleNow=Date.parse('2026-10-20T14:00:00Z');
const customJobs=[
 {...job,id:'today-a',scheduledAt:'2026-10-20T15:00:00Z',address:'Today first stop'},
 {...job,id:'today-late',scheduledAt:'2026-10-21T04:30:00Z',address:'Today late stop'},
 {...job,id:'tomorrow',scheduledAt:'2026-10-21T05:30:00Z',address:'Tomorrow stop'},
 {...job,id:'day-after',scheduledAt:'2026-10-22T15:00:00Z',address:'Day after stop'},
 {...job,id:'completed-yesterday',status:'completed',scheduledAt:'2026-10-19T15:00:00Z',address:'Finished job',paidCents:8000}
];
state=[[],null,true,''];responder=()=>ok(customJobs);requests=[];render();effect();await settle();
const chosenDay=()=>nodes(render()).find(n=>n.props?.id==='schedule-specific-date');
const dayButton=name=>nodes(render()).find(n=>n.type===stubs.Button&&n.props?.['aria-label']===name);
assert.ok(chosenDay()&&dayButton('Previous work date')&&dayButton('Next work date'));checks++;
chosenDay().props.onChange({target:{value:'2026-10-20'}});
equal(state[5],'date');equal(state[6],'2026-10-20');
equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,2);
let exactRoute=new URL(nodes(render()).find(n=>n.props?.className==='route-day-button').props.href);
equal(exactRoute.searchParams.get('destination'),'Today late stop');
equal(exactRoute.searchParams.get('waypoints'),'Today first stop');
dayButton('Next work date').props.onClick();
equal(state[6],'2026-10-21');equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,1);
exactRoute=new URL(nodes(render()).find(n=>n.props?.className==='route-day-button').props.href);
equal(exactRoute.searchParams.get('destination'),'Tomorrow stop');equal(exactRoute.searchParams.has('waypoints'),false);
dayButton('Next work date').props.onClick();
equal(state[6],'2026-10-22');equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,1);
dayButton('Previous work date').props.onClick();equal(state[6],'2026-10-21');
chosenDay().props.onChange({target:{value:'2026-10-25'}});
equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,0);
equal(nodes(render()).some(n=>n.props?.children==='No scheduled or completed jobs on this date'),true);
equal(nodes(render()).some(n=>n.props?.className==='route-day-button'),false);
equal(nodes(render()).some(n=>n.props?.className==='needs-attention'),false);
chosenDay().props.onChange({target:{value:'2026-10-19'}});
equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,1);
equal(nodes(render()).some(n=>n.props?.className==='schedule-history-status'&&n.props?.children==='completed'),true);
equal(nodes(render()).some(n=>n.props?.className==='route-day-button'),false);
equal(nodes(render()).some(n=>n.type===stubs.ScheduleWeather),true);
nodes(render()).find(n=>n.props?.className==='schedule-job').props.onClick();
equal(state[1].id,'completed-yesterday');
chosenDay().props.onChange({target:{value:''}});equal(state[5],'all');
equal(nodes(render()).filter(n=>n.props?.className==='schedule-job').length,4);
equal(requests.length,1,'Changing schedule days never creates a network request');
// Day increments are UTC calendar operations, not 24-hour elapsed local-time offsets.
for(const [start,next] of [['2026-03-07','2026-03-08'],['2026-03-08','2026-03-09'],['2026-10-31','2026-11-01'],['2026-11-01','2026-11-02']]){
 chosenDay().props.onChange({target:{value:start}});
 dayButton('Next work date').props.onClick();equal(state[6],next);
}

// Render the real ScheduleView close-start advisory from a complete owner list.
// Search and day filtering must not hide another job's start. A review button
// opens only its exact saved job, without a status/booking/network mutation.
scheduleNow=Date.parse('2026-10-20T14:00:00Z');
const closeJobs=[
 {...job,id:'tight-first',customer:'First job',scheduledAt:'2026-10-20T15:00:00Z',address:'First place'},
 {...job,id:'tight-second',customer:'Second job',scheduledAt:'2026-10-20T15:45:00Z',address:'Second place'},
 {...job,id:'same-minute',customer:'Third job',scheduledAt:'2026-10-20T15:45:00Z',address:'Third place'},
 {...job,id:'outside-window',customer:'Farther job',scheduledAt:'2026-10-20T18:01:00Z'},
 {...job,id:'already-complete',customer:'Completed job',status:'completed',scheduledAt:'2026-10-20T15:30:00Z'},
 {...job,id:'next-day',customer:'Tomorrow job',scheduledAt:'2026-10-21T05:30:00Z'}
];
state=[[],null,true,''];responder=()=>ok(closeJobs);requests=[];render();effect();await settle();
const visibleChecks=nodes(render());
const shortcut=visibleChecks.find(n=>n.props?.className==='schedule-check-shortcut');
const advanced=visibleChecks.find(n=>n.props?.className==='schedule-planning-more');
assert.ok(shortcut&&advanced,'Active appointment cautions remain visible while advanced tools are collapsed');checks++;
equal(shortcut.props['aria-label'],'Review upcoming schedule checks');
equal(nodes(shortcut).some(n=>String(n.props?.children).includes('same-time start')),true);
let scrolled=0;const disclosure={open:false,scrollIntoView(options){equal(options.block,'start');scrolled++;}};
advanced.props.ref.current=disclosure;
shortcut.props.onClick();
equal(disclosure.open,true);equal(scrolled,1);
equal(requests.length,1,'Reviewing a schedule warning does not change saved jobs or fetch data');
const review=()=>nodes(render()).find(n=>n.props?.className==='schedule-turnaround-review');
assert.ok(review(),'Close-start advisory must render on successful verified owner read');checks++;
let pairRows=nodes(review()).filter(n=>n.props?.className==='schedule-turnaround-pair');
equal(pairRows.length,1);equal(nodes(review()).filter(n=>n.props?.className==='schedule-turnaround-job').length,3);
equal(nodes(review()).some(n=>typeof n.props?.children==='string'&&n.props.children.includes('not proof of overlapping jobs')),false);
const sameStart=nodes(render()).find(n=>n.props?.className==='schedule-start-conflicts');
assert.ok(sameStart,'Existing exact same-minute warning stays separate');checks++;
let linked=nodes(review()).filter(n=>n.props?.className==='schedule-turnaround-job');
linked.find(n=>n.props['aria-label']==='Review scheduled job for Second job').props.onClick();
equal(state[1].id,'tight-second');
const beforeReadCount=requests.length;
nodes(render('NO MATCHING CUSTOMER')).filter(n=>n.props?.className==='schedule-turnaround-pair').length;
equal(nodes(render('NO MATCHING CUSTOMER')).some(n=>n.props?.className==='schedule-turnaround-review'),true);
equal(requests.length,beforeReadCount,'Search cannot hide advisory or issue new network calls');
const browse=nodes(render()).find(n=>n.props?.id==='schedule-specific-date');
browse.props.onChange({target:{value:'2026-10-21'}});
equal(nodes(render()).some(n=>n.props?.className==='schedule-turnaround-review'),true);
equal(requests.length,beforeReadCount,'Specific-day browsing is read-only');
state=[[],null,true,''];responder=()=>ok([{...job,id:'a',scheduledAt:'2026-10-20T15:00:00Z'},{...job,id:'b',scheduledAt:'2026-10-20T18:00:00Z'}]);render();effect();await settle();
equal(nodes(render()).some(n=>n.props?.className==='schedule-turnaround-review'),false);
state=[[],null,true,''];responder=()=>ok([{...job,id:'clean-upcoming',phone:'9185550101',address:'123 Synthetic Street',scheduledAt:'2026-10-20T15:00:00Z'}]);render();effect();await settle();
equal(nodes(render()).some(n=>n.props?.className==='schedule-check-shortcut'),false);

// Restore the baseline test clock before running pre-existing refresh assertions.
scheduleNow=Date.parse('2026-10-09T12:00:00Z');
// Owner-initiated refresh performs one read without a browser cache and never submits writes.
state=[[],null,true,''];responder=()=>ok([job]);requests=[];fetchOptions=[];
render();effect();await settle();
equal(typeof state[4],'string');equal(Number.isFinite(Date.parse(state[4])),true);
const refreshButton=()=>nodes(render()).find(node=>node.type===stubs.Button&&node.props?.['aria-label']==='Refresh schedule');
assert.ok(refreshButton());checks++;equal(refreshButton().props.disabled,false);
responder=()=>ok([job,{...job,id:'newly-booked',address:'Updated appointment',scheduledAt:'2026-10-10T18:00:00Z'}]);
requests=[];fetchOptions=[];
refreshButton().props.onClick();equal(state[2],true);equal(refreshButton().props.disabled,true);equal(nodes(render()).some(n=>n.type===stubs.ScheduleMonthCalendar),false);
await settle();equal(requests.length,1);equal(requests[0],'/api/estimate-history?limit=50');equal(fetchOptions[0]?.cache,'no-store');
equal(state[0].length,2);equal(nodes(render()).filter(node=>node.props?.className==='schedule-job').length,2);
const previous=state[4];responder=()=>{throw new Error('Synthetic offline during refresh');};requests=[];refreshButton().props.onClick();await settle();
equal(state[3],'Synthetic offline during refresh');equal(state[0].length,2);equal(state[4],previous);
equal(nodes(render()).some(node=>node.props?.className==='schedule-board'),false);
equal(nodes(render()).some(node=>node.type===stubs.ScheduleMonthCalendar),false);
equal(nodes(render()).some(node=>node.props?.className==='route-day-button'),false);
responder=()=>ok([job]);const retry=nodes(render()).find(node=>node.props?.role==='alert').props.children[1];
retry.props.onClick();await settle();
equal(state[3],'');equal(state[0].length,1);equal(nodes(render()).some(node=>node.type===stubs.ScheduleMonthCalendar),true);equal(nodes(render()).some(node=>node.props?.className==='schedule-board'),true);

// Financial and appointment corruption must never show unsafe balances, stale routes
// or a falsely successful refresh. Valid saved records remain recoverable with GET only.
for(const [field,value] of [
 ['totalCents','1.25'],
 ['totalCents',''],
 ['totalCents','9007199254740992'],
 ['subtotalCents','2.50'],
 ['depositCents',false],
 ['paidCents',null],
 ['discountCents','not-money'],
 ['invoiceTotalCents','12.01'],
 ['scheduledAt','not-a-date'],
 ['scheduledAt',12345]
]){
 state=[[job],null,true,''];responder=()=>ok([{...job,[field]:value}]);
 render();effect();await settle();
 equal(Boolean(state[3]),true);
 equal(state[0].length,1);
 equal(nodes(render()).some(n=>n.props?.className==='schedule-board'),false);
 equal(nodes(render()).some(n=>n.props?.className==='route-day-button'),false);
 equal(nodes(render()).some(n=>n.props?.className==='needs-attention'),false);
 responder=()=>ok([{...job,totalCents:'10000',paidCents:'2000',depositCents:'5000',invoiceTotalCents:'8000'}]);
 const retry=nodes(render()).find(n=>n.props?.role==='alert').props.children[1];
 retry.props.onClick();await settle();
 equal(state[3],'');equal(state[0].length,1);
 equal(state[0][0].invoiceTotalCents,8000);
 equal(nodes(render()).some(n=>n.props?.className==='schedule-board'),true);
}
// Execute the REAL monthly calendar with synthetic hook state: month arrows must
// browse freely, while an externally selected booking date opens its own month.
{
 const declaration=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleMonthCalendar');
 assert.ok(declaration,'Monthly calendar implementation must exist');checks++;
 let calendarState=[],calendarCursor=0,lastDate,pendingEffect=null;
 const calendarContext={exports:{},require,
  useState(initial){const i=calendarCursor++;if(!(i in calendarState))calendarState[i]=typeof initial==='function'?initial():initial;
   return [calendarState[i],update=>{calendarState[i]=typeof update==='function'?update(calendarState[i]):update;}]},
  useEffect(callback,deps){if(lastDate!==deps[0])pendingEffect=()=>{lastDate=deps[0];callback();}}
 };
 vm.runInNewContext(ts.transpileModule(declaration.getText(ast)+'\nexports.calendar=ScheduleMonthCalendar;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}
 }).outputText,calendarContext);
 function calendar(chosen){
  let tree;for(let attempt=0;attempt<2;attempt++){calendarCursor=0;pendingEffect=null;
   tree=calendarContext.exports.calendar({jobs:[],selectedDate:chosen,onSelectDate:()=>{}});
   if(!pendingEffect)break;pendingEffect();
  }return nodes(tree);
 }
 const headerLabel=all=>all.find(n=>n.type==='h2')?.props.children;
 const first=calendar('2026-10-20');equal(headerLabel(first),'October 2026');
 first.find(n=>n.props?.['aria-label']==='Next month').props.onClick();
 equal(headerLabel(calendar('2026-10-20')),'November 2026');
 equal(headerLabel(calendar('2027-02-14')),'February 2027');
 equal(headerLabel(calendar('2027-02-14')),'February 2027');
 calendar('invalid-date');equal(headerLabel(calendar('invalid-date')),'February 2027');
}
console.log(`PASS ${checks}/${checks}: actual schedule load/error/retry handlers preserve records, hide stale route/editor/forecast targets, recover jobs, and retain sorted same-day routes, overdue revised balances, selection/change/close callbacks and search. Mocked reads only.`);
