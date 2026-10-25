import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');assert.ok(fn);
const names=[],tags=new Set();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,visit);}visit(fn);
const keys=['customers','estimates','notes','invoices','photos','messages','payments'],body=id=>({...Object.fromEntries(keys.map(k=>[k,[]])),customers:[{id,name:id,estimateCount:0,estimateTotal:0,paidTotal:0}]});const ok=data=>({ok:true,json:async()=>data}),defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};const flush=()=>new Promise(r=>setImmediate(r));let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
const sharedHelpers={};
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-balance-summary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/message-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-activity-flags.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/offline-photo-availability.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
function fixture(){let state=[],refs=[],cursor=0,refCursor=0,effect,fetcher;const writes=[];const context={exports:{},require,...sharedHelpers,navigator:{onLine:true},saveOfflinePhotoCustomerDirectory:async()=>0,loadOfflinePhotoCustomerDirectory:async()=>[],clearOfflinePhotoCustomerDirectory:async()=>{},...Object.fromEntries([...tags].map(t=>[t,()=>null])),money:c=>String(c),dateTime:v=>v,statusLabel:v=>v,resolvedBillingTotalCents:e=>e.totalCents,billingBalanceCents:e=>Math.max(0,e.totalCents-e.paidCents),
useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{writes.push(names[i]);state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){if(String(fn).includes("void load()"))effect=fn;},fetch:(url,options)=>{eq(url,'/api/customers');eq(options?.cache,'no-store','Owner customer GET cannot read cached private records');return fetcher();}};
const source=fn.getText(ast).replace('  useEffect(() => { void load();','  exports.load=load;\n  useEffect(() => { void load();');vm.runInNewContext(ts.transpileModule(source+'\nexports.view=CustomersView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);const render=()=>{cursor=0;refCursor=0;return context.exports.view({searchQuery:'',onEstimateSaved(){throw Error('No writes allowed');}});};render();return {render,load:(quiet=false)=>context.exports.load(quiet),get:k=>state[names.indexOf(k)],set:(k,v)=>state[names.indexOf(k)]=v,snapshot:()=>JSON.stringify(keys.map(k=>state[names.indexOf(k)])),setFetcher:f=>fetcher=f,cleanup:()=>effect(),writes};}
for(const scenario of ['older success','older failure while pending','older success after latest error','unmount']){
 const f=fixture(),old=defer(),latest=defer();let round=old;f.setFetcher(()=>round.promise);const pending=f.load();round=latest;
 if(scenario==='unmount'){f.cleanup()();const before=f.snapshot(),count=f.writes.length;old.resolve(ok(body('old')));await pending;await flush();eq(f.snapshot(),before);eq(f.writes.length,count,'Unmounted customer loader wrote state');continue;}
 const newer=f.load();if(scenario==='older failure while pending'){old.reject(Error('old offline'));await pending;eq(f.get('loading'),true);eq(f.get('error'),'');}
 latest.resolve(scenario==='older success after latest error'?{ok:false,json:async()=>({error:'latest denied'})}:ok(body('new')));await newer;const before=f.snapshot(),error=f.get('error'),count=f.writes.length;
 if(scenario!=='older failure while pending'){old.resolve(ok(body('old')));await pending;}
 eq(f.snapshot(),before,'Stale customer response changed latest collections');eq(f.get('error'),error);eq(f.writes.length,count);eq(f.get('loading'),false);
}
const failures=[()=>({ok:false,json:async()=>({error:'denied'})}),()=>{throw Error('offline');},()=>({ok:true,json:async()=>{throw Error('bad JSON');}}),()=>ok(null)];
for(const key of keys)for(const value of [undefined,{},[null],[{}]])failures.push(()=>ok({...body('broken'),[key]:value}));
for(const value of [null,'',false,NaN,{}])failures.push(()=>ok({...body('broken'),customers:[{...body('broken').customers[0],estimateTotal:value}]}));
failures.push(()=>ok({...body('broken'),customers:[{...body('broken').customers[0],name:null}]}));
for(const [key,row] of [['estimates',{id:'bad',totalCents:100,depositCents:50,paidCents:null}],['invoices',{id:'bad',totalCents:''}],['photos',{id:'bad',sizeBytes:false}],['payments',{id:'bad',amountCents:{}}]])failures.push(()=>ok({...body('broken'),[key]:[row]}));
for(const value of ['1.5','9007199254740992',1.25])failures.push(()=>ok({...body('broken'),customers:[{...body('broken').customers[0],estimateTotal:value}]}));
for(const [key,row] of [
 ['estimates',{id:'e-fraction',totalCents:'99.5',depositCents:100,paidCents:0}],
 ['estimates',{id:'e-overflow',totalCents:'9007199254740992',depositCents:100,paidCents:0}],
 ['invoices',{id:'i-fraction',totalCents:0.75}],
 ['payments',{id:'p-overflow',amountCents:'9007199254740992'}],
 ['photos',{id:'ph-fraction',sizeBytes:0.5}]
])failures.push(()=>ok({...body('broken'),[key]:[row]}));
for(const key of keys){
 const item=key==='customers'?body('broken').customers[0]:{id:'duplicate',customerId:'broken'};
 failures.push(()=>ok({...body('broken'),[key]:[item,{...item}]}));
}
for(const failure of failures)for(const selected of [false,true]){
 const f=fixture();f.setFetcher(async()=>ok(body('saved')));await f.load();if(selected)f.set('selectedId','saved');const before=f.snapshot();f.setFetcher(failure);await f.load();eq(f.get('loading'),false);eq(Boolean(f.get('error')),true,'Bad collections must fail');eq(f.snapshot(),before,'Failure must preserve all prior collections atomically');
 const tree=nodes(f.render());eq(tree.some(n=>n.props?.className==='customer-snapshot'),false,'Failed profile must hide totals');eq(tree.some(n=>n.props?.className==='customer-list'),false);const retry=tree.find(n=>n.props?.children==='Try again');assert.ok(retry);checks++;
 f.setFetcher(async()=>ok(body('saved')));retry.props.onClick();eq(nodes(f.render()).some(n=>n.props?.className==='customer-snapshot'),false,'Pending profile must hide totals');await flush();eq(f.get('error'),'');eq(f.get('loading'),false);eq(f.get('customers')[0].id,'saved');eq(nodes(f.render()).some(n=>n.props?.className===(selected?'customer-snapshot':'customer-list')),true);
}
// A confirmed save elsewhere must refresh this view from the authenticated
// source, and a failed quiet refresh must not silently claim a clean state.
{
 const f=fixture();f.setFetcher(async()=>ok(body('saved')));await f.load();
 f.set('selectedId','saved');
 f.setFetcher(async()=>{throw Error('temporary offline');});await f.load(true);
 eq(f.get('refreshIssue'),true,'Failed post-save refresh makes stale activity explicit');
 eq(f.get('error'),'','Quiet refresh preserves prior confirmed records for recovery');
 eq(f.get('customers')[0].id,'saved','Quiet refresh does not replace saved records with unverified data');
 const screen=nodes(f.render());
 eq(screen.some(n=>n.props?.role==='alert'),'true'==='true','Failed refresh exposes an accessible warning');
 const retry=screen.find(n=>n.props?.children==='Refresh customer history');assert.ok(retry);checks++;
 f.setFetcher(async()=>ok(body('saved')));retry.props.onClick();await flush();
 eq(f.get('refreshIssue'),false,'Verified refresh clears stale-history warning');
 eq(f.get('error'),'','Verified refresh restores normal profile state');
 const source=readFileSync('app/dashboard.tsx','utf8');
 eq(source.includes('window.addEventListener("fire:attention-saved",refresh)'),true,'Profile listens for confirmed save events');
 eq(source.includes('return()=>window.removeEventListener("fire:attention-saved",refresh)'),true,'Profile cleans up save listener');
}
// Customer directory stays compact without obscuring useful property/contact context.
{
 const f=fixture();
 const b=body('saved');
 const row={...b.customers[0],name:'Synthetic Customer',address:'123 Synthetic Street, Tulsa, OK',phone:'9185550101'};
 f.setFetcher(async()=>ok({...b,customers:[row]}));await f.load();
 const card=()=>nodes(f.render()).find(n=>n.props?.className==='customer-card');
 const details=()=>nodes(card()).find(n=>n.type==='small');
 eq(details().props.children,'123 Synthetic Street, Tulsa, OK · 9185550101','Directory shows property and contact in one compact line');
 eq(nodes(card()).some(n=>n.props?.className==='customer-totals'),false,'New customer hides unhelpful zero estimate total');
 eq(typeof card().props.onClick,'function','Directory card still opens exact saved customer');
 f.setFetcher(async()=>ok({...b,customers:[{...row,estimateCount:2,estimateTotal:12000}]}));await f.load();
 eq(nodes(card()).some(n=>n.props?.className==='customer-totals'),true,'Saved estimate totals remain visible when present');
 f.setFetcher(async()=>ok({...b,customers:[{...row,address:'',phone:'',email:''}]}));await f.load();
 eq(details().props.children,'Add address or contact','Missing details have a concise, useful cue');
}
const directoryCss=readFileSync('app/globals.css','utf8');
assert.ok(directoryCss.includes('.customers-view>.customer-list .customer-card{gap:10px;min-height:60px'),'Compact directory leaves a full-size touch target');
assert.ok(directoryCss.includes('.customers-view>.customer-list .customer-main small{overflow-wrap:anywhere'),'Long addresses cannot spill outside mobile customer cards');
console.log(`PASS ${checks}/${checks}: actual CustomersView load/retry/profile gating, post-save refresh recovery, atomic collections and stale/error/unmount responses; synthetic GET only.`);
