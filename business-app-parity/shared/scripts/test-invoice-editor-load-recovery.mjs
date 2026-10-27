/** Exercise the actual invoice editor hooks/handlers; synthetic records only. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EditInvoiceDialog'),names=[],tags=new Set();
const discountParser=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='parseDiscountCents');assert.ok(discountParser);
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,visit);}visit(fn);
const flush=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const job=(id='first')=>({id:'job-'+id,invoiceId:'invoice-'+id,customerId:'customer-'+id,service:'Synthetic wash',totalCents:20001,paidCents:5000});
const response=(id='first',quantity=.5)=>({ok:true,json:async()=>({invoice:{id:'invoice-'+id,estimateId:'job-'+id,customerId:'customer-'+id,discountType:'dollar',discountValue:0,items:[{id:'item-'+id,name:'Synthetic wash',description:'Synthetic only',quantity,unit:'hour',totalCents:20001}],revisions:[]}})});
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
function fixture(){let state=[],cursor=0,refs=[],refCursor=0,effect,cleanup,estimate=job(),fetcher;const requests=[],saved=[],writes=[];
 const context={require,exports:{},services:[],useServicePricing:()=>({services:[],rates:[],loading:false,error:""}),serviceDescriptionFor:()=>'',money:v=>String(v),dateTime:v=>v,...Object.fromEntries([...tags].map(t=>[t,()=>null])),
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{writes.push(names[i]);state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){effect=fn;},fetch:(url,options)=>{requests.push({url,options});if(!options?.method)eq(JSON.stringify(options),JSON.stringify({cache:'no-store'}),'Reload bypasses cached invoice');return fetcher(url,options);}};
 vm.runInNewContext(ts.transpileModule(readFileSync('lib/editable-line-totals.ts','utf8')+'\n'+discountParser.getText(ast)+'\n'+fn.getText(ast)+'\nexports.view=EditInvoiceDialog;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{cursor=0;refCursor=0;return context.exports.view({estimate,onSaved:value=>saved.push(value)});};render();cleanup=effect();
 return {requests,saved,writes,render,get:key=>state[names.indexOf(key)],setFetcher:f=>fetcher=f,open:()=>render().props.onOpenChange(true),close:()=>render().props.onOpenChange(false),switch(id){cleanup?.();estimate=job(id);render();cleanup=effect();},unmount:()=>cleanup?.(),nodes:()=>nodes(render()),button(label){return nodes(render()).find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).includes(label));}};
}
for(const failure of ['http','network','json','wrong-invoice','wrong-job','wrong-customer','no-items','invalid-items']){
 const f=fixture();f.setFetcher(async()=>response());f.open();await flush();eq(f.get('items')[0].quantity,.5);const staleSave=f.button('Save invoice changes').props.onClick;f.close();
 const pending=deferred();f.setFetcher(()=>pending.promise);f.open();eq(f.get('items').length,0,'Reopening clears previous services before reading');eq(f.get('loading'),true);eq(f.button('Save invoice changes'),undefined,'No save action while loading');
 staleSave();eq(f.requests.filter(r=>r.options?.method==='PATCH').length,0,'Retained stale handler cannot save before verified load');
 if(failure==='network')pending.reject(Error('Synthetic offline'));
 else if(failure==='json')pending.resolve({ok:true,json:async()=>{throw Error('Synthetic malformed JSON');}});
 else if(failure==='http')pending.resolve({ok:false,json:async()=>({error:'Synthetic unavailable'})});
 else{const data=await response().json();if(failure==='wrong-invoice')data.invoice.id='invoice-other';if(failure==='wrong-job')data.invoice.estimateId='job-other';if(failure==='wrong-customer')data.invoice.customerId='customer-other';if(failure==='no-items')delete data.invoice.items;if(failure==='invalid-items')data.invoice.items[0].totalCents=-1;pending.resolve({ok:true,json:async()=>data});}
 await flush();eq(f.get('loading'),false);eq(f.get('items').length,0);eq(Boolean(f.get('loadError')),true);eq(f.button('Save invoice changes'),undefined,'Load failure cannot expose replacement services');eq(f.nodes().some(n=>n.props?.role==='alert'),true);
 f.setFetcher(async()=>response());f.button('Try loading invoice again').props.onClick();await flush();eq(f.get('loadError'),'');eq(f.get('items')[0].quantity,.5);eq(Boolean(f.button('Save invoice changes')),true,'Explicit retry restores verified editing');
 f.setFetcher(async(_url,options)=>{eq(options.method,'PATCH');const body=JSON.parse(options.body);eq(body.items[0].quantity,.5);eq(body.items[0].totalCents,20001);return {ok:true,json:async()=>({invoice:{id:'invoice-first',totalCents:20001}})};});f.button('Save invoice changes').props.onClick();await flush();eq(f.saved[0],20001);eq(f.get('open'),false);
}
for(const outcome of ['success','failure','delayed-json']){
 const f=fixture(),old=deferred(),newer=deferred(),json=deferred();f.setFetcher(url=>url.endsWith('first')?old.promise:newer.promise);f.open();
 if(outcome==='delayed-json'){old.resolve({ok:true,json:()=>json.promise});await flush();}
 f.switch('second');f.open();newer.resolve(response('second',.25));await flush();eq(f.get('items')[0].quantity,.25);const count=f.writes.length;
 if(outcome==='failure')old.reject(Error('Synthetic late failure'));else if(outcome==='delayed-json')json.resolve(await response().json());else old.resolve(response());await flush();eq(f.get('items')[0].id,'item-second');eq(f.writes.length,count,'Old invoice read cannot change selected record');
}
for(const action of ['close','unmount']){
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);f.open();f[action]();const count=f.writes.length;pending.resolve(response());await flush();eq(f.writes.length,count,'Closed/unmounted load is ignored');eq(f.saved.length,0);
}
for(const leave of ['switch','unmount']){
 const f=fixture();f.setFetcher(async()=>response());f.open();await flush();const pending=deferred();f.setFetcher(()=>pending.promise);f.button('Save invoice changes').props.onClick();
 if(leave==='switch')f.switch('second');else f.unmount();pending.resolve({ok:true,json:async()=>({invoice:{id:'invoice-first',totalCents:20001}})});await flush();eq(f.saved.length,0,'Late save cannot notify a different or unmounted job');
}
for(const payload of [{invoice:{}},{invoice:{id:'invoice-other',totalCents:20001}},{invoice:{id:'invoice-first',totalCents:-1}},{invoice:{id:'invoice-first',totalCents:'20001'}}]){
 const f=fixture();f.setFetcher(async()=>response());f.open();await flush();f.setFetcher(async()=>({ok:true,json:async()=>payload}));f.button('Save invoice changes').props.onClick();await flush();eq(f.saved.length,0);eq(f.get('open'),true);eq(Boolean(f.get('error')),true,'Unconfirmed response cannot report saved totals');
}
console.log(`PASS ${checks}/${checks}: actual invoice editor hides stale services on failed load, verifies ownership, retries safely, preserves fractional quantities/cents, ignores stale/closed reads and refuses unconfirmed save responses.`);
