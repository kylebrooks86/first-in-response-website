// Customer-facing system notices are from the business, not the owner personally.
// Do not rewrite deliberately personalized owner-authored SMS/email templates.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicInvoiceFooter,templateByKey} from "../lib/fire-templates.ts";

const customerFiles=[
  "app/estimate/[token]/accept-button.tsx",
  "app/estimate/[token]/page.tsx",
  "app/api/public/estimates/[token]/accept/route.ts",
  "app/api/public/estimates/[token]/change-request/route.ts",
  "app/invoice/[token]/page.tsx",
];
for (const path of customerFiles) {
  const content=readFileSync(path,"utf8");
  assert.doesNotMatch(content,/\bKyle\b/i,path+": customer-facing system text must use business identity");
}
const accept=readFileSync(customerFiles[0],"utf8");
const publicEstimate=readFileSync(customerFiles[1],"utf8");
const invoice=readFileSync(customerFiles[4],"utf8");
assert.match(accept,/Estimate approved and agreement signed\. First In Response Exteriors will contact you to schedule\./);
assert.match(accept,/Your request was sent to First In Response Exteriors\./);
assert.match(accept,/Describe what you would like changed/);
assert.match(publicEstimate,/After approval, First In Response Exteriors will contact you to schedule the job and arrange the 50% deposit/);
assert.match(publicEstimate,/First In Response Exteriors has been notified/);
assert.match(invoice,/publicInvoiceFooter\(footer\?\.body\)/);
const old="Thank you for choosing First In Response Exteriors. The remaining balance is due upon completion. Please contact Kyle with any questions about this invoice or to arrange payment.";
const newDefault=templateByKey("invoiceFooter").body;
assert.ok(newDefault.includes("Please contact First In Response Exteriors"));
assert.equal(publicInvoiceFooter(old),newDefault,"Already-seeded default footer must display business identity without DB edits");
assert.equal(publicInvoiceFooter(null),newDefault);
assert.equal(publicInvoiceFooter(undefined),newDefault);
const custom="Please call our office for billing questions.";
assert.equal(publicInvoiceFooter(custom),custom,"Owner-customized persisted footer must remain unchanged");
console.log("PASS: Customer estimate/approval/errors/payment notices use First In Response Exteriors; existing seeded invoice footer normalized at display; custom templates untouched. No deployment or database writes.");

// All current presentation source, including server errors and owner navigation.
const {readdirSync}=await import('node:fs');
const {join}=await import('node:path');
function scan(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())scan(path);else if(/\.(tsx?|mjs)$/.test(path)&&!path.endsWith('/chatgpt-auth.ts')&&!path.endsWith('/owner-auth.ts')){
 let text=readFileSync(path,'utf8').replace(/https?:\/\/[^\s"'<>]+/g,'');
 // One exact historical sentinel is retained for read-time footer compatibility.
 if(path==='lib/fire-templates.ts')text=text.replace(/const legacyDefault=.*;/,'');
 if(path==='lib/legacy-business-template-defaults.mjs')continue;
 assert.doesNotMatch(text,/\bKyle(?: Brooks)?\b/i,path+': business presentation must not identify the owner personally');
}}}
for(const directory of ['app','components','lib'])scan(directory);
const {FIRE_TEMPLATES,businessTemplateOverride,SERVICE_AGREEMENT,fillTemplate}=await import('../lib/fire-templates.ts');
const {LEGACY_BUSINESS_TEMPLATE_DEFAULTS}=await import('../lib/legacy-business-template-defaults.mjs');
for(const item of FIRE_TEMPLATES){
 assert.doesNotMatch(item.subject+' '+item.body,/\bKyle\b/i,item.key);
 assert.deepEqual((item.body.match(/@[a-z_]+/g)??[]).sort(),(LEGACY_BUSINESS_TEMPLATE_DEFAULTS[item.key]?.body.match(/@[a-z_]+/g)??item.body.match(/@[a-z_]+/g)??[]).sort(),'Template variables preserved: '+item.key);
}
for(const [key,legacy] of Object.entries(LEGACY_BUSINESS_TEMPLATE_DEFAULTS)){
 const saved={key,...legacy,updatedAt:'2026-10-01T00:00:00Z'},snapshot=JSON.stringify(saved),current=templateByKey(key);
 const normalized=businessTemplateOverride(saved);
 assert.equal(normalized.subject,current.subject);assert.equal(normalized.body,current.body);assert.equal(normalized.updatedAt,saved.updatedAt);assert.equal(JSON.stringify(saved),snapshot,'No mutation of saved default');
 const body='Customer Kyle Brooks asked for a callback. Contact kyle@example.invalid.';
 assert.equal(businessTemplateOverride({...saved,body}).body,body,'Custom/customer names untouched');
 assert.equal(businessTemplateOverride({...saved,subject:'Kyle Brooks custom subject'}).subject,'Kyle Brooks custom subject');
 assert.equal(businessTemplateOverride({...saved,body:legacy.body+' Custom instruction.'}).body,legacy.body+' Custom instruction.','Near matches are custom, never blindly rewritten');
}
assert.match(SERVICE_AGREEMENT,/First In Response Exteriors LLC/);
assert.match(fillTemplate(templateByKey('estimate').body,{'@customer_first_name':'Kyle'}),/^Hi Kyle,/,'Customer name is data, not branding');
const ownerDashboard=readFileSync('app/dashboard.tsx','utf8');
assert.match(ownerDashboard,/<section className="welcome-row"><div><h1>Today<\/h1>/,
 'Compact owner Home starts with its primary heading without repeating the app brand');
assert.match(ownerDashboard,/<div className="mobile-brand"><FireMark small\s*\/><strong>FIRE<\/strong>/,
 'App chrome still retains the visible FIRE brand');
assert.match(ownerDashboard,/First In Response Exteriors/,
 'Owner navigation must still identify the business');
assert.doesNotMatch(readFileSync('app/owner-account.tsx','utf8'),/Kyle|Brooks/);
console.log('PASS: all current UI/API presentation, default template categories, exact saved-default compatibility, template variables, customized text, customer names and legal LLC identity preserved.');
