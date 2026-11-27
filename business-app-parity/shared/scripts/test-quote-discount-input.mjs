import {submittedDiscountCents,quoteDiscounts,discountSnapshot,readDiscountSnapshot,verifiedSavedDiscounts} from '../lib/discount-input.ts';
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
for(const [raw,expected] of [
 [undefined,0],[null,0],[0,0],[1,1],['2500',2500],[5000,5000],
 [-1,null],[-0.5,null],[0.25,null],[NaN,null],[Infinity,null],
 ['-10',null],['1.2',null],['',null],[' ',null],['0x20',null],
 ['9e3',null],['Infinity',null],[{},null],[[],null],
 [Number.MAX_SAFE_INTEGER+1,null]
])eq(submittedDiscountCents(raw),expected,'API value '+String(raw));
for(const path of ['app/api/estimates/route.ts','app/api/estimates/[id]/route.ts','app/api/invoices/[id]/route.ts']){
 const source=readFileSync(path,'utf8');
 eq(source.includes('submittedDiscountCents('),true,'Actual route uses exact integer guard: '+path);
 eq(source.includes('Math.max(0,Math.round(Number(body.'),false,'No legacy coercion left: '+path);
}
const subtotal=46000;
eq(discountMath(subtotal,false,'percent',parse('15','percent')/100,true).total,39100,'15% discount on $460');
eq(discountMath(subtotal,false,'percent',parse('15','percent')/100,true).deposit,19550,'50% deposit');
eq(discountMath(subtotal,false,'dollar',parse('25','dollar')/100,true).total,43500,'Exact $25 discount');
eq(discountMath(44000,true,'percent',parse('45','percent',45)/100,true).total,22000,'Existing combined percent cap');
eq(discountMath(0,false,'percent',0,true).total,0,'Zero-priced line remains zero, not $150');
for(const [subtotal,percent,bundle,expected,deposit] of [[2500,0,0,2500,1250],[7500,0,0,7500,3750],[7500,1500,2500,3875,1938],[46000,1500,2500,36600,18300],[2500,0,2500,0,0]]){
 const server=quoteDiscounts(subtotal,false,'percent',percent,bundle);
 const ui=discountMath(subtotal,false,'percent',percent/100,true,bundle);
 eq(server.total,expected,'Exact server total '+subtotal);eq(server.deposit,deposit,'Exact server deposit '+subtotal);
 eq(ui.total,server.total,'Editor/server total parity '+subtotal);eq(ui.deposit,server.deposit,'Editor/server deposit parity '+subtotal);
}
// Historical prices remain readable as the amount that was actually agreed,
// even when the old automatic floor was higher than all service lines.
const original=discountSnapshot('synthetic-history',2500,false,'percent',0,0);
const old={...original,total:15000,appliedDiscount:0,deposit:7500};
const stored={subtotalCents:2500,discountCents:0,totalCents:15000,depositCents:7500};
eq(readDiscountSnapshot('synthetic-history',JSON.stringify(old),stored)?.total,15000,'Legacy snapshot remains verifiable');
eq(verifiedSavedDiscounts('synthetic-history',JSON.stringify(old),{...stored,appreciationDiscount:0,additionalDiscountType:'percent',additionalDiscountValue:0})?.total,15000,'Legacy snapshot remains unchanged');
eq(verifiedSavedDiscounts('synthetic-history',null,{...stored,appreciationDiscount:0,additionalDiscountType:'percent',additionalDiscountValue:0}),null,'Safe legacy quote without snapshot stays unchanged');
assert.throws(()=>readDiscountSnapshot('synthetic-history',JSON.stringify({...old,total:16000}),stored),'Tampered historical total rejected');checks++;
eq(readDiscountSnapshot('synthetic-current',JSON.stringify(discountSnapshot('synthetic-current',2500,false,'percent',0,0)),{subtotalCents:2500,discountCents:0,totalCents:2500,depositCents:1250})?.total,2500,'New below-minimum snapshot verifies');
console.log('PASS '+checks+' exact discount entry, legitimate sub-$150 totals, frozen legacy agreements and deposits.');
