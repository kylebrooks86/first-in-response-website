import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helpers=['resolvedBillingTotalCents','billingBalanceCents'];
const declarations=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>helpers.includes(d.name.getText(ast))));
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ScheduleView');
let state=[],cursor=0,effect,requests=[],responder;
const stubs=Object.fromEntries(['Button','EstimateDetail','ScheduleWeather','Navigation','Clock3','ChevronRight','CalendarDays'].map(name=>[name,()=>null]));
const context={exports:{},require,Error,Array,...stubs,
 useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
 useEffect(fn){effect=fn;},useCurrentTime:()=>Date.parse('2026-10-09T12:00:00Z'),fetch:async url=>{requests.push(url);return responder(url);},money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s,dateTime:s=>s,
};
vm.runInNewContext(ts.transpileModule(declarations.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=ScheduleView;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
function render(searchQuery=''){cursor=0;return context.exports.view({searchQuery});}
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
async function settle(){for(let i=0;i<16;i++)await Promise.resolve();assert.equal(state[2],false,'Load must settle');}
const job={id:'job-synthetic',customer:'Synthetic QA',service:'House Wash',status:'scheduled',scheduledAt:'2026-10-10T12:00:00Z',address:'123 A & B St, Tulsa',totalCents:10000,invoiceTotalCents:8000,depositCents:5000,paidCents:2000};
const ok=estimates=>({ok:true,json:async()=>({estimates})});
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
const failures=[
 [()=>({ok:false,json:async()=>({error:'Schedule access denied'})}),'Schedule access denied'],
 [()=>({ok:false,json:async()=>({})}),'Schedule could not be loaded.'],
 [()=>{throw new Error('Offline');},'Offline'],
 [()=>({ok:true,json:async()=>{throw new Error('Unreadable response');}}),'Unreadable response'],
 [()=>({ok:true,json:async()=>({})}),'Schedule records could not be read. Try again.'],
 [()=>({ok:true,json:async()=>({estimates:{}})}),'Schedule records could not be read. Try again.'],
 [()=>{throw 'connection failed';},'Schedule could not be loaded.'],
];
for(const [fail,message] of failures)for(const populated of [false,true]){
 state=[populated?[job]:[],populated?job:null,true,''];responder=fail;requests=[];
 const initial=nodes(render());equal(initial.find(n=>n.type===stubs.EstimateDetail).props.estimate,null);equal(initial.some(n=>n.props?.className==='route-day-button'),false);equal(initial.find(n=>n.type===stubs.ScheduleWeather).props.nextJobAt,undefined);
 effect();await settle();equal(state[3],message);equal(state[0].length,populated?1:0);equal(state[1],null);
 const all=nodes(render());const alert=all.find(n=>n.props?.role==='alert');assert.ok(alert);checks++;
 equal(alert.props.children[0].props.children,message);equal(all.some(n=>n.props?.className==='schedule-board'),false);equal(all.some(n=>n.props?.className==='route-day-button'),false);equal(all.some(n=>n.props?.children==='No upcoming jobs'),false);equal(all.find(n=>n.type===stubs.ScheduleWeather).props.nextJobAt,undefined);
 responder=()=>ok([job]);requests=[];alert.props.children[1].props.onClick();await settle();equal(state[3],'');equal(requests.length,1);equal(requests[0],'/api/estimates');
 const recovered=nodes(render());equal(recovered.some(n=>n.props?.role==='alert'),false);equal(recovered.find(n=>n.type===stubs.ScheduleWeather).props.nextJobAt,job.scheduledAt);
 const card=recovered.find(n=>n.props?.className==='schedule-job');assert.ok(card);checks++;card.props.onClick();equal(state[1].id,job.id);
 const route=recovered.find(n=>n.props?.className==='route-day-button');equal(new URL(route.props.href).searchParams.get('destination'),job.address);
}
// Successful schedule retains sorted same-day routing and attention/balance rules.
const fixtures=[{...job,id:'later',scheduledAt:'2026-10-10T15:00:00Z',address:'456 Later Rd'},job,
 {...job,id:'next-day',scheduledAt:'2026-10-11T12:00:00Z'},
 {...job,id:'future-approved',status:'approved'},
 {...job,id:'past-open',scheduledAt:'2026-10-08T12:00:00Z',status:'completed'},
 {...job,id:'past-paid',scheduledAt:'2026-10-08T13:00:00Z',status:'completed',paidCents:8000},
 {...job,id:'past-declined',scheduledAt:'2026-10-08T14:00:00Z',status:'declined'}];
state=[[],null,true,''];responder=()=>ok(fixtures.map(e=>({...e,totalCents:String(e.totalCents),paidCents:String(e.paidCents),depositCents:String(e.depositCents)})));render();effect();await settle();equal(state[0][0].totalCents,10000);equal(state[0][0].depositCents,5000);equal(state[0][0].paidCents,2000);
const all=nodes(render());const cards=all.filter(n=>n.props?.className==='schedule-job');equal(cards.length,3);equal(cards[0].key,job.id);equal(cards[1].key,'later');equal(cards[2].key,'next-day');
const route=new URL(all.find(n=>n.props?.className==='route-day-button').props.href);equal(route.searchParams.get('destination'),'456 Later Rd');equal(route.searchParams.get('waypoints'),job.address);
const attention=all.find(n=>n.props?.className==='needs-attention');const overdue=nodes(attention).filter(n=>n.type==='button');equal(overdue.length,1);equal(overdue[0].key,'past-open');equal(nodes(overdue[0]).find(n=>n.type==='b').props.children.join(''),'$60.00 due');overdue[0].props.onClick();equal(state[1].id,'past-open');
const detail=nodes(render()).find(n=>n.type===stubs.EstimateDetail);detail.props.onChanged({...job,status:'completed',paidCents:8000});equal(state[0].find(e=>e.id===job.id).status,'completed');equal(state[1].paidCents,8000);detail.props.onClose();equal(state[1],null);
equal(nodes(render('456 later')).filter(n=>n.props?.className==='schedule-job').length,1);equal(nodes(render('absent')).some(n=>n.props?.children==='No upcoming jobs'),true);
state=[[],null,true,''];responder=()=>ok([]);render();effect();await settle();equal(nodes(render()).some(n=>n.props?.children==='No upcoming jobs'),true);equal(nodes(render()).some(n=>n.props?.role==='alert'),false);
console.log(`PASS ${checks}/${checks}: actual schedule load/error/retry handlers preserve records, hide stale route/editor/forecast targets, recover jobs, and retain sorted same-day routes, overdue revised balances, selection/change/close callbacks and search. Mocked reads only.`);
