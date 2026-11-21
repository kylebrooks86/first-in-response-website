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
const {usableCustomerPhone,usableCustomerEmail,customerMessageHandoffReadiness,definitiveUnwrittenMessagePreparation,customerTemplateLinkReadiness,customerAppointmentTemplateReadiness,customerReminderIsTomorrowInTulsa,tulsaReminderExpiryUtc}
 =await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const ready=(channel,recipient,body)=>customerMessageHandoffReadiness(channel,recipient,body);
const linked=(template,subject,body,estimateLink,invoiceLink)=>customerTemplateLinkReadiness(template,subject,body,estimateLink,invoiceLink);
const appointmentClock=Date.parse('2026-11-01T16:00:00Z');
const appointment=(template,subject,date,status,address,now=appointmentClock,key)=>customerAppointmentTemplateReadiness(template,subject,date,status,address,now,key);
eq(appointment('General message','','','draft','').ready,true,'Nonappointment templates remain usable without a saved schedule');
eq(appointment('Appointment on @schedule_date at @service_address','','','approved','Somewhere').ready,false,'Unscheduled approved estimate cannot send a confirmation');
eq(appointment('Appointment on @schedule_date','','invalid','scheduled','Somewhere').ready,false,'Malformed saved date is not a confirmed appointment');
eq(appointment('Appointment on @schedule_date','','2026-11-04T16:00:00Z','approved','Somewhere').ready,false,'A date on an unconfirmed approved estimate cannot claim job is scheduled');
eq(appointment('Appointment on @schedule_date at @service_address','','2026-11-04T16:00:00Z','scheduled','').ready,false,'Scheduled appointment with missing service address blocks a misleading confirmation');
eq(appointment('Appointment on @schedule_date at @service_address','','2026-11-04T16:00:00Z','scheduled','100 Synthetic St').ready,true,'Confirmed scheduled job and address can prepare original appointment template');
eq(appointment('Appointment on @schedule_date','','2026-10-31T16:00:00Z','scheduled','100 Synthetic St').ready,false,'Past saved scheduled appointment cannot produce outdated customer confirmation');
eq(appointment('Appointment on @schedule_date','','2026-11-01T16:00:00Z','scheduled','100 Synthetic St').ready,false,'An appointment at the exact current time requires owner verification before preparation');
eq(appointment('Appointment on @schedule_date','','2026-11-01T16:00:00.001Z','scheduled','100 Synthetic St').ready,true,'A future confirmed appointment can still be prepared');
eq(appointment('Appointment on @schedule_date','','2026-11-04T16:00:00Z','scheduled','100 Synthetic St',Number.NaN).ready,false,'Unknown current time fails closed instead of claiming future appointment');
eq(appointment('General note without a schedule','','2026-10-31T16:00:00Z','scheduled','100 Synthetic St').ready,true,'Custom text that does not assert an appointment is not blocked');
eq(appointment('General note','Your appointment @schedule_date','2026-10-31T16:00:00Z','scheduled','100 Synthetic St').ready,false,'Scheduling claim in a subject also requires future verified job');
eq(appointment('Appointment on @schedule_date','','2026-10-31T16:00:00Z','scheduled','100 Synthetic St').reason.includes('Check the job status'),true,'Past-date refusal gives owner actionable status-review guidance');
eq(appointment('Your appointment','','','draft','').ready,true,'Custom reply without date placeholder remains freely available');
// The saved 24-hour template literally says "tomorrow", which must match
// Tulsa's calendar, not a generic upcoming or UTC calendar date.
const reminderSubject="Reminder: your service is tomorrow";
eq(appointment("Appointment on @schedule_date",reminderSubject,"2026-11-04T16:00:00Z","scheduled","100 Synthetic St").ready,false,
 "The 24-hour reminder cannot claim a service four days away is tomorrow");
eq(appointment("Your service is scheduled","Please prepare your property","2026-11-04T16:00:00Z","scheduled","100 Synthetic St",appointmentClock,"appointmentReminder").ready,false,
 "Customized reminder without tomorrow wording or @schedule_date still enforces actual next-day schedule");
eq(appointment("Your service is scheduled","Please prepare your property","2026-11-02T16:00:00Z","scheduled","100 Synthetic St",appointmentClock,"appointmentReminder").ready,true,
 "Customized reminder remains usable when the saved appointment really is tomorrow");
eq(appointment("Your service","Custom subject",null,"draft","100 Synthetic St",appointmentClock,"appointment").ready,false,
 "Edited appointment confirmation cannot remove date placeholder to bypass scheduled-status validation");
eq(appointment("Appointment on @schedule_date",reminderSubject,"2026-11-02T16:00:00Z","scheduled","100 Synthetic St").ready,true,
 "Next-day 24-hour reminder remains available in Tulsa");
eq(appointment("Appointment on @schedule_date",reminderSubject,"2026-11-01T23:00:00Z","scheduled","100 Synthetic St").ready,false,
 "Same-day future service is today, not tomorrow");
eq(appointment("Appointment on @schedule_date",reminderSubject,"2026-11-04T16:00:00Z","scheduled","100 Synthetic St").reason.includes("Use Appointment confirmation"),true,
 "Premature reminder gives the owner a truthful future-date alternative");
eq(customerReminderIsTomorrowInTulsa("2026-11-02T16:00:00Z",appointmentClock),true,
 "Server and browser share Tulsa-local tomorrow decision");
eq(customerReminderIsTomorrowInTulsa("2026-11-04T16:00:00Z",appointmentClock),false,
 "Server refuses a future-week reminder with no tomorrow semantics");
eq(customerReminderIsTomorrowInTulsa("not-a-date",appointmentClock),false,
 "Malformed appointment timestamp cannot be tomorrow");
eq(customerReminderIsTomorrowInTulsa("2026-11-02T16:00:00Z",NaN),false,
 "Unverifiable clock cannot assert tomorrow");
// Exact UTC boundaries are -05 or -06 depending on the midnight itself.
eq(tulsaReminderExpiryUtc(Date.parse("2026-10-31T23:30:00Z")),
 "2026-11-01T05:00:00.000Z",
 "Before November DST fallback, Tulsa tomorrow begins at 05:00 UTC");
eq(tulsaReminderExpiryUtc(Date.parse("2026-11-01T20:00:00Z")),
 "2026-11-02T06:00:00.000Z",
 "After November DST fallback, Tulsa tomorrow begins at 06:00 UTC");
eq(tulsaReminderExpiryUtc(Date.parse("2026-03-07T20:00:00Z")),
 "2026-03-08T06:00:00.000Z",
 "Before spring DST transition, next Tulsa midnight stays on standard time");
eq(tulsaReminderExpiryUtc(Date.parse("2026-03-08T20:00:00Z")),
 "2026-03-09T05:00:00.000Z",
 "After spring DST transition, next Tulsa midnight uses daylight time");
eq(customerReminderIsTomorrowInTulsa("2026-11-02T16:00:00Z",Date.parse("2026-11-02T05:59:59Z")),true,
 "One second before local midnight tomorrow is still tomorrow");
eq(customerReminderIsTomorrowInTulsa("2026-11-02T16:00:00Z",Date.parse("2026-11-02T06:00:00Z")),false,
 "At Tulsa midnight the scheduled service becomes today");
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
// A saved document's actual customer-facing URL must not be replaced with a
// javascript/data URL, an insecure public HTTP URL, or the wrong document path.
eq(linked('Read @estimate_link','','javascript:alert(1)','javascript:alert(1)','').ready,false,'Script URL cannot be prepared as a customer estimate link');
eq(linked('Read @invoice_link','','data:text/html,phish','','data:text/html,phish').ready,false,'Data URL cannot be prepared as a customer invoice link');
eq(linked('Read @estimate_link','','http://fire.example/estimate/valid','http://fire.example/estimate/valid','').ready,false,'Public HTTP link is not a secure customer estimate link');
eq(linked('Read @invoice_link','','https://fire.example/estimate/wrong','','https://fire.example/estimate/wrong').ready,false,'Invoice message cannot carry an estimate route instead');
eq(linked('Read @estimate_link','','https://user:pass@fire.example/estimate/valid','https://user:pass@fire.example/estimate/valid','').ready,false,'Credential-bearing URL cannot enter customer message');
eq(linked('Read @estimate_link','','https://fire.example/estimate/valid#spoof','https://fire.example/estimate/valid#spoof','').ready,false,'Fragment-manipulated customer link is blocked');
eq(linked('Read @estimate_link','','http://127.0.0.1:4500/estimate/test','http://127.0.0.1:4500/estimate/test','').ready,true,'Actual loopback Chrome fixture stays usable without weakening public HTTPS');
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
eq(actual.includes('const freshAppointmentReadiness=customerAppointmentTemplateReadiness(')&&actual.includes('(estimate?.address??customer.address),Date.now(),template')&&actual.includes('if(!freshAppointmentReadiness.ready){setMessageStatus(freshAppointmentReadiness.reason);return false;}'),true,
 'Real customer composer rechecks schedule at click time before recording a durable outgoing message');
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
eq(actual.includes('if(!appointmentReadiness.ready){setMessageStatus(appointmentReadiness.reason);return false;}'),true,
 'Actual composer refuses unconfirmed saved appointment date before write');
eq(actual.includes('!appointmentReadiness.ready'),true,
 'Actual mobile Copy/Text/Email controls enforce appointment readiness');
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
