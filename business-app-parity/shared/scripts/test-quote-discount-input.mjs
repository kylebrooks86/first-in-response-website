/** Test the production parser and discount math using synthetic values only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8');
const start=source.indexOf('function discountMath('),end=source.indexOf('function NewEstimate(',start);
assert.ok(start>0&&end>start,'Actual production discount implementation is present');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'\nexports.parseDiscountCents=parseDiscountCents;exports.discountMath=discountMath;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
const {parseDiscountCents:parse,discountMath}=context.exports;
let checks=0;const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
for(const [raw,mode,max,expected] of [
 ['', 'percent',50,0],['0','percent',50,0],['15','percent',50,1500],
 ['15.25','percent',50,1525],['.5','percent',50,50],['45','percent',45,4500],
 ['50','percent',50,5000],['25','dollar',50,2500],['25.01','dollar',50,2501],
 ['.01','dollar',50,1],['0.00','dollar',50,0],
 ['-1','dollar',50,null],['-5','percent',50,null],['foo','dollar',50,null],
 ['15abc','percent',50,null],[' ','percent',50,null],['1,000','dollar',50,null],
 ['15.555','percent',50,null],['25.001','dollar',50,null],['1e2','percent',50,null],
 ['46','percent',45,null],['51','percent',50,null],['12.','percent',50,null],
 ['90071992547410','dollar',50,null]
])eq(parse(raw,mode,max),expected,raw+' in '+mode);
const subtotal=46000;
eq(discountMath(subtotal,false,'percent',parse('15','percent')/100,true).total,39100,'15% discount on $460');
eq(discountMath(subtotal,false,'percent',parse('15','percent')/100,true).deposit,19550,'50% deposit');
eq(discountMath(subtotal,false,'dollar',parse('25','dollar')/100,true).total,43500,'Exact $25 discount');
eq(discountMath(44000,true,'percent',parse('45','percent',45)/100,true).total,22000,'Existing combined percent cap');
eq(discountMath(0,false,'percent',0,true).total,15000,'Minimum charge remains');
console.log('PASS '+checks+' strict discount entry, percentage caps, exact cents, minimum and deposit checks.');
