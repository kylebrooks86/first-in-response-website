/** Evaluate the actual JSX onChanged callbacks, never reconstructed copies. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let checks=0;
for(const name of ['ScheduleView','EstimatesView','FollowUpsView']){
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);let expression;
 function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){if(n.tagName.getText(ast)==='EstimateDetail')expression=n.attributes.properties.find(p=>p.name?.getText(ast)==='onChanged').initializer.expression;}ts.forEachChild(n,visit);}visit(fn);
 if(ts.isIdentifier(expression)){for(const statement of fn.body.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.name.getText(ast)===expression.getText(ast))expression=d.initializer;}
 assert.ok(ts.isArrowFunction(expression));
 let rows=[{id:'first',status:'scheduled'},{id:'second',status:'scheduled'}],selected=rows[0],loads=0;
 const setter=value=>{selected=typeof value==='function'?value(selected):value;};const context={exports:{},setSelected:setter,setReviewEstimate:setter,setRows:value=>{rows=typeof value==='function'?value(rows):value;},load:()=>{loads++;}};
 vm.runInNewContext(ts.transpileModule('exports.changed='+expression.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 context.exports.changed({id:'first',status:'completed'});assert.equal(selected.status,'completed');checks++;
 selected=null;context.exports.changed({id:'first',status:'approved'});assert.equal(selected,null,name+' cannot reopen a closed detail');checks++;
 selected=rows[1];context.exports.changed({id:'first',status:'completed'});assert.equal(selected.id,'second',name+' cannot replace another selected job');checks++;
 if(name!=='FollowUpsView'){assert.equal(rows.find(r=>r.id==='first').status,'completed');checks++;}else{assert.equal(loads,3);checks++;}
}
console.log(`PASS ${checks}/${checks}: actual Schedule, Estimates and Follow-ups callbacks update records without reopening closed details or replacing another job.`);
