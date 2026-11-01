import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const dashboard=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Dashboard');
const effects=[];
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useLayoutEffect')effects.push(n);ts.forEachChild(n,visit);}
visit(dashboard);
assert.equal(effects.length,1);
const effect=effects[0];assert.equal(effect.arguments[1].getText(ast),'[tab]');
const js=ts.transpileModule(`(${effect.arguments[0].getText(ast)})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let checks=2;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const currentTab={current:'dashboard'},tabHistory={current:[]},backDestination={current:null},scrolls=[];
function commit(tab){vm.runInNewContext(js,{tab,currentTab,tabHistory,backDestination,window:{scrollTo:options=>scrolls.push({...options})}});}
const backCall=variable(dashboard,'goBack').getText(ast);
assert.ok(backCall,'Actual top Back handler is present');
const backJs=ts.transpileModule('('+backCall+')()', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function pressBack(){let destination=null;vm.runInNewContext(backJs,{currentTab,tabHistory,backDestination,tab:currentTab.current,mobileMenu:false,customerBackHandler:{current:null},setTab:target=>{destination=target;return true;},setMobileMenu:()=>{}});if(destination!==null)commit(destination);}
commit('dashboard');eq(scrolls.length,0,'Mount must not override browser/restored position');
const sections=['customers','estimates','invoices','payments','schedule','contracts','followups','insights','business','settings','owner-account','dashboard'];
for(const tab of sections){
 const old=currentTab.current,count=scrolls.length;
 commit(tab);
 eq(scrolls.length,count+1,'Every committed main section resets once');
 eq(scrolls.at(-1),{top:0,left:0,behavior:'instant'},'Reset is immediate, never animated');
 eq(tabHistory.current.at(-1),old,'Forward visit records the section left');
 eq(currentTab.current,tab);
 for(const update of ['typing','editing','modal','retry','menu','theme','Strict Mode repeat']){commit(tab);eq(scrolls.length,count+1,`${update} in same section must not reset`);}
}
const count=scrolls.length;
pressBack();eq(currentTab.current,'owner-account','Back returns to prior actual section, not a two-screen toggle');eq(scrolls.length,count+1);
pressBack();eq(currentTab.current,'settings','Second Back moves farther through the history');
pressBack();eq(currentTab.current,'business','Third Back skips prior Back destinations, rather than bouncing');
eq(backDestination.current,null,'Committed Back clears the pending gesture guard');
commit('customers');eq(tabHistory.current.at(-1),'business','New forward visit preserves the previous section');
commit('dashboard');eq(currentTab.current,'dashboard','Home uses the same committed scroll/reset policy');
pressBack();eq(currentTab.current,'customers','Back from Home returns to last working section');
for(let i=0;i<40;i++)commit(i%2?'customers':'estimates');
eq(tabHistory.current.length,30,'Navigation history is bounded without growing forever');
const stableCount=scrolls.length;commit(currentTab.current);eq(scrolls.length,stableCount,'Same-section events do not create history or scroll');
// Back uses a bounded navigation trail; it must never oscillate between two tabs.
// The policy must stay in the shared committed-section effect: callers including
// sidebar, bottom nav, dashboard shortcuts, notifications and Home/Back all set tab.
assert.match(source,/onNavigate=\{setTab\}/);checks++;
assert.match(source,/className="bottom-nav"[\s\S]*setTab\(id\)/);checks++;
assert.match(source,/const goHome = [^\n]*setTab\("dashboard"\)/);checks++;
assert.match(source,/const goBack = \(\) => \{[\s\S]*?setTab\(target\)[\s\S]*?\};/);checks++;
assert.match(source,/item\.type==="payment_failed"\?"payments"/,'Failed-Stripe-checkout notification must open Payments');checks++;
assert.match(source,/item\.type==="payment_overage"\?\(item\.estimateId\?"estimates":"payments"\)/,'Overpayment alert opens exact estimate resolution when job is known');checks++;
assert.match(source,/const destination=taskId\?"business":next==="payments"\?"payments":invoiceId\?"invoices"/,'Payment alerts cannot jump to linked estimates when Payments is requested');checks++;
// Everyday shortcuts are prioritized, while EVERY original main section stays in the menu.
const navSource=source.match(/const nav = useMemo\(\(\) => \[([\s\S]*?)\] as const, \[\]\);/)?.[1];
assert.ok(navSource,'The real dashboard must still declare its navigation');
const navIds=[...navSource.matchAll(/\["([^"]+)",\s*"[^"]+",/g)].map(match=>match[1]);
eq(navIds,["dashboard","customers","estimates","schedule","followups","invoices","payments","door-knocking","business","insights","settings"],'One Estimates entry covers quotes and agreements; every other main section remains available');
assert.match(source,/className="estimate-section-switch"/);checks++;
assert.match(source,/ContractsView searchQuery=\{historySearch\} embedded/);checks++;
assert.match(source,/tab === "contracts" \? <EstimatesView initialSection="agreements"/);checks++;
assert.match(source,/<p className="sidebar-nav-heading">Everyday<\/p>/);checks++;
assert.match(source,/nav\.slice\(0,7\)\.map/);checks++;
assert.match(source,/className="sidebar-more-nav" open=\{moreNavOpen\}/);checks++;
assert.match(source,/nav\.slice\(7\)\.map/);checks++;
assert.match(source,/useEffect\(\(\)=>\{if\(nav\.slice\(7\)\.some\(\(\[id\]\)=>id===tab\)\)setMoreNavOpen\(true\);\},\[tab,nav\]\)/);checks++;
assert.match(source,/\["dashboard","customers","estimates","schedule","followups"\]\.includes\(id\)/);checks++;
// Optional preferences must not crash the app or strand an explicit Shortcut action.
function variable(fn,name){let result;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)result=n.initializer;ts.forEachChild(n,walk);}walk(fn);assert.ok(result,name);return result;}
let themeEffect;function findTheme(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('"fire-theme"'))themeEffect=n.arguments[0];ts.forEachChild(n,findTheme);}findTheme(dashboard);assert.ok(themeEffect);
const stride=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='StrideButton');
function run(node,mode='normal',saved=null,dark=false){
 const result={theme:null,setup:null,opens:0,writes:[],dataset:{}};
 const storage={getItem:()=>{if(mode==='read-denied')throw Error('Synthetic read refusal');return saved;},setItem:(...args)=>{if(mode==='write-denied')throw Error('Synthetic write refusal');result.writes.push(args);},clear:()=>{throw Error('Never clear device data');}};
 const window={matchMedia:()=>({matches:dark})};Object.defineProperty(window,'localStorage',{get(){if(mode==='access-denied')throw Error('Synthetic storage access refusal');return storage;}});
 const context={window,document:{documentElement:{dataset:result.dataset}},theme:'light',setTheme:value=>result.theme=value,setShowSetup:value=>result.setup=value,openShortcut:()=>result.opens++};
 vm.runInNewContext(ts.transpileModule('('+node.getText(ast)+')()',{}).outputText,context);return result;
}
for(const mode of ['read-denied','access-denied']){const r=run(themeEffect,mode,null,true);eq(r.theme,'dark','Denied preference reads preserve system theme');eq(r.dataset.theme,'dark','Denied preference reads still complete app theme mount');}
eq(run(themeEffect,'normal','light',true).theme,'light','Saved valid theme wins over system');eq(run(themeEffect,'normal','unexpected',true).theme,'dark','Unknown preference uses system theme');
for(const mode of ['write-denied','access-denied']){const r=run(variable(dashboard,'toggleTheme'),mode);eq(r.theme,'dark','Theme toggles in memory when saving unavailable');eq(r.dataset.theme,'dark','Theme toggles in DOM when saving unavailable');}
eq(run(variable(dashboard,'toggleTheme')).writes,[['fire-theme','dark']],'Normal toggle still saves only its theme preference');
for(const mode of ['read-denied','access-denied']){const r=run(variable(stride,'openStride'),mode);eq(r.setup,true,'Storage refusal leaves explicit Stride setup/launch available');eq(r.opens,0,'Storage refusal cannot automatically launch a Shortcut');}
const ready=run(variable(stride,'openStride'),'normal','yes');eq(ready.opens,1,'Existing ready Shortcut remains a direct explicit action');eq(ready.setup,null,'Existing ready Shortcut does not repeat setup');
for(const mode of ['write-denied','access-denied']){const r=run(variable(stride,'testShortcut'),mode);eq(r.opens,1,'Owner-confirmed Shortcut launch survives unavailable preference writes');eq(r.setup,false,'Owner-confirmed setup closes normally');}

// Regression: Cancel on an unsaved customer note or settings template must not
// clear search context, change record focus or consume a notification shortcut.
function runHandler(initializer,tree,scope){
 const compiled=ts.transpileModule('const __handler='+initializer.getText(tree)+';\n__handler',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(compiled,scope);
}
const alertsSource=readFileSync('components/ui/alert-dialog.tsx','utf8');
assert.match(alertsSource,/max-h-\[calc\(100dvh-2rem\)\]/,'Short-screen confirmation fits within dynamic iPhone viewport');checks++;
assert.match(alertsSource,/overflow-y-auto overscroll-contain/,'Long confirmation remains scrollable with Cancel reachable');checks++;
const searchSource=readFileSync('components/global-search.tsx','utf8');
const searchAst=ts.createSourceFile('global-search.tsx',searchSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const searchComponent=searchAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='GlobalSearch');
assert.ok(searchComponent,'Actual search component must be exercised');
let chooseInitializer;
function findChoose(n){if(ts.isVariableDeclaration(n)&&n.name.getText(searchAst)==='choose')chooseInitializer=n.initializer;ts.forEachChild(n,findChoose);}
findChoose(searchComponent);
assert.ok(chooseInitializer,'Actual search selection handler must be present');
for(const permit of [false,true]){
 const calls=[];
 const context={
  onSelect:()=>{calls.push('navigate');return permit;},
  input:{current:{blur:()=>calls.push('blur')}},
  setExpanded:()=>calls.push('close'),
  setScope:()=>calls.push('reset scope'),
  onQuery:value=>calls.push('query:'+value),
 };
 runHandler(chooseInitializer,searchAst,context)({id:'synthetic-customer'});
 eq(calls,permit?['navigate','blur','close','reset scope','query:']:['navigate'],
  'Global search '+(permit?'clears only after accepted navigation':'keeps the query, dropdown and focus when navigation is refused'));
}
const searchJump=variable(dashboard,'openSearchResult');
for(const permit of [false,true]){
 const calls=[];
 const scope={setTab:dest=>{calls.push('navigate:'+dest);return permit;}};
 for(const n of ['setSearchQuery','setGlobalQuery','setMobileMenu','setFocusCustomerRecord','setFocusCustomerSection','setFocusCustomerId','setCustomerRecordRequestKey','setFocusInvoiceId','setFocusEstimateId','setEstimateRefreshKey'])scope[n]=()=>calls.push(n);
 const result=runHandler(searchJump,ast,scope)({kind:'customer',id:'synthetic-customer'});
 eq(result,permit,'Customer search selection reports navigation approval accurately');
 if(!permit)eq(calls,['navigate:customers'],'Refused customer result does not erase or retarget the current editor');
 else eq(calls[0],'navigate:customers','Accepted customer result guards before changing search or focus');
}
let notificationCallback;
function findNotification(n){
 if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='NotificationBell'){
  const attr=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='onNavigate');
  if(attr&&ts.isJsxExpression(attr.initializer))notificationCallback=attr.initializer.expression;
 }
 ts.forEachChild(n,findNotification);
}
findNotification(dashboard);
assert.ok(notificationCallback,'Actual notification navigation callback is present');
for(const [permit,args,destination] of [
 [false,['customers',null,null,'customer-1',null,'review'],'customers'],
 [false,['invoices',null,'invoice-1',null,null,null],'invoices'],
 [true,['payments','estimate-1',null,null,null,null],'payments'],
 [true,['followups','estimate-1',null,null,null,null],'followups'],
 [true,['business',null,null,'customer-1','task-1',null],'business']
]){
 const calls=[];const scope={customerActivityRequest:{current:0},setTab:dest=>{calls.push('navigate:'+dest);return permit;}};
 for(const n of ['setSearchQuery','setGlobalQuery','setCustomerActivityFocus','setPickupTaskDraft','setReviewTaskDraft','setFocusBusinessTaskHint','setFocusBusinessTaskId','setFocusInvoiceId','setFocusFollowupEstimateId','setFocusEstimateId','setEstimateRefreshKey','setFocusCustomerSection','setFocusCustomerId'])scope[n]=()=>calls.push(n);
 runHandler(notificationCallback,ast,scope)(...args);
 eq(calls[0],'navigate:'+destination,'Notification routes to intended destination before any focus update');
 if(!permit)eq(calls.length,1,'Canceled notification leaves search and record context completely untouched');
 else eq(calls.filter(x=>x.startsWith('navigate:')).length,1,'Accepted notification changes section once, avoiding duplicate prompts');
}

console.log(`PASS ${checks}/${checks}: actual committed section effect resets once across navigation, preserves same-section updates and Back history; simulated window only, not Safari rendering.`);
