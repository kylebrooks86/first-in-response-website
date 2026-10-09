import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helpers=['resolvedBillingTotalCents','billingBalanceCents'];
const declarations=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>helpers.includes(d.name.getText(ast))));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PaymentsView');
let state=[],cursor=0,effect,requests=[],responder;
const stub=()=>null;
const context={exports:{},require,Error,Array,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useEffect(fn){effect=fn;},fetch:async url=>{requests.push(url);return responder(url);},
 money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s,Button:stub,ProcessingReport:stub,ProcessingDetails:stub,RefundPayment:stub,RecordPayment:stub,CircleDollarSign:stub,CheckCircle2:stub,CreditCard:stub,
};
vm.runInNewContext(ts.transpileModule(declarations.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=PaymentsView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(){cursor=0;return context.exports.view({searchQuery:''});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();assert.equal(state[2],false,'Load must settle');}
const ok=url=>({ok:true,json:async()=>url==='/api/estimates'?{estimates:[]}:{payments:[]}});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const oldEstimates=[{id:'old-job',customer:'Synthetic',service:'Wash',status:'completed',totalCents:10000,depositCents:5000,paidCents:2000}];
const oldPayments=[{id:'old-payment',amountCents:2000,status:'paid',type:'Cash',createdAt:'2026-10-09'}];
const failures=[
 ['estimate HTTP error',url=>url==='/api/estimates'?{ok:false,json:async()=>({error:'Job access denied'})}:ok(url),'Job access denied'],
 ['payment HTTP error',url=>url==='/api/payments'?{ok:false,json:async()=>({error:'Accounting review required'})}:ok(url),'Accounting review required'],
 ['empty HTTP error',url=>url==='/api/payments'?{ok:false,json:async()=>({})}:ok(url),'Payment history could not be loaded.'],
 ['network rejection',()=>{throw new Error('Offline');},'Offline'],
 ['invalid JSON',()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 ['missing collection',()=>({ok:true,json:async()=>({})}),'Payment records could not be read. Try again.'],
 ['invalid collection',url=>({ok:true,json:async()=>url==='/api/estimates'?{estimates:{}}:{payments:[]}}),'Payment records could not be read. Try again.'],
 ['non-Error rejection',()=>{throw 'connection failed';},'Payment records could not be loaded.'],
];
for(const [label,fail,message] of failures)for(const populated of [false,true]){
 state=[populated?oldEstimates:[],populated?oldPayments:[],true,''];requests=[];responder=fail;
 const initial=nodes(render());equal(initial.some(n=>n.props?.className==='business-metrics'),false);
 effect();await settle();equal(state[3],message);
 equal(state[0].length,populated?1:0);equal(state[1].length,populated?1:0);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert,label);checks++;
 equal(alert.props.children[0].props.children,message);
 equal(all.some(n=>n.props?.className==='business-metrics'),false);
 equal(all.some(n=>n.props?.className==='payment-layout'),false);
 equal(all.some(n=>n.props?.children==='All caught up'),false);
 equal(all.some(n=>n.type===stub&&n.props?.payments),false);
 // Retry executes the actual event handler and restores an honestly empty view.
 responder=ok;requests=[];alert.props.children[1].props.onClick();await settle();equal(state[3],'');
 equal(requests.length,2);equal(state[0].length,0);equal(state[1].length,0);
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);
 equal(recovered.some(n=>n.props?.className==='business-metrics'),true);
 equal(recovered.some(n=>n.props?.children==='All caught up'),true);
}
// A successful reload converts numeric fields and preserves separate paid/tip rows.
state=[[],[],true,''];responder=url=>({ok:true,json:async()=>url==='/api/estimates'?{estimates:oldEstimates.map(e=>({...e,totalCents:'10000',paidCents:'2000'}))}:{payments:oldPayments.map(p=>({...p,amountCents:'2000'}))}});
render();effect();await settle();equal(state[0][0].totalCents,10000);equal(state[1][0].amountCents,2000);equal(state[3],'');
console.log(`PASS ${checks}/${checks}: actual Payments load/error/retry handlers cover HTTP, network, JSON and malformed collection failures; hide misleading summaries/actions, retain prior records, recover cleanly and convert successful numeric fields. Mocked reads only.`);
