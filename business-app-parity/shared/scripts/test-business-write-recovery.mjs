/** Exercise BusinessView's actual task/expense POST handlers without touching a database. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='BusinessView');
assert.ok(view,'BusinessView exists');

function handler(name){
  for(const statement of view.body.statements){
    if(!ts.isVariableStatement(statement))continue;
    const declaration=statement.declarationList.declarations.find(item=>item.name.getText(ast)===name);
    if(declaration)return declaration.initializer.getText(ast);
  }
  throw Error('Missing actual BusinessView handler '+name);
}

const scripts=Object.fromEntries(['addTask','addExpense'].map(name=>[name,ts.transpileModule('exports.action='+handler(name)+';',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText]));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let checks=0;
const eq=(left,right,label)=>{assert.deepEqual(left,right,label);checks++;};
function fixture(name,changes={}){
  const calls=[],messages=[],saved=[],loads=[];let request=deferred(),taskSaving=false,expenseSaving=false;
  const ctx={
    exports:{},require,
    title:'Synthetic task',dueAt:'',taskNotes:'Synthetic note',taskCustomer:'none',
    category:'Chemicals',description:'Synthetic soap',amount:'15.25',expenseEstimate:'none',
    taskCreateLock:{current:false},expenseCreateLock:{current:false},
    setTaskSaving:v=>{taskSaving=v;},setExpenseSaving:v=>{expenseSaving=v;},
    setBusinessMessage:v=>{messages.push(v);},
    setTitle:v=>{ctx.title=v;saved.push('title');},
    setDueAt:v=>{ctx.dueAt=v;saved.push('dueAt');},
    setTaskNotes:v=>{ctx.taskNotes=v;saved.push('taskNotes');},
    setTaskCustomer:v=>{ctx.taskCustomer=v;saved.push('taskCustomer');},
    setDescription:v=>{ctx.description=v;saved.push('description');},
    setAmount:v=>{ctx.amount=v;saved.push('amount');},
    setExpenseEstimate:v=>{ctx.expenseEstimate=v;saved.push('expenseEstimate');},
    fetch:(url,options)=>{calls.push({url,options});return request.promise;},
    load:async()=>{loads.push('load');}
  };
  Object.assign(ctx,changes);
  vm.runInNewContext(scripts[name],ctx);
  return {ctx,calls,messages,saved,loads,act:()=>ctx.exports.action(),setRequest:next=>{request=next;},
    get saving(){return name==='addTask'?taskSaving:expenseSaving;},
    get lock(){return name==='addTask'?ctx.taskCreateLock.current:ctx.expenseCreateLock.current;},
    submitted(){return JSON.parse(calls.at(-1).options.body);}};
}
function success(name,payload){
  return name==='addTask'
    ?{task:{id:'synthetic-task-id',title:payload.title,customerId:payload.customerId,status:'open',createdAt:'2026-10-19T12:00:00Z'}}
    :{expense:{id:'synthetic-expense-id',description:payload.description,category:payload.category,estimateId:payload.estimateId,amountCents:payload.amountCents}};
}
for(const name of ['addTask','addExpense']){
  const url=name==='addTask'?'/api/tasks':'/api/expenses';
  const field=name==='addTask'?'title':'description';
  // Synchronous guard closes the same-frame double-tap window before React rerenders.
  {
    const f=fixture(name),pending=deferred();f.setRequest(pending);
    const first=f.act(),second=f.act();
    eq(f.calls.length,1,name+' double tap makes exactly one POST');
    eq(f.saving,true,name+' shows saving state');
    eq(f.lock,true,name+' holds synchronous lock');
    eq(f.calls[0].url,url,name+' calls only its intended endpoint');
    eq(f.calls[0].options.method,'POST',name+' sends POST');
    eq(f.calls[0].options.headers['content-type'],'application/json',name+' sends JSON');
    const payload=f.submitted();
    eq(payload.title??payload.description,name==='addTask'?'Synthetic task':'Synthetic soap','submitted draft is preserved');
    pending.resolve({ok:true,json:async()=>success(name,payload)});
    await Promise.all([first,second]);
    eq(f.saving,false,name+' releases saving after success');
    eq(f.lock,false,name+' releases lock after success');
    eq(f.loads.length,1,name+' refreshes saved records once');
    eq(f.ctx[field],'',name+' only clears after verified server response');
    eq(f.messages.at(-1),name==='addTask'?'Task added.':'Expense recorded.',name+' reports success only after confirmation');
  }
  for(const mode of ['network','http','bad-json','missing-record','wrong-id','wrong-amount']){
    const f=fixture(name),pending=deferred();f.setRequest(pending);
    const work=f.act(),payload=f.submitted();
    if(mode==='network')pending.reject(Error('Lost connection after request'));
    else if(mode==='http')pending.resolve({ok:false,json:async()=>({error:'Rejected'})});
    else if(mode==='bad-json')pending.resolve({ok:true,json:async()=>{throw Error('Unreadable reply');}});
    else if(mode==='missing-record')pending.resolve({ok:true,json:async()=>({})});
    else if(mode==='wrong-id')pending.resolve({ok:true,json:async()=>{
      const row=success(name,payload);if(name==='addTask')row.task.customerId='other';else row.expense.estimateId='different';
      return row;
    }});
    else pending.resolve({ok:true,json:async()=>{
      const row=success(name,payload);if(name==='addTask')row.task.title='Different task';else row.expense.amountCents=999;
      return row;
    }});
    await work;
    eq(f.saving,false,name+' '+mode+' releases saving');
    eq(f.lock,false,name+' '+mode+' releases lock');
    eq(f.ctx[field],name==='addTask'?'Synthetic task':'Synthetic soap',name+' '+mode+' retains draft');
    eq(f.loads.length,0,name+' '+mode+' does not reload as success');
    eq(f.messages.at(-1).includes('Refresh')&&f.messages.at(-1).includes('duplicate'),true,name+' '+mode+' warns about possible duplicates');
    // After a failed response the owner can retry deliberately, but not accidentally.
    const retry=deferred();f.setRequest(retry);const again=f.act();
    eq(f.calls.length,2,name+' '+mode+' permits explicit retry');
    retry.resolve({ok:true,json:async()=>success(name,f.submitted())});await again;
    eq(f.loads.length,1,name+' '+mode+' can recover after deliberate retry');
  }
}
{
 const f=fixture('addTask',{title:'   '});await f.act();
 eq(f.calls.length,0,'Blank task never sends a POST');
 eq(f.messages.at(-1),'Enter a task or reminder first.','Blank task has visible validation');
}
{
 const f=fixture('addTask',{dueAt:'invalid timestamp'});await f.act();
 eq(f.calls.length,0,'Invalid task date never sends a POST');
}
for(const amount of ['','0','abc','NaN','Infinity','100000000000000000']){
 const f=fixture('addExpense',{amount});await f.act();
 eq(f.calls.length,0,'Invalid amount '+JSON.stringify(amount)+' never sends a POST');
 eq(f.saving,false,'Invalid amount never locks the expense form');
}
eq(source.includes('disabled={taskSaving} value={title}'),true,'Task draft input disabled during save');
eq(source.includes('disabled={expenseSaving} value={amount}'),true,'Expense amount disabled during save');
console.log('PASS '+checks+'/'+checks+': actual BusinessView creation handlers guard duplicate taps, validate saved responses, retain drafts and recover safely. Synthetic fetch only.');
