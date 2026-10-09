import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ContractsView');
let state=[],cursor=0,effect,requests=[],responder;
const stubs=Object.fromEntries(['Button','EstimateDetail','PenLine','MessageSquareText','Clock3','ChevronRight'].map(name=>[name,()=>null]));
const context={exports:{},require,Error,Array,...stubs,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useRef:initial=>({current:initial}),useEffect(fn){effect=fn;},fetch:async url=>{requests.push(url);return responder(url);},money:c=>'$'+(c/100).toFixed(2),
};
vm.runInNewContext(ts.transpileModule(view.getText(ast)+'\nexports.view=ContractsView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery=''){cursor=0;return context.exports.view({searchQuery});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[2],false,'Load must settle');}
const job={id:'job-synthetic',customer:'Synthetic QA',service:'House Wash',status:'approved',signedAt:'2026-10-09T12:00:00Z',signedName:'Synthetic Signer',totalCents:10000,depositCents:5000,paidCents:2000,pendingChangeCount:0};
const ok=estimates=>({ok:true,json:async()=>({estimates})});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Agreement access denied'})}),'Agreement access denied'],
 [()=>({ok:false,json:async()=>({})}),'Agreements could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Agreement records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({estimates:{}})}),'Agreement records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Agreements could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true]){
 state=[populated?[job]:[],populated?job:null,true,''];requests=[];responder=fail;
 const initial=nodes(render());equal(initial.some(n=>n.props?.className==='business-metrics'),false);equal(initial.find(n=>n.type===stubs.EstimateDetail).props.estimate,null);
 effect();await settle();equal(state[3],message);equal(state[0].length,populated?1:0);equal(state[1],null);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);equal(all.some(n=>n.props?.className==='business-metrics'),false);equal(all.some(n=>n.props?.className==='contract-list'),false);equal(all.some(n=>n.props?.children==='No agreements yet'),false);
 responder=()=>ok([job]);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[3],'');equal(requests.length,1);equal(requests[0],'/api/estimates');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);equal(recovered.some(n=>n.props?.className==='business-metrics'),true);
 const list=recovered.find(n=>n.props?.className==='contract-list');assert.ok(list);checks++;const card=list.props.children[0];equal(nodes(card).some(n=>n.props?.className==='contract-state signed'),true);card.props.onClick();equal(state[1].signedName,'Synthetic Signer');
}
// Preserve signatures, pending-change counts and awaiting exclusions after refresh.
const fixtures=[job,{...job,id:'change',signedAt:null,signedName:null,status:'sent',pendingChangeCount:'2'},
 {...job,id:'pending',signedAt:null,status:'draft',pendingChangeCount:null},
 {...job,id:'declined',signedAt:null,status:'declined'},
 {...job,id:'completed',signedAt:null,status:'completed'}];
state=[[],null,true,''];responder=()=>ok(fixtures.map(e=>({...e,totalCents:String(e.totalCents),depositCents:String(e.depositCents),paidCents:String(e.paidCents)})));render();effect();await settle();equal(state[0][0].totalCents,10000);equal(state[0][0].depositCents,5000);equal(state[0][0].paidCents,2000);equal(state[0][1].pendingChangeCount,2);equal(state[0][2].pendingChangeCount,0);
function metric(all,label){const metrics=all.find(n=>n.props?.className==='business-metrics');return metrics.props.children.find(n=>n.props.children[0].props.children===label).props.children[1].props.children;}
let all=nodes(render());equal(metric(all,'Signed agreements'),1);equal(metric(all,'Awaiting signature'),2);equal(metric(all,'Change requests'),2);equal(all.find(n=>n.props?.className==='contract-list').props.children.length,5);
const changedCard=all.find(n=>n.props?.className==='contract-list').props.children.find(n=>n.key==='change');equal(nodes(changedCard).some(n=>n.props?.className==='contract-state change'),true);
changedCard.props.onClick();let detail=nodes(render()).find(n=>n.type===stubs.EstimateDetail);equal(detail.props.estimate.pendingChangeCount,2);detail.props.onClose();equal(state[1],null);
equal(nodes(render('signer')).find(n=>n.props?.className==='contract-list').props.children.length,4);
equal(nodes(render('absent')).some(n=>n.props?.children==='No matching agreements'),true);equal(nodes(render('absent')).some(n=>n.props?.children==='No agreements yet'),false);
// Detail change triggers a fresh read and updates agreement counters.
responder=()=>ok(fixtures.map(e=>e.id==='change'?{...e,signedAt:'now',pendingChangeCount:0}:e));requests=[];detail=nodes(render()).find(n=>n.type===stubs.EstimateDetail);detail.props.onChanged();equal(state[2],true);equal(nodes(render()).some(n=>n.props?.className==='business-metrics'),false);await settle();equal(requests.length,1);all=nodes(render());equal(metric(all,'Signed agreements'),2);equal(metric(all,'Awaiting signature'),1);equal(metric(all,'Change requests'),0);
state=[[],null,true,''];responder=()=>ok([]);render();effect();await settle();all=nodes(render());equal(all.some(n=>n.props?.children==='No agreements yet'),true);equal(all.some(n=>n.props?.role==='alert'),false);equal(metric(all,'Signed agreements'),0);
console.log(`PASS ${checks}/${checks}: actual Agreements load/error/retry and detail-refresh handlers distinguish failures/search misses/empty records, preserve signatures and change-request counts, hide stale counters/editor, recover records and retain awaiting exclusions. Mocked reads only.`);
