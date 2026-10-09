import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['RefundPayment','ProcessingDetails','ProcessingReport','PaymentsView'];
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text));
assert.equal(functions.length,names.length);
let cursor=0,state=[],posts=[];
const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useEffect(){}};
const Button=({children,...props})=>React.createElement('button',props,children);
const fragment=({children})=>React.createElement(React.Fragment,null,children);
const context={exports:{},require,useState:hooks.useState,useEffect:hooks.useEffect,Button,Dialog:fragment,DialogContent:fragment,DialogHeader:fragment,DialogTitle:fragment,Label:fragment,Input:props=>React.createElement('input',props),crypto:{randomUUID:()=> 'synthetic-request-id'},window:{setTimeout(){}},money:c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100),paymentTypeLabel:t=>t,fetch:async(url,options)=>{posts.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({pending:true})};},CircleDollarSign:()=>null};
const accounting={exports:{},require};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/processing-fees.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,accounting);
context.summarizeProcessing=accounting.exports.summarizeProcessing;
vm.runInNewContext(ts.transpileModule(functions.map(n=>n.getText(ast)).join('\n')+'\nexports.ui={RefundPayment,ProcessingDetails,ProcessingReport,PaymentsView};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const ui=context.exports.ui;
const nodes=tree=>{const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;};
let cases=0;
const check=(label,fn)=>{fn();cases++;console.log('PASS: '+label);};
const base={id:'synthetic-payment',amountCents:7500,refundableCents:7500,type:'Cash App',customer:'Synthetic customer',stripePayment:1};
function refund(payment=base,reset=false){if(reset)state=[];cursor=0;return ui.RefundPayment({payment});}
check('Refund and Check refund use the explicit action class',()=>{
 for(const pending of [false,true]){const tree=refund({...base,...(pending?{pendingRefundId:'pending-id',pendingRefundAmountCents:2100}:{})},true);const button=nodes(tree).find(n=>n.type===Button&&n.props.className==='payment-refund-action');assert.equal(button.props.children,pending?'Check refund':'Refund');}
});
check('Negative and fully refunded ledger entries have no refund action',()=>{for(const payment of [{...base,amountCents:-7500},{...base,refundableCents:0}])assert.equal(refund(payment,true),null);});
check('Refund dialog remains scrollable within a mobile viewport',()=>{const node=nodes(refund(base,true)).find(n=>n.type===fragment&&n.props.className?.includes('sm:max-w-[520px]'));assert.ok(node.props.className.includes('max-h-[90dvh]'));assert.ok(node.props.className.includes('overflow-y-auto'));});
// Execute the actual open/retry handlers, not a duplicated accounting implementation.
let tree=refund({...base,pendingRefundId:'pending-id',pendingRefundAmountCents:2100},true);
nodes(tree).find(n=>n.type===Button&&n.props.className==='payment-refund-action').props.onClick();
tree=refund({...base,pendingRefundId:'pending-id',pendingRefundAmountCents:2100});
await nodes(tree).find(n=>n.type===Button&&n.props.className==='brand-button').props.onClick();
check('Pending Stripe retry preserves payment ID, request ID and amount',()=>{assert.equal(posts.length,1);assert.deepEqual(posts[0],{url:'/api/payments/refund',paymentId:'synthetic-payment',requestId:'pending-id',amountCents:2100,externalRefundConfirmed:false,note:''});});
const manual={...base,stripePayment:0};const beforeManual=posts.length;
nodes(refund(manual,true)).find(n=>n.type===Button&&n.props.className==='payment-refund-action').props.onClick();
await nodes(refund(manual)).find(n=>n.type===Button&&n.props.className==='brand-button').props.onClick();
check('Manual refund submission without confirmation is blocked without a request',()=>{assert.equal(posts.length,beforeManual);assert.match(renderToStaticMarkup(refund(manual)),/Send the refund through/);});
check('Fee details retain gross invoice credit, separate tips and actual net proceeds',()=>{
 const html=renderToStaticMarkup(ui.ProcessingDetails({payment:{...base,amountCents:10000,grossReceivedCents:11000,bundledTipCents:1000,processingFeeCents:300,processingMethod:'Cash App'}}));for(const amount of ['$100.00','$10.00','$110.00','−$3.00','$107.00'])assert.ok(html.includes(amount));
 assert.equal(ui.ProcessingDetails({payment:base}),null);
});
check('Fee report exposes a keyboard-focusable labeled scrolling region and table headings',()=>{
 const html=renderToStaticMarkup(ui.ProcessingReport({payments:[{...base,grossReceivedCents:7500,processingFeeCents:210,processingMethod:'Cash App'}]}));assert.match(html,/role="region" aria-label="Processing fees by payment method" tabindex="0"/);assert.equal((html.match(/scope="col"/g)||[]).length,4);assert.equal((html.match(/scope="row"/g)||[]).length,2);for(const amount of ['$75.00','$2.10','$72.90'])assert.ok(html.includes(amount));
});
check('Payment history amount is explicitly placed, not mixed with refund controls',()=>{
 const n=functions.find(n=>n.name.text==='PaymentsView');let found=false;function walk(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='strong'&&node.openingElement.attributes.properties.some(a=>a.name?.text==='className'&&a.initializer?.text==='payment-history-amount')){assert.match(node.getText(ast),/money\(payment.amountCents\)/);found=true;}ts.forEachChild(node,walk);}walk(n);assert.ok(found);
});
check('Responsive stylesheet confines table overflow and places amount/action below mobile details',()=>{
 const css=postcss.parse(readFileSync('app/globals.css','utf8'));const rules=[];css.walkRules(r=>rules.push(r));
 const rule=(selector,mobile=false)=>rules.findLast(r=>r.selector===selector&&(r.parent.type==='atrule')===mobile);
 const value=(r,key)=>r.nodes.find(n=>n.prop===key)?.value;
 assert.equal(value(rule('.payment-history>article>.payment-refund-action'),'grid-column'),'2 / -1');
 assert.equal(value(rule('.payment-history>article>.payment-refund-action'),'min-height'),'44px');
 assert.equal(value(rule('.payment-history>article',true),'grid-template-columns'),'36px minmax(0,1fr)');
 assert.equal(value(rule('.payment-history-amount',true),'grid-row'),'2');
 assert.equal(value(rule('.payment-history>article>.payment-refund-action',true),'grid-row'),'3');
 assert.equal(value(rule('.processing-report-scroll'),'overflow-x'),'auto');
 assert.equal(value(rule('.payment-history>article>div'),'overflow-wrap'),'anywhere');
});
check('Customer-profile payment rows explicitly separate amount and retain refund callbacks',()=>{
 const customer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CustomersView');
 const articles=[];function walk(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='article'&&node.openingElement.attributes.properties.some(a=>a.name?.text==='className'&&a.initializer?.text==='customer-record customer-payment-record'))articles.push(node);ts.forEachChild(node,walk);}walk(customer);
 assert.equal(articles.length,1);
 const row=articles[0].getText(ast);
 assert.match(row,/<strong className="customer-payment-amount">\{money\(payment.amountCents\)\}<\/strong>/);
 assert.match(row,/<RefundPayment payment=\{payment\} onRefunded=\{\(\)=>void load\(\)\}\/>/);
 assert.match(row,/<ProcessingDetails payment=\{payment\}\/>/);
 assert.match(row,/Copy full payment reference/);
});
check('Customer-profile payment layout wraps details and provides a full-row 44px refund control',()=>{
 const rules=[];postcss.parse(readFileSync('app/globals.css','utf8')).walkRules(r=>rules.push(r));
 const rule=(selector,mobile=false)=>rules.findLast(r=>r.selector===selector&&(r.parent.type==='atrule')===mobile);
 const value=(r,key)=>r?.nodes.find(n=>n.prop===key)?.value;
 assert.equal(value(rule('.customer-record.customer-payment-record'),'display'),'grid');
 assert.equal(value(rule('.customer-record.customer-payment-record'),'grid-template-columns'),'minmax(0,1fr) auto');
 assert.equal(value(rule('.customer-payment-record>div'),'min-width'),'0');
 assert.equal(value(rule('.customer-payment-record>div'),'overflow-wrap'),'anywhere');
 assert.equal(value(rule('.customer-payment-amount'),'white-space'),'nowrap');
 assert.equal(value(rule('.customer-payment-record>.payment-refund-action'),'grid-column'),'1 / -1');
 assert.equal(value(rule('.customer-payment-record>.payment-refund-action'),'min-height'),'44px');
 assert.equal(value(rule('.customer-record.customer-payment-record',true),'grid-template-columns'),'minmax(0,1fr)');
 assert.equal(value(rule('.customer-payment-amount',true),'grid-row'),'2');
 assert.equal(value(rule('.customer-payment-record>.payment-refund-action',true),'grid-row'),'3');
});
console.log(`PASS: ${cases}/${cases} component/handler/CSS checks. Local structural tests only; no browser/iPhone or Stripe network verification.`);
