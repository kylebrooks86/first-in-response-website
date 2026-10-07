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
      CASE WHEN p.type IN ('deposit','balance','Tip') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment
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
    const tipCents = Math.round(Number(body.tipCents) || 0);
    const method = String(body.method ?? "Other").trim() || "Other";
    const reference = String(body.reference ?? "").trim() || null;
    if (!estimateId || !Number.isSafeInteger(amountCents) || amountCents < 0 || !Number.isSafeInteger(tipCents) || tipCents < 0 || (amountCents <= 0 && tipCents <= 0)) {
      return Response.json({ error: "Choose a job and enter a valid payment or tip amount." }, { status: 400 });
    }
    const estimate = await env.DB.prepare(`
      SELECT e.id,e.total_cents AS estimateTotalCents,COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,e.deposit_cents AS depositCents,e.status,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents
      FROM estimates e WHERE e.id=?
    `).bind(estimateId).first<{id:string;estimateTotalCents:number;totalCents:number;depositCents:number;status:string;paidCents:number}>();
    if (!estimate) return Response.json({ error: "Estimate not found." }, { status: 404 });
    const maxTipCents=Math.min(Number(estimate.totalCents),50000);
    if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0)return Response.json({error:"This job's tip limit cannot be represented safely. Stop and review the invoice total."},{status:409});
    if(tipCents>maxTipCents)return Response.json({error:"Tip cannot exceed the invoice total or $500."},{status:400});
    if (tipCents > 0 && estimate.status !== "completed") return Response.json({ error: "Tips can be recorded only after the job is completed." }, { status: 409 });

    const billingException = await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL LIMIT 1").bind(estimateId).first<{id:string}>();
    if (billingException) return Response.json({ error: "This job has an unresolved payment exception. Complete the refund or retained-overpayment handling and resolve the exception before recording another payment or tip." }, { status: 409 });
    const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(estimateId).first<{id:string}>();
    if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before recording another payment or tip."},{status:409});

    const paidCents = Number(estimate.paidCents);
    const dueLimit = estimate.status === "completed"
      ? Number(estimate.totalCents)
      : ["approved","scheduled"].includes(estimate.status)
        ? Number(estimate.depositCents)
        : 0;
    if(!Number.isSafeInteger(paidCents)||paidCents<0||!Number.isSafeInteger(dueLimit)||dueLimit<0||!Number.isSafeInteger(paidCents+amountCents))return Response.json({error:"Billing totals are outside FIRE's safe accounting range. Stop and review this job before recording another payment."},{status:409});
    const balance = Math.max(0, dueLimit - paidCents);

    let payment:{id:string;estimateId:string;type:string;amountCents:number;status:string;reference:string|null;createdAt:string}|null=null;
    let tip:{id:string;estimateId:string;type:string;amountCents:number;status:string;reference:string|null;createdAt:string}|null=null;
    if(amountCents>0){
      if (dueLimit <= 0) return Response.json({ error: "A payment is not due on this estimate yet." }, { status: 409 });
      if (balance <= 0) return Response.json({ error: estimate.status === "completed" ? "This job is already paid in full. Record the tip by itself instead." : "The reservation deposit is already paid." }, { status: 400 });
      if (amountCents > balance) return Response.json({ error: `Payment cannot exceed the amount currently due of $${(balance / 100).toFixed(2)}. Put any extra amount in Tip received instead.` }, { status: 400 });

      payment = { id:crypto.randomUUID(), estimateId, type:method, amountCents, status:"paid", reference, createdAt:new Date().toISOString() };
      const paymentStatement = env.DB.prepare(`
        INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
        SELECT ?,?,?,?,'paid',?,?
        WHERE ? <= (
          SELECT MAX(0,
            CASE
              WHEN e.status='completed' THEN COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)
              WHEN e.status IN ('approved','scheduled') THEN e.deposit_cents
              ELSE 0
            END - COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
          )
          FROM estimates e WHERE e.id=?
        )
        AND (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')) <= 9007199254740991 - ?
      `).bind(payment.id, estimateId, method, amountCents, reference, payment.createdAt, amountCents, estimateId, estimateId, amountCents);

      if(tipCents>0){
        const tipId=crypto.randomUUID();
        const tipReference=[method,reference].filter(Boolean).join(" · ")||method;
        const tipCreatedAt=new Date().toISOString();
        const results=await env.DB.batch([
          paymentStatement,
          env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
            SELECT ?,?,'Tip',?,'paid',?,?
            WHERE EXISTS (SELECT 1 FROM payments WHERE id=? AND estimate_id=? AND status='paid')`)
            .bind(tipId,estimateId,tipCents,tipReference,tipCreatedAt,payment.id,estimateId),
          env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
            SELECT ?,'tip_received',?,?,customer_id,?,? FROM estimates
            WHERE id=? AND EXISTS (SELECT 1 FROM payments WHERE id=? AND estimate_id=? AND status='paid')`)
            .bind(crypto.randomUUID(),"Tip received",`${(tipCents/100).toFixed(2)} tip recorded via ${method}.`,estimateId,tipCreatedAt,estimateId,payment.id,estimateId),
        ]);
        if(!results[0]?.meta.changes)return Response.json({ error:"The amount due changed while this payment was being recorded. Refresh the job and verify the remaining balance before trying again." },{status:409});
        if(!results[1]?.meta.changes)return Response.json({ error:"The invoice payment was not paired with its tip record. Refresh Payment History before recording anything else." },{status:409});
        tip={id:tipId,estimateId,type:"Tip",amountCents:tipCents,status:"paid",reference:tipReference,createdAt:tipCreatedAt};
      }else{
        const inserted=await paymentStatement.run();
        if(!inserted.meta.changes)return Response.json({ error:"The amount due changed while this payment was being recorded. Refresh the job and verify the remaining balance before trying again." },{status:409});
      }
    }

    if(tipCents>0&&amountCents<=0){
      tip={id:crypto.randomUUID(),estimateId,type:"Tip",amountCents:tipCents,status:"paid",reference:[method,reference].filter(Boolean).join(" · ")||method,createdAt:new Date().toISOString()};
      const results=await env.DB.batch([
        env.DB.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?, 'Tip',?,'paid',?,?)")
          .bind(tip.id,estimateId,tipCents,tip.reference,tip.createdAt),
        env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) SELECT ?,'tip_received',?,?,customer_id,?,? FROM estimates WHERE id=?")
          .bind(crypto.randomUUID(),"Tip received",`${(tipCents/100).toFixed(2)} tip recorded via ${method}.`,estimateId,tip.createdAt,estimateId),
      ]);
      if(!results[0]?.meta.changes)return Response.json({error:"The tip could not be recorded safely. Refresh Payment History before trying again."},{status:409});
    }

    const refreshed = await env.DB.prepare(`
      SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,
        e.deposit_cents AS depositCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents
      FROM estimates e WHERE e.id=?
    `).bind(estimateId).first<{status:string;totalCents:number;depositCents:number;paidCents:number}>();
    const nextPaid = Number(refreshed?.paidCents ?? (paidCents + amountCents));
    const refreshedDueLimit = refreshed?.status === "completed"
      ? Number(refreshed.totalCents)
      : refreshed && ["approved","scheduled"].includes(refreshed.status)
        ? Number(refreshed.depositCents)
        : dueLimit;
    if(!Number.isSafeInteger(nextPaid)||nextPaid<0||!Number.isSafeInteger(refreshedDueLimit)||refreshedDueLimit<0)return Response.json({error:"Payment was recorded, but refreshed billing totals require review before FIRE can reconcile the balance."},{status:409});
    if(refreshed?.status==="completed"&&amountCents>0){
      await env.DB.prepare(`UPDATE invoices SET status=CASE
        WHEN ?>=total_cents THEN 'paid'
        WHEN ?>0 THEN 'partial'
        WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
        ELSE 'draft' END WHERE estimate_id=?`)
        .bind(nextPaid,nextPaid,estimateId).run();
    }
    return Response.json({ payment, tip, paidCents:nextPaid, balanceCents:Math.max(0, refreshedDueLimit-nextPaid) }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't record this payment. Please try again." }, { status: 500 });
  }
}

