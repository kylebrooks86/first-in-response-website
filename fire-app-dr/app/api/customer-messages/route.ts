import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getOwnerUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value = await request.json() as Record<string, unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    if (!customerId || !body || !["text","email","copy"].includes(channel)) return Response.json({ error: "Customer, channel, and message are required." }, { status: 400 });
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(customerId).first<{id:string}>();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return Response.json({error:"That estimate does not belong to this customer."},{status:409});
    }
    if(template==="review"&&channel!=="copy"){
      if(!estimateId)return Response.json({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS billingTotalCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number}>();
      const reviewPaidCents=Number(reviewState?.paidCents);
      const reviewBillingTotalCents=Number(reviewState?.billingTotalCents);
      const reviewBillingSafe=Boolean(reviewState)&&Number.isSafeInteger(reviewPaidCents)&&reviewPaidCents>=0&&Number.isSafeInteger(reviewBillingTotalCents)&&reviewBillingTotalCents>=0;
      if(!reviewState||!reviewBillingSafe||reviewState.status!=="completed"||reviewPaidCents<reviewBillingTotalCents||Number(reviewState.paymentOverageOpen)>0||Number(reviewState.pendingRefundCount)>0)
        return Response.json({error:"Resolve billing and record the final payment before requesting a review."},{status:409});
    }
    if(body.length>10000)return Response.json({error:"Message is too long to save."},{status:400});
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if(template==="review"&&channel!=="copy"){
      const inserted=await env.DB.prepare(`INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (
          SELECT 1 FROM customer_messages
          WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
            AND datetime(created_at)>=datetime('now','-30 seconds')
        )`)
        .bind(id,customerId,estimateId,channel,template,body,createdAt,customerId,estimateId,channel).run();
      if(!inserted.meta.changes){
        const recent=await env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt
          FROM customer_messages WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
          ORDER BY created_at DESC LIMIT 1`).bind(customerId,estimateId,channel).first();
        if(recent)return Response.json({message:recent,duplicate:true});
      }
    }else{
      await env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id, customerId, estimateId || null, channel, template, body, createdAt).run();
    }
    return Response.json({ message: { id, customerId, estimateId: estimateId || null, channel, template, body, createdAt } }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't save this communication." }, { status: 500 });
  }
}
