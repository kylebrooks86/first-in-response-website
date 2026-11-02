import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {canOfferManualPayment,isWithdrawnPublicEstimate} from "../lib/public-payment-visibility.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const pay=readFileSync(resolve(root,"app/pay/[id]/page.tsx"),"utf8");
const invoice=readFileSync(resolve(root,"app/invoice/[token]/page.tsx"),"utf8");
const estimate=readFileSync(resolve(root,"app/estimate/[token]/page.tsx"),"utf8");
const valid={status:"approved",acceptedAt:"2026-11-02T12:00:00Z",signedAt:"2026-11-02T12:01:00Z",billingVerified:true,balanceCents:5000,reviewPending:false};
let checks=0;
const check=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
for(const status of ["declined","superseded"]){check(isWithdrawnPublicEstimate(status),true,status+" withdrawn");check(canOfferManualPayment({...valid,status}),false,status+" manual blocked");}
for(const status of ["draft","sent","viewed","paid","unknown"]){check(isWithdrawnPublicEstimate(status),false,status+" not withdrawn");check(canOfferManualPayment({...valid,status}),false,status+" manual blocked");}
for(const status of ["approved","scheduled","completed"]){check(canOfferManualPayment({...valid,status}),true,status+" signed manual allowed");}
for(const [key,value] of Object.entries({acceptedAt:null,signedAt:null,billingVerified:false,balanceCents:0,reviewPending:true})){check(canOfferManualPayment({...valid,[key]:value}),false,key+" fail closed");}
for(const amount of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){check(canOfferManualPayment({...valid,balanceCents:amount}),false,"invalid cents");}
for(const date of ["",0,false]){check(canOfferManualPayment({...valid,acceptedAt:date}),false,"invalid acceptance");check(canOfferManualPayment({...valid,signedAt:date}),false,"invalid signature");}
check(canOfferManualPayment({...valid,billingVerified:1}),false,"must confirm billing");
check(canOfferManualPayment({...valid,reviewPending:0}),false,"must confirm no review");
for(const [source,name] of [[pay,"pay"],[invoice,"invoice"]]){
  check(source.includes("canOfferManualPayment({"),true,name+" shares gating policy");
  check(source.includes("signed_at AS "+(name==="pay"?"signedAt":"estimateSignedAt")),true,name+" checks persisted signature");
  check(source.includes("manualPaymentEligible&&"),true,name+" hides instructions when invalid");
}
check(pay.includes("isWithdrawnPublicEstimate(row.status)"),true,"withdrawn pay link checked");
check(pay.indexOf("isWithdrawnPublicEstimate(row.status)")<pay.indexOf("const itemResult"),true,"withdrawn pay link hides item details before loading");
check(pay.includes("Payment link no longer available"),true,"neutral unavailable text");
check(!pay.includes("After approval, the 50% deposit"),true,"no hardcoded deposit in public payment page");
check(invoice.includes("{manualPaymentEligible&&row.estimateStatus"),true,"invoice card action also signed-only");
check(estimate.includes('if(row.status==="declined")'),true,"quote share page still hides voided quote");
console.log(`PASS ${checks}/${checks}: public estimate, pay and invoice signed-only payment visibility; voided link privacy; billing review; no hardcoded 50% message. Source tests only, no hosted transactions.`);
