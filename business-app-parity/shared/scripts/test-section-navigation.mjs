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
const currentTab={current:'dashboard'},previousTab={current:'dashboard'},scrolls=[];
function commit(tab){vm.runInNewContext(js,{tab,currentTab,previousTab,window:{scrollTo:options=>scrolls.push({...options})}});}
commit('dashboard');eq(scrolls.length,0,'Mount must not override browser/restored position');
const sections=['customers','estimates','invoices','payments','schedule','contracts','followups','insights','business','settings','owner-account','dashboard'];
for(const tab of sections){
 const old=currentTab.current,count=scrolls.length;
 commit(tab);
 eq(scrolls.length,count+1,'Every committed main section resets once');
 eq(scrolls.at(-1),{top:0,left:0,behavior:'instant'},'Reset is immediate, never animated');
 eq(previousTab.current,old,'Back history preserves the section left');
 eq(currentTab.current,tab);
 for(const update of ['typing','editing','modal','retry','menu','theme','Strict Mode repeat']){commit(tab);eq(scrolls.length,count+1,`${update} in same section must not reset`);}
}
const count=scrolls.length,target=previousTab.current;commit(target);eq(currentTab.current,target,'Back transition uses same scroll policy');eq(scrolls.length,count+1);
commit('dashboard');eq(currentTab.current,'dashboard','Home uses same policy');
// The policy must stay in the shared committed-section effect: callers including
// sidebar, bottom nav, dashboard shortcuts, notifications and Home/Back all set tab.
assert.match(source,/onNavigate=\{setTab\}/);checks++;
assert.match(source,/className="bottom-nav"[\s\S]*setTab\(id\)/);checks++;
assert.match(source,/const goHome = [^\n]*setTab\("dashboard"\)/);checks++;
assert.match(source,/const goBack = [^\n]*setTab\(target\)/);checks++;
assert.match(source,/item\.type==="payment_failed"\|\|item\.type==="payment_overage"/,'Payment activity destination is Payments');checks++;
assert.match(source,/else if\(next==="payments"\)\{setTab\("payments"\);\}/,'Payment alerts override estimate-focused navigation');checks++;
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
console.log(`PASS ${checks}/${checks}: actual committed section effect resets once across navigation, preserves same-section updates and Back history; simulated window only, not Safari rendering.`);
