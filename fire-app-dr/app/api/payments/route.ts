import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized() {
  const user = await getOwnerUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

export async function GET() {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await env.DB.prepare(`
    SELECT p.id,p.estimate_id AS estimateId,p.type,p.amount_cents AS amountCents,p.status,
      p.provider_id AS reference,p.created_at AS createdAt,c.id AS customerId,c.name AS customer,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
      CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
      CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents,
      CASE WHEN p.type IN ('deposit','balance') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment
    FROM payments p
    JOIN estimates e ON e.id=p.estimate_id
    JOIN customers c ON c.id=e.customer_id
    ORDER BY p.created_at DESC
  `).all();
  const paymentRowsSafe=(result.results as Record<string,unknown>[]).every((row)=>{
    const amount=Number(row.amountCents);
    const refunded=Number(row.refundedCents??0);
    const refundable=Number(row.refundableCents??0);
    return Number.isSafeInteger(amount)&&Number.isSafeInteger(refunded)&&refunded>=0&&Number.isSafeInteger(refundable)&&refundable>=0;
  });
  if(!paymentRowsSafe)return Response.json({error:"Payment history contains accounting values that require owner review."},{status:409});
  return Response.json({ payments: result.results });
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const estimateId = String(body.estimateId ?? "").trim();
    const amountCents = Math.round(Number(body.amountCents) || 0);
    const method = String(body.method ?? "Other").trim() || "Other";
    const reference = String(body.reference ?? "").trim() || null;
    if (!estimateId || !Number.isSafeInteger(amountCents) || amountCents <= 0) return Response.json({ error: "Choose a job and enter a valid payment amount." }, { status: 400 });

    const estimate = await env.DB.prepare(`
      SELECT e.id,e.total_cents AS estimateTotalCents,COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,e.deposit_cents AS depositCents,e.status,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid'),0) AS paidCents
      FROM estimates e WHERE e.id=?
    `).bind(estimateId).first<{id:string;estimateTotalCents:number;totalCents:number;depositCents:number;status:string;paidCents:number}>();
    if (!estimate) return Response.json({ error: "Estimate not found." }, { status: 404 });
    const billingException = await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL LIMIT 1").bind(estimateId).first<{id:string}>();
    if (billingException) return Response.json({ error: "This job has an unresolved payment exception. Complete the refund or retained-overpayment handling and resolve the exception before recording another payment." }, { status: 409 });
    const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(estimateId).first<{id:string}>();
    if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before recording another payment."},{status:409});
    const paidCents = Number(estimate.paidCents);
    const dueLimit = estimate.status === "completed"
      ? Number(estimate.totalCents)
      : ["approved","scheduled"].includes(estimate.status)
        ? Number(estimate.depositCents)
        : 0;
    if(!Number.isSafeInteger(paidCents)||paidCents<0||!Number.isSafeInteger(dueLimit)||dueLimit<0||!Number.isSafeInteger(paidCents+amountCents))return Response.json({error:"Billing totals are outside FIRE's safe accounting range. Stop and review this job before recording another payment."},{status:409});
    const balance = Math.max(0, dueLimit - paidCents);
    if (dueLimit <= 0) return Response.json({ error: "A payment is not due on this estimate yet." }, { status: 409 });
    if (balance <= 0) return Response.json({ error: estimate.status === "completed" ? "This job is already paid in full." : "The reservation deposit is already paid." }, { status: 400 });
    if (amountCents > balance) return Response.json({ error: `Payment cannot exceed the amount currently due of $${(balance / 100).toFixed(2)}.` }, { status: 400 });

    const payment = { id:crypto.randomUUID(), estimateId, type:method, amountCents, status:"paid", reference, createdAt:new Date().toISOString() };
    const inserted = await env.DB.prepare(`
      INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,?,?,'paid',?,?
      WHERE ? <= (
        SELECT MAX(0,
          CASE
            WHEN e.status='completed' THEN COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)
            WHEN e.status IN ('approved','scheduled') THEN e.deposit_cents
            ELSE 0
          END - COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0)
        )
        FROM estimates e WHERE e.id=?
      )
      AND (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p WHERE p.estimate_id=? AND p.status='paid') <= 9007199254740991 - ?
    `).bind(payment.id, estimateId, method, amountCents, reference, payment.createdAt, amountCents, estimateId, estimateId, amountCents).run();
    if (!inserted.meta.changes) return Response.json({ error: "The amount due changed while this payment was being recorded. Refresh the job and verify the remaining balance before trying again." }, { status: 409 });

    const refreshed = await env.DB.prepare(`
      SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,
        e.deposit_cents AS depositCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid'),0) AS paidCents
      FROM estimates e WHERE e.id=?
    `).bind(estimateId).first<{status:string;totalCents:number;depositCents:number;paidCents:number}>();
    const nextPaid = Number(refreshed?.paidCents ?? (paidCents + amountCents));
    const refreshedDueLimit = refreshed?.status === "completed"
      ? Number(refreshed.totalCents)
      : refreshed && ["approved","scheduled"].includes(refreshed.status)
        ? Number(refreshed.depositCents)
        : dueLimit;
    if(!Number.isSafeInteger(nextPaid)||nextPaid<0||!Number.isSafeInteger(refreshedDueLimit)||refreshedDueLimit<0)return Response.json({error:"Payment was recorded, but refreshed billing totals require review before FIRE can reconcile the balance."},{status:409});
    if(refreshed?.status==="completed"){
      await env.DB.prepare(`UPDATE invoices SET status=CASE
        WHEN ?>=total_cents THEN 'paid'
        WHEN ?>0 THEN 'partial'
        WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
        ELSE 'draft' END WHERE estimate_id=?`)
        .bind(nextPaid,nextPaid,estimateId).run();
    }
    return Response.json({ payment, paidCents:nextPaid, balanceCents:Math.max(0, refreshedDueLimit-nextPaid) }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't record this payment. Please try again." }, { status: 500 });
  }
}
