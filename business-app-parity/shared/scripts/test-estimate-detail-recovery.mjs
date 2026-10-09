import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimateDetail');assert.ok(fn);
const names=[],tags=new Set();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}visit(fn);
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};const flush=()=>new Promise(r=>setImmediate(r));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};const ok=complete=>({ok:true,json:async()=>({reports:[{status:complete?'completed':'draft'}]})});
const job=id=>({id,customer:'Synthetic',service:'Wash',status:'scheduled',items:[],totalCents:20000,depositCents:10000,paidCents:0,createdAt:'2026-10-09',paymentOverageOpen:0});
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
function fixture(){let state=[],cursor=0,effect,cleanup,estimate,fetcher;const requests=[],writes=[];const context={exports:{},require,...Object.fromEntries([...tags].map(t=>[t,()=>null])),money:c=>String(c),dateTime:v=>v,statusLabel:v=>v,serviceDescriptionFor:()=>'',resolvedBillingTotalCents:e=>e.totalCents,
useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{writes.push(names[i]);state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect(fn){effect=fn;},fetch:(url,options)=>{eq(options,undefined,'Only synthetic read requests allowed');requests.push(url);return fetcher(url);}};
vm.runInNewContext(ts.transpileModule(fn.getText(ast)+'\nexports.view=EstimateDetail;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const render=()=>{cursor=0;return context.exports.view({estimate,onClose(){},onChanged(){throw Error('No financial/job writes allowed in report-read tests');}});};
return {open(value){cleanup?.();estimate=value;render();cleanup=effect();},render,get:key=>state[names.indexOf(key)],setFetcher:f=>fetcher=f,unmount:()=>cleanup?.(),writes,requests,button:()=>nodes(render()).find(n=>n.type===context.Button&&[n.props.children].flat(Infinity).some(c=>c==='Mark job complete'||c==='Complete report first'))};}
for(const scenario of ['older success','older failure','delayed JSON']){
 const f=fixture(),old=deferred(),newer=deferred(),json=deferred();f.setFetcher(url=>url.endsWith('first')?old.promise:newer.promise);f.open(job('first'));
 if(scenario==='delayed JSON'){old.resolve({ok:true,json:()=>json.promise});await flush();}
 f.open(job('second'));eq(f.get('reportComplete'),false);newer.resolve(ok(false));await flush();eq(f.get('reportComplete'),false);const count=f.writes.length;
 if(scenario==='older failure')old.reject(Error('old offline'));else if(scenario==='delayed JSON')json.resolve({reports:[{status:'completed'}]});else old.resolve(ok(true));await flush();eq(f.get('reportComplete'),false,scenario+': old job must not mark new report complete');eq(f.writes.length,count,'Stale report must not write state');eq(f.button().props.disabled,true);eq(f.requests[1],'/api/job-reports?estimateId=second');
}
{
 const f=fixture();let next=deferred();f.setFetcher(()=>next.promise);f.open(job('loaded'));next.resolve(ok(true));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);next=deferred();f.open(job('pending'));eq(f.get('reportComplete'),false,'New job resets previous completion before read');eq(f.button().props.disabled,true);next.resolve(ok(true));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);
}
for(const outcome of ['success','failure'])for(const close of ['unmount','no estimate']){
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);f.open(job('closed'));if(close==='unmount')f.unmount();else f.open(null);const count=f.writes.length;
 if(outcome==='success')pending.resolve(ok(true));else pending.reject(Error('offline'));await flush();eq(f.get('reportComplete'),false,close+' invalidates '+outcome);eq(f.writes.length,count,'Closed detail cannot write state');if(close==='no estimate')eq(f.render(),null);
}
for(const response of [{ok:false,json:async()=>({reports:[{status:'completed'}]})},{ok:true,json:async()=>null},{ok:true,json:async()=>({reports:{status:'completed'}})},{ok:true,json:async()=>{throw Error('bad JSON');}}]){
 const f=fixture();f.setFetcher(async()=>response);f.open(job('failed'));await flush();eq(f.get('reportComplete'),false,'HTTP/JSON/collection failures must not enable completion');eq(f.button().props.disabled,true);
 f.setFetcher(async()=>ok(true));f.open(job('retry'));await flush();eq(f.get('reportComplete'),true);eq(f.button().props.disabled,false);
}
console.log(`PASS ${checks}/${checks}: actual estimate-detail effect/button state guards report loads across estimate switches, pending reads, close/unmount, failed/malformed responses and retry; synthetic reads only.`);
