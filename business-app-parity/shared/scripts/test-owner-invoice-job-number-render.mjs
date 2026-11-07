/** Render the actual owner InvoicesView card with synthetic saved identities.
 * No browser, provider, network, database, feature activation or payment action.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {jobNumberLabel} from '../lib/job-numbering.mjs';
import {customerNumberLabel} from '../lib/customer-numbering.mjs';

const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const view=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='InvoicesView');
assert.ok(view,'Actual owner invoice workspace exists');
const cards=[];
function visit(node){
 if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(a=>
  ts.isJsxAttribute(a)&&a.name.text==='className'&&a.initializer&&ts.isStringLiteral(a.initializer)&&a.initializer.text==='invoice-card'))cards.push(node.getText(ast));
 ts.forEachChild(node,visit);
}
visit(view);assert.equal(cards.length,1,'One actual owner invoice card');
const base={id:'abcdef-synthetic-invoice',estimateId:'synthetic-estimate',customer:'Synthetic owner fixture',customerNumber:7,
 service:'Synthetic service',status:'sent',totalCents:2500,paidCents:0,shareToken:'synthetic-preview-only'};
function render(invoice,card=cards[0]){
 const compiled=ts.transpileModule('const card=('+card+');',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 const build=new Function('React','Receipt','ExternalLink','RecordPayment','customerNumberLabel','jobNumberLabel','money','statusLabel','invoice','estimate','load',compiled+';return card;');
 return renderToStaticMarkup(build(React,()=>null,()=>null,()=>null,customerNumberLabel,jobNumberLabel,
  cents=>'$'+(cents/100).toFixed(2),s=>s,invoice,{id:invoice.estimateId},()=>{}));
}
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
const numbered=render({...base,jobNumber:42});
check(numbered.includes('Job #0042'),'A saved Job # must be visible in the actual owner invoice card');
check(numbered.includes('Customer #0007'),'Customer identity remains separate');
check(numbered.includes('Invoice #ABCDEF'),'Original invoice identifier is preserved');
check(numbered.includes('$25.00'),'No invoice amount changes');
check(numbered.includes('/invoice/synthetic-preview-only?ownerPreview=1&amp;from=invoices'),'Exact original preview destination is retained');
for(const jobNumber of [undefined,null,0,-1,'invented']){
 const html=render({...base,jobNumber});
 check(!html.includes('Job #'),'Unactivated or invalid identity never becomes a fabricated Job #');
 check(html.includes('Invoice #ABCDEF')&&html.includes('$25.00'),'Legacy invoice content remains usable without numbering');
}
check(!render({...base,jobNumber:42,customerNumber:null}).includes('Customer #'),'No customer number is fabricated');
const removed=cards[0].replace('{jobNumberLabel(invoice.jobNumber)&&<small>{jobNumberLabel(invoice.jobNumber)}</small>}','');
check(removed!==cards[0],'Negative control removes the actual saved-number display');
check(!render({...base,jobNumber:42},removed).includes('Job #0042'),'Negative control demonstrates the original lost-label defect');
console.log('PASS '+checks+' actual owner invoice JSX rendering checks; synthetic only, numbering remains disabled.');
