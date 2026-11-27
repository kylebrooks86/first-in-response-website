/** Render the real Customer invoice JSX branch, not a mock screenshot.
 * Ensure a missing share token is never presented as a dead link.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='CustomersView');assert.ok(fn);
const blocks=[];function visit(n){if(ts.isJsxExpression(n)&&n.expression?.getText(ast).startsWith('section === "invoices" && (matchingInvoices.length'))blocks.push(n.expression);ts.forEachChild(n,visit);}visit(fn);
assert.equal(blocks.length,1,'Extract exactly the actual customer Invoice tab rendering branch');
const source=blocks[0].getText(ast);
const code=ts.transpileModule('exports.render=()=>('+source+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const environment={exports:{},require,Receipt:()=>null,ExternalLink:()=>null,selected:{customerNumber:null},customerNumberLabel:()=>'',jobNumberLabel:()=>'',money:n=>'$'+(n/100).toFixed(2),statusLabel:x=>x,section:'invoices',customerInvoices:[],matchingInvoices:[]};
vm.runInNewContext(code,environment);
const nodes=x=>{const result=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(!v||typeof v!=='object')return;result.push(v);walk(v.props?.children);}walk(x);return result};
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
function render(invoice){environment.matchingInvoices=[invoice];environment.customerInvoices=[invoice];return nodes(environment.exports.render())}
const record={id:'synthetic-invoice',status:'sent',dueAt:'2026-11-10',totalCents:12500,paidCents:0,shareToken:'synthetic-private-token',jobNumber:123,customerNumber:234};
let output=render(record);
const link=output.find(n=>n.type==='a'&&n.props?.id==='customer-invoice-synthetic-invoice');
assert.ok(link,'Saved invoice has exact actionable owner preview');checks++;
eq(link.props.href,'/invoice/synthetic-private-token?ownerPreview=1&from=customer','Preview keeps exact existing owner route');
eq(link.props.className,'customer-record record-button','Existing tappable card appearance retained');
eq(link.props.tabIndex,undefined,'Functional anchor remains keyboard focusable');
eq(output.filter(n=>n.props?.role==='status').length,0,'Valid invoice has no false unavailable warning');
for(const token of [null,'']){
 output=render({...record,shareToken:token});
 eq(output.some(n=>n.type==='a'),false,'Missing token never produces an inert clickable anchor');
 const fallback=output.find(n=>n.type==='div'&&n.props?.id==='customer-invoice-synthetic-invoice');
 assert.ok(fallback,'Record remains visible without misleading action');checks++;
 eq(fallback.props.className,'customer-record','No pointer/interactive card class when preview unavailable');
 eq(output.some(n=>n.props?.role==='status'&&String(n.props.children).includes('Preview unavailable')),true,'Owner gets one concise truthful preview status');
 eq(output.some(n=>n.props?.href!==undefined),false,'No external or invented preview URL');
}
eq(output.some(n=>n.props?.onClick),false,'Missing-token row cannot submit a transaction');
eq(source.includes('RecordPayment'),false,'Customer invoice history never initiates billing action');
console.log('PASS '+checks+'/'+checks+' actual customer Invoice JSX: saved preview remains keyboard/openable; missing token shows a real record without a dead link or fabricated URL.');
