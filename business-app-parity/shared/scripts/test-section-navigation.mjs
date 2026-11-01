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


// Release blocker regression: every cross-section owner shortcut must ask the
// shared unsaved-editor guard BEFORE mutating customer, quote, task, or search focus.
const expectedQuickActions = {
 DashboardView:['onOpenEstimate','onOpenCustomer','onOpenCustomerActivity','onOpenTask','onOpenDoorHouse'],
 CustomersView:['onPreparePickupTask','onPrepareReviewTask','onOpenTerritory'],
 FollowUpsView:['onOpenEstimate','onOpenCustomer'],
 ScheduleView:['onNavigate','onOpenCustomer'],
 DoorKnocking:['onCreateCustomer','onOpenCustomer'],
 BusinessView:['onOpenCustomer','onOpenCustomerActivity'],
 PaymentsView:['onOpenEstimate','onOpenCustomerReview'],
};
const quickActionNodes=[];
function findQuickActions(node){
 if(ts.isJsxSelfClosingElement(node)){
  const kind=node.tagName.getText(ast);
  for(const prop of expectedQuickActions[kind]||[]){
   const attribute=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text===prop);
   assert.ok(attribute&&ts.isJsxExpression(attribute.initializer)&&attribute.initializer.expression,kind+'.'+prop+' must remain a handler');
   quickActionNodes.push({kind,prop,node:attribute.initializer.expression});
  }
 }
 ts.forEachChild(node,findQuickActions);
}
findQuickActions(dashboard);
eq(quickActionNodes.length,18,'All 18 original owner cross-section quick-action handlers are covered');
for(const {kind,prop,node} of quickActionNodes){
 const hits=[],scope={customerActivityRequest:{current:3},setTab:destination=>{hits.push('authorize:'+destination);return false;}};
 const setters=['setSearchQuery','setGlobalQuery','setFocusEstimateId','setEstimateRefreshKey','setFocusCustomerId','setFocusCustomerSection','setCustomerActivityFocus','setFocusBusinessTaskHint','setFocusBusinessTaskId','setPickupTaskDraft','setReviewTaskDraft','setFocusDoorHouseId','setFocusFollowupEstimateId','setTerritoryCustomerAddress','setFocusTerritoryAddress'];
 for(const key of setters)scope[key]=()=>hits.push('mutate:'+key);
 runHandler(node,ast,scope)('synthetic-id','review');
 eq(hits.length,1,kind+'.'+prop+' does not change drafts, focus, search or task when navigation is refused');
 eq(hits[0].startsWith('authorize:'),true,kind+'.'+prop+' checks the navigation guard before mutations');
 eq(scope.customerActivityRequest.current,3,kind+'.'+prop+' cannot consume an activity request ID after cancellation');
}
// Sidebar and Home also must preserve the currently open navigation surface if
// the user selects Cancel on an unsaved Settings/customer note warning.
assert.match(source,/onClick=\{\(\)=>\{if\(setTab\(id\)\)setMobileMenu\(false\);\}\}/,'Sidebar menu only closes after accepted navigation');checks++;
assert.match(source,/const goHome = \(\) => \{ if\(setTab\("dashboard"\)\)setMobileMenu\(false\); \};/,'Home retains menu context when navigation is rejected');checks++;


// Customer review-status deferral is a persisted write, just like a note.
// Extract and execute the real Customer screen's parent status effects.
const customerScreen=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
assert.ok(customerScreen,'Customer screen is present');
const customerGuardEffects=[];
function findCustomerStatusEffects(node){
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('onNoteDraftStatusChange'))
  customerGuardEffects.push(node.arguments[0]);
 ts.forEachChild(node,findCustomerStatusEffects);
}
findCustomerStatusEffects(customerScreen);
eq(customerGuardEffects.length,2,'Customer status update and unmount cleanup are separate effects');
const updateStatusEffect=customerGuardEffects.find(node=>node.getText(ast).includes('const dirty='));
const unmountStatusEffect=customerGuardEffects.find(node=>node!==updateStatusEffect);
assert.ok(updateStatusEffect&&unmountStatusEffect,'Both customer status lifetimes are represented');
function runCustomerEffect(node,scope){
 const js=ts.transpileModule('const __customerEffect='+node.getText(ast)+';\n__customerEffect()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(js,scope);
}
for(const [savingNote,reviewCheckSnoozing,draft,expectedDirty,expectedSaving] of [
 [false,false,'',false,false],
 [false,false,'Unfinished gate code',true,false],
 [true,false,'',false,true],
 [false,true,'',false,true],
 [true,true,'Unfinished draft',true,true],
]){
 const statuses=[];
 const cleanup=runCustomerEffect(updateStatusEffect,{
  noteText:draft,noteDrafts:{current:{}},savingNote,reviewCheckSnoozing,
  onNoteDraftStatusChange:status=>statuses.push(status)
 });
 eq(cleanup,undefined,'Typing cannot run a false-cleanup between customer draft status updates');
 eq(statuses.length,1,'One status update per rendered customer editor state');
 eq(statuses[0].dirty,expectedDirty,'Unsaved customer draft status is accurate');
 eq(statuses[0].saving,expectedSaving,'In-flight customer note and review-check saves are both protected');
}
const unmounted=[];const dispose=runCustomerEffect(unmountStatusEffect,{onNoteDraftStatusChange:status=>unmounted.push(status)});
eq(unmounted.length,0,'Customer section stays protected until the component actually unmounts');
dispose();
eq(unmounted.length,1,'Unmount fires exactly one status cleanup');
eq(unmounted[0].dirty,false,'Unmount clears customer dirty status');
eq(unmounted[0].saving,false,'Unmount releases customer saving lock');
assert.match(source,/A customer update is saving\. Wait for confirmation before leaving Customers\./,'Saving warning covers review-status check as well as customer notes');checks++;


// High-frequency quote/payment fields: accessible names must point to controls.
const estimateEditor=source.slice(source.indexOf('function EditEstimateDialog('),source.indexOf('function EditInvoiceDialog('));
assert.ok(estimateEditor.length>1000,'Estimate editing source exists');
for(const key of ['edit-estimate-service','edit-estimate-description','edit-estimate-quantity']){
 const expression=String.fromCharCode(96)+key+'-'+String.fromCharCode(36)+'{index}'+String.fromCharCode(96);
 assert.ok(estimateEditor.includes('htmlFor={'+expression+'}'),key+' has an associated visible label');
 assert.ok(estimateEditor.includes('id={'+expression+'}'),key+' has a corresponding real input or select');
 checks+=2;
}
for(const key of ['payment-gross-','payment-fee-','payment-net-','payment-reference-','payment-tip-']){
 assert.ok(source.includes('htmlFor={"'+key+'"+estimate.id}'),key+' has a visible label');
 assert.ok(source.includes('id={"'+key+'"+estimate.id}'),key+' label points to the matching payment input');
 checks+=2;
}


// Business records are high-value: drafts and uncertain task/expense writes must
// survive a canceled section change. Exercise the real component expressions.
const businessScreen=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='BusinessView');
assert.ok(businessScreen,'Business screen source exists');
const businessDefaults={title:'',dueAt:'',taskNotes:'',taskCustomer:'none',description:'',amount:'',expenseDate:'',category:'Supplies',
 expenseEstimate:'none',rescheduleEditingId:null,rescheduleDateInput:'',taskRecoveryId:null,expenseRecoveryId:null,pendingBackup:null,
 taskSaving:false,expenseSaving:false,taskToggling:null,rescheduleSaving:false,restoreBusy:false};
const evalBusiness=(variableName,overrides={})=>{
 const value=variable(businessScreen,variableName).getText(ast);
 const js=ts.transpileModule('('+value+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(js,{...businessDefaults,...overrides});
};
eq(evalBusiness('businessDraftDirty'),false,'Empty Business form is not an unsaved edit');
for(const state of [{title:'Yard sign pickup'},{description:'Fuel'},{amount:'12.50'},{taskNotes:'Call after shift'},
 {dueAt:'2026-11-01T10:00'},{expenseEstimate:'synthetic-estimate'},{taskRecoveryId:'synthetic-uncertain'},
 {pendingBackup:{format:'synthetic'}},{rescheduleEditingId:'synthetic-task'}]){
 eq(evalBusiness('businessDraftDirty',state),true,'Business does not lose prepared work on navigation');
}
eq(evalBusiness('businessWriteSaving'),false,'Idle Business screen is free to navigate');
for(const state of [{taskSaving:true},{expenseSaving:true},{taskToggling:'synthetic-task'},
 {rescheduleSaving:true},{restoreBusy:true}]){
 eq(evalBusiness('businessWriteSaving',state),true,'In-flight Business writes block section exit');
}
const tabInitializer=variable(dashboard,'setTab');
assert.ok(ts.isCallExpression(tabInitializer),'Dashboard shared navigation guard uses a callback');
const sharedTabGuard=tabInitializer.arguments[0];
for(const [dirty,saving,approve,expected,reason] of [
 [false,false,true,true,'clean Business section can leave'],
 [true,false,false,false,'Cancel keeps task/expense draft'],
 [true,false,true,true,'Confirm can deliberately discard a draft'],
 [false,true,true,false,'Saving blocks exit regardless of confirmation']
]){
 const events=[],work={dirty,saving};
 const scope={currentTab:{current:'business'},businessWorkStateRef:{current:work},
  customerNoteStateRef:{current:{dirty:false,saving:false}},
  settingsDirtyRef:{current:false},settingsSavingRef:{current:false},
  setTabState:dest=>events.push('commit:'+dest),
  window:{alert:()=>events.push('alert'),confirm:()=>{events.push('confirm');return approve;}}};
 const accepted=runHandler(sharedTabGuard,ast,scope)('customers');
 eq(accepted,expected,'Business navigation outcome: '+reason);
 eq(events.some(v=>v.startsWith('commit:')),expected,'No accidental screen change: '+reason);
 if(saving)eq(events.filter(x=>x==='alert').length,1,'Pending write displays one explanatory warning');
 if(dirty&&!saving&&!approve)eq(work.dirty,true,'Cancel retains the original dirty state');
}
assert.match(source,/<BusinessView onWorkStatusChange=\{setBusinessWorkState\}/,'Parent receives Business source status');checks++;


// Customer Back must not hide a record while a note or review-check write is
// still being confirmed. Both visible back controls share this exact handler.
const customerCloseDeclaration=variable(customerScreen,'closeCustomerRecord');
assert.ok(ts.isCallExpression(customerCloseDeclaration),'Customer Back is a stable callback');
const customerCloseAction=customerCloseDeclaration.arguments[0];
for(const [noteBusy,reviewBusy,blocked] of [[false,false,false],[true,false,true],[false,true,true],[true,true,true]]){
 const calls=[];
 const scope={noteSaveLock:{current:noteBusy},reviewCheckSnoozeLock:{current:reviewBusy},
  window:{alert:message=>calls.push('alert:'+message)},
  setSelectedId:()=>calls.push('close customer'),setActiveEstimate:()=>calls.push('close estimate'),
  setSection:()=>calls.push('reset section')};
 runHandler(customerCloseAction,ast,scope)();
 eq(calls.some(x=>x==='close customer'),!blocked,'Customer Back honors pending note/review saves');
 eq(calls.some(x=>x.startsWith('alert:')),blocked,'Active customer write receives a visible warning');
 if(blocked)eq(calls.length,1,'Blocked Back does not change any customer-focused state');
}
eq((source.match(/onClick=\{closeCustomerRecord\}/g)||[]).length,2,'Both direct customer Back links use guarded action');
assert.match(source,/onRegisterBack\?\.\(selectedId\?closeCustomerRecord:null\)/,'Mobile topbar Back uses guarded customer handler');checks++;
assert.match(source,/if\(!focusCustomerId\|\|loading\|\|error\|\|offlinePhotoOnly\|\|savingNote\|\|reviewCheckSnoozing\)return;/,'Deep links wait until pending customer saves finish');checks++;

// Settings must report the current dirty/save state without clearing the parent
// guard on each keystroke. Only the separate unmount effect resets the shell.
const settingsScreen=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='SettingsView');
assert.ok(settingsScreen,'Settings template editor source exists');
const settingsStatusEffects=[];
function findSettingsStatusEffect(node){
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
  const cb=node.arguments[0]?.getText(ast)||'';
  if(cb.includes('onDirtyChange?.(')||cb.includes('onSavingChange?.('))settingsStatusEffects.push(node);
 }
 ts.forEachChild(node,findSettingsStatusEffect);
}
findSettingsStatusEffect(settingsScreen);
eq(settingsStatusEffects.length,4,'Each Settings guard has a separate update and unmount-only effect');
for(const [handler,prop] of [['onDirtyChange','hasUnsavedTemplateChanges'],['onSavingChange','saving']]){
 const matching=settingsStatusEffects.filter(node=>node.arguments[0].getText(ast).includes(handler+'?.('));
 eq(matching.length,2,handler+' has exactly two scoped effects');
 const update=matching.find(node=>node.arguments[1].getText(ast).includes(prop));
 const cleanup=matching.find(node=>node.arguments[1].getText(ast)==='['+handler+']');
 assert.ok(update&&cleanup,handler+' includes a state update and unmount-only cleanup');
 const events=[],scope={[prop]:true,[handler]:value=>events.push(value)};
 const onUpdate=runHandler(update.arguments[0],ast,scope);
 const onUnmount=runHandler(cleanup.arguments[0],ast,{...scope});
 eq(onUpdate(),undefined,handler+' dependency update installs no transient false cleanup');
 eq(events,[true],handler+' reports active dirty or saving state');
 scope[prop]=false;
 onUpdate();
 eq(events,[true,false],handler+' reports state transitions without intermediate false on prior cleanup');
 scope[prop]=true;
 onUpdate();
 eq(events,[true,false,true],handler+' can become guarded again');
 const destructor=onUnmount();
 eq(typeof destructor,'function',handler+' has a real unmount release');
 destructor();
 eq(events,[true,false,true,false],handler+' clears parent status only on actual unmount');
}

console.log(`PASS ${checks}/${checks}: actual committed section effect resets once across navigation, preserves same-section updates and Back history; simulated window only, not Safari rendering.`);
