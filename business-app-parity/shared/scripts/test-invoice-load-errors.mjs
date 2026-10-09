import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='InvoicesView');
let state=[],cursor=0,effect,requests=[],responder;
const Button=()=>null,RecordPayment=()=>null,Receipt=()=>null,ExternalLink=()=>null;
const context={exports:{},require,Error,Array,Button,RecordPayment,Receipt,ExternalLink,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
 useEffect(fn){effect=fn;},fetch:async url=>{requests.push(url);return responder(url);},money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s,
};
vm.runInNewContext(ts.transpileModule(view.getText(ast)+'\nexports.view=InvoicesView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery=''){cursor=0;return context.exports.view({searchQuery});}
function nodes(tree){const result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;result.push(n);walk(n.props?.children);}walk(tree);return result;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[1],false,'Load must settle');}
const ok=invoices=>({ok:true,json:async()=>({invoices})});
const prior=[{id:'invoice-synthetic',estimateId:'job-synthetic',customer:'Synthetic QA',service:'House Wash',status:'sent',estimateStatus:'completed',depositCents:5000,totalCents:10000,paidCents:2000,shareToken:'synthetic-token'}];
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Invoice access denied'})}),'Invoice access denied'],
 [()=>({ok:false,json:async()=>({})}),'Invoices could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Invoice records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({invoices:{}})}),'Invoice records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Invoices could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true]){
 state=[populated?prior:[],true,''];requests=[];responder=fail;
 equal(nodes(render()).some(n=>n.type===RecordPayment),false);
 effect();await settle();equal(state[2],message);equal(state[0].length,populated?1:0);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);
 equal(all.some(n=>n.type===RecordPayment),false);
 equal(all.some(n=>n.props?.className==='invoice-list'),false);
 equal(all.some(n=>n.props?.children==='No invoices yet'),false);
 // Actual retry handler fetches the endpoint again and restores loaded records.
 responder=()=>ok(prior);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[2],'');equal(requests.length,1);equal(requests[0],'/api/invoices');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);
 const action=recovered.find(n=>n.type===RecordPayment);assert.ok(action);checks++;
 equal(action.props.estimate.id,'job-synthetic');equal(action.props.estimate.status,'completed');equal(action.props.estimate.depositCents,5000);equal(action.props.estimate.paidCents,2000);
 equal(recovered.find(n=>n.type==='a').props.href,'/invoice/synthetic-token');
}
// Search misses must not imply that loaded invoice records don't exist.
state=[prior,false,''];let all=nodes(render('no-match'));equal(all.some(n=>n.props?.children==='No matching invoices'),true);equal(all.some(n=>n.props?.children==='No invoices yet'),false);
for(const term of ['SYNTHETIC','house wash','sent'])equal(nodes(render(term)).some(n=>n.props?.className==='invoice-list'),true);
state=[[],true,''];responder=()=>ok([]);render();effect();await settle();all=nodes(render());equal(all.some(n=>n.props?.children==='No invoices yet'),true);equal(all.some(n=>n.props?.children==='No matching invoices'),false);
// Preserve zero invoices, string-to-number conversion, and payment refresh callback.
state=[[],true,''];responder=()=>ok([{...prior[0],totalCents:'0',paidCents:null}]);render();effect();await settle();equal(state[0][0].totalCents,0);equal(state[0][0].paidCents,0);
const action=nodes(render()).find(n=>n.type===RecordPayment);requests=[];action.props.onRecorded();await settle();equal(requests.length,1);equal(requests[0],'/api/invoices');
console.log(`PASS ${checks}/${checks}: actual invoice load/error/retry and payment-refresh handlers cover HTTP/network/JSON/malformed failures, preserve old records, hide stale payment actions, recover loaded invoices, distinguish search misses from no invoices, and retain zero totals and invoice links. Mocked reads only.`);
