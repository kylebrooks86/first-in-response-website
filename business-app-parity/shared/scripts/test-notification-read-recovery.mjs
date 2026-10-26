/** Run the actual NotificationBell with synthetic GET/PATCH races and failures. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='NotificationBell');
const bellSource=fn?.getText(ast)||'';
const css=readFileSync('app/globals.css','utf8');
assert.ok(bellSource.includes('aria-expanded={showActivity}'),'Recent activity toggle exposes expanded state');
assert.ok(bellSource.includes('hidden={!showActivity}'),'Read history can collapse without losing records');
assert.ok(bellSource.includes('activityExpanded??unread>0'),'Unread activity stays visible by default');
assert.ok(bellSource.includes('setActivityExpanded(null);setShowRead(false);setAttentionSummary'),'Opening bell resets to unread-aware default');
assert.ok(css.includes('.notification-list[hidden]{display:none}'),'Collapsed history is visually hidden');
assert.ok(css.includes('.notification-activity-toggle:focus-visible'),'Keyboard focus remains visible');

assert.ok(fn,'NotificationBell source exists');
const names=[],tags=new Set();
function inspect(n){
  if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}
  ts.forEachChild(n,inspect);
}
inspect(fn);
const code=ts.transpileModule(fn.getText(ast)+'\nexports.view=NotificationBell;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const make=(id,readAt=null)=>({id,type:'estimate_viewed',title:'Synthetic '+id,body:'Synthetic message',createdAt:'2026-10-19T19:00:00Z',readAt,estimateId:'synthetic-estimate'});
const original=[make('first'),make('second','2026-10-19T20:00:00Z')];
const ok=()=>({ok:true,json:async()=>({notifications:original,unread:1})});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(done=>setImmediate(done));
let checks=0;
function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
function nodes(tree){
  const values=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;values.push(n);visit(n.props?.children);}visit(tree);return values;
}
function fixture(){
  let state=[],refs=[],cursor=0,refCursor=0,effect,cleanup,handler=async()=>ok();const calls=[],navigation=[];
  const context={exports:{},require,...Object.fromEntries([...tags].map(t=>[t,()=>null])),dateTime:v=>v,
    useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]},
    useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
    useEffect(fn){effect=fn;},
    window:{setInterval:()=>101,clearInterval:()=>{}},
    fetch:(url,options)=>{calls.push({url,options});return handler(url,options);}
  };
  vm.runInNewContext(code,context);
  const render=()=>{cursor=0;refCursor=0;return context.exports.view({onNavigate:(...a)=>navigation.push(a)});};
  const query=()=>nodes(render());
  const get=name=>state[names.indexOf(name)];
  return {calls,navigation,render,query,get,fetch(fn){handler=fn;},
    mount(){render();cleanup=effect();},unmount(){cleanup?.();},
    markOne(){const unread=query().find(n=>n.type==='button'&&n.props?.className==='unread');assert.ok(unread,'Unread notification button exists');unread.props.onClick();},
    markAll(){const btn=query().find(n=>n.type==='button'&&n.props?.children==='Mark all as read');assert.ok(btn,'Mark all button exists');btn.props.onClick();},
    error(){return query().find(n=>n.props?.role==='alert')?.props.children;},
    status(){return query().find(n=>n.props?.role==='status')?.props.children;}
  };
}
{
  const f=fixture();f.mount();await flush();
  const toggle=()=>f.query().find(n=>n.type==='button'&&n.props?.className==='notification-activity-toggle');
  const activity=()=>f.query().find(n=>n.props?.id==='fire-notification-activity');
  eq(toggle().props['aria-expanded'],true,'Unread recent activity starts visible');
  eq(activity().props.hidden,false,'Unread notifications remain accessible without extra taps');
  toggle().props.onClick();eq(toggle().props['aria-expanded'],false,'Owner can collapse activity without marking any item read');
  eq(f.get('items').length,2,'Collapsing activity retains all saved notifications');
  toggle().props.onClick();eq(activity().props.hidden,false,'Owner can reopen activity');
  f.unmount();
}
{
  const f=fixture();
  f.fetch(async()=>({ok:true,json:async()=>({notifications:original.map(x=>({...x,readAt:'2026-10-19T23:00:00Z'})),unread:0})}));
  f.mount();await flush();
  eq(f.query().find(n=>n.type==='button'&&n.props?.className==='notification-activity-toggle').props['aria-expanded'],false,'Already-read history starts collapsed');
  f.unmount();
}
{
  const f=fixture();f.mount();await flush();
  eq(f.get('unread'),1,'Initial authenticated GET populates the correct unread count');
  eq(f.get('items').length,2,'Initial list retains both notifications');
  f.fetch(async()=>({ok:false,json:async()=>({error:'Session expired'})}));
  f.render().props.onOpenChange(true);await flush();
  eq(f.get('unread'),1,'HTTP failure never replaces prior unread badge with zero');
  eq(f.get('items').length,2,'HTTP failure never replaces saved notifications');
  eq(Boolean(f.error()),true,'Refresh failure gives visible feedback');
  f.fetch(async()=>({ok:true,json:async()=>({notifications:[],unread:0,error:'incomplete'})}));
  f.render().props.onOpenChange(true);await flush();
  eq(f.get('items').length,0,'Complete empty notifications collection is valid');
  f.unmount();
}
for(const kind of ['network','http','malformed','negative']){
  const f=fixture();f.mount();await flush();
  const patch=deferred();
  f.fetch((url,options)=>options?.method==='PATCH'?patch.promise:Promise.resolve(ok()));
  f.markOne();f.markOne();
  eq(f.calls.filter(x=>x.options?.method==='PATCH').length,1,kind+': repeated taps cannot issue duplicate PATCH');
  eq(f.get('unread'),1,kind+': badge stays unread while unconfirmed');
  eq(f.get('items')[0].readAt,null,kind+': row stays unread while unconfirmed');
  eq(f.get('busy'),true,kind+': mutation shows activity');
  if(kind==='network')patch.reject(Error('offline'));
  if(kind==='http')patch.resolve({ok:false,json:async()=>({error:'Not authorized'})});
  if(kind==='malformed')patch.resolve({ok:true,json:async()=>({ok:true})});
  if(kind==='negative')patch.resolve({ok:true,json:async()=>({ok:false,readAt:'2026-10-19T22:00:00Z'})});
  await flush();
  eq(f.get('unread'),1,kind+': rejected PATCH never clears unread badge');
  eq(f.get('items')[0].readAt,null,kind+': rejected PATCH never marks row read');
  eq(f.get('busy'),false,kind+': mutation unlocks after failed PATCH');
  eq(Boolean(f.error()?.includes('not confirmed')),true,kind+': failed PATCH gives durable warning');
  eq(f.navigation.length,2,kind+': navigation remains available during uncertain PATCH');
  f.unmount();
}
{
  const f=fixture();f.mount();await flush();
  let current=original,patch=deferred();
  f.fetch((url,options)=>options?.method==='PATCH'?patch.promise:Promise.resolve({ok:true,json:async()=>({notifications:current,unread:current.filter(x=>!x.readAt).length})}));
  f.markOne();eq(f.get('unread'),1,'Confirmed write has not happened yet');
  current=[{...original[0],readAt:'2026-10-19T22:00:00Z'},original[1]];
  patch.resolve({ok:true,json:async()=>({ok:true,readAt:'2026-10-19T22:00:00Z'})});await flush();await flush();
  eq(f.get('unread'),0,'Successful server response refreshes unread badge');
  eq(f.get('items')[0].readAt,'2026-10-19T22:00:00Z','Successful confirmation persists read status');
  eq(f.get('busy'),false,'Success unlocks mutation');
  eq(f.calls.filter(x=>x.options?.method==='PATCH').length,1,'Success sends one PATCH');
  f.unmount();
}
for(const success of [false,true]){
  const f=fixture();f.mount();await flush();
  let current=original;const patch=deferred();
  f.fetch((url,options)=>options?.method==='PATCH'?patch.promise:Promise.resolve({ok:true,json:async()=>({notifications:current,unread:current.filter(x=>!x.readAt).length})}));
  f.markAll();f.markAll();
  eq(f.calls.filter(x=>x.options?.method==='PATCH').length,1,'Mark all repeated clicks send one PATCH');
  eq(f.get('unread'),1,'Mark all does not clear unread until confirmed');
  if(success){
    current=original.map(x=>({...x,readAt:x.readAt||'2026-10-19T22:00:00Z'}));
    patch.resolve({ok:true,json:async()=>({ok:true,readAt:'2026-10-19T22:00:00Z'})});
  }else patch.reject(Error('Lost response'));
  await flush();await flush();
  eq(f.get('unread'),success?0:1,'Mark all '+success+' updates badge only after confirmation');
  eq(Boolean(f.get('items')[0].readAt),success,'Mark all '+success+' keeps correct read state');
  eq(f.get('busy'),false,'Mark all always unlocks');
  f.unmount();
}
{
  const f=fixture(),pendingGet=deferred();let seen=0;
  f.fetch((url,options)=>options?.method==='PATCH'?Promise.resolve({ok:true,json:async()=>({ok:true,readAt:'2026-10-19T22:00:00Z'})}):(++seen===1?Promise.resolve(ok()):seen===2?pendingGet.promise:Promise.resolve({ok:true,json:async()=>({notifications:original.map(x=>({...x,readAt:'2026-10-19T22:00:00Z'})),unread:0})})));
  f.mount();await flush();
  f.render().props.onOpenChange(true);eq(seen,2,'Second GET deliberately remains in flight');
  f.markOne();await flush();await flush();
  eq(f.get('unread'),0,'Confirmed mutation wins over in-flight GET');
  pendingGet.resolve(ok());await flush();
  eq(f.get('unread'),0,'Late pre-PATCH GET is rejected instead of restoring unread');
  f.unmount();
}
console.log('PASS '+checks+'/'+checks+': actual notification component validates reads and PATCH before changing badges, prevents duplicate writes and rejects stale network data. Synthetic requests only.');

{
 const f=fixture();f.mount();await flush();
 const list=()=>f.query().find(n=>n.props?.id==='fire-notification-activity');
 const rows=()=>nodes(list()).filter(n=>n.type==='button');
 eq(rows().length,1,'Read notifications are hidden from the default activity list');
 const show=f.query().find(n=>n.type==='button'&&n.props.children==='Show read notifications');show.props.onClick();
 eq(rows().length,2,'Read history remains available on request');
 eq(f.calls.filter(c=>c.options?.method==='PATCH').length,0,'Showing history changes no saved state');
 f.query().find(n=>n.type==='button'&&n.props.children==='Hide read notifications').props.onClick();eq(rows().length,1,'Hiding read history restores the unread list');
 f.fetch(async(url,options)=>options?.method==='PATCH'?{ok:true,json:async()=>({ok:true,readAt:'2026-10-26T20:00:00Z'})}:{ok:true,json:async()=>({notifications:original.map(n=>({...n,readAt:'2026-10-26T20:00:00Z'})),unread:0})});
 f.markAll();await flush();eq(rows().length,0,'Confirmed mark-all removes rows from unread list');eq(f.get('items').length,2,'Mark-all preserves saved activity history');
 eq(f.query().find(n=>n.type==='button'&&n.props.children==='Mark all as read').props.disabled,true,'Mark-all remains visible and disabled when caught up');
 f.unmount();
}
console.log('PASS notification unread filtering, history access and confirmed mark-all behavior.');
