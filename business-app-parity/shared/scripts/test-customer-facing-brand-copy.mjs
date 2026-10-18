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
