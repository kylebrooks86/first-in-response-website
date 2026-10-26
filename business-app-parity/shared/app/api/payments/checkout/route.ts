import { LOCAL_CUSTOMER_DEPLOYMENT } from "../../../local-customer-deployment";
import { env } from "cloudflare:workers";

type RuntimeEnv = Cloudflare.Env & { STRIPE_RESTRICTED_KEY?: string; STRIPE_SECRET_KEY?: string; FIRE_ENV?:string; SITE_ORIGIN?: string };

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

// A repeated customer checkout request MUST NOT call Stripe's /expire endpoint
// for a previous still-active session. The customer may already be paying.
async function inspectUnpaidExpiration(session: {id:string;type:string;amountCents:number},estimateId:string,secret:string,sandbox:boolean){
  if(!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(session.id))return false;
  if((sandbox&&!session.id.startsWith("cs_test_"))||(!sandbox&&!session.id.startsWith("cs_live_")))return false;
  const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`,{
    headers:{authorization:`Bearer ${secret}`,"Stripe-Version":"2026-08-26.dahlia"}
  });
  if(!response.ok)return false;
  const remote=await response.json() as {
    id?:string;status?:string;payment_status?:string;livemode?:boolean;
    amount_total?:number;client_reference_id?:string;
    metadata?:Record<string,string>;
  };
  return remote.id===session.id&&remote.livemode===!sandbox&&
    remote.status==="expired"&&remote.payment_status==="unpaid"&&
    remote.client_reference_id===estimateId&&
    remote.metadata?.estimate_id===estimateId&&
    remote.metadata?.payment_type===session.type&&
    remote.metadata?.expected_charge_cents===String(session.amountCents)&&
    remote.amount_total===session.amountCents;
}

export async function POST(request: Request) {
  if (String(LOCAL_CUSTOMER_DEPLOYMENT) === "qa") return Response.json({error:"Synthetic QA disables all Stripe actions and connection probes."},{status:503,headers:{"cache-control":"no-store"}});
  const runtime = env as RuntimeEnv;
  const stripeKey = runtime.STRIPE_RESTRICTED_KEY || runtime.STRIPE_SECRET_KEY;
  const sandboxTarget = String(LOCAL_CUSTOMER_DEPLOYMENT) !== "live" || /(?:staging|doomsday|synthetic|sandbox)/i.test(runtime.FIRE_ENV || "");
  if(sandboxTarget&&stripeKey&&!/^(sk|rk|rkcs)_test_/.test(stripeKey))return Response.json({error:"Staging only accepts sandbox Stripe keys."},{status:503});
  if (!stripeKey) return Response.json({ error: "Payments have not been connected yet." }, { status: 503 });
  try {
    const { shareToken, paymentType = "deposit", tipCents: requestedTipCents = 0 } = await request.json() as { shareToken?: string; paymentType?: "deposit" | "balance"; tipCents?: number };
    if (!shareToken) return Response.json({ error: "Estimate link is required." }, { status: 400 });
    if (!["deposit","balance"].includes(paymentType)) return Response.json({ error: "Invalid payment type." }, { status: 400 });
    const tipCents = requestedTipCents;
    if (typeof tipCents !== "number" || !Number.isSafeInteger(tipCents) || tipCents < 0) return Response.json({ error: "Invalid tip amount." }, { status: 400 });
    if (paymentType !== "balance" && tipCents > 0) return Response.json({ error: "Tips are available only with the final balance payment." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT e.id, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents, e.deposit_cents AS depositCents, e.status, e.accepted_at AS acceptedAt,
             c.name AS customer,
             COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
      FROM estimates e JOIN customers c ON c.id=e.customer_id
      WHERE e.share_token=? LIMIT 1
    `).bind(shareToken).first<{ id: string; totalCents: number; depositCents: number; status:string; acceptedAt:string|null; customer: string; service: string }>();
    if(row?.status==="superseded")return Response.json({error:"This quote was replaced. Use the latest quote from First In Response Exteriors."},{status:409});
    if (!row) return Response.json({ error: "Estimate not found." }, { status: 404 });
    const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(row.id).first();
    if(pendingRefund)return Response.json({error:"A refund is processing. Wait for Stripe reconciliation before collecting another payment."},{status:409});
    const billingException = await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL LIMIT 1").bind(row.id).first<{id:string}>();
    if (billingException) return Response.json({ error: "This account has a payment exception under review. Resolve the refund or retained overpayment before starting another card payment." }, { status: 409 });
    if (!row.acceptedAt && !["approved","scheduled","completed"].includes(row.status)) return Response.json({ error: "Approve and sign the estimate before making the reservation deposit." }, { status: 409 });
    if (paymentType === "balance" && row.status !== "completed") return Response.json({ error: "The remaining balance is due after the job is completed." }, { status: 409 });
    if (paymentType === "deposit" && row.status === "completed") return Response.json({ error: "This job is complete. Pay the remaining final invoice balance instead of a reservation deposit." }, { status: 409 });
    const paid = await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.id).first<{ amount: number }>();
    const paidCents = Number(paid?.amount ?? 0);
    const totalCents=Number(row.totalCents);const depositCents=Number(row.depositCents);
    if(!Number.isSafeInteger(paidCents)||!Number.isSafeInteger(totalCents)||!Number.isSafeInteger(depositCents))return Response.json({error:"Billing totals are outside FIRE's safe payment range. Contact First In Response Exteriors before paying."},{status:409});
    const amount = paymentType === "deposit" ? Math.max(0, depositCents - paidCents) : Math.max(0, totalCents - paidCents);
    if(!Number.isSafeInteger(amount))return Response.json({error:"The amount due cannot be represented safely. Contact First In Response Exteriors before paying."},{status:409});
    if (amount < 50) return Response.json({ error: "This estimate has no balance due." }, { status: 400 });
    const maxTipCents = Math.min(totalCents, 50000);
    if (tipCents > maxTipCents) return Response.json({ error: `Tip cannot exceed the invoice total or $500.` }, { status: 400 });
    const chargeAmount = amount + tipCents;
    if (!Number.isSafeInteger(chargeAmount) || chargeAmount <= 0) return Response.json({ error: "The total card charge is outside FIRE's safe payment range." }, { status: 409 });
    const openSessions = await env.DB.prepare("SELECT id,type,amount_cents AS amountCents FROM payment_checkout_sessions WHERE estimate_id=? AND status='open'").bind(row.id).all<{id:string;type:string;amountCents:number}>();
    for (const session of openSessions.results) {
      // A prior request may have reached Stripe without receiving its acknowledgement.
      // Do not mistake our provisional D1 checkout lock for a Stripe session or
      // discard it: that could create a second charge after an ambiguous response.
      if(session.id.startsWith("fire-creating:"))return Response.json({error:"A card checkout is still being prepared or needs reconciliation. Do not start another payment; contact FIRE if this message persists."},{status:409});
      // Read only: never invalidate a real customer session just because the
      // payment button was tapped twice or an old page was refreshed.
      // Stripe-paid sessions must be reconciled by webhook/owner, not expired.
      const remotelyExpired = await inspectUnpaidExpiration(session,row.id,stripeKey,sandboxTarget);
      if (!remotelyExpired) return Response.json({ error:"A previous card checkout is still open, paid, or needs reconciliation. Do not start a second payment; contact FIRE if this persists." }, { status:409 });
      const closed=await env.DB.prepare(`UPDATE payment_checkout_sessions
        SET status='expired',expired_at=?
        WHERE id=? AND estimate_id=? AND type=? AND amount_cents=? AND status='open'`)
        .bind(new Date().toISOString(),session.id,row.id,session.type,session.amountCents).run();
      if(!closed.meta.changes)return Response.json({error:"Previous checkout changed during verification. Refresh before retrying."},{status:409});
    }
    // Secure the one-open-checkout slot BEFORE calling Stripe. The existing D1
    // partial unique index (0015) makes the reservation atomic across requests;
    // checking for open rows alone did not prevent two concurrent Stripe sessions.
    const reservationId=`fire-creating:${crypto.randomUUID()}`;
    let reserved=false;
    try {
      const locked=await env.DB.prepare(`INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at)
        SELECT ?,?,?,?,'open',? WHERE NOT EXISTS (
          SELECT 1 FROM payment_checkout_sessions WHERE estimate_id=? AND status='open') AND EXISTS(SELECT 1 FROM estimates WHERE id=? AND status<>'superseded')`)
        .bind(reservationId,row.id,paymentType,chargeAmount,new Date().toISOString(),row.id,row.id).run();
      reserved=Boolean(locked.meta.changes);
    }catch {
      // The unique index also rejects a concurrent reservation which won the race.
      return Response.json({error:"A checkout was just started for this estimate. Please wait before trying again."},{status:409});
    }
    if(!reserved)return Response.json({error:"A checkout was just started for this estimate. Please wait before trying again."},{status:409});
    // Release only when Stripe definitively did not create a payable session,
    // or confirms that a newly created session has been expired.
    const releaseReservation=async()=>env.DB.prepare(`UPDATE payment_checkout_sessions
      SET status='expired',expired_at=? WHERE id=? AND status='open'`)
      .bind(new Date().toISOString(),reservationId).run();
    const origin = runtime.SITE_ORIGIN || new URL(request.url).origin;
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${origin}/estimate/${shareToken}?session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/estimate/${shareToken}`);
    form.set("client_reference_id", row.id);
    form.set("metadata[estimate_id]", row.id);
    // Signed Stripe events can use this to finish a checkout reservation if
    // Stripe accepted the payment before D1 acknowledged the session ID.
    form.set("metadata[fire_checkout_reservation_id]", reservationId);
    form.set("metadata[payment_type]", paymentType);
    form.set("metadata[expected_amount_cents]", String(amount));
    form.set("metadata[tip_amount_cents]", String(tipCents));
    form.set("metadata[expected_charge_cents]", String(chargeAmount));
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(amount));
    form.set("line_items[0][price_data][product_data][name]", `${row.service} — ${paymentType === "deposit" ? "50% deposit" : "remaining balance"}`);
    if (tipCents > 0) {
      form.set("line_items[1][quantity]", "1");
      form.set("line_items[1][price_data][currency]", "usd");
      form.set("line_items[1][price_data][unit_amount]", String(tipCents));
      form.set("line_items[1][price_data][product_data][name]", "Optional tip");
    }
    form.set("payment_intent_data[description]", `FIRE estimate ${row.id}`);
    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded", "Idempotency-Key":`fire-checkout-${reservationId}` }, body: form });
    const data = await stripe.json() as { id?: string; url?: string; error?: { message?: string } };
    if(!stripe.ok){
      // Stripe may send HTTP 5xx/429 after creating a session. Those responses
      // are NOT evidence that a retry is safe. Keep the lock for owner review.
      // Only non-retryable validation/auth errors can release this reservation.
      if([400,401,403,404,422].includes(stripe.status)){
        await releaseReservation();
        return Response.json({error:data.error?.message||"Payment checkout was rejected by Stripe."},{status:502});
      }
      return Response.json({error:"Stripe payment setup has an uncertain outcome. Do not start another checkout; ask FIRE to review this payment.",checkoutUncertain:true},{status:503});
    }
    if(!data.id||!data.url)return Response.json({error:"Stripe checkout acknowledgment was incomplete. Payment setup needs review before starting another."},{status:503});
    const current=await env.DB.prepare(`SELECT e.status,e.deposit_cents AS depositCents,
      COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen
      FROM estimates e WHERE e.id=?`).bind(row.id).first<{status:string;depositCents:number;totalCents:number;paidCents:number;paymentOverageOpen:number}>();
    const currentDue=current?(paymentType==="deposit"&&current.status!=="completed"?Math.max(0,Number(current.depositCents)-Number(current.paidCents)):paymentType==="balance"&&current.status==="completed"?Math.max(0,Number(current.totalCents)-Number(current.paidCents)):0):0;
    if(!current||!Number.isSafeInteger(currentDue)||Number(current.paymentOverageOpen)>0||currentDue!==amount){
      if(await expireTrackedCheckout(data.id,stripeKey))await releaseReservation();
      return Response.json({error:"The amount due changed during checkout creation. Refresh the job; if the checkout remains blocked, contact FIRE."},{status:409});
    }
    try {
      // Promote the existing lock to the real Stripe session IN PLACE. Creating
      // a second open row would violate the unique index and strand the session.
      const saved=await env.DB.prepare(`UPDATE payment_checkout_sessions SET id=?
        WHERE id=? AND estimate_id=? AND status='open'`)
        .bind(data.id,reservationId,row.id).run();
      if(!saved.meta.changes)throw Error("Checkout reservation was lost.");
    } catch {
      if(await expireTrackedCheckout(data.id,stripeKey))await releaseReservation();
      return Response.json({error:"Stripe checkout could not be safely tracked. If payment setup remains blocked, contact FIRE before trying again."},{status:503});
    }
    return Response.json({ url: data.url });
  } catch {
    return Response.json({ error: "Payment checkout could not be started." }, { status: 500 });
  }
}
