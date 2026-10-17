import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');

const dashboard=readFileSync('app/dashboard.tsx','utf8');
const css=readFileSync('app/globals.css','utf8');
const source=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=name=>source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
const home=component('DashboardView');
assert.ok(home,'Actual dashboard component not found');
const paymentButtons=[];
function walk(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='button'&&
     node.openingElement.attributes.properties.some(attr=>
       ts.isJsxAttribute(attr)&&attr.name.text==='className'&&attr.initializer?.text==='mobile-record-payments-action')){
    paymentButtons.push(node);
  }
  ts.forEachChild(node,walk);
}
walk(home);
assert.equal(paymentButtons.length,1,'One mobile Record payments shortcut must exist');
const button=paymentButtons[0].getText(source);
assert.match(button,/Record payments/,'User-facing label must say Record payments');
assert.match(button,/onClick=\{\(\)=>onNavigate\("payments"\)\}/,
  'Shortcut must open actual existing Payments tab, never submit a payment');
assert.match(button,/type="button"/);
const parsed=postcss.parse(css);
const rules=[];parsed.walkRules(rule=>rules.push(rule));
const get=(selector,media)=>rules.findLast(rule=>rule.selector===selector&&
  (media?rule.parent.type==='atrule'&&rule.parent.params==='max-width:760px':
   rule.parent.type==='root'));
const value=(rule,property)=>rule?.nodes.find(node=>node.prop===property)?.value;
assert.equal(value(get('.mobile-record-payments-action',false),'display'),'none',
  'Do not alter desktop presentation');
assert.equal(value(get('.mobile-record-payments-action',true),'display'),'flex',
  'Button must show on iPhone / narrow iPad widths');
assert.equal(value(get('.mobile-record-payments-action',true),'width'),'100%');
assert.equal(value(get('.mobile-record-payments-action',true),'min-height'),'48px');
assert.equal(value(get('.mobile-record-payments-action:focus-visible',true),'outline'),
  '3px solid #f7b9be');
assert.ok(dashboard.indexOf('className="mobile-record-payments-action"')<
  dashboard.indexOf('<ScheduleWeather compact'),
  'Mobile shortcut must be visible near top of dashboard before forecast');
assert.match(dashboard,/process\.env\.NODE_ENV === "development" && localCustomersCandidate && <CandidateLayoutTrace\/>/,
  'Layout diagnostic must never render in production-built QA, LIVE, staging, or Doomsday');
assert.ok(!dashboard.includes('{localCustomersCandidate && <CandidateLayoutTrace/>}'));
const sharedPage=readFileSync('app/page.tsx','utf8');
assert.match(sharedPage,/process\.env\.NODE_ENV === "development"/);
console.log('PASS: Shared dashboard mobile Record payments shortcut, width, minimum touch size, actual Payments tab navigation, accessible focus, unchanged desktop header, and development-only layout diagnostics. No remote writes or payments.');
