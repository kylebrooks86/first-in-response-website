import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EditInvoiceDialog');assert.ok(fn);
const stateNames=[],tags=new Set();
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')stateNames.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}visit(fn);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const body=id=>({invoice:{items:[{id,name:id,description:id,quantity:2,unit:'job',totalCents:20000}],discountType:'dollar',discountValue:1000,dueAt:'2026-11-20',createdAt:'2026-10-09',revisions:[{id:'revision-'+id,items:[],totalCents:20000}]}});
const ok=id=>({ok:true,json:async()=>body(id)});
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function fixture(){let state=[],refs=[],cursor=0,refCursor=0,effect,fetcher;const writes=[];
 const context={exports:{},require,...Object.fromEntries([...tags].map(tag=>[tag,()=>null])),services:[],money:c=>String(c),dateTime:v=>v,serviceDescriptionFor:()=>'',
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{writes.push(stateNames[i]);state[i]=typeof v==='function'?v(state[i]):v;}];},
 useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){if(!effect)effect=fn;},
 fetch:(url,options)=>{eq(url,'/api/invoices/synthetic-invoice');eq(options,undefined,'Only mocked invoice reads allowed');return fetcher();}};
 vm.runInNewContext(ts.transpileModule(fn.getText(ast).replace('  const setOpenSafe=', '  exports.hydrate=hydrate;\n  const setOpenSafe=')+'\nexports.view=EditInvoiceDialog;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{cursor=0;refCursor=0;return context.exports.view({estimate:{invoiceId:'synthetic-invoice',paidCents:0},onSaved(){throw Error('Saving is forbidden in loader recovery checks');}});};
 render();return {render,setFetcher:f=>fetcher=f,load:()=>context.exports.hydrate(),get:k=>state[stateNames.indexOf(k)],snapshot:()=>JSON.stringify(state),writes,close:()=>render().props.onOpenChange(false),reopen:()=>render().props.onOpenChange(true),unmount:()=>effect?.()()};
}
for(const scenario of ['older success','older failure while pending','older success after latest failure','delayed old JSON']){
 const f=fixture(),first=deferred(),second=deferred(),json=deferred();let round=first;f.setFetcher(()=>round.promise);const old=f.load();
 if(scenario==='delayed old JSON'){first.resolve({ok:true,json:()=>json.promise});await flush();}
 round=second;const newer=f.load();eq(f.get('loading'),true);
 if(scenario==='older failure while pending'){first.reject(Error('old offline'));await old;eq(f.get('loading'),true,'Stale finally must not end a newer load');eq(f.get('error'),'','Stale error must not replace latest request');}
 second.resolve(scenario==='older success after latest failure'?{ok:false,json:async()=>({error:'latest denied'})}:ok('new'));await newer;eq(f.get('loading'),false);eq(f.get('error'),scenario==='older success after latest failure'?'latest denied':'');
 const before=f.snapshot(),count=f.writes.length;
 if(scenario==='delayed old JSON')json.resolve(body('old'));else if(scenario!=='older failure while pending')first.resolve(ok('old'));await old;
 eq(f.snapshot(),before,scenario+': stale result changed current editor');eq(f.writes.length,count,scenario+': stale result wrote state');
 if(scenario!=='older success after latest failure')eq(f.get('items')[0].id,'new');
}
for(const outcome of ['success','network failure','JSON failure']){
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);const old=f.load();f.close();const before=f.snapshot(),count=f.writes.length;
 if(outcome==='network failure')pending.reject(Error('offline'));else pending.resolve(outcome==='JSON failure'?{ok:true,json:async()=>{throw Error('bad JSON');}}:ok('closed'));
 await old;eq(f.snapshot(),before,'Closed editor must ignore '+outcome);eq(f.writes.length,count,'Closed editor must not write state');
 const next=deferred();f.setFetcher(()=>next.promise);f.reopen();eq(f.get('loading'),true);next.resolve(ok('reopened'));await flush();eq(f.get('items')[0].id,'reopened');eq(f.get('loading'),false);eq(f.get('error'),'');
}
{
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);const old=f.load();f.unmount();const before=f.snapshot(),count=f.writes.length;pending.resolve(ok('unmounted'));await old;eq(f.snapshot(),before,'Unmount invalidates pending editor reads');eq(f.writes.length,count,'No state writes after unmount');
}
{
 const f=fixture();f.setFetcher(async()=>({ok:false,json:async()=>({error:'denied'})}));await f.load();eq(f.get('error'),'denied');eq(f.get('loading'),false);f.close();f.setFetcher(async()=>ok('retry'));f.reopen();await flush();eq(f.get('error'),'');eq(f.get('loading'),false);eq(f.get('items')[0].id,'retry');
}
console.log(`PASS ${checks}/${checks}: actual invoice editor overlapping loads, delayed JSON, close/reopen, failure retry and unmount guards; synthetic reads only.`);
