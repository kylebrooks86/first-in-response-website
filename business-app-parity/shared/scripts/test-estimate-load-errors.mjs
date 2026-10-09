import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='resolvedBillingTotalCents'));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimatesView');
let state=[],cursor=0,effects=[],requests=[],responder,saved=[];
const stubs=Object.fromEntries(['Button','EstimateDetail','NewEstimate','SquareKanban','List','Star','CalendarDays','ClipboardList','ChevronRight'].map(name=>[name,()=>null]));
const context={exports:{},require,Error,Array,...stubs,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useEffect(fn){effects.push(fn);},fetch:async url=>{requests.push(url);return responder(url);},money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s,dateTime:s=>s,
 window:{setTimeout(fn){fn();return 1;},clearTimeout(){}},
};
vm.runInNewContext(ts.transpileModule(helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=EstimatesView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery='',focusEstimateId=null){cursor=0;effects=[];return context.exports.view({searchQuery,focusEstimateId,onSaved:e=>saved.push(e)});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[4],false,'Load must settle');}
const prior=[{id:'job-synthetic',customer:'Synthetic QA',service:'House Wash',status:'approved',totalCents:10000,depositCents:5000,paidCents:2000,createdAt:'2026-10-09'}];
const ok=estimates=>({ok:true,json:async()=>({estimates})});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Estimate access denied'})}),'Estimate access denied'],
 [()=>({ok:false,json:async()=>({})}),'Estimates could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Estimate records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({estimates:{}})}),'Estimate records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Estimates could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true])for(const mode of ['pipeline','list']){
 state=[populated?prior:[],'all',mode,populated?prior[0]:null,true,''];requests=[];responder=fail;
 equal(nodes(render()).find(n=>n.type===stubs.EstimateDetail).props.estimate,null);
 effects[0]();await settle();equal(state[5],message);equal(state[0].length,populated?1:0);equal(state[3],null);
 const all=nodes(render('',prior[0].id));const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);
 equal(all.some(n=>n.props?.className==='pipeline-board'),false);equal(all.some(n=>n.props?.className==='estimate-list'),false);
 equal(all.some(n=>n.props?.children==='Nothing here'),false);equal(all.some(n=>n.props?.children==='No matching estimates'),false);
 effects[1]();equal(state[3],null,'Failed read must not open a stale focus target');
 responder=()=>ok(prior);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[5],'');equal(requests.length,1);equal(requests[0],'/api/estimates');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);
 const card=recovered.find(n=>n.props?.className===(mode==='pipeline'?'pipeline-card':'estimate-card'));assert.ok(card);checks++;
 card.props.onClick();equal(state[3].id,prior[0].id);
 render('',prior[0].id);state[3]=null;effects[1]();equal(state[3].id,prior[0].id);
}
// Retain all pipeline stages and revised invoice amounts after successful reload.
const fixtures=['draft','sent','approved','scheduled','completed','paid','declined'].map((status,i)=>({...prior[0],id:'stage-'+i,status:status==='paid'?'completed':status,totalCents:'10000',invoiceTotalCents:8000,paidCents:status==='paid'?'8000':'0',depositCents:'5000'}));
state=[[],'all','pipeline',null,true,''];responder=()=>ok(fixtures);render();effects[0]();await settle();equal(state[0][0].totalCents,10000);equal(state[0][0].subtotalCents,10000);equal(state[0][0].discountCents,0);equal(state[0][0].depositCents,5000);equal(state[0][0].paidCents,0);
const columns=nodes(render()).filter(n=>n.props?.className?.startsWith('pipeline-column '));equal(columns.length,7);
for(const column of columns){const card=nodes(column).find(n=>n.props?.className==='pipeline-card');assert.ok(card);checks++;equal(nodes(card).findLast(n=>n.type==='strong').props.children,'$80.00');}
// List filter, search, creation callbacks, detail updates and closing remain available.
state[2]='list';state[1]='approved';equal(nodes(render()).filter(n=>n.props?.className==='estimate-card').length,1);
equal(nodes(render('missing')).some(n=>n.props?.children==='No matching estimates'),true);
saved=[];const fresh={...prior[0],id:'new-job'};nodes(render()).find(n=>n.type===stubs.NewEstimate).props.onSaved(fresh);equal(saved[0].id,'new-job');equal(state[0][0].id,'new-job');
const detail=nodes(render()).find(n=>n.type===stubs.EstimateDetail);detail.props.onChanged({...fresh,status:'scheduled'});equal(state[0][0].status,'scheduled');equal(state[3].status,'scheduled');detail.props.onClose();equal(state[3],null);
state=[[],'all','pipeline',null,true,''];responder=()=>ok([]);render();effects[0]();await settle();equal(nodes(render()).filter(n=>n.props?.className==='pipeline-empty').length,7);
console.log(`PASS ${checks}/${checks}: actual estimate load/error/retry and focus handlers cover both views and populated/empty failures, hide stale cards/editor, recover cleanly, retain pipeline stages, revised amounts, search/filter, creation and detail callbacks. Mocked reads only.`);
