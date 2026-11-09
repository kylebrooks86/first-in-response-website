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

/* Actual owner Job Report and Job Costs headers must share their saved,
 * immutable Job # with the estimate and invoice. No synthetic ID creation,
 * handler execution, provider calls or feature-flag changes.
 */
for(const [functionName,heading] of [
  ['JobReport','Service completion report'],
  ['JobCost','Job costs &']
]){
  const fn=ast.statements.find(node=>
    ts.isFunctionDeclaration(node)&&node.name?.text===functionName);
  check(Boolean(fn),functionName+' owner dialog exists');
  const headers=[];
  function findHeaders(node){
    if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='DialogHeader'&&
      node.openingElement.attributes.properties.some(a=>
        ts.isJsxAttribute(a)&&a.name.text==='className'&&
        a.initializer&&ts.isStringLiteral(a.initializer)&&
        a.initializer.text==='fire-job-header'))headers.push(node.getText(ast));
    ts.forEachChild(node,findHeaders);
  }
  findHeaders(fn);
  check(headers.length===1,functionName+' has exactly one actual job dialog header');
  const header=headers[0];
  check(header.includes(heading),functionName+' original dialog heading preserved');
  const renderHeader=(jobNumber,jsx=header)=>{
    const code=ts.transpileModule('const header=('+jsx+');',{
      compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}
    }).outputText;
    const passthrough=(props)=>React.createElement('div',props,props.children);
    const dialogTitle=(props)=>React.createElement('h2',props,props.children);
    const build=new Function('React','DialogHeader','DialogTitle',
      'jobNumberLabel','estimate',code+';return header;');
    return renderToStaticMarkup(build(React,passthrough,dialogTitle,jobNumberLabel,{
      customer:'Synthetic owner fixture',service:'Synthetic service',jobNumber
    }));
  };
  const numbered=renderHeader(42);
  check(numbered.includes('Job #0042'),functionName+' displays real saved Job #0042');
  check(numbered.includes('Synthetic owner fixture')&&numbered.includes('Synthetic service'),
    functionName+' preserves customer and service identity');
  for(const invalid of [undefined,null,0,-1,'fabricated']){
    const unnumbered=renderHeader(invalid);
    check(!unnumbered.includes('Job #'),functionName+' does not invent a disabled/invalid job number');
    check(unnumbered.includes('Synthetic owner fixture'),functionName+' stays usable unnumbered');
  }
  const label='{jobNumberLabel(estimate.jobNumber)&&<small className="fire-job-number">{jobNumberLabel(estimate.jobNumber)}</small>}';
  check(header.includes(label),functionName+' uses the same canonical saved number formatter');
  const negative=renderHeader(42,header.replace(label,''));
  check(!negative.includes('Job #0042'),functionName+' negative control proves missing label is caught');
}

console.log('PASS '+checks+' actual owner invoice JSX rendering checks; synthetic only, numbering remains disabled.');
