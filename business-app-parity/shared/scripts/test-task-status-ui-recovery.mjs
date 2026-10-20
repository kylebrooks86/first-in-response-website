/** Use actual BusinessView handlers, synthetic PATCH and GET only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const comp=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='BusinessView');
assert.ok(comp,'BusinessView exists');
function handler(name){
 for(const statement of comp.body.statements){
  if(!ts.isVariableStatement(statement))continue;
  const found=statement.declarationList.declarations.find(d=>d.name.getText(ast)===name);
  if(found)return found.initializer.getText(ast);
 }
 throw Error('Missing actual BusinessView handler '+name);
}
const source='exports.toggle='+handler('toggleTask')+';\nexports.refresh='+handler('refreshTaskStatuses')+';';
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const row=(status='open',completedAt=null)=>({id:'synthetic-task',title:'Synthetic job reminder',status,completedAt,createdAt:'2026-10-20T12:00:00Z'});
const response=(ok,status,completedAt)=>({ok,json:async()=>({ok,status,completedAt})});
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function fixture(){
 const requests=[],notices=[],state={rows:[row()],taskStatusUncertain:false,taskToggling:null,loadRequest:{current:0}};
 let handler=async(_url,options)=>options?.method==='PATCH'?response(true,'completed','2026-10-20T13:00:00Z'):{ok:true,json:async()=>({tasks:[row()]})};
 const ctx={exports:{},taskStatusLock:{current:false},taskStatusRefreshLock:{current:false},loadRequest:state.loadRequest,
  taskStatusUncertain:false,
  setTaskStatusUncertain:v=>{ctx.taskStatusUncertain=v;state.taskStatusUncertain=v;},
  setTaskStatusMessage:v=>{notices.push(v);},
  setTaskToggling:v=>{state.taskToggling=v;},
  setTasks:v=>{state.rows=typeof v==='function'?v(state.rows):v;},
  fetch:(url,options)=>{requests.push({url,options});return handler(url,options);}
 };
 vm.runInNewContext(script,ctx);
 return {state,ctx,notices,requests,
  toggle:()=>ctx.exports.toggle(state.rows[0]),
  refresh:()=>ctx.exports.refresh(),
  setHandler:h=>{handler=h;},
  patchCount:()=>requests.filter(x=>x.options?.method==='PATCH').length,
  getCount:()=>requests.filter(x=>!x.options?.method).length,
  lastPatch:()=>JSON.parse(requests.filter(x=>x.options?.method==='PATCH').at(-1).options.body)
 };
}
{
 const f=fixture(),pending=deferred();
 f.setHandler((_url,opts)=>opts?.method==='PATCH'?pending.promise:Promise.resolve({ok:true,json:async()=>({tasks:[row()]})}));
 const first=f.toggle(),again=f.toggle();
 eq(f.patchCount(),1,'Rapid double tap sends one PATCH');
 eq(f.state.rows[0].status,'open','No optimistic completion displayed while pending');
 eq(f.state.taskToggling,'synthetic-task','Owner sees pending state during write');
 eq(f.lastPatch().expectedStatus,'open','Sends compare-and-swap expected status');
 eq(f.lastPatch().status,'completed','Sends explicit requested status');
 pending.resolve(response(true,'completed','2026-10-20T13:00:00Z'));
 await Promise.all([first,again]);
 eq(f.state.rows[0].status,'completed','Confirmed response updates status');
 eq(f.state.rows[0].completedAt,'2026-10-20T13:00:00Z','Server completion timestamp displayed');
 eq(f.state.taskToggling,null,'Pending indicator cleared');
 eq(f.state.taskStatusUncertain,false,'Confirmed write needs no recovery');
}
for(const scenario of ['network','http','missing-confirmation','wrong-status','invalid-timestamp']){
 const f=fixture(),pending=deferred();
 f.setHandler((_url,opts)=>opts?.method==='PATCH'?pending.promise:Promise.resolve({ok:true,json:async()=>({tasks:[row('completed','2026-10-20T13:00:00Z')]})}));
 const request=f.toggle();
 if(scenario==='network')pending.reject(Error('Connection lost after possible commit'));
 else if(scenario==='http')pending.resolve({ok:false,json:async()=>({error:'Task changed elsewhere'})});
 else if(scenario==='missing-confirmation')pending.resolve({ok:true,json:async()=>({status:'completed'})});
 else if(scenario==='wrong-status')pending.resolve(response(true,'open',null));
 else pending.resolve(response(true,'completed','not a timestamp'));
 await request;
 eq(f.state.rows[0].status,'open',scenario+' does not optimistically confirm a status');
 eq(f.state.taskStatusUncertain,true,scenario+' locks all further task updates');
 eq(f.state.taskToggling,null,scenario+' releases pending indicator');
 const countBefore=f.patchCount();
 await f.toggle();
 eq(f.patchCount(),countBefore,scenario+' blocked subsequent PATCH until verified refresh');
 eq(f.notices.at(-1).includes('not confirmed'),true,scenario+' instructs read-only reconciliation');
 await f.refresh();
 eq(f.getCount(),1,scenario+' reconciliation sends one GET');
 eq(f.requests.at(-1).options.cache,'no-store',scenario+' avoids browser cached status');
 eq(f.state.rows[0].status,'completed',scenario+' accepts the verified server record');
 eq(f.state.taskStatusUncertain,false,scenario+' unlocks only after verified read');
 eq(f.state.loadRequest.current,1,scenario+' invalidates older concurrent Business load');
}
{
 const f=fixture();
 f.setHandler((_url,opts)=>opts?.method==='PATCH'?Promise.reject(Error('Offline')):Promise.resolve({ok:false,json:async()=>({error:'Expired'})}));
 await f.toggle();await f.refresh();
 eq(f.state.taskStatusUncertain,true,'Unauthorized refresh leaves task writes blocked');
 eq(f.state.rows[0].status,'open','Failed GET never fabricates a completed state');
 eq(f.notices.at(-1).includes('refresh failed'),true,'Owner sees a refresh failure warning');
}
{
 const f=fixture();
 f.state.rows=[row('completed','2026-10-20T13:00:00Z')];
 f.setHandler((_url,opts)=>opts?.method==='PATCH'?response(true,'open',null):{ok:true,json:async()=>({tasks:[row()]})});
 await f.toggle();
 eq(f.lastPatch().expectedStatus,'completed','Reopening requires last saved completed state');
 eq(f.state.rows[0].status,'open','Confirmed reopen updates status');
 eq(f.state.rows[0].completedAt,null,'Confirmed reopen clears completion timestamp');
}
console.log('PASS '+checks+'/'+checks+': actual task status click handler waits for server confirmation, blocks uncertain writes and reconciles with uncached GET only. Synthetic network.');
