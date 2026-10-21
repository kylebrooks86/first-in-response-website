/** Run BusinessView's actual authenticated list handler with disposable GET responses. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='BusinessView');
assert.ok(view,'BusinessView source exists');
const statement=view.body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='load'));
assert.ok(statement,'Actual BusinessView load handler exists');
const declaration=statement.declarationList.declarations.find(d=>d.name.getText(ast)==='load');
const script=ts.transpileModule('exports.load='+declaration.initializer.getText(ast)+';',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const task=(id='task-new')=>({id,title:'Synthetic reminder',status:'open'});
const expense=(amountCents='425')=>({id:'expense-new',description:'Synthetic supply',amountCents,incurredAt:'2026-10-20T12:00:00Z'});
const json=(value,status=200)=>({ok:status===200,json:async()=>value});
const valid=(id='task-new')=>({
 '/api/tasks':json({tasks:[task(id)]}),
 '/api/expenses':json({expenses:[expense()]}),
 '/api/customers':json({customers:[{id:'c1',name:'Synthetic customer'}],estimates:[{id:'e1'}]})
});
function fixture(){
 const state={loading:null,error:null,tasks:null,expenses:null,customers:null,estimates:null,receipts:[],requests:[],notice:null,expanded:[],highlighted:[]};
 const loadRequest={current:0};let handler=(url)=>valid()[url];
 const ctx={exports:{},loadRequest,taskFocusNotice:null,
  setTaskFocusNotice:v=>{state.notice=v;ctx.taskFocusNotice=v;},
  setTaskSearch:()=>{},setTaskFilter:()=>{},
  setContextTaskId:id=>state.expanded.push(id),setHighlightTaskId:id=>state.highlighted.push(id),
  setLoading:v=>{state.loading=v;},setLoadError:v=>{state.error=v;},
  setTasks:v=>{state.tasks=v;},setExpenses:v=>{state.expenses=v;},
  setCustomers:v=>{state.customers=v;},setEstimates:v=>{state.estimates=v;},
  reconcileReceipts:(tasks,expenses)=>state.receipts.push([tasks,expenses]),
  fetch:(url,options)=>{state.requests.push({url,options});return handler(url,options);}
 };
 vm.runInNewContext(script,ctx);
 return {state,load:()=>ctx.exports.load(),setHandler:fn=>{handler=fn;},setNotice:v=>{ctx.taskFocusNotice=v;state.notice=v;},loadRequest};
}
{
 const f=fixture();await f.load();
 eq(f.state.requests.length,3,'All three owner lists were fetched');
 eq(f.state.requests.map(r=>r.url),['/api/tasks','/api/expenses','/api/customers'],'Expected authenticated endpoints only');
 eq(f.state.requests.every(r=>r.options?.cache==='no-store'),true,'Every owner read opts out of browser caches');
 eq(f.state.tasks?.[0].id,'task-new','Validated tasks accepted');
 eq(f.state.expenses?.[0].amountCents,425,'Integer cents normalized once');
 eq(f.state.receipts.length,1,'Only complete lists reconcile pending save receipts');
 eq(f.state.error,'','Successful list read has no error');
 eq(f.state.loading,false,'Owner UI leaves loading state');
}
for(const scenario of ['network','http','bad-shape','invalid-expense']){
 const f=fixture();f.setHandler(url=>{
  if(url==='/api/tasks'&&scenario==='network')return Promise.reject(Error('Synthetic offline'));
  if(url==='/api/expenses'&&scenario==='http')return json({error:'Synthetic unavailable'},503);
  if(url==='/api/customers'&&scenario==='bad-shape')return json({customers:null,estimates:[]});
  if(url==='/api/expenses'&&scenario==='invalid-expense')return json({expenses:[expense('4.5')]});
  return valid()[url];
 });
 await f.load();
 eq(Boolean(f.state.error),true,scenario+' produces visible error, not false empty lists');
 eq(f.state.loading,false,scenario+' releases loading');
 eq(f.state.receipts.length,0,scenario+' must not reconcile from partial/unverified data');
 eq(f.state.tasks,null,scenario+' does not partially replace saved tasks');
}
{
 const f=fixture(),old=deferred();let first=true;
 f.setHandler(url=>{
  if(url==='/api/tasks'&&first){first=false;return old.promise;}
  return valid('newest-task')[url];
 });
 const early=f.load();const latest=f.load();await latest;
 old.resolve(json({tasks:[task('stale-task')]}));await early;
 eq(f.state.tasks?.[0].id,'newest-task','Late stale GET cannot overwrite newer verified list');
 eq(f.state.receipts.length,1,'Stale response cannot reconcile or clear saved operation IDs');
 eq(f.state.loading,false,'Stale completion cannot strand UI in loading state');
}
// A missing task notification is only restored after the full owner-scoped list
// finishes correctly; a failed or stale read must not claim a found task.
{
 const f=fixture();
 f.setNotice({id:'task-new',status:'missing',customerId:'c1',activity:'sign'});
 await f.load();
 eq(f.state.notice?.status,'restored','Verified saved task makes a missing notification recoverable');
 eq(f.state.expanded.at(-1),'task-new','Recovered task reopens exact read-only details');
 eq(f.state.highlighted.at(-1),'task-new','Recovered task is highlighted without toggling completion');
 eq(f.state.requests.every(r=>!r.options?.method),true,'Recovery checks saved GETs only');
}
{
 const f=fixture();
 f.setNotice({id:'unknown-task',status:'missing',customerId:'c1',activity:'review'});
 await f.load();
 eq(f.state.notice?.status,'missing','Absent task remains explicitly unverified after full read');
 eq(f.state.expanded.length,0,'No arbitrary task details are opened on missing recovery');
}
{
 const f=fixture();
 f.setNotice({id:'task-new',status:'missing',customerId:'c1',activity:'sign'});
 f.setHandler(url=>url==='/api/customers'?json({customers:null,estimates:[]}):valid()[url]);
 await f.load();
 eq(f.state.notice?.status,'missing','Failed owner list cannot claim task restored');
 eq(f.state.expanded.length,0,'Partial lists do not focus unverified records');
 eq(f.state.receipts.length,0,'Failed task recovery never reconciles pending save receipts');
}
console.log('PASS '+checks+'/'+checks+': actual BusinessView owner-only list recovery, stale reads, task-notification rechecks and no automatic writes. Synthetic data only.');
