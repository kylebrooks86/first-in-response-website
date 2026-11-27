/** Regression for the preview-only owner deposit-exception calculator. No DB or payment calls. */
import assert from 'node:assert/strict';
import {previewOwnerDepositException} from '../lib/deposit-exception-proposal.mjs';
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
const fail=(input,message)=>{assert.throws(()=>previewOwnerDepositException(input),new RegExp(message));checks++};
const original={id:"synthetic-estimate",status:"approved",totalCents:18001,depositCents:9001,paidCents:3000,
  signedAt:"2026-10-18T00:00:00Z",acceptedAt:"2026-10-18T00:00:00Z",contractVersion:"v1",
  invalidPaymentCount:0,pendingRefundCount:0,openCheckoutCount:0,billingExceptionCount:0,invoiceCount:0};
const owner="kylebrooks8605@gmail.com";
function make(mode,extra={},current=original){
 const request={mode,confirmed:true,expectedStatus:current.status,expectedTotalCents:current.totalCents,
   expectedDepositCents:current.depositCents,expectedPaidCents:current.paidCents,
   expectedSignedAt:current.signedAt,expectedContractVersion:current.contractVersion,...extra};
 return {current,request,verifiedOwnerEmail:owner};
}
const before=JSON.stringify(original);
const previews=[
 ["standard",{},9001,false,false],
 ["waive",{},0,false,true],
 ["percentage",{percentBasisPoints:2500},4500,false,true],
 ["fixed",{fixedCents:7000},7000,false,true],
 ["schedule-before-deposit",{},9001,true,true],
 ["restore-standard",{},9001,false,false]
];
for(const [mode,extra,required,deferred,reapproval] of previews){
 const p=previewOwnerDepositException(make(mode,extra));
 eq([p.proposedDepositCents,p.scheduleBeforeCollection,p.requiresSignedAgreementRevision],[required,deferred,reapproval]);
 eq([p.originalTotalCents,p.existingNetPrincipalPaidCents,p.remainingJobPrincipalCents],[18001,3000,15001]);
 eq(p.remainingDepositCents,Math.max(0,required-3000));
 eq([p.previewOnly,p.canSchedule,p.canPersist],[true,false,false]);
 eq([p.signedAtAtReview,p.contractVersionAtReview],[original.signedAt,"v1"]);
}
eq(JSON.stringify(original),before);
const unsigned={...original,signedAt:null,acceptedAt:null,contractVersion:null};
eq(previewOwnerDepositException(make("waive",{},unsigned)).requiresSignedAgreementRevision,false);
const paidOverDeposit={...original,paidCents:10000};
eq(previewOwnerDepositException(make("fixed",{fixedCents:5000},paidOverDeposit)).remainingDepositCents,0);
eq(previewOwnerDepositException(make("fixed",{fixedCents:5000},paidOverDeposit)).remainingJobPrincipalCents,8001);
const odd={...original,totalCents:1,depositCents:1,paidCents:0};
eq(previewOwnerDepositException(make("percentage",{percentBasisPoints:5000},odd)).proposedDepositCents,1);
const large={...original,totalCents:Number.MAX_SAFE_INTEGER,depositCents:4503599627370496,paidCents:0};
eq(previewOwnerDepositException(make("percentage",{percentBasisPoints:2500},large)).proposedDepositCents,2251799813685248);
for(const [field,value] of [["pendingRefundCount",1],["openCheckoutCount",1],["billingExceptionCount",1],["invoiceCount",1],["invalidPaymentCount",1]])
 fail(make("waive",{}, {...original,[field]:value}),"reconciliation");
for(const [field,value] of [["totalCents",-1],["depositCents",1.5],["paidCents",20000]])
 fail(make("waive",{}, {...original,[field]:value}),"Invalid|Inconsistent");
for(const status of ["completed","declined","unknown"])
 fail(make("waive",{}, {...original,status}),"cannot have deposit");
fail(make("waive",{confirmed:false}),"confirmation");
fail({...make("waive"),verifiedOwnerEmail:"outsider@example.invalid"},"owner permission");
fail({...make("waive"),verifiedOwnerEmail:""},"owner permission");
fail(make("waive",{expectedTotalCents:17000}),"changed");
fail(make("waive",{expectedDepositCents:0}),"changed");
fail(make("waive",{expectedPaidCents:9001}),"changed");
fail(make("waive",{expectedSignedAt:null}),"changed");
fail(make("waive",{expectedStatus:"scheduled"}),"changed");
fail(make("waive",{expectedContractVersion:"v2"}),"changed");
fail(make("percentage",{percentBasisPoints:-1}),"percentage");
fail(make("percentage",{percentBasisPoints:10001}),"percentage");
fail(make("percentage",{percentBasisPoints:25.1}),"percentage");
fail(make("fixed",{fixedCents:-100}),"Invalid");
fail(make("fixed",{fixedCents:19000}),"exceed");
fail(make("fixed",{fixedCents:100.5}),"Invalid");
fail(make("percentage"),"amount input");
fail(make("waive",{fixedCents:0}),"amount input");
fail(make("fixed",{fixedCents:1000,percentBasisPoints:1000}),"amount input");
fail(make("waive",{reason:"x".repeat(501)}),"Reason");
fail(make("waive",{overrideDepositRequirement:true}),"Unsupported exception request field");
fail(make("unexpected"),"Unsupported deposit");
eq(previewOwnerDepositException(make("waive",{reason:"  owner note  "})).reason,"owner note");
console.log("PASS "+checks+"/"+checks+": all six preview modes, discounted/odd/large totals, collected principal, signed revision flag, stale state, billing holds, owner confirmation and forged-field refusal; NO database, payments, agreement or scheduling mutations.");
