import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import { readOwnerWriteObject } from "../../../lib/customer-write-request-guard.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
// Customer message receipts contain owner-private contacts and manually prepared text.
const privateResponse=(response:Response):Response=>{
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Vary","Cookie");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
};
const privateJson=(value:unknown,init?:ResponseInit)=>privateResponse(Response.json(value,init));
async function authorized(){
  try{
    const user=await getOwnerUser();
    return Boolean(user&&typeof user.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL);
  }catch{return false;}
}

export async function POST(request: Request) {
  if (!await authorized()) return privateJson({ error: "Unauthorized" }, { status: 401 });
  try {
    // Reuse the QA/DR bounded, same-origin owner guard before any D1 reads/writes.
    const parsed=await readOwnerWriteObject(request,64_000);
    if(parsed.response)return privateResponse(parsed.response);
    const value=parsed.value as Record<string,unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    if (!customerId || !body || !["text","email","copy"].includes(channel)) return privateJson({ error: "Customer, channel, and message are required." }, { status: 400 });
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(customerId).first<{id:string}>();
    if(!customer)return privateJson({error:"Customer not found."},{status:404});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return privateJson({error:"That estimate does not belong to this customer."},{status:409});
    }
    if(template==="review"){
      if(!estimateId)return privateJson({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents) AS billingTotalCents,
        (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id) AS invoiceOwnershipMismatch,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
        (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number;invoiceOwnershipMismatch:number;openCheckoutCount:number}>();
      const reviewPaidCents=Number(reviewState?.paidCents);
      const reviewBillingTotalCents=Number(reviewState?.billingTotalCents);
      const reviewBillingSafe=Boolean(reviewState)&&Number.isSafeInteger(reviewPaidCents)&&reviewPaidCents>=0&&
        Number.isSafeInteger(reviewBillingTotalCents)&&reviewBillingTotalCents>0;
      const noHolds=Boolean(reviewState)&&[reviewState?.invoiceOwnershipMismatch,reviewState?.paymentOverageOpen,
        reviewState?.pendingRefundCount,reviewState?.openCheckoutCount]
        .every(value=>Number.isSafeInteger(Number(value))&&Number(value)===0);
      // No review handoff while invoice ownership, exact payment or a ledger hold differs.
      if(!reviewState||!reviewBillingSafe||!noHolds||reviewState.status!=="completed"||reviewPaidCents!==reviewBillingTotalCents)
        return privateJson({error:"Resolve billing and record the final payment before requesting a review."},{status:409});
    }
    if(body.length>10000)return privateJson({error:"Message is too long to save."},{status:400});
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if(template==="review"){
      const inserted=await env.DB.prepare(`INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (
          SELECT 1 FROM customer_messages
          WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
            AND datetime(created_at)>=datetime('now','-30 seconds')
        )`)
        .bind(id,customerId,estimateId,channel,template,body,createdAt,customerId,estimateId,channel).run();
      if((inserted as unknown as {success?:boolean}).success===false||!Number.isSafeInteger(Number(inserted.meta?.changes)))
        return privateJson({error:"Communication save could not be confirmed. Refresh saved messages before retrying.",saveUncertain:true},{status:503});
      if(!inserted.meta.changes){
        const recent=await env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt
          FROM customer_messages WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
          ORDER BY created_at DESC LIMIT 1`).bind(customerId,estimateId,channel).first();
        if(recent)return privateJson({message:recent,duplicate:true});
        return privateJson({error:"Review request was not saved. Recheck the job and payment status."},{status:409});
      }
    }else{
      const inserted=await env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id, customerId, estimateId || null, channel, template, body, createdAt).run();
      if((inserted as unknown as {success?:boolean}).success===false||Number(inserted.meta?.changes)!==1)
        return privateJson({error:"Communication save could not be confirmed. Refresh saved messages before retrying.",saveUncertain:true},{status:503});
    }
    return privateJson({ message: { id, customerId, estimateId: estimateId || null, channel, template, body, createdAt } }, { status: 201 });
  } catch {
    return privateJson({ error: "Communication save could not be verified. Refresh saved messages before retrying.",saveUncertain:true }, { status: 503 });
  }
}
