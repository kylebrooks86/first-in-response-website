import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=data=>({ok:true,json:async()=>data});
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const names=['BusinessView','EstimatesView','InvoicesView','ContractsView','FollowUpsView','PaymentsView'].filter(name=>!process.argv.includes('--view')||name===process.argv[process.argv.indexOf('--view')+1]);
const job=id=>({id,customer:'QA',service:'Wash',status:'draft',totalCents:10000,depositCents:5000,paidCents:0,createdAt:'2026-10-09T12:00:00Z',items:[]});
const exp=(id,amountCents=1234,incurredAt='2026-10-09T12:00:00Z')=>({id,amountCents,incurredAt,description:'QA expense'});
function body(url,id){if(url==='/api/tasks')return {tasks:[{id,title:id,status:'open'}]};if(url==='/api/expenses')return {expenses:[exp(id)]};if(url==='/api/customers')return {customers:[{id,name:id}],estimates:[job(id)]};if(url==='/api/payments')return {payments:[]};if(url==='/api/invoices')return {invoices:[{id,customer:'QA',service:'Wash',totalCents:10000,paidCents:0,estimateId:id}]};return {estimates:[job(id)]};}
function fixture(name){
 const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(view);
 const stateNames=[];const tags=new Set();function walk(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')stateNames.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,walk);}walk(view);
 let state=[],refs=[],cursor=0,refCursor=0,effect,fetcher=url=>Promise.resolve(ok(body(url,'initial')));
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-09T12:00:00Z']));}static now(){return new Date('2026-10-09T12:00:00Z').getTime();}}
 const context={exports:{},require,Error,Date:Clock,Array,Number,...Object.fromEntries([...tags].map(tag=>[tag,()=>null])),
  useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
  useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){if(!effect)effect=fn;},
  fetch:(...args)=>fetcher(...args),useCurrentTime:()=>Clock.now(),money:c=>'$'+(c/100).toFixed(2),dateTime:v=>v,
  statusLabel:v=>v,repeatCadenceMonths:()=>null,addMonths:d=>d,};
 const helpers=['resolvedBillingTotalCents','billingBalanceCents'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)?.getText(ast)||'').join('\n');
 const source=view.getText(ast).replace('useEffect(()=>{void load();','exports.load=load;useEffect(()=>{void load();');
 vm.runInNewContext(ts.transpileModule(helpers+'\n'+source+`\nexports.view=${name};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{cursor=0;refCursor=0;return context.exports.view({searchQuery:''});};
 render();return {render,setFetcher:f=>fetcher=f,load:()=>context.exports.load(),get:key=>state[stateNames.indexOf(key)],set:(key,v)=>state[stateNames.indexOf(key)]=v,cleanup:()=>effect()};
}
function nodes(tree){let out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
for(const name of names){
 for(const scenario of ['older success','older error while pending','older success after latest error','unmount']){
  const f=fixture(name),first=[],second=[];let round=first;
  f.setFetcher(url=>{const d=defer();round.push({url,...d});return d.promise;});
  let cleanup;
  const old=scenario==='unmount'?(cleanup=f.cleanup(),null):f.load();round=second;
  const newer=scenario==='unmount'?null:f.load();
  const errorKey=name==='BusinessView'?'loadError':'error';
  if(scenario==='unmount'){cleanup();first.forEach(d=>d.resolve(ok(body(d.url,'old'))));await new Promise(r=>setImmediate(r));eq(f.get('loading'),true,`${name}: unmount cannot settle state`);eq(f.get(errorKey),'');continue;}
  if(scenario==='older error while pending'){first.forEach(d=>d.reject(new Error('old offline')));await old;eq(f.get('loading'),true,`${name}: stale finally cannot settle newer load`);eq(f.get(errorKey),'');}
  second.forEach(d=>d.resolve(scenario==='older success after latest error'?{ok:false,json:async()=>({error:'latest failed'})}:ok(body(d.url,'new'))));await newer;
  const before=JSON.stringify([f.get('rows'),f.get('tasks'),f.get('expenses'),f.get('customers'),f.get('estimates'),f.get('payments'),f.get(errorKey),f.get('loading')]);
  if(scenario!=='older error while pending'){first.forEach(d=>d.resolve(ok(body(d.url,'old'))));await old;}
  eq(JSON.stringify([f.get('rows'),f.get('tasks'),f.get('expenses'),f.get('customers'),f.get('estimates'),f.get('payments'),f.get(errorKey),f.get('loading')]),before,`${name}: stale response changed current state`);
  eq(f.get('loading'),false);eq(f.get(errorKey),scenario==='older success after latest error'?'latest failed':'');
 }
}
if(!process.argv.includes('--races-only')){
const failures=[];
for(const endpoint of ['/api/tasks','/api/expenses','/api/customers']){
 failures.push(url=>url===endpoint?{ok:false,json:async()=>({error:'denied'})}:ok(body(url,'new')));
 failures.push(url=>{if(url===endpoint)throw new Error('Offline');return ok(body(url,'new'));});
 failures.push(url=>url===endpoint?{ok:true,json:async()=>{throw new Error('Malformed JSON');}}:ok(body(url,'new')));
 failures.push(url=>url===endpoint?ok(null):ok(body(url,'new')));
}
for(const [url,key] of [['/api/tasks','tasks'],['/api/expenses','expenses'],['/api/customers','customers'],['/api/customers','estimates']])for(const bad of [undefined,{},[null],[[]],[{}]])failures.push(endpoint=>ok(endpoint===url?{...body(url,'new'),[key]:bad}:body(endpoint,'new')));
for(const invalid of [exp('bad',NaN),exp('bad',-1),exp('bad',null),exp('bad',''),exp('bad',false),exp('bad',{}),exp('bad',' '),exp('bad',1,'bad-date')])failures.push(url=>ok(url==='/api/expenses'?{expenses:[invalid]}:body(url,'new')));
for(const failure of failures)for(const populated of [false,true]){
 const f=fixture('BusinessView');if(populated){f.set('tasks',body('/api/tasks','saved').tasks);f.set('expenses',[exp('saved')]);f.set('customers',body('/api/customers','saved').customers);f.set('estimates',[job('saved')]);}
 const saved=JSON.stringify(['tasks','expenses','customers','estimates'].map(k=>f.get(k)));
 f.setFetcher(failure);await f.load();eq(f.get('loading'),false);assert.ok(f.get('loadError'));checks++;
 eq(JSON.stringify(['tasks','expenses','customers','estimates'].map(k=>f.get(k))),saved,'Failure must preserve ALL last good collections');
 const all=nodes(f.render());eq(all.some(n=>n.props?.className==='business-metrics'),false);eq(all.some(n=>n.props?.className==='business-grid'),false);
 const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;assert.ok(nodes(alert).some(n=>n.props?.children==='Try again'));checks++;
 f.setFetcher(url=>ok(body(url,'recovered')));alert.props.children[1].props.onClick();for(let i=0;i<20;i++)await Promise.resolve();eq(f.get('loading'),false);eq(f.get('loadError'),'');eq(f.get('tasks')[0].id,'recovered');eq(nodes(f.render()).some(n=>n.props?.className==='business-metrics'),true);
}
const f=fixture('BusinessView');f.setFetcher(url=>ok(url==='/api/expenses'?{expenses:[exp('current',1200),exp('last-year',99900,'2025-10-09T12:00:00Z'),exp('last-month',80000,'2026-09-09T12:00:00Z')]}:body(url,'good')));await f.load();
const metrics=nodes(f.render()).find(n=>n.props?.className==='business-metrics');eq(metrics.props.children[1].props.children[1].props.children,'$12.00','Expense total must match BOTH month and year');
f.setFetcher(url=>ok(url==='/api/customers'?{customers:[],estimates:[]}:url==='/api/tasks'?{tasks:[]}:{expenses:[]}));await f.load();eq(f.get('loadError'),'');eq(nodes(f.render()).find(n=>n.props?.className==='business-metrics').props.children[1].props.children[1].props.children,'$0.00','Zero is valid only after successful reads');
}
console.log(`PASS ${checks}/${checks}: actual Business loading/retry/year filtering and all six loaders overlap/error/unmount races; synthetic reads only.`);
