/** Exercise the ACTUAL EstimatesView amount parser without D1 or user data. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimatesView');
assert.ok(view,'Original EstimatesView must be present');
const matches=[];
function search(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='cents'&&node.initializer)matches.push(node.initializer.getText(ast));
 ts.forEachChild(node,search);
}
search(view);
assert.equal(matches.length,1,'Only the actual Estimates history cents parser is tested');
const output=ts.transpileModule('const cents = '+matches[0]+';exports.cents=cents;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const context={exports:{}};vm.runInNewContext(output,context);
const cents=context.exports.cents;
let checks=0;
for(const [value,expected] of [
 [0,0],[1,1],[25001,25001],['0',0],['  0123  ',123],['25001',25001],
 [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],['9007199254740991',Number.MAX_SAFE_INTEGER]
]){
 assert.equal(cents(value),expected,'Accept exact valid D1 integer cents: '+String(value));checks++;
}
for(const value of [
 -1,-100,'-1','+1','1.5',1.5,'1e3','0x10','0b10',
 'Infinity','NaN','', ' ','1 000','12_00',false,null,undefined,[],{},
 Number.MAX_SAFE_INTEGER+1,'9007199254740992'
]){
 assert.throws(()=>cents(value),/Estimate amounts could not be read/,
  'Refuse malformed or unsafe estimate cents: '+String(value));checks++;
}
assert.ok(source.includes('subtotalCents:cents(item.subtotalCents??item.totalCents)'), 'Subtotal checks stay in actual loader');checks++;
assert.ok(source.includes('totalCents:cents(item.totalCents)'), 'Job totals stay checked');checks++;
assert.ok(source.includes('paidCents:cents(item.paidCents)'), 'Recorded payment total stays checked');checks++;
assert.ok(source.includes('invoiceTotalCents:item.invoiceTotalCents==null?item.invoiceTotalCents:cents(item.invoiceTotalCents)'), 'Invoice totals stay checked when present');checks++;
console.log('PASS '+checks+' actual Estimates history cents parsing and integration guards. Local source only, no DB, payments or hosting.');
