/** NEW FIRE customer Text/Email readiness contract.
 * No customer data, provider sends, browser, database or network actions.
 * This checks the logic used on the actual customer profile MessageComposer.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('lib/customer-contact-links.ts','utf8');
const js=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {usableCustomerPhone,usableCustomerEmail,customerMessageHandoffReadiness,definitiveUnwrittenMessagePreparation,customerTemplateLinkReadiness}
 =await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const ready=(channel,recipient,body)=>customerMessageHandoffReadiness(channel,recipient,body);
const linked=(template,subject,body,estimateLink,invoiceLink)=>customerTemplateLinkReadiness(template,subject,body,estimateLink,invoiceLink);
eq(linked('Custom note','','Hi there','','').ready,true,'Custom messages without link placeholders stay free to prepare');
eq(linked('See @form_link','','See your customer report link','','').ready,false,'Missing real report URL must never be presented as a customer-facing link');
eq(linked('See @form_link','','Report at https://example.invalid/report','','').ready,false,'Pasting unrelated URL into unresolved placeholder cannot bypass verified report access');
eq(linked('Please reply','', 'Please reply', '', '').ready,true,'Truthful report handoff without fictitious URL remains usable');
eq(linked('Review @estimate_link','','Hi, your estimate is ready','','').ready,false,'Missing saved estimate URL blocks preparation');
eq(linked('Review @estimate_link','','Hi, your estimate is ready','https://fire.example/estimate/valid','').ready,false,'Loaded link omitted by edited draft cannot be sent');
eq(linked('Review @estimate_link','','Hi https://fire.example/estimate/valid','https://fire.example/estimate/valid','').ready,true,'Exact saved estimate link in message permits preparation');
eq(linked('Your invoice is ready: @invoice_link','','Invoice sent','','').ready,false,'Missing invoice token blocks payment reminder');
eq(linked('Your invoice is ready: @invoice_link','','Invoice link https://fire.example/invoice/valid','','https://fire.example/invoice/valid').ready,true,'Saved invoice link permits preparation');
eq(linked('Custom','Invoice @invoice_link','No URL included','','https://fire.example/invoice/valid').ready,false,'Subject placeholders cannot bypass invoice link guard');
eq(linked('@estimate_link @invoice_link','','Estimate https://fire.example/estimate/valid','https://fire.example/estimate/valid','').ready,false,'Templates requiring two URLs block if either missing');
eq(usableCustomerPhone('(918) 555-0111'),'+19185550111','Normalize an Oklahoma mobile number');
eq(usableCustomerPhone('918-555-0111'),'+19185550111','Normalize dash-formatted number');
eq(usableCustomerPhone('+1 918 555 0111'),'+19185550111','Retain US country code');
eq(usableCustomerPhone('918-555-0111 ext 2'),null,'Reject nonrecipient phone extensions');
eq(usableCustomerPhone('555'),null,'Reject incomplete number');
eq(usableCustomerPhone(''),null,'Reject absent number');
eq(usableCustomerEmail('owner+contact@example.com'),'owner+contact@example.com','Accept valid contact email');
eq(usableCustomerEmail('broken@@example'),null,'Reject invalid email');
eq(ready('text','(918) 555-0111','  Hello customer  ').ready,true,
 'Valid text and saved number can be prepared, not sent');
eq(ready('email','owner+contact@example.com','  Please confirm. ').ready,true,
 'Valid email and meaningful message can be prepared');
eq(ready('text','918-555-0111','').ready,false,
 'Empty custom Text draft stays unprepared');
eq(ready('email','owner+contact@example.com','   \n ').ready,false,
 'Whitespace-only custom email stays unprepared');
eq(ready('text','invalid!','Hello').ready,false,
 'Invalid phone blocks durable Text preparation');
eq(ready('email','not an address','Hello').ready,false,
 'Invalid email blocks durable Email preparation');
eq(ready('text',null,'Hello').reason.includes('valid customer'),true,
 'Missing phone gives actionable owner guidance');
eq(ready('email',null,'Hello').reason.includes('valid customer'),true,
 'Missing email gives actionable owner guidance');
eq(ready('text','918-555-0111','').reason.includes('FIRE will not send automatically'),true,
 'Blank Text explicitly says no automatic sending');
eq(ready('email','owner+contact@example.com','').reason.includes('FIRE will not send automatically'),true,
 'Blank Email explicitly says no automatic sending');
eq(ready('text','918-555-0111','Prepared').reason,'',
 'Complete Text does not claim sending occurred');
eq(ready('email','owner+contact@example.com','Prepared').reason,'',
 'Complete Email does not claim sending occurred');

eq(definitiveUnwrittenMessagePreparation(400),true,'API input rejection occurs before insert and is safe to fix');
eq(definitiveUnwrittenMessagePreparation(404),true,'Deleted customer rejection occurs before insert and is safe to fix');
eq(definitiveUnwrittenMessagePreparation(409),false,'Conflict may refer to saved immutable draft; retain original operation ID');
eq(definitiveUnwrittenMessagePreparation(500),false,'Server error cannot prove whether draft was committed');
eq(definitiveUnwrittenMessagePreparation(503),false,'Gateway outage must not cause duplicate sends or new preparation');
eq(definitiveUnwrittenMessagePreparation(0),false,'Network error cannot prove noncommit');


const dashboard=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',dashboard,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const composer=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='MessageComposer');
assert.ok(composer,'Original MessageComposer is preserved');
const actual=composer.getText(ast);
eq(actual.includes('customerMessageHandoffReadiness("text",customer.phone,body)'),true,
 'Actual MessageComposer checks saved phone before making text_prepared audit event');
eq(actual.includes('customerMessageHandoffReadiness("email",customer.email,body)'),true,
 'Actual MessageComposer checks saved email before making email_prepared audit event');
eq(actual.includes('if(!linkReadiness.ready){setMessageStatus(documentLinkMessage);return false;}'),true,
 'Actual durable prepared-message route refuses missing estimate/invoice URL');
eq(actual.includes('!linkReadiness.ready||!customerMessageHandoffReadiness("text"'),true,
 'Actual Google Voice Text button refuses a link-dependent missing URL');
eq(actual.includes('!linkReadiness.ready||!customerMessageHandoffReadiness("email"'),true,
 'Actual Email button refuses a link-dependent missing URL');
eq(actual.includes('setShareLinkError("Estimate link unavailable.'),true,
 'Actual estimate-share request displays an actionable error instead of silently failing');
eq(actual.includes('setInvoiceLinkError("Invoice link unavailable.'),true,
 'Actual invoice-share request displays an actionable error instead of silently failing');
eq(actual.includes('>Retry link</Button>'),true,
 'Actual composer offers owner-requested manual link retry, never auto-sends');
eq(actual.includes('role="status"'),true,
 'Composer exposes guidance in accessible status text');
eq(actual.includes('GoogleVoiceTextShortcutAction phone={customer.phone}'),true,
 'Prepared Text still routes through owner-approved Google Voice Shortcut');
eq(actual.includes('if(!await log("copy"))return;'),true,
 'Copy action saves and verifies owner audit record before modifying clipboard');
eq(actual.includes('await navigator.clipboard.writeText(body.trim())'),true,
 'Actual Copy action uses the exact trimmed recorded message');
eq(actual.includes('"@callback_number":"918-922-9366"'),true,
 'Callback merge tag contains FIRE business Voice number, not a fake instruction');
eq(actual.includes('"@form_link":""'),true,
 'No fabricated report URL is injected into saved message content');
eq(actual.includes('if(definitiveUnwrittenMessagePreparation(response.status)){'),true,
 'Actual composer releases uncertain draft lock only on proven pre-write rejections');
eq(actual.includes('ownerConfirmedSent:true'),true,
 'Explicit owner send confirmation remains mandatory');
eq(actual.includes('mailto:'),true,
 'Email retains explicit mail-app handoff, no auto-send');
eq(actual.includes('personalPhoneBackupAction'),false,
 'No invented automatic personal-number fallback action');
console.log('PASS '+checks+'/'+checks+' NEW focused customer Text/Email readiness and actual composer wiring checks. No sends or owner data.');
