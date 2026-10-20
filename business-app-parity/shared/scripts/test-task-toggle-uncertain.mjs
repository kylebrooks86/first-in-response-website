/** Run the actual BusinessView task status PATCH handler against synthetic lost replies. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='BusinessView');
assert.ok(view,'BusinessView exists');
const stmt=view.body.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='toggleTask'));
assert.ok(stmt,'Actual task toggle handler exists');
const fn=stmt.declarationList.declarations.find(d=>d.name.getText(ast)==='toggleTask').initializer.getText(ast);
const compiled=ts.transpileModule('exports.toggle='+fn+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const task={id:'synthetic-task-1',status:'open',title:'Synthetic follow-up'};
function fixture(options={}){
 const calls=[],messages=[],toggles=[],uncertain=[],rows=[{...task}],lock={current:false};
 let loading=false,loadError='',uncertainValue=null,toggling=null;
 const network=pending();
 const ctx={exports:{},taskToggleLock:lock,taskToggleUncertain:options.uncertain??null,loading:options.loading??false,loadError:options.loadError??'',
  setTaskToggling:v=>{toggling=v;toggles.push(v);},
  setTaskToggleUncertain:v=>{uncertainValue=v;uncertain.push(v);},
  setBusinessMessage:v=>messages.push(v),
  setTasks:fn=>{rows.splice(0,rows.length,...fn(rows));},
  fetch:(url,config)=>{calls.push({url,config});return network.promise;}};
 vm.runInNewContext(compiled,ctx);
 return {ctx,calls,messages,toggles,uncertain,rows,lock,network,act:()=>ctx.exports.toggle(task),get pending(){return uncertainValue;},get toggling(){return toggling;}};
}
{
 const f=fixture(),first=f.act(),second=f.act();
 eq(f.calls.length,1,'Double-tap issues exactly one PATCH');
 eq(f.lock.current,true,'Synchronous lock held before React state update');
 eq(f.rows[0].status,'open','Status not optimistically changed before response');
 eq(f.calls[0].url,'/api/tasks','PATCH targets only task endpoint');
 eq(f.calls[0].config.method,'PATCH','PATCH method used');
 eq(JSON.parse(f.calls[0].config.body).status,'completed','Explicit target status sent');
 f.network.resolve({ok:true,json:async()=>({ok:true,status:'completed'})});
 await Promise.all([first,second]);
 eq(f.rows[0].status,'completed','Verified status changes local UI');
 eq(f.pending,null,'Confirmed response does not block future status changes');
 eq(f.lock.current,false,'Lock released after verified response');
 eq(f.toggling,null,'Saving indicator cleared');
 eq(f.messages.at(-1),'Task status confirmed.','Only verified result is announced as success');
}
for(const mode of ['network','http','bad-json','wrong-status','missing-confirmation']){
 const f=fixture(),work=f.act();
 if(mode==='network')f.network.reject(Error('Lost after commit'));
 else if(mode==='http')f.network.resolve({ok:false,json:async()=>({error:'Server returned 503'})});
 else if(mode==='bad-json')f.network.resolve({ok:true,json:async()=>{throw Error('Unreadable response')}});
 else if(mode==='wrong-status')f.network.resolve({ok:true,json:async()=>({ok:true,status:'open'})});
 else f.network.resolve({ok:true,json:async()=>({status:'completed'})});
 await work;
 eq(f.rows[0].status,'open',mode+' leaves previous status displayed, not falsely reversed');
 eq(f.pending,task.id,mode+' blocks future toggles pending saved-list refresh');
 eq(f.lock.current,false,mode+' releases network lock');
 eq(f.messages.at(-1).includes('may have succeeded'),true,mode+' explains uncertain outcome');
 const again=f.act();await again;
 eq(f.calls.length,1,mode+' refuses another status PATCH until verified refresh');
}
for(const props of [{uncertain:task.id},{loading:true},{loadError:'Could not read saved tasks'}]){
 const f=fixture(props);await f.act();
 eq(f.calls.length,0,'Blocked/uncertain state does not issue task PATCH');
}
eq(source.includes('Task status needs verification'),true,'Recovery warning is shown in UI');
eq(source.includes('Refresh saved tasks'),true,'Owner has an explicit refresh action');
eq(source.includes('disabled={taskToggling!==null||taskToggleUncertain!==null||loading}'),true,'Task controls disabled while uncertain or in-flight');
console.log('PASS '+checks+'/'+checks+': task status change never falsely rolls back a committed PATCH, blocks double-taps and requires verified refresh after lost response.');
