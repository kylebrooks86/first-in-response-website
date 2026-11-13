/** Real URL helper and React handlers with a captured native boundary. No device/provider calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),source=readFileSync('components/google-voice-text-action.tsx','utf8');
const contacts={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-contact-links.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,contacts);
let checks=0;const check=(condition,label)=>{assert.ok(condition,label);checks++;};
function fixture({unsupported=false,throws=false,confirm=true}={}){
 const states=[],refs=[],routes=[],warnings=[];let si=0,ri=0,props={phone:'9185550102',message:'  Saved body\nexact.  '};
 const context={exports:{},navigator:{userAgent:unsupported?'Android':'iPhone',platform:unsupported?'Linux':'iPhone',maxTouchPoints:1},window:{location:{assign:value=>{if(throws)throw Error('Synthetic blocked launch');routes.push(value);}},confirm:value=>{warnings.push(value);return confirm;}},fetch:()=>{throw Error('Handoff must never write records');},require:name=>{
  if(name==='react')return{useState(initial){const i=si++;if(!(i in states))states[i]=initial;return[states[i],value=>states[i]=value];},useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial});}};
  if(name==='react/jsx-runtime')return require(name);
  if(name==='@/lib/customer-contact-links')return contacts.exports;
  return new Proxy({},{get:(_target,key)=>key});
 }};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const render=()=>{si=0;ri=0;return context.exports.GoogleVoiceTextShortcutAction(props);};
 return{routes,warnings,render,button:()=>render().props.children[0],status:()=>render().props.children[1],reset:()=>render().props.children[2],change:next=>{props={...props,...next};},helper:context.exports.googleVoiceTextShortcutHref,supports:context.exports.supportsGoogleVoiceTextShortcut};
}
const {helper,supports}=fixture();
const bodies=['  Exact saved body\r\nSecond line\n\t  ','Quotes " and \\ and &text=evil#name + % ?','🔥 Café 中文 \u2028 \u0000','\ud800'];
for(const body of bodies){
 const url=new URL(helper('(918) 555-0102',body)),payload=JSON.parse(url.searchParams.get('text'));
 check(url.protocol==='shortcuts:'&&url.hostname==='run-shortcut'&&url.searchParams.get('name')==='FIRE Google Voice Text'&&url.searchParams.get('input')==='text','Only exact owner-tested text Shortcut receives direct input');
 check(JSON.stringify(payload)===JSON.stringify({phone:'+19185550102',message:body}),'JSON round trip preserves exact multiline Unicode/reserved characters');
 check([...url.searchParams.keys()].join(',')==='name,input,text','Body cannot inject parameters, callbacks or clipboard routing');
}
for(const phone of ['', 'bad','9185550102?body=x','9185550102&name=Other'])check(helper(phone,'Exact body')===null,'Invalid destination produces no URL');
for(const body of ['', ' \n\t ', 'x'.repeat(8000),'🔥'.repeat(1500)])check(helper('9185550102',body)===null,'Empty/oversized encoded input is refused without truncation');
const overhead=helper('9185550102','a').length-1,boundary='a'.repeat(8000-overhead);
check(helper('9185550102',boundary).length===8000&&helper('9185550102',boundary+'a')===null,'Exact encoded transport boundary is enforced');
check(JSON.parse(new URL(helper('9185550199','Other recipient')).searchParams.get('text')).phone==='+19185550199','Changed recipient reaches exact new destination');
for(const args of [['iPhone','iPhone',1],['iPad','iPad',5],['Macintosh','MacIntel',5]])check(supports(...args),'iPhone and iPad including desktop-mode iPad supported');
for(const args of [['Android','Linux',5],['Macintosh','MacIntel',0],['Windows','Win32',0]])check(!supports(...args),'Other devices keep manual Voice');
const direct=fixture(),click=direct.button().props.onClick;click();click();
check(direct.routes.length===1&&direct.button().props.disabled,'Same-tick duplicate text taps request one handoff and stay locked');
check(JSON.parse(new URL(direct.routes[0]).searchParams.get('text')).message==='  Saved body\nexact.  ','Actual handler passes exact saved message');
check(direct.status().props.children.includes('sending is unconfirmed'),'Opening/returning from Shortcut cannot be a delivery receipt');
direct.reset().props.onClick();check(direct.routes.length===1&&direct.warnings.length===1&&!direct.button().props.disabled,'Unsent reset warns about duplicates and never relaunches automatically');
const cancelled=fixture({confirm:false});cancelled.button().props.onClick();cancelled.reset().props.onClick();check(cancelled.button().props.disabled&&cancelled.routes.length===1,'Cancelled retry preserves duplicate protection');
for(const options of [{unsupported:true},{throws:true}]){const f=fixture(options);f.button().props.onClick();check(f.routes.length===0&&!f.button().props.disabled,'Unsupported/blocked launch stays manual and unconfirmed');check(Boolean(f.status()),'Failure explained without losing original message');}
const scoped=fixture();scoped.button().props.onClick();scoped.change({phone:'9185550199',message:'New exact draft'});scoped.button().props.onClick();
check(scoped.routes.length===2&&JSON.parse(new URL(scoped.routes[1]).searchParams.get('text')).phone==='+19185550199','Changed customer/message never reuses prior destination');
for(const patch of [{phone:'invalid'},{message:''},{message:'🔥'.repeat(1500)}]){const f=fixture();f.change(patch);check(f.button().props.disabled,'Unusable direct text disabled');f.button().props.onClick();check(f.routes.length===0,'Rejected input never launches or silently falls back');}
console.log('PASS '+checks+' direct Google Voice text URL/security/actual-handler assertions; no native calls or records written.');
