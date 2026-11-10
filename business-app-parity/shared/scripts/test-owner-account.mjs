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
 for(const expected of ['Owner Account','First In Response Exteriors','(918) 922-9366','LIVE','ChatGPT sign-in'])assert.ok(html.includes(expected),expected);
 assert.ok(!html.includes('DOOMSDAY'));assert.ok(!html.includes('<input'));assert.ok(!html.includes('password'));
 assert.equal((html.match(/class="record-card"/g)||[]).length,3,'Owner Account uses three compact cards instead of redundant security panel');
 assert.ok(html.includes('Environment &amp; access')&&html.includes('Account details are view-only.'),'Environment security and non-editable identity remain clear');
 assert.ok(html.includes('href="tel:+19189229366"')&&html.includes('rel="noopener noreferrer"'),'Direct business contact links preserve safety and context');
 const buttons=[];const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='button')buttons.push(node);visit(node.props?.children);};visit(tree);
 assert.equal(buttons.length,1);buttons[0].props.onClick();assert.equal(clicks,1);
 assert.ok(html.includes(`Switch to ${theme==='light'?'dark':'light'} mode`));
}
for(const environment of ['QA','DOOMSDAY','STAGING']){
 const html=renderToStaticMarkup(exports.OwnerAccountView({environment,theme:'light',onToggleTheme:()=>{}}));
 assert.ok(html.includes(environment+' · FIRE Business App'));
 assert.ok(html.includes(environment==='QA'||environment==='DOOMSDAY'?'signed-cookie authentication':'ChatGPT sign-in'));
 assert.ok(html.includes('Records and payment settings stay separate.'),'Separate environments remain explicitly warned');
 const canSignOut=environment==='QA'||environment==='DOOMSDAY';
 assert.equal(html.includes('class="owner-account-signout"'),canSignOut,`${environment}: logout only for independent sessions`);
 if(canSignOut){
  assert.ok(html.includes('href="/api/auth/logout?return_to=%2F"'),'Use same-origin established logout route');
  assert.ok(html.includes(`Sign out of ${environment}`),'Logout names the current environment');
  assert.ok(html.includes('Saved records are not deleted.'),'Clarify signout does not delete records');
 }else assert.ok(!html.includes('/api/auth/logout'),'ChatGPT-auth targets must not expose independent-session logout');
}
const css=readFileSync('app/globals.css','utf8');
assert.match(css,/\.owner-account-view a\.owner-account-signout\{[^}]*min-height:48px[^}]*max-width:100%/,'Signout control has safe iPhone touch target');
assert.match(css,/\[data-theme="dark"\] \.owner-account-view a\.owner-account-signout\{/,'Signout dark mode contrast is specified');
assert.match(css,/\.owner-account-view \.brand-button\{[^}]*min-height:44px[^}]*max-width:100%[^}]*white-space:normal/,'Theme action has minimum 44px touch height and can wrap on narrow screens');
for(const marker of ['["settings", "Settings", Settings]','tab === "settings" ? <SettingsView onDirtyChange={setSettingsDirty} onSavingChange={setSettingsSaving}/>','tab === "owner-account" ? <OwnerAccountView environment={environment} theme={theme} onToggleTheme={toggleTheme}/>','className="mobile-back-button"','className={`mobile-home-button','className="bottom-nav"'])assert.ok(dashboard.includes(marker));
// Public documents must never render owner-only floating navigation.
for(const path of ['app/estimate/[token]/page.tsx','app/invoice/[token]/page.tsx','app/pay/[id]/page.tsx']){
 const current=readFileSync(path,'utf8');
 for(const marker of ['PortalNavigation','mobile-back-button','mobile-home-button','isOwner'])assert.ok(!current.includes(marker),`${path}: ${marker}`);
}
// Billing/refund and notification changes are exercised by test-public-document-guards.mjs.
// Pin the exact, reviewed ChatGPT owner-auth Git blob from the PR150 parent.
// The legacy historical commit-path reference did not exist in this app-only repo;
// never silently omit the auth no-change guard or weaken the runtime auth implementation.
assert.equal(execFileSync('git',['hash-object','app/chatgpt-auth.ts'],{encoding:'utf8'}).trim(),
 'eef37346915e9aafb60037c59eaea8e67507ea5a','Owner-auth module must match its reviewed unchanged Git object');
console.log('PASS: owner account navigation, light/dark rendering, QA/DR scoped sign out, preserved LIVE auth, safe touch targets, and public document isolation.');
