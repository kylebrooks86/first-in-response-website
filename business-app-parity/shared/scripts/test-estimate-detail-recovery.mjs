import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimateDetail');assert.ok(fn);
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
console.log(`PASS ${checks}/${checks}: actual estimate-detail effect/button state guards report loads across estimate switches, pending reads, close/unmount, failed/malformed responses and retry; synthetic reads/PATCH only; closeout failures, ownership validation and duplicate taps.`);
