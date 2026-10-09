import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='BusinessView');
const stateNames=[],tags=new Set();function scan(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')stateNames.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}ts.forEachChild(n,scan);}scan(view);
const stubs=Object.fromEntries([...tags].map(tag=>[tag,()=>null]));
let state=[],refs=[],cursor=0,refCursor=0,effect,pendingPatch,patchFailure=false;const requests=[];
const tasks=[{id:'open-task',title:'Call synthetic customer',status:'open'},{id:'done-task',title:'Very long completed synthetic task title',status:'completed'}];
const context={exports:{},require,...stubs,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},
 useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect(fn){effect=fn;},money:c=>'$'+(c/100).toFixed(2),dateTime:v=>v,
 fetch:async(url,opts={})=>{if(opts.method){requests.push({url,method:opts.method,body:JSON.parse(opts.body)});if(opts.method==='PATCH')return new Promise(resolve=>{pendingPatch=()=>resolve({ok:!patchFailure,json:async()=>patchFailure?{error:'Synthetic update failed'}:{ok:true}});});return {ok:true,json:async()=>({})};}return {ok:true,json:async()=>url==='/api/tasks'?{tasks:tasks.map(t=>({...t}))}:url==='/api/expenses'?{expenses:[]}:{customers:[{id:'customer',name:'Synthetic customer'}],estimates:[{id:'job',customerId:'customer',service:'Wash'}]}};},
};
vm.runInNewContext(ts.transpileModule(view.getText(ast)+'\nexports.view=BusinessView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const render=()=>{cursor=0;refCursor=0;return context.exports.view();};
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
const all=()=>nodes(render()),get=key=>state[stateNames.indexOf(key)];
const text=n=>Array.isArray(n)?n.map(text).join(''):typeof n==='string'?n:n&&typeof n==='object'?text(n.props?.children):'';
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
async function settle(){for(let i=0;i<24;i++)await Promise.resolve();}
render();effect();await settle();eq(get('loading'),false);
const expected={
 'business-task-title':'Task or reminder','business-task-customer':'Customer','business-task-due':'Due date and time (optional)','business-task-notes':'Notes (optional)',
 'business-expense-category':'Expense category','business-expense-job':'Job','business-expense-description':'Expense description','business-expense-amount':'Amount ($)',
};
const controls=all().filter(n=>[stubs.Input,stubs.Textarea,stubs.SelectTrigger].includes(n.type));
eq(controls.length,8);eq(new Set(controls.map(n=>n.props.id)).size,8);
for(const control of controls){const label=all().find(n=>n.type===stubs.Label&&n.props.htmlFor===control.props.id);assert.ok(label,'Missing associated label for '+control.props.id);checks++;eq(label.props.children,expected[control.props.id]);if(control.type===stubs.SelectTrigger)eq(control.props['aria-labelledby'],label.props.id);}
eq(controls.find(n=>n.props.id==='business-task-due').props.type,'datetime-local');eq(controls.find(n=>n.props.id==='business-expense-amount').props.inputMode,'decimal');
for(const [id,value,key] of [['business-task-title','Call QA','title'],['business-task-due','2026-10-09T15:30','dueAt'],['business-task-notes','Bring supplies','taskNotes'],['business-expense-description','Synthetic supplies','description'],['business-expense-amount','25.34','amount']]){
 all().find(n=>n.props.id===id).props.onChange({target:{value}});eq(get(key),value);eq(all().find(n=>n.props.id===id).props.value,value);
}
function select(id,value,key){const field=all().find(n=>n.props.className==='business-field'&&nodes(n).some(c=>c.props.id===id));nodes(field).find(n=>n.type===stubs.Select).props.onValueChange(value);eq(get(key),value);}
select('business-task-customer','customer','taskCustomer');select('business-expense-category','Fuel','category');select('business-expense-job','job','expenseEstimate');
const taskButton=id=>all().find(n=>n.type==='button'&&n.key===id);
eq(taskButton('open-task').props['aria-label'],'Toggle completion for Call synthetic customer');eq(taskButton('open-task').props['aria-pressed'],false);eq(taskButton('done-task').props['aria-pressed'],true);eq(taskButton('done-task').props['aria-label'],'Toggle completion for Very long completed synthetic task title');
taskButton('open-task').props.onClick();eq(taskButton('open-task').props['aria-busy'],true);eq(taskButton('open-task').props.disabled,true);eq(taskButton('open-task').props['aria-pressed'],true);eq(taskButton('open-task').props['aria-label'],'Toggle completion for Call synthetic customer');eq(requests.at(-1),{url:'/api/tasks',method:'PATCH',body:{id:'open-task',status:'completed'}});pendingPatch();await settle();eq(taskButton('open-task').props['aria-busy'],false);eq(taskButton('open-task').props.disabled,false);
patchFailure=true;taskButton('done-task').props.onClick();eq(taskButton('done-task').props['aria-pressed'],false);eq(requests.at(-1).body.status,'open');pendingPatch();await settle();eq(taskButton('done-task').props['aria-pressed'],true);eq(get('businessMessage'),'Synthetic update failed');eq(taskButton('done-task').props['aria-busy'],false);
// Labels/wrappers preserve the actual synthetic task and expense submission handlers.
all().find(n=>n.type===stubs.Button&&text(n).includes('Add task')).props.onClick();await settle();const taskPost=requests.find(r=>r.method==='POST'&&r.url==='/api/tasks');eq(taskPost.body.title,'Call QA');eq(taskPost.body.customerId,'customer');eq(taskPost.body.notes,'Bring supplies');eq(taskPost.body.dueAt,new Date('2026-10-09T15:30').toISOString());eq(get('title'),'');
const expenseAction=all().find(n=>n.type===stubs.Button&&n.props.className==='brand-button'&&JSON.stringify(n.props.children).includes('Add expense'));assert.ok(expenseAction);checks++;expenseAction.props.onClick();await settle();const expensePost=requests.find(r=>r.method==='POST'&&r.url==='/api/expenses');eq(expensePost.body.amountCents,2534);eq(expensePost.body.category,'Fuel');eq(expensePost.body.estimateId,'job');eq(expensePost.body.description,'Synthetic supplies');eq(get('amount'),'');
const css=readFileSync('app/globals.css','utf8');assert.match(css,/\.business-field\{[^}]*min-width:0/);checks++;assert.match(css,/\.business-field \[data-slot="select-trigger"\]\{[^}]*width:100%[^}]*max-width:100%/);checks++;assert.match(css,/@media\(max-width:760px\)\{\s*\.business-field input,[\s\S]*?\.task-list>button\{min-height:44px\}/);checks++;assert.match(css,/\.business-field input,\.business-field textarea\{font-size:16px\}/);checks++;assert.match(css,/\.task-list button>span:last-child\{[^}]*overflow-wrap:anywhere/);checks++;
console.log(`PASS ${checks}/${checks}: actual Business fields retain visible associated labels, date/decimal entry, select/change/submit behavior, task pressed/busy/rollback states, and narrow-screen sizing/wrapping declarations. Synthetic handlers and structural CSS only; no browser/iPhone or remote writes.`);
