import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helperNames=['resolvedBillingTotalCents','billingBalanceCents'];
const helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>helperNames.includes(d.name.getText(ast)))||ts.isFunctionDeclaration(n)&&['repeatCadenceMonths','addMonths'].includes(n.name?.text));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
let state=[],cursor=0,effect,requests=[],responder;
const stubs=Object.fromEntries(['Button','MessageComposer','Clock3','Star','CalendarDays','CheckCircle2'].map(name=>[name,()=>null]));
const context={exports:{},require,Error,Array,...stubs,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useRef:initial=>({current:initial}),useEffect(fn){effect=fn;},useCurrentTime:()=>Date.parse('2026-10-09T12:00:00Z'),fetch:async url=>{requests.push(url);return responder(url);},money:c=>'$'+(c/100).toFixed(2),
};
vm.runInNewContext(ts.transpileModule(helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=FollowUpsView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery=''){cursor=0;return context.exports.view({searchQuery});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[1],false,'Load must settle');}
const job={id:'job-synthetic',customerId:'customer-synthetic',customer:'Synthetic QA',email:'qa@example.test',phone:'9185550100',service:'House Wash',status:'sent',createdAt:'2026-10-01T12:00:00Z',totalCents:10000,invoiceTotalCents:8000,depositCents:5000,paidCents:2000,paymentOverageOpen:0};
const ok=estimates=>({ok:true,json:async()=>({estimates})});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Follow-up access denied'})}),'Follow-up access denied'],
 [()=>({ok:false,json:async()=>({})}),'Customer follow-ups could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Follow-up records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({estimates:{}})}),'Follow-up records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Customer follow-ups could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true]){
 state=[populated?[job]:[],true,''];requests=[];responder=fail;
 equal(nodes(render()).some(n=>n.props?.className==='followup-summary'),false);
 effect();await settle();equal(state[2],message);equal(state[0].length,populated?1:0);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);equal(all.some(n=>n.props?.className==='followup-summary'),false);equal(all.some(n=>n.props?.className==='followup-list'),false);equal(all.some(n=>n.type===stubs.MessageComposer),false);equal(all.some(n=>n.props?.children==='You’re caught up'),false);
 responder=()=>ok([job]);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[2],'');equal(requests.length,1);equal(requests[0],'/api/estimates');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);equal(recovered.some(n=>n.props?.className==='followup-summary'),true);
 const action=recovered.find(n=>n.type===stubs.MessageComposer);assert.ok(action);checks++;equal(action.props.initialTemplate,'followUp7');equal(action.props.customer.id,job.customerId);equal(action.props.customer.estimateTotal,8000);equal(action.props.customer.paidTotal,2000);equal(action.props.triggerLabel,'Prepare message');
}
// Actual recommendation logic retains billing exceptions, deposits, reviews and recurrence.
const fixtures=[
 {...job,id:'exception',status:'completed',paymentOverageOpen:1},
 {...job,id:'invoice',invoiceId:'invoice-synthetic'},
 {...job,id:'appointment',status:'scheduled',scheduledAt:'2026-10-10T12:00:00Z'},
 {...job,id:'seven'},
 {...job,id:'three',createdAt:'2026-10-06T12:00:00Z'},
 {...job,id:'one',createdAt:'2026-10-08T12:00:00Z'},
 {...job,id:'review',status:'completed',paidCents:8000,createdAt:'2026-10-08T12:00:00Z'},
 {...job,id:'repeat-six',status:'completed',service:'Window Cleaning',paidCents:8000,createdAt:'2026-04-01T12:00:00Z'},
 {...job,id:'repeat-year',status:'completed',paidCents:8000,createdAt:'2025-10-01T12:00:00Z'},
 {...job,id:'already-requested',status:'completed',paidCents:8000,createdAt:'2026-10-08T12:00:00Z',lastReviewRequestAt:'now',lastRebookMessageAt:'now'},
];
state=[[],true,''];responder=()=>ok(fixtures.map(e=>({...e,totalCents:String(e.totalCents),paidCents:String(e.paidCents)})));render();effect();await settle();equal(state[0][0].totalCents,10000);equal(state[0][0].paidCents,2000);
const all=nodes(render());const actions=all.filter(n=>n.type===stubs.MessageComposer);equal(actions.length,9);
const expected={'exception':'invoiceReminder','invoice':'invoiceReminder','appointment':'appointmentReminder','seven':'followUp7','three':'followUp3','one':'followUp1','review':'review','repeat-six':'winBack6','repeat-year':'winBack11'};
for(const action of actions){equal(action.props.initialTemplate,expected[action.props.estimate.id]);equal(action.props.customer.estimateTotal,8000);equal(action.props.customer.email,'qa@example.test');}
equal(actions[0].props.estimate.id,'exception');equal(actions[1].props.estimate.id,'appointment');
equal(all.some(n=>n.type==='small'&&Array.isArray(n.props.children)&&n.props.children.includes('$60.00')),true);
equal(nodes(render('Window')).filter(n=>n.type===stubs.MessageComposer).length,1);
state=[[],true,''];responder=()=>ok([]);render();effect();await settle();equal(nodes(render()).some(n=>n.props?.children==='You’re caught up'),true);equal(nodes(render()).some(n=>n.props?.role==='alert'),false);
console.log(`PASS ${checks}/${checks}: actual follow-up load/error/retry handlers distinguish failed reads from no actions, retain records, restore recommendations, and preserve billing exception/reminder priorities, appointment timing, review/recurrence suppression, revised totals and message-draft props. Mocked reads only; no message prepared or sent.`);
