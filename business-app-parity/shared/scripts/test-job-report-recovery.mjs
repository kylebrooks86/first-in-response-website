import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='JobReport'),constant=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='reportChecks'));assert.ok(fn&&constant);
const names=[],tags=new Set();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,visit);}visit(fn);
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},flush=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const job=id=>({id,customerId:'customer',service:'Dryer vent'}),report=(id,notes='saved')=>({estimateId:id,customerId:'customer',checklist:'{"Before photos captured":true}',notes,airflowBefore:'1',airflowAfter:'2'}),ok=reports=>({ok:true,json:async()=>({reports})});
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
function fixture(){let state=[],refs=[],cursor=0,refCursor=0,effect,cleanup,estimate=job('first'),fetcher;const writes=[];let post=async()=>({ok:true,json:async()=>({})}),posts=0,savedCalls=0;const context={exports:{},require,Error,navigator:{onLine:true},...Object.fromEntries([...tags].map(t=>[t,()=>null])),useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{writes.push(names[i]);state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){effect=fn;},fetch:(url,options)=>{if(options?.method==='POST'){posts++;return post(JSON.parse(options.body));}eq(JSON.stringify(options),JSON.stringify({cache:'no-store'}),'Private report GET bypasses browser caches; no writes');eq(url,`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`);return fetcher();}};
vm.runInNewContext(ts.transpileModule(constant.getText(ast)+'\n'+fn.getText(ast)+'\nexports.view=JobReport;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const render=()=>{cursor=0;refCursor=0;return context.exports.view({estimate,onSaved(){savedCalls++;}});};render();
return {setPost:f=>post=f,get posts(){return posts;},get savedCalls(){return savedCalls;},get:k=>state[names.indexOf(k)],setFetcher:f=>fetcher=f,writes,render,open(value=estimate){cleanup?.();estimate=value;render().props.onOpenChange(true);render();cleanup=effect();},close(){render().props.onOpenChange(false);cleanup?.();render();cleanup=effect?.();},unmount(){cleanup?.();},retry(){const button=nodes(render()).find(n=>n.props?.children==='Retry loading report');assert.ok(button);button.props.onClick();cleanup?.();render();cleanup=effect();},assertBlocked(){const all=nodes(render());eq(all.filter(n=>n.type===context.Input||n.type===context.Textarea||n.type==='input').length,0,'Editor hidden until successful read');eq(all.some(n=>n.props?.children==='Save job report'),false);}};}
for(const scenario of ['old success','old failure','old JSON']){
 const f=fixture(),old=deferred(),fresh=deferred(),json=deferred();f.setFetcher(()=>old.promise);f.open();f.assertBlocked();if(scenario==='old JSON'){old.resolve({ok:true,json:()=>json.promise});await flush();}
 f.close();f.setFetcher(()=>fresh.promise);f.open(job('second'));fresh.resolve(ok([report('second','fresh')]));await flush();eq(f.get('notes'),'fresh');const count=f.writes.length;
 if(scenario==='old failure')old.reject(Error('offline'));else if(scenario==='old JSON')json.resolve({reports:[report('first')]});else old.resolve(ok([report('first')]));await flush();eq(f.get('notes'),'fresh');eq(f.writes.length,count,'Stale responses cannot write any state');eq(f.get('loadError'),'');
}
for(const action of ['close','unmount'])for(const outcome of ['success','failure']){
 const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);f.open();f[action]();const count=f.writes.length;if(outcome==='success')pending.resolve(ok([report('first')]));else pending.reject(Error('offline'));await flush();eq(f.writes.length,count,'Closed/unmounted request is invalid');
}
const invalid=[{ok:false,json:async()=>({reports:[report('first')]})},{ok:true,json:async()=>null},{ok:true,json:async()=>({})},{ok:true,json:async()=>({reports:{}})},{ok:true,json:async()=>{throw Error('bad JSON');}},ok([null]),ok([[]]),ok([report('other')]),ok([{...report('first'),customerId:'other'}]),ok([{...report('first'),notes:3}]),ok([{...report('first'),checklist:'broken'}]),ok([{...report('first'),checklist:'null'}]),ok([{...report('first'),checklist:'[]'}]),ok([{...report('first'),checklist:'{"Before photos captured":"true"}'}])];
for(const response of [...invalid,'network']){
 const f=fixture();f.setFetcher(async()=>ok([report('first','prior')]));f.open();await flush();eq(f.get('notes'),'prior');f.close();f.setFetcher(async()=>{if(response==='network')throw Error('offline');return response;});f.open();await flush();eq(f.get('loading'),false);eq(Boolean(f.get('loadError')),true);eq(f.get('notes'),'prior','Failed read does not partially replace data');f.assertBlocked();f.setFetcher(async()=>ok([]));f.retry();f.assertBlocked();await flush();eq(f.get('loadError'),'');for(const key of ['notes','before','after'])eq(f.get(key),'','No-report response clears prior form');eq(f.get('checks').length,0);
}
{
 const f=fixture();f.setFetcher(async()=>ok([report('first')]));f.open();await flush();eq(f.get('checks').join(','),'Before photos captured');eq(f.get('before'),'1');eq(f.get('after'),'2');f.close();f.setFetcher(async()=>ok([]));f.open(job('second'));f.assertBlocked();await flush();eq(f.get('notes'),'');eq(f.get('checks').length,0);
}
for(const outcome of ['success','failure']){
 const f=fixture();f.setFetcher(async()=>ok([]));f.open();await flush();
 const pending=deferred();let submitted;f.setPost(body=>{submitted=body;return pending.promise;});
 const button=nodes(f.render()).find(n=>n.props?.children==='Save draft report');assert.ok(button);
 button.props.onClick();button.props.onClick();eq(f.posts,1,'Same-frame repeated taps issue only one report POST');
 f.render().props.onOpenChange(false);eq(f.get('open'),true,'Report stays open while save pending');
 const fields=nodes(f.render()).filter(n=>n.type==='input'||n.props?.placeholder==='Before reading'||n.props?.placeholder==='After reading'||n.props?.placeholder?.startsWith('Condition,'));
 eq(fields.length>0,true);eq(fields.every(n=>n.props.disabled||n.props.readOnly),true,'Report fields freeze to the submitted snapshot');
 if(outcome==='success')pending.resolve({ok:true,json:async()=>({report:{...submitted,id:'saved-report',checklist:JSON.stringify(submitted.checklist),status:'draft'}})});else pending.reject(Error('Network interrupted'));
 await flush();eq(f.get('saving'),false);eq(f.savedCalls,outcome==='success'?1:0);eq(f.get('saved'),outcome==='success');
 if(outcome==='failure')eq(f.get('error'),'Network interrupted');
 f.render().props.onOpenChange(false);eq(f.get('open'),false,'Dialog unlocks after success or failure');
}
for(const mutate of [()=>undefined,r=>({...r,estimateId:'other'}),r=>({...r,customerId:'other'}),r=>({...r,notes:'not submitted'}),r=>({...r,status:'completed'}),r=>({...r,checklist:'invalid'}),r=>({...r,checklist:'{}'})]){
 const f=fixture();f.setFetcher(async()=>ok([]));f.open();await flush();
 f.setPost(async body=>({ok:true,json:async()=>({report:mutate({...body,id:'saved',checklist:JSON.stringify(body.checklist),status:'draft'})})}));
 nodes(f.render()).find(n=>n.props?.children==='Save draft report').props.onClick();await flush();
 eq(f.get('saved'),false,'HTTP success alone is not confirmed persistence');eq(f.savedCalls,0,'Unconfirmed result cannot advance job completion');
 eq(f.get('saving'),false);eq(f.get('error').includes('could not be confirmed'),true);
}
{
 const f=fixture();f.setFetcher(async()=>ok([]));f.open();await flush();
 for(const checkbox of nodes(f.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox').slice(0,6))checkbox.props.onChange();
 f.setPost(async body=>({ok:true,json:async()=>({report:{...body,id:'completed-report',checklist:JSON.stringify(body.checklist),status:'completed'}})}));
 nodes(f.render()).find(n=>n.props?.children==='Save completed report').props.onClick();await flush();
 eq(f.get('saved'),true,'Completed report requires matching server confirmation');eq(f.savedCalls,1);eq(f.get('saving'),false);
}
// Contact-free service completion is NOT a claim the customer attended.
// Both alternatives use the same historical JSON checklist without migration.
for(const mode of ['no-note','documented']){
 const f=fixture();f.setFetcher(async()=>ok([]));f.open();await flush();
 const boxes=nodes(f.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox');
 eq(boxes.length,7,'Owner sees original six checks plus explicit contact-free alternative');
 for(const box of boxes.slice(0,5))box.props.onChange();
 boxes.at(-1).props.onChange();
 eq(f.get('checks').includes('Customer walkthrough completed'),false,'Absent-customer choice never asserts customer walkthrough');
 eq(f.get('checks').includes('Customer absent — completion documented for follow-up'),true,'Distinct saved contact-free checklist key');
 let button=nodes(f.render()).find(n=>n.props?.children==='Save draft report');assert.ok(button);
 if(mode==='documented'){
  const note=nodes(f.render()).find(n=>n.props?.placeholder?.startsWith('Condition,'));
  assert.ok(note);note.props.onChange({target:{value:'Customer was not home; final photos captured and work noted for later follow-up.'}});
  button=nodes(f.render()).find(n=>n.props?.children==='Save completed report');assert.ok(button);
 }
 let submitted;
 f.setPost(async body=>{submitted=body;return{ok:true,json:async()=>({report:{...body,id:'owner-contact-free-report',checklist:JSON.stringify(body.checklist),status:body.status==='complete'?'completed':'draft'}})};});
 button.props.onClick();await flush();
 eq(submitted.status,mode==='documented'?'complete':'draft','Contact-free requires actual technician note before completed status');
 eq(submitted.checklist['Customer walkthrough completed'],false,'Saved row does not falsely say customer walkthrough occurred');
 eq(submitted.checklist['Customer absent — completion documented for follow-up'],true,'Saved row preserves alternative completion evidence');
 eq(f.get('saved'),true,'Actual D1-matching report response allows saved status');
 eq(f.savedCalls,1,'Report completion callback fires exactly once');
}
// Legacy six-key completed reports remain readable with their original
// walkthrough meaning and can be saved as complete without contact-free key.
{
 const f=fixture();const existing=Object.fromEntries(['Property condition documented','Before photos captured','Plants and fragile areas protected','Service completed as quoted','After photos captured','Customer walkthrough completed'].map(item=>[item,true]));
 f.setFetcher(async()=>ok([{...report('first'),checklist:JSON.stringify(existing)}]));f.open();await flush();
 eq(f.get('checks').length,6,'Legacy saved six-checkbox report retains checked state');
 eq(f.get('checks').includes('Customer absent — completion documented for follow-up'),false,'Legacy history does not imply customer absence');
 eq(Boolean(nodes(f.render()).find(n=>n.props?.children==='Save completed report')),true,'Legacy completed report remains eligible for saved completion');
}
{
 const f=fixture();f.setFetcher(async()=>ok([]));f.open();await flush();
 const boxes=nodes(f.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox');
 for(const b of boxes.slice(0,6))b.props.onChange();
 nodes(f.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox').at(-1).props.onChange();
 eq(f.get('checks').includes('Customer walkthrough completed'),false,'Switching to no-customer path removes walkthrough claim');
 eq(f.get('checks').includes('Customer absent — completion documented for follow-up'),true,'Switching paths keeps alternative only');
 nodes(f.render()).filter(n=>n.type==='input'&&n.props.type==='checkbox')[5].props.onChange();
 eq(f.get('checks').includes('Customer absent — completion documented for follow-up'),false,'Switching back to walkthrough removes contact-free marker');
}
console.log(`PASS ${checks}/${checks}: actual JobReport hooks/JSX cover stale close/reopen and delayed JSON, unmount, HTTP/network/collection/checklist/ownership failures, retry and empty-report reset; synthetic GET/POST mocks only; save locking, dismissal, field freeze and failure recovery.`);
