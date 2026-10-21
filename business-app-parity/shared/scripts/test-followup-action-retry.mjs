/** Run actual FollowUpsView action handler under synthetic Cloudflare replies. No sends or real data. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
assert.ok(view,'Actual FollowUpsView exists');
const names=[];
const needed=['resolvedBillingTotalCents','billingBalanceCents'];
const helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>needed.includes(d.name.getText(ast)))||ts.isFunctionDeclaration(n)&&['repeatCadenceMonths','addMonths'].includes(n.name?.text));
const compiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8')+'\n'+helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=FollowUpsView;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const fixedTime=Date.parse('2026-10-09T12:00:00Z');
class FixedDate extends Date {static now(){return fixedTime;}}
const starter={id:'estimate-1',customerId:'customer-1',customer:'Synthetic QA',service:'House Wash',status:'sent',
  createdAt:'2026-10-01T12:00:00.000Z',firstEstimateSentAt:'2026-10-01T12:00:00.000Z',lastEstimateSentAt:'2026-10-01T12:00:00.000Z',
  totalCents:10000,depositCents:5000,paidCents:0,paymentOverageOpen:0};
const getOk=(row=starter)=>({ok:true,json:async()=>({estimates:[row],nextCursor:null})});
const postOk=(action,when='2026-10-09T12:00:00.000Z')=>({ok:true,status:201,json:async()=>({action,createdAt:when,snoozeUntil:action==='snooze'?'2026-10-16T12:00:00.000Z':null})});
const later=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(r=>setImmediate(r));
const stubs=Object.fromEntries(['EstimateDetail','Button','MessageComposer','Clock3','Star','CalendarDays','CheckCircle2'].map(n=>[n,()=>null]));
function nodes(tree){const out=[];function scan(n){if(Array.isArray(n))return n.forEach(scan);if(!n||typeof n!=='object')return;out.push(n);scan(n.props?.children);}scan(tree);return out;}
let count=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);count++;}
function fixture(){
 let state=[],refs=[],cursor=0,refCursor=0,effect,cleanup,effectCursor=0,handler=(url,options)=>options?.method==='POST'?postOk('contacted'):getOk(),operations=0;
 const requests=[],context={exports:{},require,Date:FixedDate,Error,Array,Number,JSON,Math,...stubs,
   useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
   useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
   useEffect(fn){if(effectCursor++===0)effect=fn;},useCurrentTime:()=>fixedTime,money:c=>'$'+(c/100).toFixed(2),
   crypto:{randomUUID:()=>{operations++;return '10000000-0000-4000-8000-'+String(operations).padStart(12,'0');}},
   fetch:(url,options)=>{requests.push({url,options});return handler(url,options);}
 };
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=0;refCursor=0;effectCursor=0;return context.exports.view({searchQuery:''});};
 return {requests,render,getState:i=>state[i],getOpCount:()=>operations,response:fn=>{handler=fn;},
  mount(){render();cleanup=effect();},unmount(){cleanup?.();},
  action(name){const button=nodes(render()).find(n=>n.type===stubs.Button&&n.props?.children===name);assert.ok(button,'Expected '+name+' button');return button;},
  postCount:()=>requests.filter(x=>x.options?.method==='POST').length,
  lastPost:()=>JSON.parse(requests.filter(x=>x.options?.method==='POST').at(-1).options.body),
  alert:()=>nodes(render()).find(n=>n.props?.role==='alert')?.props.children,
  retry:()=>refs[1]?.current
 };
}
// A lost reply may still represent a committed DB write. Reuse exactly the same UUID after a deliberate retry.
for(const problem of ['offline','http','bad-json','wrong-action','bad-createdAt','bad-snooze']){
 const action=problem==='bad-snooze'?'snooze':'contacted';
 const name=action==='snooze'?'Snooze 7 days':'Contacted';
 const f=fixture();f.mount();await flush();
 const pending=later();f.response((url,options)=>options?.method==='POST'?pending.promise:getOk());
 const button=f.action(name);button.props.onClick();button.props.onClick();
 eq(f.postCount(),1,problem+' sends only one POST during rapid taps');
 eq(f.action(name).props.disabled,true,problem+' disables buttons while saving');
 const original=f.lastPost();
 eq(original.action,action,problem+' sends selected action');
 eq(original.estimateId,'estimate-1',problem+' binds estimate');
 eq(original.customerId,'customer-1',problem+' binds customer');
 if(problem==='offline')pending.reject(Error('Lost connection after server commit'));
 else if(problem==='http')pending.resolve({ok:false,status:503,json:async()=>({error:'Unconfirmed'})});
 else if(problem==='bad-json')pending.resolve({ok:true,json:async()=>{throw Error('truncated reply');}});
 else if(problem==='wrong-action')pending.resolve(postOk('snooze'));
 else if(problem==='bad-createdAt')pending.resolve({ok:true,json:async()=>({action,createdAt:'not a timestamp'})});
 else pending.resolve({ok:true,json:async()=>({action,createdAt:'2026-10-09T12:00:00.000Z',snoozeUntil:'invalid'})});
 await flush();
 eq(f.postCount(),1,problem+' never auto-retries');
 eq(Boolean(f.alert()?.includes('not confirmed')),true,problem+' shows unconfirmed-save alert');
 eq(f.action(name).props.disabled,false,problem+' unlocks same safe action');
 const other=f.action(action==='contacted'?'Snooze 7 days':'Contacted');
 eq(other.props.disabled,true,problem+' blocks conflicting new action');
 other.props.onClick();
 eq(f.postCount(),1,problem+' conflicting click cannot bypass guard');
 // The deliberate retry uses an identical idempotency key, including after ambiguous HTTP outcomes.
 f.response((url,options)=>options?.method==='POST'?postOk(action):getOk());
 f.action(name).props.onClick();await flush();await flush();
 eq(f.postCount(),2,problem+' deliberate retry sends request');
 eq(f.lastPost().operationId,original.operationId,problem+' reuses original operation ID');
 eq(f.getOpCount(),1,problem+' never allocates a second UUID');
 eq(f.getState(6).includes(action==='snooze'?'snoozed':'Contact recorded'),true,problem+' confirms success');
 eq(f.retry(),null,problem+' clears pending attempt only on confirmed response');
 f.unmount();
}
// An already confirmed action uses exactly one POST and reports no external message delivery.
{
 const f=fixture();f.mount();await flush();
 f.action('Contacted').props.onClick();await flush();await flush();
 eq(f.postCount(),1,'Normal save posts exactly once');
 eq(f.getState(6).includes('no message send is claimed'),true,'Contacted action never claims sending a message');
 eq(f.retry(),null,'Normal confirmed save releases retry state');
 f.unmount();
}
console.log('PASS '+count+'/'+count+': actual follow-up POST handler reuses uncertain operation IDs, blocks conflicting actions, checks server identity and timestamps, and avoids automatic repeats. Synthetic requests only.');
