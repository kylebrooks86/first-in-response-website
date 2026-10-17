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
       ts.isJsxAttribute(attr)&&attr.name.text==='className'&&attr.initializer?.text==='mobile-payment-quick-action')){
    paymentButtons.push(node);
  }
  ts.forEachChild(node,walk);
}
walk(source);
assert.equal(paymentButtons.length,1,'Exactly one shared mobile dollar shortcut should exist');
const button=paymentButtons[0].getText(source);
assert.match(button,/aria-label="Record payments"/,'Accessible action name must be explicit');
assert.match(button,/title="Record payments"/);
assert.match(button,/onClick=\{\(\)=>setTab\("payments"\)\}/,
 'Mobile quick action must navigate to the same Payments tab as desktop, never submit funds');
assert.match(button,/type="button"/);
assert.match(button,/disabled=\{!interactive\}/);
assert.match(button,/<span aria-hidden="true">\$<\/span>/);
const header=dashboard.slice(dashboard.indexOf('<header className={`topbar '));
assert.ok(header.indexOf('className="mobile-payment-quick-action"') <
 header.indexOf('<StrideButton top/>'),'Dollar shortcut belongs in the top utility actions');
assert.ok(header.indexOf('className="mobile-payment-quick-action"') <
 header.indexOf('</header>'),'Dollar action must be on every screen, not dashboard only');
assert.ok(!dashboard.includes('mobile-record-payments-action'),
 'Remove oversized old dashboard button entirely');
assert.match(header,/<button disabled=\{!interactive\} className="payment-state" onClick=\{\(\)=>setTab\("payments"\)\}/,
 'Desktop Payments action must remain unchanged');
const parsed=postcss.parse(css);const rules=[];parsed.walkRules(rule=>rules.push(rule));
const get=(selector,media)=>rules.findLast(rule=>rule.selector===selector&&
  (media?rule.parent.type==='atrule':rule.parent.type==='root'));
const value=(rule,property)=>rule?.nodes.find(node=>node.prop===property)?.value;
assert.equal(value(get('.mobile-payment-quick-action',false),'display'),'none',
 'Desktop must keep its original toolbar entry only');
assert.match(css,/@media\(max-width:760px\)\{\s*\.mobile-payment-quick-action\{/);
assert.equal(value(get('.mobile-payment-quick-action',true),'display'),'grid!important');
assert.equal(value(get('.mobile-payment-quick-action',true),'min-height'),'42px!important');
assert.equal(value(get('.mobile-payment-quick-action',true),'width'),'42px!important');
assert.ok(css.includes('@media(max-width:430px)'));
assert.ok(css.includes('@media(max-width:360px)'));
assert.ok(css.includes('.topbar .mobile-brand{display:none!important}'),
 'Keep all interactive buttons even on extremely narrow phones');
assert.equal(value(get('.mobile-payment-quick-action:focus-visible',true),'outline'),
 '3px solid #db4651!important');
assert.match(dashboard,/process\.env\.NODE_ENV === "development" && localCustomersCandidate && <CandidateLayoutTrace\/>/,
 'Diagnostic must remain development-only across QA, LIVE, staging, Doomsday');
console.log('PASS: Shared top-bar $ quick action on phone, accessible label, same Payments navigation on every tab, preserved desktop entry, narrow layout, no giant CTA; no real payments.');
