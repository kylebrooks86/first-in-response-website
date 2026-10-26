/** Actual paginated EstimatesView: synthetic reads only, no customer/payment writes. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimatesView'),names=[],tags=new Set();
function walk(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,walk);}walk(fn);
const row=id=>({id,customer:'Synthetic '+id,service:'Wash',status:'approved',totalCents:10000,depositCents:5000,paidCents:0,createdAt:'2026-10-20'}),ok=(estimates,nextCursor=null)=>({ok:true,json:async()=>({estimates,nextCursor})}),flush=()=>new Promise(r=>setImmediate(r));
const nodes=tree=>{const out=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;out.push(n);visit(n.props?.children);}visit(tree);return out;};
function fixture(){let state=[],refs=[],cursor=0,ref=0,fetcher,effects=[];const requests=[],stubs=Object.fromEntries([...tags].map(t=>[t,()=>null]));
 const context={exports:{},require,...stubs,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef(initial){return refs[ref++]??(refs[ref-1]={current:initial});},useEffect(fn){effects.push(fn);},fetch:(url)=>{requests.push(url);return fetcher(url);},window:{setTimeout(fn){fn();return 1;},clearTimeout(){}},resolvedBillingTotalCents:e=>e.invoiceTotalCents??e.totalCents,money:String,statusLabel:String,dateTime:String};
 const source=fn.getText(ast).replace('  const searched=rows;','  exports.load=load;\n  const searched=rows;');vm.runInNewContext(ts.transpileModule(source+'\nexports.view=EstimatesView;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const render=()=>{cursor=0;ref=0;effects=[];return context.exports.view({searchQuery:'',onSaved(){}});};render();const set=(key,v)=>state[names.indexOf(key)]=v,get=key=>state[names.indexOf(key)];return {render,set,get,requests,fetch:f=>fetcher=f,load:(append=false)=>context.exports.load(append),button:label=>nodes(render()).find(n=>n.props?.onClick&&n.props.children===label),cleanup:()=>effects.find(f=>String(f).includes('setTimeout'))()};
}
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const failures=[()=>Promise.reject(Error('Offline')),()=>({ok:false,json:async()=>({error:'Denied'})}),()=>({ok:true,json:async()=>{throw Error('Unreadable');}}),()=>({ok:true,json:async()=>null}),()=>ok([null]),()=>ok([{}]),()=>ok([row('a'),row('a')]),()=>ok([row('a')],{}),()=>ok([row('a')],''),()=>ok([], 'next'),()=>ok([row('a')], 'x'.repeat(513)),()=>ok([{...row('a'),totalCents:'bad'}]),()=>ok([{...row('a'),paidCents:null}]),()=>ok([{...row('a'),invoiceTotalCents:Infinity}]),()=>ok([{...row('a'),depositCents:1.2}]),()=>ok(Array.from({length:51},(_,i)=>row(String(i))))];
for(const mode of ['pipeline','list'])for(const fail of failures){
 const f=fixture();f.set('rows',[row('old')]);f.set('selected',row('old'));f.set('view',mode);f.set('nextCursor','old-cursor');f.set('loading',false);f.render();f.fetch(fail);await f.load();eq(f.get('rows')[0].id,'old','Failure preserves cached source rows');assert.ok(f.get('error'));checks++;
 const all=nodes(f.render());eq(all.some(n=>['pipeline-board','estimate-list'].includes(n.props?.className)),false,'Failed new query hides prior results');eq(all.some(n=>n.props?.role==='status'),false,'Old totals/history count cannot masquerade as query result');eq(Boolean(f.button('Try again')),true);eq(Boolean(f.button('Retry older estimates')),false);
 f.set('historySearch','New query');f.render();f.fetch(()=>ok([row('new')]));f.button('Try again').props.onClick();await flush();eq(f.get('rows').map(r=>r.id).join(','),'new');eq(f.get('error'),'');eq(f.requests.at(-1).includes('q=New%20query'),true,'Retry uses current query');eq(Boolean(f.button('Load older estimates')),false);
}
{
 const f=fixture();f.set('rows',[row('first')]);f.set('nextCursor','cursor-1');f.set('selected',row('first'));f.set('loading',false);f.render();f.fetch(()=>{throw Error('Older page offline');});await f.load(true);eq(f.get('selected').id,'first');eq(nodes(f.render()).some(n=>n.props?.className==='estimate-list'),true,'Preserved older records stay in the default simple Estimates list when another page fails');eq(Boolean(f.button('Retry older estimates')),true);eq(Boolean(f.button('Try again')),false);
 f.fetch(()=>ok([row('older')], 'cursor-1'));await f.load(true);assert.match(f.get('error'),/paging/);checks++;eq(f.get('rows').length,1,'Looped cursor cannot publish page');
 f.fetch(()=>ok([row('first'),row('older')]));await f.load(true);eq(f.get('rows').map(r=>r.id).join(','),'first,older');eq(f.get('selected').id,'first','Appending must preserve open details');eq(f.get('error'),'');
}
{
 const f=fixture();let resolve;f.fetch(()=>new Promise(r=>resolve=r));const old=f.load();f.fetch(()=>ok([row('latest')]));await f.load();resolve(ok([row('stale')]));await old;eq(f.get('rows')[0].id,'latest');eq(f.get('loading'),false);
}
{
 const f=fixture(),age=36*3600000,now=Date.now();
 const sent=(id,hours,extra={})=>({...row(id),status:'sent',firstViewedAt:new Date(now-hours*3600000).toISOString(),...extra});
 f.set('loading',false);
 f.set('error','');
 f.set('view','list');
 f.set('rows',[sent('viewed-48',48),sent('viewed-36',36),sent('too-new',8),sent('approved',72,{status:'approved'}),sent('invoice',60,{invoiceId:'inv-1'}),sent('no-view',4,{firstViewedAt:null})]);
 const button=nodes(f.render()).find(n=>n.props?.['aria-pressed']===false&&String(n.props?.children).includes('Viewed · awaiting decision'));
 assert.ok(button,'Viewed-estimate filter is available on mobile');
 button.props.onClick();
 eq(f.get('viewedOnly'),true,'Owner controls viewed filter without mutating records');
 eq(f.get('view'),'list','Filter opens mobile-friendly list');
 eq(f.get('filter'),'all','Old status chip filters do not hide selected viewed jobs');
 const cards=nodes(f.render()).filter(n=>n.props?.className==='estimate-card');
 eq(cards.length,2,'Only older viewed, unapproved, uninvoiced jobs are visible');
 eq(String(cards[0].props.children[1]?.props?.children?.[0]?.props?.children??'').length>0,true,'Cards retain saved job identity');
 const off=nodes(f.render()).find(n=>n.props?.['aria-pressed']===true&&String(n.props?.children).includes('Viewed · awaiting decision'));
 off.props.onClick();eq(f.get('viewedOnly'),false,'Owner can restore full list without touching status or billing');
}
{
 const f=fixture();f.set('loading',false);f.set('rows',[row('new-lead')]);f.set('view','list');
 eq(nodes(f.render()).some(n=>String(n.props?.children).includes('Viewed · awaiting decision')),false,'No empty Viewed filter clutter before customer actually views a quote');
 f.set('viewedOnly',true);
 eq(nodes(f.render()).some(n=>String(n.props?.children).includes('Viewed · awaiting decision')),true,'Selected Viewed filter remains available to clear even if its queue becomes empty');
}
{
  const f=fixture();f.set('loading',false);f.set('error','');f.set('view','pipeline');
  f.set('rows',[]);let tree=nodes(f.render());
  eq(tree.filter(n=>String(n.props?.className??'').startsWith('pipeline-column ')).length,0,'Brand-new account avoids seven empty pipeline columns');
  eq(tree.filter(n=>n.props?.className==='estimate-pipeline-empty').length,1,'Empty pipeline uses one compact placeholder');
  eq(tree.some(n=>n.props?.children==='No estimates yet'),true,'First use tells the owner what to do without seven labels');
  f.set('rows',[row('only-approved')]);tree=nodes(f.render());
  let stages=tree.filter(n=>String(n.props?.className??'').startsWith('pipeline-column '));
  eq(stages.length,1,'One saved quote shows only its occupied pipeline stage');
  eq(stages[0].props.className,'pipeline-column approved','Single occupied column retains status');
  eq(tree.some(n=>n.props?.className==='estimate-pipeline-empty'),false,'Empty placeholder disappears with a saved estimate');
  f.set('rows',[row('only-approved'),{...row('sent-quote'),status:'sent'}]);tree=nodes(f.render());
  stages=tree.filter(n=>String(n.props?.className??'').startsWith('pipeline-column '));
  eq(stages.length,2,'A second occupied pipeline stage is immediately visible');
  eq(stages.map(n=>n.props.className).join(','),'pipeline-column sent,pipeline-column approved','Occupied stages retain business pipeline order');
  eq(tree.filter(n=>n.props?.className==='pipeline-card').length,2,'All visible estimate cards remain accessible');
}
console.log(`PASS ${checks}/${checks}: real estimate-history recovery, compact useful-only viewed filters and guarded paging. Synthetic reads only.`);
