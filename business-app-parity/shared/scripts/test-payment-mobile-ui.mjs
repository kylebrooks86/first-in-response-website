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
const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useRef:initial=>({current:initial}),useEffect(){}};
const Button=({children,...props})=>React.createElement('button',props,children);
const fragment=({children})=>React.createElement(React.Fragment,null,children);
const sharedHelpers={};
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-balance-summary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
{const module={exports:{},require};vm.runInNewContext(ts.transpileModule(readFileSync('lib/refund-retry-state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,module);Object.assign(sharedHelpers,module.exports);}
const context={exports:{},require,...sharedHelpers,useState:hooks.useState,useRef:hooks.useRef,useEffect:hooks.useEffect,Button,Dialog:fragment,DialogContent:fragment,DialogHeader:fragment,DialogTitle:fragment,Label:fragment,Input:props=>React.createElement('input',props),crypto:{randomUUID:()=> 'synthetic-request-id'},window:{setTimeout(){}},money:c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100),paymentTypeLabel:t=>t,fetch:async(url,options)=>{posts.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({pending:true})};},CircleDollarSign:()=>null};
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
await nodes(tree).find(n=>n.type===Button&&n.props.className==='brand-button').props.onClick();await new Promise(resolve=>setImmediate(resolve));
check('Pending Stripe retry preserves payment ID, request ID and amount',()=>{assert.equal(posts.length,1);assert.deepEqual(posts[0],{url:'/api/payments/refund',paymentId:'synthetic-payment',requestId:'pending-id',amountCents:2100,externalRefundConfirmed:false,note:''});});
const manual={...base,stripePayment:0};const beforeManual=posts.length;
nodes(refund(manual,true)).find(n=>n.type===Button&&n.props.className==='payment-refund-action').props.onClick();
await nodes(refund(manual)).find(n=>n.type===Button&&n.props.className==='brand-button').props.onClick();
check('Manual refund submission without confirmation is blocked without a request',()=>{assert.equal(posts.length,beforeManual);assert.match(renderToStaticMarkup(refund(manual)),/Send the refund through/);});
check('Fee details retain gross invoice credit, separate tips and actual net proceeds',()=>{
 const html=renderToStaticMarkup(ui.ProcessingDetails({payment:{...base,amountCents:10000,grossReceivedCents:11000,bundledTipCents:1000,processingFeeCents:300,processingMethod:'Cash App'}}));for(const amount of ['$100.00','$10.00','$110.00','−$3.00','$107.00'])assert.ok(html.includes(amount));
 assert.equal(ui.ProcessingDetails({payment:base}),null);
});
check('Fee report exposes a labeled four-column table without an unnecessary scroll focus stop',()=>{
 const html=renderToStaticMarkup(ui.ProcessingReport({payments:[{...base,grossReceivedCents:7500,processingFeeCents:210,processingMethod:'Cash App'}]}));assert.match(html,/role="region" aria-label="Processing fees by payment method"/);assert.ok(!html.includes('tabindex="0"'));assert.equal((html.match(/scope="col"/g)||[]).length,4);assert.equal((html.match(/scope="row"/g)||[]).length,2);for(const amount of ['$75.00','$2.10','$72.90'])assert.ok(html.includes(amount));
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
 assert.equal(value(rule('.processing-report-scroll'),'overflow-x'),'visible','Processing fee table does not scroll sideways');
 assert.equal(value(rule('.processing-report-table'),'min-width'),'0','Table fits available card width');
 assert.equal(value(rule('.processing-report-table'),'table-layout'),'fixed','Four columns share viewport width');
 assert.equal(value(rule('.processing-report-table th,.processing-report-table td'),'white-space'),'normal','Large amounts may wrap instead of clipping');
 assert.equal(value(rule('.processing-report-table th,.processing-report-table td'),'overflow-wrap'),'anywhere');
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
check('Paid review queue controls preserve search, sort, filtered reset, and exact job navigation',()=>{
 const payments=functions.find(n=>n.name.text==='PaymentsView');
 const body=payments.getText(ast);
 for(const expected of ['reviewCloseoutSearch.trim().toLowerCase()','reviewCloseoutFilter==="prepared"','reviewCloseoutOrder==="customer"','reviewCloseoutOrder==="newest"','setReviewCloseoutSearch("")','setReviewCloseoutFilter("all")','setReviewCloseoutOrder("priority")','setShowAllReviewCloseouts(false)','encodeURIComponent(item.estimateId)','reviewMoreAvailable?" · Older jobs not loaded"'])assert.ok(body.includes(expected),'Missing review queue behavior: '+expected);
 let comparator;function find(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='sort'&&node.arguments[0]?.getText(ast).includes('reviewCloseoutOrder'))comparator=node.arguments[0].getText(ast);ts.forEachChild(node,find);}find(payments);assert.ok(comparator,'Actual paid-review comparator exists');
 const rows=[{estimateId:'new-ready',customerName:'Ada',state:'ready',lastPaidAt:'2026-10-20T12:00:00Z'},{estimateId:'old-ready',customerName:'Zed',state:'ready',lastPaidAt:'2026-10-01T12:00:00Z'},{estimateId:'prepared',customerName:'Ben',state:'prepared',lastPaidAt:'2026-10-19T12:00:00Z'}];
 for(const [order,expected] of [['priority',['prepared','old-ready','new-ready']],['newest',['new-ready','prepared','old-ready']],['customer',['new-ready','prepared','old-ready']]]){const context={exports:{},reviewCloseoutOrder:order};vm.runInNewContext(ts.transpileModule('exports.sort='+comparator,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);assert.deepEqual(rows.slice().sort(context.exports.sort).map(row=>row.estimateId),expected,order+' uses actual saved-record ordering');}
 assert.match(body,/reviewCloseoutError\?<p role="alert"/);
});
check('Read-only collectible job finder preserves all jobs and exposes additional pages',()=>{
 const payments=functions.find(n=>n.name.text==='PaymentsView'),body=payments.getText(ast);
 const match=payments.body.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='matchingOpen'));
 const decl=match?.declarationList.declarations.find(d=>d.name.getText(ast)==='matchingOpen');
 assert.ok(decl,'Real PaymentsView has a scoped local filter');
 const expr=ts.transpileModule('exports.filter='+decl.initializer.getText(ast)+';',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const balances=[{id:'A',customer:'Tulsa One',service:'House Wash',status:'approved',address:'South Tulsa'},{id:'B',customer:'Owasso Two',service:'Gutter Cleanout',status:'scheduled',address:'Owasso'},{id:'C',customer:'Broken Arrow Three',service:'Window Cleaning',status:'approved',address:'Broken Arrow'}];
 for(const [term,expected] of [['',3],['Owasso',1],['Window',1],['missing',0]]){
  const state={exports:{},open:balances,balanceSearch:term};vm.runInNewContext(expr,state);
  assert.equal(state.exports.filter.length,expected,term+' filters existing verified balances only');
  assert.equal(balances.length,3,'Filtering never truncates verified source balances');
 }
 assert.match(body,/matchingOpen\.slice\(0,balanceLimit\)/,'Only displayed balance cards are limited');
 assert.match(body,/matchingOpen\.length>balanceLimit/,'All remaining balances remain reachable');
 assert.match(body,/open\.length\?<div className="record-empty">/,'A search miss never says all caught up');
 assert.match(body,/setBalanceLimit\(20\)/,'Search changes reset pagination');
});
check('Invoice mobile cards retain payment-review warning, balance and accessible actions',()=>{
 const src=readFileSync('app/dashboard.tsx','utf8');
 assert.ok(src.includes('className="invoice-card"')&&src.includes('Payment review')&&src.includes('Billing exception open'));
 const sheet=postcss.parse(readFileSync('app/globals.css','utf8'));
 const mobile=(selector,width)=>{let found;sheet.walkRules(r=>{if(r.selector===selector&&r.parent.type==='atrule'&&r.parent.params.includes('max-width:'+width+'px'))found=r;});return found;};
 const decl=(selector,width,property)=>mobile(selector,width)?.nodes.find(n=>n.prop===property)?.value;
 assert.equal(decl('.invoice-card>.status-chip',980,'display'),'inline-flex','Mobile invoice status must remain visible');
 assert.equal(decl('.invoice-card>.invoice-total',980,'display'),'grid','Mobile invoice totals and outstanding balance must remain visible');
 assert.equal(decl('.invoice-card>.invoice-actions',980,'grid-row'),'3','Payment controls follow invoice details');
 assert.equal(decl('.invoice-card>.invoice-actions>a,.invoice-card>.invoice-actions>button',980,'min-height'),'44px','Touch controls remain 44px high');
 assert.equal(decl('.invoice-card>.invoice-icon',430,'display'),'none','Decorative receipt icon can collapse on compact phones');
 assert.equal(decl('.invoice-card>.invoice-total',430,'grid-column'),'2','Amounts remain visible next to the customer');
 assert.equal(decl('.invoice-card>.status-chip',430,'grid-row'),'2','Status remains visible below customer details');
 assert.ok(sheet.toString().includes('.invoice-card>.status-chip.partial{background:'));
});
check('Owner payment history and checkout alerts cannot be served from stale browser cache',()=>{
 const route=readFileSync('app/api/payments/route.ts','utf8');
 assert.ok(route.includes('return Response.json({payments:result.results,checkoutIssues:checkoutIssues.results},{headers:{"Cache-Control":"no-store, private"}});'));
});
console.log(`PASS: ${cases}/${cases} component/handler/CSS checks. Local structural tests only; no browser/iPhone or Stripe network verification.`);
