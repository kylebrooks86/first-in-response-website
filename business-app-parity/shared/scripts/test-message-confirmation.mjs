/** Execute the actual composer confirmation handler; synthetic responses only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const composer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MessageComposer');
let declaration;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='confirmSent')declaration=n;ts.forEachChild(n,visit);}visit(composer);assert.ok(declaration);
const code=ts.transpileModule('exports.confirm='+declaration.initializer.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const draft={id:'saved-draft',customerId:'synthetic-customer',estimateId:'synthetic-job',template:'review',body:'Exact review text',channel:'text_prepared',createdAt:'2026-10-21T12:00:00Z'};
let count=0;const check=(condition,label)=>{assert.ok(condition,label);count++};
function fixture(options={}){
 const state={working:false,status:'',prepared:draft,pending:[draft],logged:[],sent:[],events:[],requests:[]};
 const scope={current:1},lock={current:false};
 const context={exports:{},preparedMessage:draft,preparationLock:lock,messageScope:scope,customer:{id:draft.customerId},initialTemplate:'review',Event,
 setWorking:v=>state.working=v,setMessageStatus:v=>state.status=v,setPreparedMessage:v=>state.prepared=v,setPendingMessages:fn=>state.pending=fn(state.pending),
 onLogged:m=>state.logged.push(m),onSent:async(...args)=>{state.sent.push(args);if(options.refreshError)throw Error('Synthetic refresh failure');},window:{dispatchEvent:e=>state.events.push(e.type)},
 fetch:async(url,init)=>{state.requests.push({url,...JSON.parse(init.body)});if(options.wait)await options.wait;if(options.offline)throw Error('Synthetic network interrupted');return {ok:options.ok!==false,json:async()=>options.payload??{message:{...draft,id:draft.id+':owner-confirmed',channel:'text_confirmed',createdAt:'2026-10-22T12:00:00Z'}}};}};
 vm.runInNewContext(code,context);return {state,scope,lock,confirm:context.exports.confirm};
}
for(const [field,value] of Object.entries({id:'foreign-id',customerId:'foreign',estimateId:'foreign',template:'invoice',body:'Changed text',channel:'text_prepared',createdAt:'invalid'})){
 const f=fixture({payload:{message:{...draft,id:draft.id+':owner-confirmed',channel:'text_confirmed',[field]:value}}});await f.confirm();
 check(f.state.logged.length===0&&f.state.sent.length===0&&f.state.events.length===0,'Wrong '+field+' cannot publish confirmation or refresh attention');
 check(f.state.prepared===draft&&f.state.pending.length===1&&!f.state.working&&!f.lock.current,'Wrong '+field+' retains exact draft and unlocks explicit retry');
}
for(const options of [{payload:{}},{ok:false,payload:{error:'Synthetic unavailable'}},{offline:true}]){
 const f=fixture(options);await f.confirm();check(f.state.prepared===draft&&f.state.logged.length===0&&f.state.sent.length===0,'Missing/failed/interrupted confirmation preserves draft');
}
let release;const wait=new Promise(r=>release=r),rapid=fixture({wait});const first=rapid.confirm();await rapid.confirm();
check(rapid.state.requests.length===1&&rapid.state.working,'Duplicate synchronous taps issue one request');release();await first;
check(rapid.state.prepared===null&&rapid.state.pending.length===0&&rapid.state.sent.length===1,'Exact verified receipt clears only matching pending draft');
check(rapid.state.events.join()==='fire:attention-saved','Only verified save refreshes attention');
const refresh=fixture({refreshError:true});await refresh.confirm();check(refresh.state.status.includes('Send confirmation saved.')&&refresh.state.prepared===null,'Refresh failure cannot relabel a verified saved confirmation as unsaved');
let lateRelease;const late=fixture({wait:new Promise(r=>lateRelease=r)});const work=late.confirm();late.scope.current++;lateRelease();await work;
check(late.state.logged.length===0&&late.state.sent.length===0&&late.state.events.length===0,'Late response from an old customer/job scope cannot update active records');
console.log(`PASS ${count} actual composer confirmation assertions; synthetic receipts, rapid taps, scope isolation and recovery.`);

// Execute the actual preparation and email handlers, including API normalization
// and a lost acknowledgement. No OS apps, provider or customer messages.
const declarationFor=name=>{let found;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)found=node;ts.forEachChild(node,walk);}walk(composer);assert.ok(found,name);return found.initializer.getText(ast);};
const preparationCode=ts.transpileModule('exports.log='+declarationFor('log')+';exports.email='+declarationFor('sendEmail'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function prepareFixture(options={}){
 const state={requests:[],status:'',prepared:null,pending:[],logged:[],working:false,timers:[]};
 const scope={current:1},lock={current:false},operation={current:null};
 const context={exports:{},body:options.body??'  Hello\nFIRE customer  ',customer:{id:'customer'},estimate:{id:'job'},template:'custom',crypto,Event,AbortController,
 preparationLock:lock,messageScope:scope,uncertainPreparation:operation,
 setTimeout:fn=>{state.timers.push(fn);return state.timers.length;},clearTimeout:()=>{},
 setWorking:v=>state.working=v,setMessageStatus:v=>state.status=v,setPreparedMessage:v=>state.prepared=v,setPendingMessages:fn=>state.pending=fn(state.pending),onLogged:v=>state.logged.push(v),window:{dispatchEvent:()=>{}},
 fetch:async(url,init)=>{const payload=JSON.parse(init.body);state.requests.push(payload);if(options.hang)return await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('Interrupted'))));if(options.wait)await options.wait;
 return{ok:options.ok!==false,json:async()=>({message:{...payload,id:'owner-message-prep:'+payload.requestId,body:options.wrong?'different':payload.body.trim(),createdAt:'2026-10-30T12:00:00Z'}})};}};
 vm.runInNewContext(preparationCode,context);context.log=context.exports.log;
 return {state,scope,lock,operation,log:context.exports.log,email:context.exports.email};
}
const normalized=prepareFixture();check(await normalized.log('text_prepared')===true,'Surrounding whitespace no longer rejects a valid trimmed server receipt');
check(normalized.state.prepared.body==='Hello\nFIRE customer'&&normalized.state.requests[0].body==='Hello\nFIRE customer','Exact normalized body preserves internal line breaks in saved handoff');
const empty=prepareFixture({body:' \n '});check(await empty.log('text_prepared')===false&&empty.state.requests.length===0,'Whitespace-only draft never writes a prepared record');
const wrong=prepareFixture({wrong:true});check(await wrong.log('text_prepared')===false&&wrong.state.prepared===null,'Actually conflicting server body still blocks handoff');
const email=prepareFixture();await email.email();check(email.state.prepared.channel==='email_prepared'&&email.state.status.includes('Open email app'),'Email preparation exposes an explicit user-gesture handoff without opening an OS app after an awaited fetch');
let unlock;const delayed=prepareFixture({wait:new Promise(resolve=>unlock=resolve)});const preparing=delayed.log('text_prepared');await delayed.log('text_prepared');check(delayed.state.requests.length===1&&delayed.state.status==='Preparing message…','Immediate progress and lock prevent duplicate same-frame preparations');delayed.scope.current++;unlock();await preparing;check(delayed.state.prepared===null,'Late receipt from another customer scope never produces a handoff');
const interrupted=prepareFixture({hang:true});const pending=interrupted.log('text_prepared');interrupted.state.timers[0]();await pending;
check(!interrupted.state.working&&!interrupted.lock.current&&interrupted.operation.current!==null,'Timed-out preparation unlocks with the same operation retained; no automatic resend');
const originalRequest=interrupted.state.requests[0].requestId;
const retried=interrupted.log('text_prepared');interrupted.state.timers[1]();await retried;
check(interrupted.state.requests[1].requestId===originalRequest,'Deliberate unchanged retry reuses original idempotency key after timeout');
console.log('PASS '+count+' combined actual composer confirmation/preparation assertions; no external sends.');
