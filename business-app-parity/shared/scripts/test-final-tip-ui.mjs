import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),state=[];let cursor=0,posts=[];
const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useMemo:fn=>fn()};
const exports={};const window={location:{href:''}};
const mockRequire=name=>name==='react'?hooks:name.startsWith('@/components/ui/')?{Button:props=>React.createElement('button',props,props.children),Input:props=>React.createElement('input',props)}:name==='lucide-react'?{CreditCard:()=>null,Heart:()=>null,LoaderCircle:()=>null}:require(name);
vm.runInNewContext(ts.transpileModule(readFileSync('app/pay/[id]/pay-button.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:mockRequire,window,fetch:async(url,options)=>{posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({url:'https://checkout.stripe.com/fixture'})};}});
const props={shareToken:'fixture',paymentType:'balance',dueAmountCents:10000,tipBaseCents:20000};
const render=overrides=>{cursor=0;return exports.PayButton({...props,...overrides});};
const nodes=tree=>{const result=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(walk);result.push(n);walk(n.props?.children);};walk(tree);return result;};
const preset=label=>nodes(render()).find(n=>n.type==='button'&&nodes(n).some(child=>child.type==='strong'&&child.props.children===label));
let tree=render();assert.equal(preset('No tip').props['aria-pressed'],true);
for(const label of ['No tip','5%','10%','15%','Custom'])assert.ok(preset(label));
for(const [label,amount] of [['No tip','$0.00'],['5%','$10.00'],['10%','$20.00'],['15%','$30.00']])assert.ok(nodes(preset(label)).some(n=>n.type==='span'&&n.props.children===amount));
for(const [label,amount] of [['5%',1000],['10%',2000],['15%',3000],['No tip',0]]){
 preset(label).props.onClick();tree=render();const submit=nodes(tree).find(n=>typeof n.type==='function'&&n.props.onClick);await submit.props.onClick();assert.equal(posts.at(-1).tipCents,amount);state[0]=false;
}
preset('Custom').props.onClick();tree=render();nodes(tree).find(n=>n.props?.id==='fire-custom-tip').props.onChange({target:{value:'23.45'}});
tree=render();await nodes(tree).find(n=>typeof n.type==='function'&&n.props.onClick).props.onClick();assert.equal(posts.at(-1).tipCents,2345);assert.equal(window.location.href,'https://checkout.stripe.com/fixture');state[0]=false;
tree=render();nodes(tree).find(n=>n.props?.id==='fire-custom-tip').props.onChange({target:{value:'-1'}});const count=posts.length;await nodes(render()).find(n=>typeof n.type==='function'&&n.props.onClick).props.onClick();assert.equal(posts.length,count);
for(const overrides of [{paymentType:'deposit'},{dueAmountCents:0}])assert.equal(nodes(render(overrides)).some(n=>n.props?.['aria-label']==='Optional tip'),false);
const source=readFileSync('app/dashboard.tsx','utf8');
const approvedBaseline=JSON.parse(readFileSync('scripts/fixtures/approved-customer-functions.json','utf8'));
const functionBody=(text,name)=>{const start=text.indexOf('function '+name+'(');const end=text.indexOf('\nfunction ',start+1);return text.slice(start,end<0?undefined:end);};
for(const name of ['EditCustomerDialog','PropertyPreview','OwnerAccountView'])if(approvedBaseline[name])assert.equal(functionBody(source,name),approvedBaseline[name]);

const tipExpr=source.match(/const netTips=(.*?);const outstanding/)[1];
assert.equal(vm.runInNewContext(tipExpr,{payments:[{type:'balance',amountCents:10000},{type:'Tip',amountCents:1000},{type:'Tip Refund',amountCents:-500}]}),500);
const paidExpr=source.match(/const customerPaidTotal=(.*);/)[1];
assert.equal(vm.runInNewContext(paidExpr,{customerPayments:[{type:'balance',amountCents:10000},{type:'Refund',amountCents:-2000},{type:'Tip',amountCents:1000},{type:'Tip Refund',amountCents:-500}]}),8000);
// Execute actual contact-link expressions with an address that requires encoding.
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const selected={phone:'+1 (918) 555-1212',email:'fixture@example.test',address:'123 A & B St, Tulsa, OK'};const links=[];
function walk(node,inside=false){if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(a=>a.name?.getText(ast)==='className'&&a.initializer?.text==='customer-contact'))inside=true;
 if(inside&&ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='a'){const expr=node.attributes.properties.find(a=>a.name?.getText(ast)==='href').initializer.expression;links.push(vm.runInNewContext(ts.transpile(`(${expr.getText(ast)})`),{selected,encodeURIComponent}));}
 ts.forEachChild(node,child=>walk(child,inside));}
walk(ast);for(const value of [`tel:${selected.phone}`,`sms:${selected.phone}`,`mailto:${selected.email}`,`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.address)}&travelmode=driving`,`https://earth.google.com/web/search/${encodeURIComponent(selected.address)}`,`https://www.zillow.com/homes/${encodeURIComponent(selected.address.trim().replace(/\s+/g,'-'))}_rb/`])assert.ok(links.includes(value));
assert.ok(source.includes('<StrideButton />'));assert.ok(source.includes('<PropertyPreview address={selected.address} />'));
console.log('PASS: actual selector default, preset and custom interactions, checkout request amounts, invalid custom rejection, final-only visibility; customer command/edit UI unchanged; encoded Call/Text/Email/Maps/Earth/Zillow links, Stride and property-preview integration retained.');

const invoiceAst=ts.createSourceFile('invoice.tsx',readFileSync('app/invoice/[token]/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const manualLinks=[];
function checkInvoice(node){if(ts.isJsxOpeningElement(node)&&node.tagName.getText(invoiceAst)==='a'){const a=node.attributes.properties.find(a=>a.name?.getText(invoiceAst)==='href');if(a?.initializer?.expression)manualLinks.push(vm.runInNewContext(ts.transpile(`(${a.initializer.expression.getText(invoiceAst)})`),{handles:{cashApp:'$FIREExteriors',venmo:'@FirstInResponseExteriors'},encodeURIComponent}));}ts.forEachChild(node,checkInvoice);}
checkInvoice(invoiceAst);assert.deepEqual(manualLinks,['https://cash.app/$FIREExteriors','https://venmo.com/u/FirstInResponseExteriors']);
console.log('PASS: rendered invoice payment cards link directly to the configured FIRE Cash App and Venmo profiles.');
