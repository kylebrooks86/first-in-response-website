/** Actual EditInvoiceDialog price input JSX handler and save guard, synthetic.
 * No browser network, database, account or customer communication.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const editor=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EditInvoiceDialog');
assert.ok(editor,'Actual owner invoice editor must exist');
let input=null,save=null,invalid=null;
function walk(node){
 if(ts.isVariableDeclaration(node)&&node.name?.getText(ast)==='save'&&node.initializer&&ts.isArrowFunction(node.initializer))save=node.initializer;
 if(ts.isVariableDeclaration(node)&&node.name?.getText(ast)==='invoiceRateInvalid')invalid=node.initializer;
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(ast)==='Input'){
  const attrs=node.attributes.properties;
  const id=attrs.find(a=>a.name?.getText(ast)==='id')?.getText(ast)||'';
  if(id.includes('-rate')&&id.includes('invoice-'))input=node;
 }
 ts.forEachChild(node,walk);
}walk(editor);
assert.ok(input&&save&&invalid,'Actual invoice rate input, validator and save callback must exist');
const attr=(name)=>input.attributes.properties.find(a=>a.name?.getText(ast)===name);
const handler=attr('onChange')?.initializer?.expression?.getText(ast);
assert.ok(handler&&handler.includes('setRateDrafts')&&handler.includes('exactMoneyInputCents'), 'Actual input must retain raw text and parse exact cents');
const src=ts.transpileModule('exports.change='+handler+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const parseContext={exports:{}};
const parser=ts.transpileModule(readFileSync('lib/exact-money-input.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(parser,parseContext);
let drafts={},line={id:'saved-invoice-line',unitRateCents:2200},index=0,changes=[];
const context={exports:{},item:line,index,rateDrafts:drafts,
 invoiceLineKey:(item)=>item.id,
 exactMoneyInputCents:parseContext.exports.exactMoneyInputCents,
 setRateDrafts:callback=>{drafts=callback(drafts);context.rateDrafts=drafts;},
 updateItem:(i,patch)=>{changes.push({i,...patch});line={...line,...patch};context.item=line;}
};
vm.runInNewContext(src,context);
const check=(v,label)=>assert.ok(v,label);
const apply=raw=>context.exports.change({target:{value:raw}});
const invalidExpr=ts.transpileModule('exports.invalid=()=>'+invalid.getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(invalidExpr,context);
Object.defineProperty(context,'items',{configurable:true,get:()=>[line]});
check(line.unitRateCents===2200,'Original $22 saved invoice rate remains untouched');
apply('0.221');
check(line.unitRateCents===2200&&changes.length===0,'Third decimal cannot silently round or modify saved cents');
check(drafts[line.id]==='0.221'&&context.exports.invalid()===true,'Raw invalid price remains visible and blocks Save');
for(const raw of ['1e2','3.999','-5','NaN','Infinity','123456789123456789123456789.00']){
 apply(raw);
 check(line.unitRateCents===2200&&context.exports.invalid()===true,'Invalid '+raw+' cannot change invoice price');
}
apply('0.22');
check(line.unitRateCents===22&&changes.length===1&&context.exports.invalid()===false,'Valid 22-cent rate updates exactly, no third-decimal rounding');
apply('12.35');
check(line.unitRateCents===1235&&changes.length===2&&!context.exports.invalid(),'Valid $12.35 is exact 1235 cents');
apply('');
check(line.unitRateCents===0&&changes.length===3&&!context.exports.invalid(),'Owner may explicitly set a zero-dollar unit price');
apply('10.');
check(line.unitRateCents===0&&context.exports.invalid(),'Incomplete decimal remains editable but cannot save');
apply('10.50');
check(line.unitRateCents===1050&&!context.exports.invalid(),'Completed decimal resumes verified Save readiness');
const editorText=editor.getText(ast);
check(editorText.includes('aria-invalid={rateDrafts[')&&editorText.includes('at most two decimal places')&&editorText.includes('This amount has not been rounded'),
 'Actual iPhone field shows a concise inline error for third decimals');
check(editorText.includes('disabled={saving||uncertain||invoiceRateInvalid||!invoiceHasUnsavedChanges}'),
 'Actual Save invoice button disabled when price invalid');
check(editorText.includes('rateDrafts:{}')&&editorText.includes('const currentInvoiceEditSnapshot=JSON.stringify({items,rateDrafts,'),
 'Unsaved raw price edits trigger the existing discard confirmation');
check(!editorText.includes('Math.round((Number(event.target.value)||0)*100)'),
 'Old silent unit-price roundoff is absent');
const saveText=ts.transpileModule('exports.save='+save.getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let posted=0,saveError='';
const saveCtx={exports:{},saveLock:{current:false},uncertain:false,estimate:{id:'owner-job',invoiceId:'owner-invoice'},loadedInvoice:{current:'edit-key'},currentInvoice:{current:'edit-key'},invoiceKey:'edit-key',
 invoiceRateInvalid:true,setError:v=>saveError=v,
 fetch:()=>{posted++;throw Error('No network allowed');}};
vm.runInNewContext(saveText,saveCtx);await saveCtx.exports.save();
check(posted===0&&saveError.includes('Correct the highlighted unit price'),
 'Actual invoice save callback refuses invalid cent input before any PATCH');
console.log('PASS actual EditInvoiceDialog exact raw unit rates, third-decimal rejection, no silent rounding, save/discard guards. No network or hosted writes.');
