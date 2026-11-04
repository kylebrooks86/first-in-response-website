/** Synthetic owner deposit amendment: versioned, read-only customer disclosure. No approval, scheduling or payment permission. */
import {validateDepositAuditIntegrity} from './deposit-audit-backup.mjs';
const valid=n=>Number.isSafeInteger(n)&&n>=0;
const usd=n=>{const c=BigInt(n);return '$'+(c/100n).toString()+'.'+(c%100n).toString().padStart(2,'0');};
const fail=message=>{throw new Error(message);};
/** @param {{estimate:{id:string,status:string,totalCents:number,depositCents:number,acceptedAt:string|null,signedAt:string|null},latestEvent:Record<string,any>,eventCount:number,paymentCount:number,invoiceCount:number,openCheckoutCount:number,pendingRefundCount:number}} input */
export function describeRevisedDepositTerms(input){
 const {estimate:e,latestEvent:a,eventCount,paymentCount,invoiceCount,openCheckoutCount,pendingRefundCount}=input??{};
 if(!e||!a||typeof e.id!=='string'||!e.id)fail('Missing estimate and audit record.');
 if(!valid(e.totalCents)||!valid(e.depositCents)||e.depositCents>e.totalCents)fail('Invalid price or deposit.');
 if(!['draft','sent'].includes(e.status)||e.acceptedAt!==null||e.signedAt!==null)fail('Signed or progressed agreement.');
 if(!Number.isInteger(eventCount)||eventCount<1||eventCount>100||[paymentCount,invoiceCount,openCheckoutCount,pendingRefundCount].some(n=>n!==0))
   fail('Financial activity or incomplete audit history.');
 if(a.previous_total_cents!==e.totalCents||a.new_deposit_cents!==e.depositCents||a.paid_principal_cents!==0||a.previous_signed_at!==null||a.requires_customer_reapproval!==0)
   fail('Estimate no longer matches unsigned audit.');
 const integrity=validateDepositAuditIntegrity({estimates:[{id:e.id}],deposit_policy_events:[a]},true);
 if(integrity)fail(integrity);
 const names={standard:'Standard 50% deposit','restore-standard':'Standard 50% deposit restored',waive:'Upfront deposit waived',percentage:'Owner-adjusted percentage deposit',fixed:'Owner-adjusted fixed deposit','schedule-before-deposit':'Deposit collection deferral requested'};
 const mode=a.mode,modeName=names[mode];if(!modeName)fail('Unsupported deposit terms.');
 const deferred=mode==='schedule-before-deposit',waived=mode==='waive';
 return Object.freeze({
   version:'deposit-exception-v1:'+a.id,eventId:a.id,createdAt:a.created_at,
   mode,modeName,percent:mode==='percentage'?a.percent_basis_points/100:null,
   totalCents:e.totalCents,depositCents:e.depositCents,balanceAfterDepositCents:e.totalCents-e.depositCents,
   totalDisplay:usd(e.totalCents),depositDisplay:usd(e.depositCents),balanceDisplay:usd(e.totalCents-e.depositCents),
   explanation:waived?'The upfront deposit is waived, but the entire job price remains payable.':
     deferred?'The deposit remains owed. Scheduling before collection is only proposed and requires separate owner approval.':
       'The remaining service price stays payable after the deposit.',
   notice:'Proposed revised deposit terms — not yet signed or approved.',
   requirement:'Review these deposit terms with the service agreement. A new customer signature is required. This preview does not authorize payment or scheduling.',
   previewOnly:true,signatureEnabled:false,paymentEnabled:false,canSchedule:false
 });
}
