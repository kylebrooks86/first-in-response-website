import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {shouldOfferReviewAfterPayment} from "../../../lib/customer-review-invite.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value = await request.json() as Record<string, unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    if (!customerId || !body || !["text_prepared","email_prepared","copy"].includes(channel)) return Response.json({ error: "Customer, channel, and message are required." }, { status: 400 });
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(customerId).first<{id:string}>();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return Response.json({error:"That estimate does not belong to this customer."},{status:409});
    }
    if(template==="review"){
      if(!estimateId)return Response.json({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS billingTotalCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
        (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number;openCheckoutCount:number}>();
      if(!reviewState||!shouldOfferReviewAfterPayment({
        status:reviewState.status,totalCents:Number(reviewState.billingTotalCents),
        paidCents:Number(reviewState.paidCents),paymentReviewPending:Number(reviewState.paymentOverageOpen)>0||Number(reviewState.pendingRefundCount)>0||Number(reviewState.openCheckoutCount)>0
      }))
        return Response.json({error:"Complete the job, verify exact final payment and resolve any checkout, refund or billing hold before preparing a review request."},{status:409});
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id, customerId, estimateId || null, channel, template, body, createdAt).run();
    return Response.json({ message: { id, customerId, estimateId: estimateId || null, channel, template, body, createdAt } }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't save this communication." }, { status: 500 });
  }
}

// Confirmation appends evidence; preparation and legacy history stay immutable.
export async function PATCH(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value=await request.json() as Record<string,unknown>;
    const id=String(value.preparedMessageId??"").trim();
    const customerId=String(value.customerId??"").trim();
    if(!id||!customerId||value.ownerConfirmedSent!==true)return Response.json({error:"Explicit owner send confirmation is required."},{status:400});
    const prepared=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(id,customerId).first<{id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string}>();
    if(!prepared||!["text_prepared","email_prepared"].includes(prepared.channel))return Response.json({error:"A matching prepared message is required."},{status:409});
    const confirmedId=prepared.id+":owner-confirmed";
    const channel=prepared.channel==="text_prepared"?"text_confirmed":"email_confirmed";
    const createdAt=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) SELECT ?,customer_id,estimate_id,?,template,body,? FROM customer_messages WHERE id=? AND customer_id=? AND channel=? AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=?)").bind(confirmedId,channel,createdAt,prepared.id,customerId,prepared.channel,confirmedId),
      env.DB.prepare("UPDATE estimates SET status='sent' WHERE id=? AND customer_id=? AND status='draft' AND NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=estimates.id) AND EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND customer_id=? AND estimate_id=estimates.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed'))").bind(prepared.estimateId,customerId,confirmedId,customerId),
    ]);
    const message=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(confirmedId,customerId).first();
    const estimate=prepared.estimateId?await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(prepared.estimateId,customerId).first<{status:string}>():null;
    return Response.json({message,estimateStatus:estimate?.status});
  }catch{return Response.json({error:"Send confirmation could not be saved. No delivery is claimed."},{status:500});}
}
