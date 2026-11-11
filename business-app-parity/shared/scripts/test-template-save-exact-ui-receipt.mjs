/** Evaluate the actual SettingsView.save and validTemplate callbacks (not
 * a rewritten simulator). All responses are synthetic; no hosted writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import{FIRE_TEMPLATES}from'../lib/fire-templates.ts';

const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='SettingsView');
assert.ok(view,'Actual owner SettingsView exists');
const get=name=>{
 let found=null;
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name?.getText(ast)===name&&node.initializer)found=node.initializer;
  ts.forEachChild(node,visit);
 }
 visit(view);
 assert.ok(found,'Actual SettingsView.'+name+' exists');
 return found.getText(ast);
};
const compiled=ts.transpileModule('exports.valid='+get('validTemplate')+';exports.save='+get('save')+';',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++};
const estimate=FIRE_TEMPLATES.find(t=>t.key==='estimate');
assert.ok(estimate);
const custom={...estimate,subject:'  My Tulsa estimate  ',body:'  Custom owner copy @customer_first_name  '};
const normalized={...custom,subject:'My Tulsa estimate',body:'Custom owner copy @customer_first_name'};
function fixture({draft=custom,server,approve=true}={}){
 let messages=[],saving=[],requests=[],draftValue=draft,templates=FIRE_TEMPLATES.map(t=>t.key===draft.key?{...estimate,subject:'Old saved subject',body:'Old saved body'}:t),confirmations=0;
 const context={exports:{},FIRE_TEMPLATES,draft:draftValue,templates,
  templateSaveLock:{current:false},templatesLoading:false,templatesError:'',
  window:{confirm:()=>{confirmations++;return approve;}},
  fetch:async(url,options)=>{
   requests.push({url,options,payload:JSON.parse(options.body)});
   if(server instanceof Error)throw server;
   if(typeof server==='function')return server(options);
   return{ok:true,json:async()=>({template:server??normalized})};
  },
  setMessage:message=>messages.push(message),
  setSaving:value=>saving.push(value),
  setTemplates:fn=>{templates=fn(templates);context.templates=templates;},
  setDraft:value=>{draftValue=value;context.draft=value;}
 };
 vm.runInNewContext(compiled,context);
 // The actual save closure references the sibling SettingsView validator.
 // Export both from AST, then bind the same validator in the VM scope.
 context.validTemplate=context.exports.valid;
 return{run:(reset=false)=>context.exports.save(reset),context,get messages(){return messages;},get saving(){return saving;},get requests(){return requests;},get templates(){return templates;},get draft(){return draftValue;},get confirmations(){return confirmations;}};
}
{
 const f=fixture();await f.run();
 check(f.requests.length===1&&f.requests[0].payload.body===custom.body,'Save submits unmodified owner text, not a rounded or replaced draft');
 check(f.messages.at(-1)==='Template saved.','Exact normalized subject/body receipt yields success');
 check(f.draft.body===normalized.body&&f.templates.find(x=>x.key==='estimate').body===normalized.body,'Only verified exact saved response replaces owner edits');
 check(f.saving.join(',')==='true,false'&&!f.context.templateSaveLock.current,'Save lock ends only after receipt processed');
}
for(const [name,receipt]of [
 ['stale subject',{...normalized,subject:'Yesterday subject'}],
 ['stale body',{...normalized,body:'Older text from server'}],
 ['wrong key',{...normalized,key:'invoice'}],
 ['missing body',{...normalized,body:''}],
 ['wrong category',{...normalized,category:'After service'}]
]){
 const f=fixture({server:receipt});await f.run();
 check(f.requests.length===1,'Attempt '+name+' sent exactly once');
 check(f.messages.at(-1).includes('saved template response')||f.messages.at(-1).includes('Template save could not be confirmed'),
  'Mismatched '+name+' cannot show Template saved');
 check(f.draft.body===custom.body&&f.templates.find(x=>x.key==='estimate').body==='Old saved body',
  'Mismatched '+name+' preserves unsaved draft and previously confirmed server snapshot');
}
{
 const f=fixture({server:async()=>({ok:false,json:async()=>({error:'Synthetic database uncertain; check saved version'})})});
 await f.run();
 check(f.messages.at(-1).includes('check saved version')&&!f.messages.includes('Template saved.'),
  'Server unverified/503 keeps old copy and explicit recovery message');
 check(f.draft.body===custom.body,'Unconfirmed POST never overwrites unsaved owner draft');
}
{
 const f=fixture({server:new Error('Synthetic lost reply')});await f.run();
 check(f.messages.at(-1).includes('Template save could not be verified')&&f.draft.body===custom.body,
  'Cross-realm simulated lost reply preserves exact unsaved copy and safe fallback');
}
{
 const f=fixture({server:estimate});await f.run(true);
 check(f.confirmations===1&&f.requests[0].payload.reset===true,'Restore default requires explicit owner confirmation');
 check(f.messages.at(-1)==='Default restored.'&&f.draft.body===estimate.body,'Only verified exact default restore replaces draft');
}
{
 const f=fixture({server:{...estimate,subject:'Incorrect original'}});await f.run(true);
 check(f.messages.at(-1).includes('saved template response')&&f.draft.body===custom.body,
  '200 with incorrect reset default is NOT reported as restored');
}
{
 const f=fixture({approve:false});await f.run(true);
 check(f.requests.length===0&&f.draft.body===custom.body,'Cancel restore keeps unsaved custom copy and performs no PUT');
}
const viewText=view.getText(ast);
check(viewText.includes('setMessage(reset?"Default restored.":"Template saved.")')&&
 viewText.indexOf('result.template.body!==body')<viewText.indexOf('setMessage(reset?"Default restored.":"Template saved.")'),
 'Actual owner screen shows green confirmation only after exact subject/body readback');
console.log('PASS '+checks+'/'+checks+' actual Settings message template save/restore receipt verification, owner-draft preservation and interrupted responses. NO HOSTED WRITES.');
