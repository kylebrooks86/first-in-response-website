/** Inline New Estimate uses the ALREADY imported customer-identity module to
 * preserve strict isolated TEST module count (188). Make sure its validation
 * agrees with the actual Add Customer and contact-handoff contract.
 * Disposable source-only; no cloud, browser storage, D1, messages or provider.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const load=(path)=>{
 const output={};
 const text=readFileSync(path,'utf8');
 const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(js,{exports:output,require:()=>{throw Error('Unexpected imported module in source-only parity test')},console});
 return output;
};
const identity=load('lib/customer-identity.ts');
const contact=load('lib/customer-contact-links.ts');
assert.equal(typeof identity.validInlineCustomerEmail,'function');
assert.equal(typeof identity.validInlineCustomerPhone,'function');
let checks=0;
const check=(value)=>{
 const emailExpected=!value.trim()||Boolean(contact.usableCustomerEmail(value));
 const phoneExpected=!value.trim()||Boolean(contact.usableCustomerPhone(value));
 assert.equal(identity.validInlineCustomerEmail(value),emailExpected,'Email validation drift for '+JSON.stringify(value));
 assert.equal(identity.validInlineCustomerPhone(value),phoneExpected,'Phone validation drift for '+JSON.stringify(value));
 checks+=2;
};
for(const value of [
 '', ' ', '\t', ' hello@example.invalid ', 'HELLO+BUSINESS@example.invalid',
 'owner@example', 'foo..bar@example.invalid', 'no-at-sign', '@example.invalid',
 'foo@example.invalid!', 'a@b.co', 'a@b.c', 'a@-b.com','n@b.technology',
 '9185550100','(918) 555-0100','+1 (918) 555-0100','1-918-555-0100',
 '+1 918.555.0100','918-555-0100','918/555/0100','918 555 0100',
 '918555010','91855501000','+2 918 555 0100','+44 20 7946 0958',
 'not-a-number', '918abc0100','() 918 555 0100','9999999999',
 '+1 (918) 555.0100', '918-555-0100 ext 7', '\n9185550100',
 '918\t555\t0100', 'A'.repeat(300), 'somebody@example.invalid\n',
 'support@firstinresponseexteriors.com'
])check(value);
// Systematic allowed phone punctuation/spacing, including all +1 choices.
for(const d of ['9185550123','+19185550123','19185550123','9185550000']){
 for(const p of ['', ' ', '(', ')', '.', '-', '+']){
  const s=d.slice(0,3)+p+d.slice(3);
  if(s.trim())check(s);
 }
}
const estimate=readFileSync('app/api/estimates/route.ts','utf8');
assert.match(estimate,/validInlineCustomerEmail\(email\)/);
assert.match(estimate,/validInlineCustomerPhone\(phone\)/);
assert.doesNotMatch(estimate,/from ['"]\.\.\/\.\.\/\.\.\/lib\/customer-contact-links['"]/);
console.log('PASS '+checks+' inline New Estimate vs Add Customer contact-rule parity assertions. Strict TEST Worker module graph unchanged.');
