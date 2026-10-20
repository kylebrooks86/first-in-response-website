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
const compiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8')+'\n'+helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=FollowUpsView;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const fixedTime=Date.parse('2026-10-09T12:00:00Z');
class FixedDate extends Date {static now(){return fixedTime;}}
const components=['EstimateDetail','Button','MessageComposer','Clock3','Star','CalendarDays','CheckCircle2'];
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
 let state=[],refs=[],cursor=0,refCursor=0,effect,cleanup,handler=async()=>response([job()]);
 const requests=[],stubs=Object.fromEntries(components.map(k=>[k,()=>null]));
 const context={exports:{},require,...stubs,Date:FixedDate,Math,Error,Array,Number,JSON,
  useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
  useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
  useEffect(fn){effect=fn;},useCurrentTime:()=>fixedTime,money:c=>'$'+(c/100).toFixed(2),
  fetch:(url,options)=>{requests.push({url,options});return handler(url,options);},
 };
 vm.runInNewContext(compiled,context);
 const render=(searchQuery='')=>{cursor=0;refCursor=0;return context.exports.view({searchQuery});};
 const lookup=(predicate)=>nodes(render()).find(predicate);
 return {requests,render,nodes:()=>nodes(render()),lookup,
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
 f.clickText('Load older records');await flush();
 eq(f.get(0).length,2,'Append deduplicates the older page');
 eq(f.get(3),null,'End of paging is recognized');
 eq(f.requests.at(-1).url,'/api/followups?limit=50&cursor=next','Append uses the saved continuation cursor');
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
console.log('PASS '+checks+'/'+checks+': actual FollowUpsView paginated endpoint, failure/retry, retained existing rows, deduplicated append and stale read protection. Mock GET only.');
