import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const execute=(expression,context)=>vm.runInNewContext(ts.transpile(`(${expression})`,{target:ts.ScriptTarget.ES2022}),context);
let entryCount=0,themeHandler;
function walk(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='toggleTheme')themeHandler=node.initializer.getText(ast);
 if(ts.isJsxOpeningElement(node)){
  const attrs=node.attributes.properties;
  const label=attrs.find(a=>a.name?.getText(ast)==='aria-label');
  if(label?.initializer?.text==='Open owner account'){
   const handler=attrs.find(a=>a.name?.getText(ast)==='onClick').initializer.expression.getText(ast);
   const events=[];execute(handler,{setTab:value=>events.push(['tab',value]),setMobileMenu:value=>events.push(['menu',value])})();
   assert.deepEqual(events[0],['tab','owner-account']);
   if(attrs.some(a=>a.name?.getText(ast)==='className'&&a.initializer?.text==='sidebar-foot'))assert.deepEqual(events[1],['menu',false]);
   entryCount++;
  }
 }
 ts.forEachChild(node,walk);
}
walk(ast);assert.equal(entryCount,2);
for(const theme of ['light','dark']){
 const changes=[];const document={documentElement:{dataset:{theme}}};
 execute(themeHandler,{theme,setTheme:value=>changes.push(value),document,window:{localStorage:{setItem:(key,value)=>changes.push([key,value])}}})();
 const next=theme==='light'?'dark':'light';assert.equal(document.documentElement.dataset.theme,next);assert.deepEqual(changes,[next,['fire-theme',next]]);
}
const exports={};const compiled=ts.transpileModule(readFileSync('app/owner-account.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(compiled,{exports,require});
for(const theme of ['light','dark']){
 let clicks=0;const tree=exports.OwnerAccountView({theme,onToggleTheme:()=>clicks++});
 const html=renderToStaticMarkup(tree);
 for(const expected of ['Owner Account','Kyle Brooks','First In Response Exteriors','(918) 922-9366','LIVE','ChatGPT sign-in'])assert.ok(html.includes(expected),expected);
 assert.ok(!html.includes('DOOMSDAY'));assert.ok(!html.includes('<input'));assert.ok(!html.includes('password'));
 const buttons=[];const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='button')buttons.push(node);visit(node.props?.children);};visit(tree);
 assert.equal(buttons.length,1);buttons[0].props.onClick();assert.equal(clicks,1);
 assert.ok(html.includes(`Switch to ${theme==='light'?'dark':'light'} mode`));
}
for(const marker of ['["settings", "Templates", Settings]','tab === "settings" ? <SettingsView/>','tab === "owner-account" ? <OwnerAccountView environment={environment} theme={theme} onToggleTheme={toggleTheme}/>','className="mobile-back-button"','className={`mobile-home-button','className="bottom-nav"'])assert.ok(dashboard.includes(marker));
// Public documents must never render owner-only floating navigation.
for(const path of ['app/estimate/[token]/page.tsx','app/invoice/[token]/page.tsx','app/pay/[id]/page.tsx']){
 const current=readFileSync(path,'utf8');
 for(const marker of ['PortalNavigation','mobile-back-button','mobile-home-button','isOwner'])assert.ok(!current.includes(marker),`${path}: ${marker}`);
}
// Billing/refund and notification changes are exercised by test-public-document-guards.mjs.
for(const path of ['app/page.tsx','app/chatgpt-auth.ts'])assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show',`776bbe8c894877d6c199aa8b8f041feeb949ba8e:${path}`],{encoding:'utf8'}));
console.log('PASS: owner entry actions, mobile menu close, light/dark rendering, theme persistence, Templates separation, dashboard navigation, public documents omit owner controls, owner auth unchanged.');
