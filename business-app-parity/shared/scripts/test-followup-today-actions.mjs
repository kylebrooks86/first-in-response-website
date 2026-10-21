/** Read-only Today's customer actions: real FollowUpsView, synthetic owner records. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='FollowUpsView');
assert.ok(view,'Real FollowUpsView exists');
const required=['resolvedBillingTotalCents','billingBalanceCents'];
const helpers=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>required.includes(d.name.getText(ast)))||ts.isFunctionDeclaration(n)&&['repeatCadenceMonths','addMonths'].includes(n.name?.text));
const transpiled=ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8')+'\n'+helpers.map(n=>n.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.view=FollowUpsView;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const fixed=Date.parse('2026-10-21T12:00:00Z');
class FixedDate extends Date{static now(){return fixed;}}
const t={exports:{},require,Date:FixedDate,Math,Number};vm.runInNewContext(ts.transpileModule(readFileSync('lib/follow-up-timing.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,t);
const {todayCustomerQueue,todayActionLane,followupLatestContact}=t.exports;
let assertions=0;function eq(a,b,label){assert.deepEqual(a,b,label);assertions++;}
const at=d=>new Date(fixed+d*86400000).toISOString();
const item=(id,customerId,kind='followup',template='followUp7',opts={})=>({
  kind,template,priority:3,estimate:{id,customerId,status:'sent',firstEstimateSentAt:at(-8),...opts}
});
const missed=item('old','c1');
const duplicate=item('other','c1');
const billing=item('bill','c2','followup','invoiceReminder');
const future=item('future','c3','repeat','winBack6',{});
future.dueAt=at(10);
eq(todayActionLane(missed,fixed),'now','Missed suggested outreach needs action');
eq(todayActionLane(billing,fixed),'verify','Unverified billing due date needs owner review');
eq(todayActionLane(future,fixed),null,'Future repeat-service suggestions are not called due today');
let queue=todayCustomerQueue([missed,duplicate,billing,future],fixed);
eq(queue.length,2,'Daily preview groups duplicate customer entries and omits future work');
eq(queue[0].item.estimate.id,'old','First saved action is retained');
eq(queue[0].additionalCustomerActions,1,'Other actions for the same customer are transparently counted');
eq(queue[1].item.estimate.id,'bill','Different customer and verification action remain visible');
eq(todayCustomerQueue([missed,billing],fixed,1).length,1,'Preview limit is enforced');
eq(todayCustomerQueue([missed,billing],fixed,0).length,0,'Zero limit is safe');
eq(todayCustomerQueue([missed,item('different','')],fixed).length,2,'Missing customer ID cannot collapse unrelated estimates');
const evidence=(confirmed,prepared,logged)=>followupLatestContact({lastConfirmedMessageAt:confirmed,lastPreparedAt:prepared,lastManualContactAt:logged},fixed);
eq(evidence(at(-2),at(-1),null).kind,'prepared','Newer prepared draft never inherits an older confirmed send');
eq(evidence(at(-1),at(-2),null).kind,'confirmed','Latest explicitly confirmed send is labeled correctly');
eq(evidence(at(-2),at(-3),at(-1)).kind,'logged','Newer contact note does not imply a message send');
eq(evidence(null,null,null).kind,'unverified','Missing status remains unknown');
eq(evidence('not-a-time',null,null).kind,'unverified','Malformed time fails closed');
eq(evidence(at(2),null,null).kind,'unverified','Future contact timestamp fails closed');
const stubs=Object.fromEntries(['EstimateDetail','Button','MessageComposer','Clock3','Star','CalendarDays','CheckCircle2','FileText','ChevronRight','Users','Phone','MessageSquareText','Mail','AlertTriangle'].map(x=>[x,()=>null]));
const estimate=(id,customerId,extra={})=>({id,customerId,customer:id==='q1'||id==='q2'?'Same Customer':'Another Customer',service:'House Wash',status:'sent',createdAt:at(-8),firstEstimateSentAt:at(-8),lastEstimateSentAt:at(-8),totalCents:12000,depositCents:6000,paidCents:0,paymentOverageOpen:0,...extra});
const saved=[
 estimate('q1','one',{lastConfirmedMessageAt:at(-2),lastPreparedAt:at(-1)}),
 estimate('q2','one',{lastConfirmedMessageAt:at(-3)}),
 estimate('q3','three',{lastManualContactAt:at(-2),status:'accepted',invoiceId:'invoice-three'})
];
let states=[],refs=[],si=0,ri=0,effects=[],ei=0,requests=[],opens=[],focuses=[];
const ctx={exports:{},require,Date:FixedDate,Math,Number,JSON,Error,crypto:{randomUUID:()=>{throw Error('No write allowed');}},...stubs,
 useState(value){const i=si++;if(!(i in states))states[i]=value;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},
 useRef(value){const i=ri++;return refs[i]??(refs[i]={current:value});},
 useEffect(fn){effects[ei++]=fn;},
 useCurrentTime:()=>fixed,money:n=>'$'+(n/100).toFixed(2),
 document:{getElementById:id=>({scrollIntoView:()=>focuses.push(id),focus:()=>focuses.push('focus:'+id)})},
 fetch:async(url,opts)=>{requests.push({url,opts});if(opts?.method==='POST'||opts?.method==='PATCH')throw Error('Unexpected customer write');return{ok:true,json:async()=>({estimates:saved,nextCursor:null})};}
};
vm.runInNewContext(transpiled,ctx);
function nodes(tree){const out=[];function scan(v){if(Array.isArray(v))return v.forEach(scan);if(!v||typeof v!=='object')return;out.push(v);scan(v.props?.children);}scan(tree);return out;}
const render=()=>{si=0;ri=0;ei=0;return ctx.exports.view({searchQuery:'',onOpenCustomer:id=>opens.push(id)});};
render();effects[0]();await new Promise(r=>setImmediate(r));
const v=nodes(render());
eq(v.filter(n=>n.props?.['aria-label']==='Top follow-up priorities in loaded records').length,1,'One integrated priority region');
const quick=v.filter(n=>n.props?.['aria-label']?.startsWith?.('Jump to '));
eq(quick.length,2,'Two unique customer preview actions, three original saved items');
eq(v.filter(n=>n.type===stubs.MessageComposer).length,3,'All three original actions remain in the full list');
const snippets=v.filter(n=>typeof n.props?.className==='string'&&n.props.className.includes('followup-today-item'));
eq(snippets.length,2,'Mobile queue cards are bounded by customer');
eq(JSON.stringify(snippets[0]).includes('Prepared/copied'),true,'The queue shows latest prepared state, not a false sent status');
eq(JSON.stringify(snippets[0]).includes('more saved action'),true,'Grouped secondary action is disclosed even when its count renders as a separate React text node');
quick[0].props.onClick();
eq(focuses[0],'followup-action-q1','Quick jump focuses the exact original action');
const profile=v.find(n=>n.props?.['aria-label']==='Open customer profile for Same Customer');
assert.ok(profile);profile.props.onClick();
eq(opens[0],'one','Customer shortcut targets the exact profile');
eq(requests.every(r=>r.opts?.method!=='POST'&&r.opts?.method!=='PATCH'),true,'Preview performs reads only');
eq(requests[0].url,'/api/followups?limit=50','Preview uses the existing paginated endpoint');
eq(v.some(n=>n.props?.['aria-label']==='Older customer record coverage'),false,'No false unchecked warning after a final-page response');
console.log('PASS '+assertions+'/'+assertions+' synthetic daily action queue, communication-state and real component interaction checks. No sends or customer writes.');
