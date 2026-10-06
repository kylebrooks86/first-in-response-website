import { env } from "cloudflare:workers";

type RuntimeEnv = Cloudflare.Env & { STRIPE_WEBHOOK_SECRET?: string; STRIPE_SECRET_KEY?: string };

type StripeCheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number;
  metadata?: {
    estimate_id?: string;
    payment_type?: string;
    expected_amount_cents?: string;
    tip_amount_cents?: string;
    expected_charge_cents?: string;
  };
};

type StripeRefund = {
  id:string;
  status?:string;
  amount?:number;
  payment_intent?:string|{id?:string}|null;
  metadata?:{fire_refund_id?:string;fire_payment_id?:string};
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: StripeCheckoutSession | StripeRefund };
};

const currency = (value:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value/100);
const encoder = new TextEncoder();

function toHex(bytes:ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte)=>byte.toString(16).padStart(2,"0")).join("");
}

function constantTimeEqual(a:string,b:string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody:string, signatureHeader:string, secret:string) {
  const parts = signatureHeader.split(",").map((part)=>part.trim());
  const timestamp = parts.find((part)=>part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part)=>part.startsWith("v1=")).map((part)=>part.slice(3));
  if (!timestamp || !signatures.length) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const nowSeconds = Math.floor(Date.now()/1000);
  if (Math.abs(nowSeconds-timestampNumber) > 300) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = toHex(digest);
  return signatures.some((signature)=>constantTimeEqual(expected, signature));
}

async function recordCheckoutPayment(session:StripeCheckoutSession) {
  if (!session.id || session.payment_status !== "paid" || !session.amount_total) return { ok:false, reason:"unpaid" };
  const estimateId = session.metadata?.estimate_id?.trim();
  if (!estimateId) return { ok:false, reason:"missing_estimate" };

  const estimate = await env.DB.prepare(`
    SELECT e.id,e.status,COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,e.deposit_cents AS depositCents,e.customer_id AS customerId,c.name AS customer,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
    FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.id=? LIMIT 1
  `).bind(estimateId).first<{id:string;status:string;totalCents:number;depositCents:number;customerId:string;customer:string;service:string}>();
  if (!estimate) return { ok:false, reason:"estimate_not_found" };

  const sessionAmount=Number(session.amount_total);
  const paymentType = session.metadata?.payment_type === "balance" ? "balance" : "deposit";
  const expectedAmount = Number(session.metadata?.expected_amount_cents ?? sessionAmount);
  const tipCents = Number(session.metadata?.tip_amount_cents ?? 0);
  const expectedCharge = Number(session.metadata?.expected_charge_cents ?? (expectedAmount + tipCents));
  if (!Number.isSafeInteger(sessionAmount) || sessionAmount<=0 || !Number.isSafeInteger(expectedAmount) || expectedAmount<=0 || !Number.isSafeInteger(tipCents) || tipCents<0 || !Number.isSafeInteger(expectedCharge) || expectedCharge!==sessionAmount || expectedAmount+tipCents!==sessionAmount) return { ok:false, reason:"amount_mismatch" };
  if (paymentType!=="balance" && tipCents>0) return {ok:false,reason:"tip_not_allowed_for_deposit"};
  const tracked = await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payment_checkout_sessions WHERE id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if (!tracked || tracked.estimateId !== estimateId || tracked.type !== paymentType || Number(tracked.amountCents) !== sessionAmount || !["open","paid"].includes(tracked.status)) {
    return { ok:false, reason:"untracked_or_stale_checkout" };
  }

  const prior = await env.DB.prepare("SELECT id FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first();
  if (prior) {
    if (tipCents>0) {
      await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
        SELECT ?,?,'Tip',?,'paid',?,?
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
        .bind(crypto.randomUUID(),estimateId,tipCents,`${session.id}:tip`,new Date().toISOString(),`${session.id}:tip`).run();
    }
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return { ok:true, duplicate:true };
  }

  const existingPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimateId).first<{amount:number}>();
  const existingPaid=Number(existingPaidRow?.amount??0);
  if(!Number.isSafeInteger(existingPaid)||!Number.isSafeInteger(existingPaid+sessionAmount))return {ok:false,reason:"unsafe_paid_total"};

  const obligationCents=paymentType === "deposit" ? Number(estimate.depositCents) : Number(estimate.totalCents);
  if(!Number.isSafeInteger(obligationCents)||obligationCents<0)return {ok:false,reason:"unsafe_billing_total"};
  const now = new Date().toISOString();

  const inserted = await env.DB.prepare(`
    INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
    SELECT ?,?,?,?,'paid',?,?
    WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)
  `).bind(crypto.randomUUID(),estimateId,paymentType,expectedAmount,session.id,now,session.id).run();
  if (!inserted.meta.changes) return { ok:true, duplicate:true };

  if (tipCents>0) {
    await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,'Tip',?,'paid',?,?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),estimateId,tipCents,`${session.id}:tip`,now,`${session.id}:tip`).run();
  }
  const refreshedPaid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimateId).first<{amount:number}>();
  const nextPaid=Number(refreshedPaid?.amount??0);
  if(!Number.isSafeInteger(nextPaid)||nextPaid<0)return {ok:false,reason:"unsafe_paid_total"};
  const overpaymentCents=Math.max(0,nextPaid-obligationCents);
  if(!Number.isSafeInteger(overpaymentCents))return {ok:false,reason:"unsafe_overpayment_total"};

  const followups=[
    env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id),
    env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),"payment_received",`Payment received from ${estimate.customer}`,`${currency(expectedAmount)} ${paymentType} received for ${estimate.service}.`,estimate.customerId,estimateId,now),
  ];
  if(estimate.status==="completed"||paymentType==="balance")followups.unshift(
    env.DB.prepare(`UPDATE invoices SET status=CASE
      WHEN ?>=total_cents THEN 'paid'
      WHEN ?>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(nextPaid,nextPaid,estimateId)
  );
  if(tipCents>0){
    followups.push(
      env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),"tip_received",`Tip received from ${estimate.customer}`,`${currency(tipCents)} tip received with the final card payment.`,estimate.customerId,estimateId,now)
    );
  }
  if(overpaymentCents>0){
    const overpaymentBody=`${currency(overpaymentCents)} is currently recorded above the amount due. Review the Stripe payments and either refund the excess or intentionally keep it as an overpayment on this job.`;
    followups.push(
      env.DB.prepare("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL")
        .bind(`Review overpayment from ${estimate.customer}`,overpaymentBody,estimateId),
      env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL)`)
        .bind(crypto.randomUUID(),"payment_overage",`Review overpayment from ${estimate.customer}`,overpaymentBody,estimate.customerId,estimateId,now,estimateId)
    );
  }
  await env.DB.batch(followups);
  return { ok:true, duplicate:false };
}

async function stripeCheckoutForPaymentIntent(paymentIntent:string,secret:string){
  const query=new URLSearchParams({payment_intent:paymentIntent,limit:"1"});
  const response=await fetch(`https://api.stripe.com/v1/checkout/sessions?${query.toString()}`,{headers:{authorization:`Bearer ${secret}`}});
  const payload=await response.json() as {data?:Array<{id?:string}>;error?:{message?:string}};
  if(!response.ok)return {id:null,error:payload.error?.message||"Stripe Checkout lookup failed."};
  return {id:payload.data?.[0]?.id??null,error:null};
}

async function finalizeWebhookRefund(requestRow:{id:string;paymentId:string;estimateId:string;amountCents:number;mode?:string;status:string;providerRefundId?:string|null;paymentType:string;customerId:string;customer:string},refund:StripeRefund){
  if(requestRow.mode!=="stripe")return {ok:false,reason:"refund_mode_mismatch"};
  if(requestRow.status==="succeeded")return {ok:true,duplicate:true};
  if(requestRow.status==="failed"&&refund.status==="succeeded"&&requestRow.mode==="stripe"&&requestRow.providerRefundId&&requestRow.providerRefundId!==refund.id)
    return {ok:false,reason:"restored_refund_provider_mismatch"};
  if(refund.status==="failed"||refund.status==="canceled"){
    await env.DB.prepare("UPDATE payment_refunds SET status='failed',provider_refund_id=? WHERE id=? AND status='pending'").bind(refund.id,requestRow.id).run();
    return {ok:true,failed:true};
  }
  if(refund.status!=="succeeded"){
    await env.DB.prepare("UPDATE payment_refunds SET provider_refund_id=? WHERE id=? AND status='pending'").bind(refund.id,requestRow.id).run();
    return {ok:true,pending:true};
  }
  const amount=Number(requestRow.amountCents);
  if(!Number.isSafeInteger(amount)||amount<=0||Number(refund.amount)!==amount)return {ok:false,reason:"refund_amount_mismatch"};
  const now=new Date().toISOString();
  const provider=`refund:${requestRow.paymentId}:${requestRow.id}`;
  await env.DB.batch([
    env.DB.prepare("UPDATE payment_refunds SET status='succeeded',provider_refund_id=?,completed_at=? WHERE id=? AND mode='stripe' AND status IN ('pending','failed')").bind(refund.id,now,requestRow.id),
    env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,CASE WHEN ?='Tip' THEN 'Tip Refund' ELSE 'Refund' END,?,'paid',?,?
      WHERE EXISTS (SELECT 1 FROM payment_refunds r WHERE r.id=? AND r.mode='stripe' AND r.status='succeeded' AND r.provider_refund_id=?)
        AND NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),requestRow.estimateId,requestRow.paymentType,-amount,provider,now,requestRow.id,refund.id,provider),
    env.DB.prepare(`UPDATE invoices SET status=CASE
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>=total_cents THEN 'paid'
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(requestRow.estimateId,requestRow.estimateId,requestRow.estimateId),
    env.DB.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,?),resolved_at=?,resolution_note=?
      WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL
      AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
        <= COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=? LIMIT 1),(SELECT e.total_cents FROM estimates e WHERE e.id=?))`)
      .bind(now,now,`refund:${amount}`,requestRow.estimateId,requestRow.estimateId,requestRow.estimateId,requestRow.estimateId),
    env.DB.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(`refund-note:${requestRow.id}`,requestRow.paymentType==="Tip"?"tip_refunded":"payment_refunded",requestRow.paymentType==="Tip"?`Tip refund recorded for ${requestRow.customer}`:`Refund recorded for ${requestRow.customer}`,`${currency(amount)} Stripe ${requestRow.paymentType==="Tip"?"tip refund":"refund"} completed.`,requestRow.customerId,requestRow.estimateId,now),
  ]);
  const [verifiedRequest,verifiedLedger]=await Promise.all([
    env.DB.prepare("SELECT status,provider_refund_id AS providerRefundId,amount_cents AS amountCents FROM payment_refunds WHERE id=?").bind(requestRow.id).first<{status:string;providerRefundId:string|null;amountCents:number}>(),
    env.DB.prepare("SELECT amount_cents AS amountCents FROM payments WHERE provider_id=? LIMIT 1").bind(provider).first<{amountCents:number}>(),
  ]);
  if(verifiedRequest?.status!=="succeeded"||verifiedRequest.providerRefundId!==refund.id||Number(verifiedRequest.amountCents)!==amount||Number(verifiedLedger?.amountCents)!==-amount)
    return {ok:false,reason:"refund_ledger_verification_failed"};
  return {ok:true,duplicate:false};
}

async function recordRefundUpdate(refund:StripeRefund,stripeSecret?:string){
  let requestId=refund.metadata?.fire_refund_id?.trim()||"";
  let paymentId=refund.metadata?.fire_payment_id?.trim()||"";

  if(!requestId||!paymentId){
    const paymentIntent=typeof refund.payment_intent==="string"?refund.payment_intent:refund.payment_intent?.id;
    if(!paymentIntent)return {ok:false,reason:"missing_refund_payment_intent"};
    if(!stripeSecret)return {ok:false,reason:"stripe_secret_missing"};
    const lookup=await stripeCheckoutForPaymentIntent(paymentIntent,stripeSecret);
    if(!lookup.id)return {ok:false,reason:"checkout_lookup_failed"};

    const original=await env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,p.amount_cents AS originalAmount,e.customer_id AS customerId,c.name AS customer
      FROM payments p JOIN estimates e ON e.id=p.estimate_id JOIN customers c ON c.id=e.customer_id
      WHERE p.provider_id=? AND p.status='paid' AND p.amount_cents>0 LIMIT 1`).bind(lookup.id)
      .first<{id:string;estimateId:string;originalAmount:number;customerId:string;customer:string}>();
    if(!original)return {ok:false,reason:"original_payment_not_found"};

    const amount=Number(refund.amount);
    if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false,reason:"refund_amount_invalid"};
    const alreadyReserved=await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS amount
      FROM payment_refunds WHERE payment_id=? AND status IN ('pending','succeeded') AND COALESCE(provider_refund_id,'')<>?`)
      .bind(original.id,refund.id).first<{amount:number}>();
    const priorAmount=Number(alreadyReserved?.amount??0);
    if(!Number.isSafeInteger(priorAmount)||priorAmount<0||priorAmount+amount>Number(original.originalAmount))
      return {ok:false,reason:"refund_exceeds_original_payment"};

    requestId=`stripe-external:${refund.id}`;
    paymentId=original.id;
    const now=new Date().toISOString();
    const imported=await env.DB.prepare(`INSERT INTO payment_refunds (id,payment_id,estimate_id,amount_cents,mode,status,provider_refund_id,note,created_at)
      SELECT ?,p.id,p.estimate_id,?,'stripe','pending',?,'Imported from Stripe webhook',?
      FROM payments p
      WHERE p.id=? AND p.status='paid' AND p.amount_cents>0
        AND ? <= p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded') AND COALESCE(r.provider_refund_id,'')<>?),0)
        AND NOT EXISTS (SELECT 1 FROM payment_refunds WHERE provider_refund_id=? OR id=?)`)
      .bind(requestId,amount,refund.id,now,paymentId,amount,refund.id,refund.id,requestId).run();
    if(!imported.meta.changes){
      const duplicate=await env.DB.prepare("SELECT id FROM payment_refunds WHERE provider_refund_id=? OR id=? LIMIT 1").bind(refund.id,requestId).first<{id:string}>();
      if(!duplicate)return {ok:false,reason:"refund_reservation_conflict"};
    }
  }

  const requestRow=await env.DB.prepare(`SELECT r.id,r.payment_id AS paymentId,r.estimate_id AS estimateId,r.amount_cents AS amountCents,r.mode,r.status,r.provider_refund_id AS providerRefundId,
    p.amount_cents AS originalAmount,p.type AS paymentType,e.customer_id AS customerId,c.name AS customer
    FROM payment_refunds r JOIN payments p ON p.id=r.payment_id JOIN estimates e ON e.id=r.estimate_id JOIN customers c ON c.id=e.customer_id
    WHERE r.id=? LIMIT 1`).bind(requestId).first<{id:string;paymentId:string;estimateId:string;amountCents:number;mode:string;status:string;providerRefundId:string|null;originalAmount:number;paymentType:string;customerId:string;customer:string}>();
  if(!requestRow||requestRow.paymentId!==paymentId)return {ok:false,reason:"refund_request_not_found"};
  if(requestRow.mode!=="stripe")return {ok:false,reason:"refund_mode_mismatch"};
  return finalizeWebhookRefund(requestRow,refund);
}

export async function POST(request:Request) {
  const runtime = env as RuntimeEnv;
  if (!runtime.STRIPE_WEBHOOK_SECRET) return Response.json({ error:"Stripe webhook is not configured." }, { status:503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error:"Missing Stripe signature." }, { status:400 });

  const rawBody = await request.text();
  if (!await verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)) {
    return Response.json({ error:"Invalid Stripe signature." }, { status:400 });
  }

  let event:StripeEvent;
  try { event = JSON.parse(rawBody) as StripeEvent; }
  catch { return Response.json({ error:"Invalid webhook payload." }, { status:400 }); }

  if (["refund.created","refund.updated"].includes(event.type ?? "")) {
    const refund=event.data?.object as StripeRefund|undefined;
    if(!refund)return Response.json({error:"Missing Stripe refund."},{status:400});
    const result=await recordRefundUpdate(refund,runtime.STRIPE_SECRET_KEY);
    if(!result.ok)return Response.json({error:`Refund event rejected: ${result.reason}.`},{status:400});
    return Response.json({received:true,refund:true,duplicate:Boolean(result.duplicate),pending:Boolean(result.pending),failed:Boolean(result.failed)});
  }

  if (!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type ?? "")) {
    return Response.json({ received:true, ignored:true });
  }

  const session = event.data?.object as StripeCheckoutSession|undefined;
  if (!session) return Response.json({ error:"Missing checkout session." }, { status:400 });
  const result = await recordCheckoutPayment(session);
  if (!result.ok) return Response.json({ error:`Payment event rejected: ${result.reason}.` }, { status:400 });
  return Response.json({ received:true, duplicate:Boolean(result.duplicate) });
}
