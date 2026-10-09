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
console.log(`PASS ${checks}/${checks}: actual committed section effect resets once across navigation, preserves same-section updates and Back history; simulated window only, not Safari rendering.`);
