import { env } from "cloudflare:workers";

type RuntimeEnv = Cloudflare.Env & { STRIPE_SECRET_KEY?: string; SITE_ORIGIN?: string };

async function expireTrackedCheckout(sessionId: string, secret: string) {
  const headers = { authorization: `Bearer ${secret}` };
  const expire = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, { method: "POST", headers });
  if (expire.ok) return true;

  // Stripe may already have expired the session even if our prior local status update failed.
  // Re-read the authoritative remote state so a stale local "open" row cannot permanently
  // block creation of a replacement checkout link.
  const inspect = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers });
  if (!inspect.ok) return false;
  const remote = await inspect.json() as { status?: string };
  return remote.status === "expired";
}

export async function POST(request: Request) {
  const runtime = env as RuntimeEnv;
  if (!runtime.STRIPE_SECRET_KEY) return Response.json({ error: "Payments have not been connected yet." }, { status: 503 });
  try {
    const { shareToken, paymentType = "deposit" } = await request.json() as { shareToken?: string; paymentType?: "deposit" | "balance" };
    if (!shareToken) return Response.json({ error: "Estimate link is required." }, { status: 400 });
    if (!["deposit","balance"].includes(paymentType)) return Response.json({ error: "Invalid payment type." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT e.id, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents, e.deposit_cents AS depositCents, e.status, e.accepted_at AS acceptedAt,
             c.name AS customer,
             COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
      FROM estimates e JOIN customers c ON c.id=e.customer_id
      WHERE e.share_token=? LIMIT 1
    `).bind(shareToken).first<{ id: string; totalCents: number; depositCents: number; status:string; acceptedAt:string|null; customer: string; service: string }>();
    if (!row) return Response.json({ error: "Estimate not found." }, { status: 404 });
    const billingException = await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL LIMIT 1").bind(row.id).first<{id:string}>();
    if (billingException) return Response.json({ error: "This account has a payment exception under review. Resolve the refund or credit before starting another card payment." }, { status: 409 });
    const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(row.id).first<{id:string}>();
    if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before starting another card payment."},{status:409});
    if (!row.acceptedAt && !["approved","scheduled","completed"].includes(row.status)) return Response.json({ error: "Approve and sign the estimate before making the reservation deposit." }, { status: 409 });
    if (paymentType === "balance" && row.status !== "completed") return Response.json({ error: "The remaining balance is due after the job is completed." }, { status: 409 });
    if (paymentType === "deposit" && row.status === "completed") return Response.json({ error: "This job is complete. Pay the remaining final invoice balance instead of a reservation deposit." }, { status: 409 });
    const paid = await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid'").bind(row.id).first<{ amount: number }>();
    const paidCents = Number(paid?.amount ?? 0);
    const totalCents=Number(row.totalCents);const depositCents=Number(row.depositCents);
    if(!Number.isSafeInteger(paidCents)||!Number.isSafeInteger(totalCents)||!Number.isSafeInteger(depositCents))return Response.json({error:"Billing totals are outside FIRE's safe payment range. Contact Kyle before paying."},{status:409});
    const amount = paymentType === "deposit" ? Math.max(0, depositCents - paidCents) : Math.max(0, totalCents - paidCents);
    if(!Number.isSafeInteger(amount))return Response.json({error:"The amount due cannot be represented safely. Contact Kyle before paying."},{status:409});
    if (amount < 50) return Response.json({ error: "This estimate has no balance due." }, { status: 400 });
    const openSessions = await env.DB.prepare("SELECT id FROM payment_checkout_sessions WHERE estimate_id=? AND status='open'").bind(row.id).all<{id:string}>();
    for (const session of openSessions.results) {
      const remotelyExpired = await expireTrackedCheckout(session.id, runtime.STRIPE_SECRET_KEY);
      if (!remotelyExpired) return Response.json({ error:"A previous payment checkout is still processing. Please wait a moment and try again." }, { status:409 });
      await env.DB.prepare("UPDATE payment_checkout_sessions SET status='expired',expired_at=? WHERE id=? AND status='open'").bind(new Date().toISOString(), session.id).run();
    }
    const origin = runtime.SITE_ORIGIN || new URL(request.url).origin;
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${origin}/estimate/${shareToken}?session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/estimate/${shareToken}`);
    form.set("client_reference_id", row.id);
    form.set("metadata[estimate_id]", row.id);
    form.set("metadata[payment_type]", paymentType);
    form.set("metadata[expected_amount_cents]", String(amount));
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(amount));
    form.set("line_items[0][price_data][product_data][name]", `${row.service} — ${paymentType === "deposit" ? "50% deposit" : "remaining balance"}`);
    form.set("payment_intent_data[description]", `FIRE estimate ${row.id}`);
    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${runtime.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
    const data = await stripe.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!stripe.ok || !data.id || !data.url) return Response.json({ error: data.error?.message || "Payment checkout could not be started." }, { status: 502 });
    const current=await env.DB.prepare(`SELECT e.status,e.deposit_cents AS depositCents,
      COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen
      FROM estimates e WHERE e.id=?`).bind(row.id).first<{status:string;depositCents:number;totalCents:number;paidCents:number;paymentOverageOpen:number}>();
    const currentDue=current?(paymentType==="deposit"&&current.status!=="completed"?Math.max(0,Number(current.depositCents)-Number(current.paidCents)):paymentType==="balance"&&current.status==="completed"?Math.max(0,Number(current.totalCents)-Number(current.paidCents)):0):0;
    if(!current||!Number.isSafeInteger(currentDue)||Number(current.paymentOverageOpen)>0||currentDue!==amount){
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.id)}/expire`,{method:"POST",headers:{authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}`}});
      return Response.json({error:"The amount due changed while checkout was being created. Refresh the page before paying."},{status:409});
    }
    try {
      await env.DB.prepare("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,?,?, 'open', ?)")
        .bind(data.id,row.id,paymentType,amount,new Date().toISOString()).run();
    } catch {
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.id)}/expire`, { method:"POST", headers:{ authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}` } });
      return Response.json({ error:"Payment checkout could not be safely tracked. Please try again." }, { status:502 });
    }
    return Response.json({ url: data.url });
  } catch {
    return Response.json({ error: "Payment checkout could not be started." }, { status: 500 });
  }
}
