/** Standard deposit scheduling foundation; no mutation, waiver or payment initiation. */
export function depositPolicyEnabled(env:{FIRE_DEPOSIT_POLICY_CANDIDATE?:string}){return env.FIRE_DEPOSIT_POLICY_CANDIDATE==='synthetic-tests-only';}
const principalSql="COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)";
export const depositPolicyColumns=`e.id,e.customer_id AS customerId,e.status,e.scheduled_at AS scheduledAt,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.accepted_at AS acceptedAt,e.signed_at AS signedAt,
 ${principalSql} AS paidCents,
 (SELECT COUNT(*) FROM payments p WHERE p.estimate_id=e.id AND (typeof(p.amount_cents)<>'integer' OR p.amount_cents NOT BETWEEN -9007199254740991 AND 9007199254740991)) AS invalidPaymentCount,
 (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
 (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount,
 (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS billingExceptionCount,
 (SELECT COUNT(*) FROM invoices i WHERE i.estimate_id=e.id) AS invoiceCount`;
export type DepositPolicyRow={id:string;customerId:string;status:string;scheduledAt:string|null;totalCents:number;depositCents:number;paidCents:number;acceptedAt:string|null;signedAt:string|null;invalidPaymentCount:number;pendingRefundCount:number;openCheckoutCount:number;billingExceptionCount:number;invoiceCount:number};
export function depositSchedulingPolicy(row:DepositPolicyRow,enforced:boolean){
 const cents=[row.totalCents,row.depositCents,row.paidCents],counts=[row.invalidPaymentCount,row.pendingRefundCount,row.openCheckoutCount,row.billingExceptionCount,row.invoiceCount];
 const safe=cents.every(n=>Number.isSafeInteger(n)&&n>=0)&&counts.every(n=>Number.isSafeInteger(n)&&n>=0)&&row.invalidPaymentCount===0&&row.depositCents<=row.totalCents&&row.paidCents<=row.totalCents;
 const standardRequiredCents=safe?Math.round(row.totalCents/2):null;
 const retainedSchedule=row.status==='scheduled'&&Boolean(row.scheduledAt)&&Number.isFinite(Date.parse(row.scheduledAt!));
 const signed=Boolean(row.acceptedAt&&row.signedAt)&&['approved','scheduled'].includes(row.status);
 const hold=row.pendingRefundCount+row.openCheckoutCount+row.billingExceptionCount+row.invoiceCount>0;
 const termsMatch=safe&&row.depositCents===standardRequiredCents;
 const reason=!safe?'records':!signed?'approval':hold?'reconciliation':!retainedSchedule&&!termsMatch?'terms':!retainedSchedule&&row.paidCents<standardRequiredCents!?'deposit_due':null;
 const messages:Record<string,string>={records:"Review this job's deposit and payment records before scheduling; the amounts could not be verified.",approval:'The customer must approve and sign the estimate before scheduling.',reconciliation:'Review active checkout, refund, invoice or billing exceptions before changing this schedule.',terms:'The stored deposit terms differ from the standard 50% requirement. Keep the agreement unchanged and review its terms before scheduling.',deposit_due:`A 50% deposit is required before scheduling. Record the remaining $${((row.depositCents-row.paidCents)/100).toFixed(2)} deposit. Approval is not payment. Owner deposit exceptions are not enabled in this candidate yet.`};
 return {enforced,standardPercent:50,standardRequiredCents,storedRequiredCents:safe?row.depositCents:null,netPrincipalPaidCents:safe?row.paidCents:null,remainingDepositCents:safe&&row.invoiceCount===0?Math.max(0,row.depositCents-row.paidCents):null,remainingJobBalanceCents:safe&&row.invoiceCount===0?row.totalCents-row.paidCents:null,retainedSchedule,canSchedule:reason===null,blockedReason:reason,message:reason?messages[reason]:null,overrideAvailable:false};
}
// Re-evaluate the same financial requirements inside the actual UPDATE. A
// preflight GET alone cannot protect against concurrent refunds or changed terms.
export const depositSchedulingGuard=`typeof(totalCents)='integer' AND totalCents BETWEEN 0 AND 9007199254740991
 AND typeof(depositCents)='integer' AND depositCents BETWEEN 0 AND totalCents
 AND typeof(paidCents)='integer' AND paidCents BETWEEN 0 AND totalCents AND invalidPaymentCount=0
 AND pendingRefundCount=0 AND openCheckoutCount=0 AND billingExceptionCount=0 AND invoiceCount=0
 AND acceptedAt IS NOT NULL AND length(acceptedAt)>0 AND signedAt IS NOT NULL AND length(signedAt)>0
 AND ((status='scheduled' AND scheduledAt IS NOT NULL AND julianday(scheduledAt) IS NOT NULL)
 OR (status='approved' AND depositCents=CAST(totalCents/2 AS INTEGER)+(totalCents%2) AND paidCents>=depositCents))`;
