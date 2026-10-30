/** Actual customer profile/note handlers with synthetic records and deferred responses. */
import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';let lastNoteId;import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const flush=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
function nodes(tree){const result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;result.push(n);walk(n.props?.children);}walk(tree);return result;}
const customer=id=>({id,name:'Synthetic '+id,email:'qa-'+id+'@example.invalid',phone:'',address:'Synthetic address',leadSource:'Unknown',createdAt:'2026-10-19',estimateCount:0,estimateTotal:0,paidTotal:0});
const helpers={};for(const file of ['customer-balance-summary.ts','message-history.ts','customer-activity-flags.ts','offline-photo-availability.ts','customer-contact-links.ts']){const c={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);Object.assign(helpers,c.exports);}
function fixture(name,editRecord=null){const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name),states=[],tags=new Set();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')states.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,visit);}visit(fn);
 let state=[],cursor=0,refs=[],refCursor=0,effects=[],fetcher,currentCustomer=editRecord??customer('first');const requests=[],updated=[];
 const context={exports:{},require,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=>lastNoteId=randomUUID()},...helpers,...Object.fromEntries([...tags].map(t=>[t,()=>null])),navigator:{onLine:true},money:String,dateTime:String,statusLabel:String,resolvedBillingTotalCents:r=>r.totalCents,billingBalanceCents:r=>Math.max(0,r.totalCents-r.paidCents),saveOfflinePhotoCustomerDirectory:async()=>{},loadOfflinePhotoCustomerDirectory:async()=>[],clearOfflinePhotoCustomerDirectory:async()=>{},
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){effects.push(fn);},fetch:(url,options)=>{requests.push({url,options});return fetcher(url,options);}};
 const source=fn.getText(ast).replace('  // The server-backed customer workflow','  exports.load=load;\n  // The server-backed customer workflow');
 vm.runInNewContext(ts.transpileModule(source+`\nexports.view=${name};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{cursor=0;refCursor=0;effects=[];return context.exports.view(name==='EditCustomer'?{customer:currentCustomer,onUpdated:r=>updated.push(r)}:{searchQuery:'',onEstimateSaved(){}});};
 const get=k=>state[states.indexOf(k)],set=(k,v)=>state[states.indexOf(k)]=v;
 render();let cleanup;
 if(name==='CustomersView'){set('customers',[customer('first'),customer('second')]);set('selectedId','first');set('section','notes');set('loading',false);render();effects.find(f=>String(f).includes('noteDraftCustomer.current'))();cleanup=effects.find(f=>String(f).includes('noteMounted.current'))();}
 else cleanup=effects[0]();
 const button=label=>nodes(render()).find(n=>n.props?.onClick&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.trim()===label));
 return {render,get,set,requests,updated,button,setFetcher:f=>fetcher=f,unmount:()=>cleanup?.(),load:()=>context.exports.load(),switch(id){if(name==='EditCustomer'){currentCustomer=customer(id);render();}else{set('selectedId',id);render();effects.find(f=>String(f).includes('noteDraftCustomer.current'))();render();}},draft(value){const input=nodes(render()).find(n=>n.props?.id==='customer-note-draft-'+get('selectedId'));input.props.onChange({target:{value}});render();},noteInput:()=>nodes(render()).find(n=>n.props?.id==='customer-note-draft-'+get('selectedId'))};
}
const note=(customerId='first',body='Synthetic gate note')=>({id:lastNoteId,customerId,body,createdAt:'2026-10-19T12:00:00Z'});
for(const kind of ['success','http','network','json','wrong-customer','wrong-body','missing-id','wrong-request','bad-date']){
 const f=fixture('CustomersView'),pending=deferred();f.draft('  Synthetic gate note  ');f.setFetcher(()=>pending.promise);const add=f.button('Add note');add.props.onClick();add.props.onClick();eq(f.requests.length,1,'Same-frame note taps submit once');eq(f.noteInput().props.disabled,true);eq(JSON.parse(f.requests[0].options.body).body,'Synthetic gate note');
 if(kind==='network')pending.reject(Error('Synthetic offline'));else if(kind==='json')pending.resolve({ok:true,json:async()=>{throw Error('Malformed JSON');}});
 else{const row=note();if(kind==='wrong-customer')row.customerId='second';if(kind==='wrong-body')row.body='Different text';if(kind==='missing-id')delete row.id;if(kind==='wrong-request')row.id=randomUUID();if(kind==='bad-date')row.createdAt='bad';pending.resolve({ok:kind!=='http',json:async()=>({note:row})});}
 await flush();eq(f.get('savingNote'),false);eq(f.noteInput().props.disabled,false);
 if(kind==='success'){eq(f.get('notes').length,1);eq(f.get('noteText'),'');eq(f.get('noteFeedback').kind,'success');}
 else{eq(f.get('notes').length,0);eq(f.get('noteText'),'  Synthetic gate note  ');eq(f.get('noteFeedback').kind,'error');eq(Boolean(f.button('Refresh saved notes')),true);f.setFetcher(async()=>({ok:true,json:async()=>({note:note()})}));f.button('Add note').props.onClick();await flush();eq(f.get('notes').length,1);eq(f.get('noteText'),'');eq(JSON.parse(f.requests.at(-1).options.body).requestId,JSON.parse(f.requests[0].options.body).requestId,'Retry preserves exact request identity');}
}
for(const outcome of ['success','failure']){
 const f=fixture('CustomersView'),pending=deferred();f.draft('Synthetic gate note');f.setFetcher(()=>pending.promise);f.button('Add note').props.onClick();f.switch('second');f.draft('Second customer draft');
 if(outcome==='success')pending.resolve({ok:true,json:async()=>({note:note()})});else pending.reject(Error('Offline'));
 await flush();eq(f.get('noteText'),'Second customer draft','Late response cannot clear another customer draft');eq(f.get('selectedId'),'second');eq(nodes(f.render()).some(n=>(n.props?.role==='alert'||n.props?.role==='status')&&['save-error','save-success'].includes(n.props?.className)),false,'Other customer feedback is not shown');
 f.switch('first');eq(f.get('noteText'),outcome==='success'?'':'Synthetic gate note');f.switch('second');eq(f.get('noteText'),'Second customer draft');
}
{
 const f=fixture('CustomersView'),pending=deferred();f.draft('Synthetic gate note');f.setFetcher(()=>pending.promise);f.button('Add note').props.onClick();f.unmount();pending.resolve({ok:true,json:async()=>({note:note()})});await flush();eq(f.get('notes').length,0);
}
{
 const f=fixture('CustomersView'),pending=deferred();f.draft('Synthetic gate note');f.setFetcher((url,options)=>options?.method?pending.promise:Promise.resolve({status:401,ok:false,json:async()=>({error:'Unauthorized'})}));f.button('Add note').props.onClick();await f.load();pending.resolve({ok:true,json:async()=>({note:note()})});await flush();eq(f.get('notes').length,0,'Authentication denial invalidates pending note response');eq(f.get('customers').length,0);eq(f.get('selectedId'),null);
}
for(const kind of ['success','http','network','json','wrong-customer','wrong-fields']){
 const f=fixture('EditCustomer'),pending=deferred();f.render().props.onOpenChange(true);f.set('name',' Synthetic updated ');f.setFetcher(()=>pending.promise);const save=f.button('Save changes');save.props.onClick();save.props.onClick();eq(f.requests.length,1);const payload=JSON.parse(f.requests[0].options.body);eq(payload.name,'Synthetic updated');f.render().props.onOpenChange(false);eq(f.get('open'),true,'Customer editor remains open during save');eq(nodes(f.render()).some(n=>n.type==='fieldset'&&n.props.disabled),true);
 if(kind==='network')pending.reject(Error('Offline'));else if(kind==='json')pending.resolve({ok:true,json:async()=>{throw Error('Malformed JSON');}});else{const row={...customer('first'),...payload};if(kind==='wrong-customer')row.id='second';if(kind==='wrong-fields')row.name='Unconfirmed';pending.resolve({ok:kind!=='http',json:async()=>({customer:row})});}
 await flush();eq(f.get('saving'),false);
 if(kind==='success'){eq(f.updated.length,1);eq(f.get('open'),false);}else{eq(f.updated.length,0);eq(f.get('open'),true);eq(Boolean(f.get('error')),true);eq(f.get('name'),' Synthetic updated ');f.render().props.onOpenChange(false);eq(f.get('open'),false);}
}
// Exact real-world failure: API returns SQL NULL for missing email/phone
// when an address-only QA customer is being edited. Save must not throw
// before entering its try/catch or silently remain open without a request.
for(const missing of ['email','phone','address','all']){
 const initial={...customer('first'),email:'synthetic@example.invalid',phone:'9185550123',address:'123 Synthetic Street'};
 if(missing==='all'){initial.email=null;initial.phone=null;initial.address=null;}
 else initial[missing]=null;
 const f=fixture('EditCustomer',initial),pending=deferred();
 f.render().props.onOpenChange(true);
 f.set('name','  Synthetic updated  ');
 if(missing==='email'||missing==='all')f.set('phone','9185550175');
 if(missing==='phone'||missing==='all')f.set('email','update@example.invalid');
 f.setFetcher(()=>pending.promise);
 f.button('Save changes').props.onClick();
 eq(f.requests.length,1,'Nullable '+missing+' customer edit must submit exactly once');
 const sent=JSON.parse(f.requests[0].options.body);
 eq(sent.name,'Synthetic updated');
 for(const field of ['email','phone','address'])
   eq(typeof sent[field],'string','Customer PATCH always contains strings, field '+field);
 const receipt={...initial,...sent};
 pending.resolve({ok:true,json:async()=>({customer:receipt})});
 await flush();
 eq(f.get('saving'),false);
 eq(f.updated.length,1,'Existing nullable customer can be edited');
 eq(f.get('open'),false,'Successful nullable edit closes form');
}

for(const leave of ['switch','unmount']){
 const f=fixture('EditCustomer'),pending=deferred();f.render().props.onOpenChange(true);f.setFetcher(()=>pending.promise);f.button('Save changes').props.onClick();if(leave==='switch')f.switch('second');else f.unmount();pending.resolve({ok:true,json:async()=>({customer:customer('first')})});await flush();eq(f.updated.length,0,'Late edit response cannot update a different/unmounted customer');
}
for(const name of ['EditCustomer','CustomersView']){
 const f=fixture(name);if(name==='CustomersView')f.draft('Original note');else f.render().props.onOpenChange(true);
 const callback=f.button(name==='CustomersView'?'Add note':'Save changes').props.onClick;f.switch('second');f.setFetcher(()=>{throw Error('Stale handler must not issue a request');});callback();await flush();eq(f.requests.length,0,'Stale customer handler cannot write after selection changes');
}
console.log(`PASS ${checks}/${checks}: actual customer note/edit handlers prevent duplicate taps, show recoverable failures, preserve customer-specific drafts, validate returned identity/content and ignore stale or unauthorized responses. Synthetic POST/PATCH only.`);
