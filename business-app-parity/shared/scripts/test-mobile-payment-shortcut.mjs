import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');

const dashboard=readFileSync('app/dashboard.tsx','utf8');
const css=readFileSync('app/globals.css','utf8');
const source=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const paymentButtons=[];
function walk(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='button'&&
     node.openingElement.attributes.properties.some(attr=>
       ts.isJsxAttribute(attr)&&attr.name.text==='className'&&attr.initializer?.text==='payments-quick-action')){
    paymentButtons.push(node);
  }
  ts.forEachChild(node,walk);
}
walk(source);
assert.equal(paymentButtons.length,1,'Exactly one shared dollar shortcut should exist');
const button=paymentButtons[0].getText(source);
assert.match(button,/aria-label="Record payments"/,'Accessible action name must be explicit');
assert.match(button,/title="Record payments"/);
assert.match(button,/onClick=\{\(\)=>setTab\("payments"\)\}/,
 'Shared quick action must navigate to Payments, never submit funds');
assert.match(button,/type="button"/);
assert.match(button,/disabled=\{!interactive\}/);
assert.match(button,/<span aria-hidden="true">\$<\/span>/);
const header=dashboard.slice(dashboard.indexOf('<header className={`topbar '));
assert.ok(header.indexOf('className="payments-quick-action"') <
 header.indexOf('<StrideButton top/>'),'Dollar shortcut belongs in the top utility actions');
assert.ok(header.indexOf('className="payments-quick-action"') <
 header.indexOf('</header>'),'Dollar action must be on every screen, not dashboard only');
assert.ok(!dashboard.includes('mobile-record-payments-action'),
 'Remove oversized old dashboard button entirely');
assert.ok(!dashboard.includes('payment-state'),'No separate desktop dot/text entry remains');
const parsed=postcss.parse(css);const rules=[];parsed.walkRules(rule=>rules.push(rule));
const get=(selector,media)=>rules.findLast(rule=>rule.selector===selector&&
  (media?rule.parent.type==='atrule'&&rule.parent.params.includes('max-width:760px'):rule.parent.type==='root'));
const value=(rule,property)=>rule?.nodes.find(node=>node.prop===property)?.value;
const important=(rule,property)=>Boolean(rule?.nodes.find(node=>node.prop===property)?.important);
assert.equal(value(get('.payments-quick-action',false),'display'),'grid',
 'The same dollar action must be visible at desktop, tablet and phone widths');
assert.ok(important(get('.payments-quick-action',false),'display'));
assert.equal(value(get('.payments-quick-action',false),'min-height'),'42px');
assert.equal(value(get('.payments-quick-action',false),'width'),'42px');
assert.equal(get('.payments-quick-action',true),undefined,'No phone-only visibility rule');
assert.ok(css.includes('@media(max-width:430px)'));
assert.ok(css.includes('@media(max-width:360px)'));
assert.ok(css.includes('.topbar .mobile-brand{display:none!important}'),
 'Keep all interactive buttons even on extremely narrow phones');
assert.equal(value(get('.payments-quick-action:focus-visible',false),'outline'),
 '3px solid #db4651');
assert.match(dashboard,/process\.env\.NODE_ENV === "development" && localCustomersCandidate && <CandidateLayoutTrace\/>/,
 'Diagnostic must remain development-only across QA, LIVE, staging, Doomsday');
console.log('PASS: Shared top-bar $ quick action at every screen size, accessible label, same Payments navigation on every tab, no duplicate desktop entry, narrow layout, no giant CTA; no real payments.');
