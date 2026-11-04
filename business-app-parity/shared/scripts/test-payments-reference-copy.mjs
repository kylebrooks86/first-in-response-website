import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const dashboard=readFileSync('app/dashboard.tsx','utf8');
const css=readFileSync('app/globals.css','utf8');
const ast=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const payments=ast.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text==='PaymentsView');
assert.ok(payments,'The real PaymentsView must remain present');
let declaration;
function scan(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='copyHistoryPaymentReference')declaration=node;
 ts.forEachChild(node,scan);
}
scan(payments);
assert.ok(declaration?.initializer&&ts.isArrowFunction(declaration.initializer),'Test actual Payments reference-copy callback');
const callbackSource=declaration.initializer.getText(ast);
assert.ok(!/fetch\s*\(|\/api\/|payment\.status\s*=/.test(callbackSource),'Copy is UI-only; never writes records');
const compiled=ts.transpileModule('const copyHistoryPaymentReference='+callbackSource+';exports.copy=copyHistoryPaymentReference;',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
let feedback=null;
const history=[];
const context={
 exports:{},
 navigator:{clipboard:undefined},
 paymentReferenceCopyAttempt:{current:0},
 setPaymentReferenceCopy(value){
  feedback=typeof value==='function'?value(feedback):value;
  history.push(JSON.parse(JSON.stringify(feedback)));
 },
 Error
};
vm.runInNewContext(compiled,context);
const copy=context.exports.copy;
const shown=()=>JSON.parse(JSON.stringify(feedback));
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
let pending=[];
context.navigator.clipboard={writeText:value=>new Promise((resolve,reject)=>pending.push({resolve,reject,value}))};
const success=copy('payment-a','pi_test_A');
eq(shown(),{id:'payment-a',status:'copying'},'Must show pending before clipboard resolves');
eq(pending[0].value,'pi_test_A','Must pass original exact reference, no truncation');
pending[0].resolve();
await success;
eq(shown(),{id:'payment-a',status:'copied'},'Only confirmed clipboard write shows Copied');
context.navigator.clipboard={writeText:()=>Promise.reject(new Error('clipboard denied'))};
await copy('payment-b','pi_test_B');
eq(shown(),{id:'payment-b',status:'manual'},'Permission denial must show the manual fallback');
context.navigator.clipboard=undefined;
await copy('payment-c','pi_test_C');
eq(shown(),{id:'payment-c',status:'manual'},'Missing clipboard API must not throw or claim copied');

pending=[];
context.navigator.clipboard={writeText:value=>new Promise((resolve,reject)=>pending.push({resolve,reject,value}))};
const old=copy('payment-old','pi_old');
const latest=copy('payment-latest','pi_latest');
eq(shown(),{id:'payment-latest',status:'copying'},'Newest request takes precedence');
pending[1].resolve();
await latest;
eq(shown(),{id:'payment-latest',status:'copied'},'Latest confirmed reference is the one shown');
pending[0].reject(new Error('older write refused'));
await old;
eq(shown(),{id:'payment-latest',status:'copied'},'Earlier failed copy must not overwrite latest confirmation');

const scope=payments.getText(ast);
assert.match(scope,/aria-label="Copy full payment reference"/);checks++;
assert.match(scope,/disabled=\{paymentReferenceCopy\?\.id===payment\.id&&paymentReferenceCopy\.status==="copying"\}/);checks++;
assert.match(scope,/role=\{paymentReferenceCopy\.status==="manual"\?"alert":"status"\}/);checks++;
assert.match(scope,/Clipboard unavailable\. Select and copy this reference manually:/);checks++;
assert.match(scope,/<code className="payment-reference-manual">\{payment\.reference\}<\/code>/);checks++;
assert.ok(!scope.includes('navigator.clipboard.writeText(payment.reference||"").catch(()=>{})'),'Do not silently discard clipboard errors');checks++;
assert.match(css,/\.payments-view \.payment-reference-copy-button\{[^}]*min-height:44px/);checks++;
assert.match(css,/\.payments-view \.payment-reference-copy-button:focus-visible\{[^}]*outline:3px/);checks++;
assert.match(css,/\.payments-view \.payment-reference-manual\{[^}]*user-select:text;[^}]*-webkit-user-select:text/);checks++;
const customers=ast.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text==='CustomersView');
assert.ok(customers,'The real CustomersView must remain present');checks++;
const customerSource=customers.getText(ast);
assert.match(customerSource,/className="customer-payment-reference-copy-button"/);checks++;
assert.match(customerSource,/className="customer-payment-copy-feedback" role=\{paymentReferenceCopyFeedback\.ok\?"status":"alert"\}/);checks++;
assert.match(customerSource,/if\(!navigator\.clipboard\?\.writeText\)throw new Error\("Clipboard unavailable"\)/);checks++;
assert.match(css,/\.customer-payment-record \.customer-payment-reference-copy-button\{[^}]*min-height:44px/);checks++;
assert.match(css,/\.customer-payment-record \.customer-payment-reference-copy-button:focus-visible\{[^}]*outline:3px/);checks++;
assert.match(css,/\.customer-payment-record \.customer-payment-copy-feedback code\{[^}]*user-select:text/);checks++;
console.log('PASS '+checks+' checks: Payments reference copy pending/success/failure/missing API/overlapping requests, exact bytes, on-screen manual fallback, 44px tap target and focus; source-only, no Stripe/D1/provider actions.');
