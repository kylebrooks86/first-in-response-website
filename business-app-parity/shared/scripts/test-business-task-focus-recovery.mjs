/** Exercise the real BusinessView task notification effect with synthetic saved rows. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const s=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='BusinessView');
assert.ok(component,'BusinessView must exist');
let target=null;
function walk(n){
 if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('taskFocusHandled.current')){
  target=n.arguments[0].getText(ast);
 }
 ts.forEachChild(n,walk);
}walk(component);
assert.ok(target,'Real saved-task notification focus effect exists');
const script=ts.transpileModule('exports.effect='+target+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let count=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);count++;};
function fixture({id='missing',hint='customer-a',activity='sign',tasks=[],loading=false,error=''}={}){
 const reports=[],actions=[],focus=[],flags=[],setups=[];
 const ctx={exports:{},focusTaskId:id,focusTaskCustomerId:hint,focusTaskActivity:activity,
  loading,loadError:error,tasks,taskFocusHandled:{current:null},Date,
  setTaskFocusNotice:v=>reports.push(v),setContextTaskId:id=>setups.push(['context',id]),
  setHighlightTaskId:id=>setups.push(['highlight',id]),setTaskSearch:s=>setups.push(['search',s]),setTaskFilter:f=>setups.push(['filter',f]),
  onFocusTaskHandled:()=>actions.push('handled'),
  taskDueBucket:task=>task.status==='completed'?'none':'today',
  taskLinkedFlag:task=>task.notes==='review'?{kind:'review'}:null,
  document:{getElementById:id=>{focus.push(id);return{scrollIntoView:()=>focus.push('scroll'),focus:()=>focus.push('focus')}}}
 };
 vm.runInNewContext(script,ctx);
 return {ctx,reports,actions,focus,setups,run:()=>ctx.exports.effect()};
}
{
 const f=fixture();f.run();
 eq(f.reports[0].status,'missing','Successful owner list shows missing, not silently acknowledged');
 eq(f.reports[0].id,'missing','Missing alert retains the exact task ID');
 eq(f.reports[0].customerId,'customer-a','Owner metadata is only a candidate customer ID');
 eq(f.setups.some(x=>x[0]==='context'&&x[1]===null),true,'Missing task never opens unrelated task details');
 eq(f.actions.length,1,'Missing target acknowledged only after explanation is retained');
 eq(f.focus.length,0,'Missing record never receives false focus');
 f.run();eq(f.actions.length,1,'Same missing notification is processed once');
}
{
 const f=fixture({loading:true});f.run();eq(f.actions.length,0,'Loading never acknowledges notification');
 eq(f.reports.length,0,'Loading does not claim task missing');
}
{
 const f=fixture({error:'server unavailable'});f.run();eq(f.actions.length,0,'Failed verified read never acknowledges task');
 eq(f.reports.length,0,'Failed read cannot claim a missing task');
}
{
 const f=fixture({id:'task-1',tasks:[{id:'task-1',status:'completed',customerId:'confirmed',notes:'review'}]});
 f.run();eq(f.reports[0].status,'changed','Completed task shows changed status');
 eq(f.reports[0].customerId,'confirmed','Changed state uses latest authoritative customer, not notification hint');
 eq(f.reports[0].activity,'review','Changed task activity is derived from saved task marker');
 eq(f.focus[0],'business-task-task-1','Changed task focuses exact read-only details button');
 eq(f.actions.length,1,'Changed task acknowledges after verified focus');
}
{
 const f=fixture({id:'task-2',tasks:[{id:'task-2',status:'open',customerId:'confirmed'}]});
 f.run();eq(f.reports[0],null,'Unchanged task does not raise a false recovery alert');
 eq(f.focus[0],'business-task-task-2','Current task focuses exact saved details');
}
eq(s.includes('customer=taskFocusNotice.customerId?customers.find(row=>row.id===taskFocusNotice.customerId):null'),true,'Customer fallback ID is verified against successful owner list');
eq(s.includes('This does not prove it was deleted.'),true,'Missing notification never claims task deletion');
eq(s.includes('This notification\\'s task could not be verified.'),true,'Unavailable owner feed explains uncertainty');
eq(s.includes('if(taskFocusNotice?.status==="missing"&&taskResult.tasks.some(row=>row.id===taskFocusNotice.id))'),true,'Explicit recheck reconciles restored tasks');
eq(s.includes('setFocusBusinessTaskHint({customerId:null,activity:null});setFocusBusinessTaskId(id);'),true,'Dashboard task navigation cannot inherit a bell customer hint');
eq(s.includes('onClick={()=>void toggleTask(task)}'),true,'Owner completion remains separately guarded');
console.log('PASS '+count+'/'+count+' missing, unavailable, changed, stale hint and exact task navigation regressions.');
