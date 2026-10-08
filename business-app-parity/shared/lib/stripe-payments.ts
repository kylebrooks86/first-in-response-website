type Database = Cloudflare.Env["DB"];

export type StripeCheckoutSession = {
  id: string;
  amount_total?: number | null;
  client_reference_id?: string | null;
  payment_status?: string | null;
  metadata?: {
    estimate_id?: string;
    invoice_id?: string;
    payment_type?: string;
    expected_amount_cents?: string;
    tip_amount_cents?: string;
    expected_charge_cents?: string;
  } | null;
};

const currency = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(value / 100);

export async function retrieveStripeCheckoutSession(sessionId: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${secretKey}`, "Stripe-Version": "2026-08-26.dahlia" },
  });
  if (!response.ok) return null;
  return response.json() as Promise<StripeCheckoutSession>;
}

export async function recordStripeCheckoutFailure(db: Database, session: StripeCheckoutSession) {
  const estimateId = session.metadata?.estimate_id;
  if (!estimateId) return { recorded: false };
  const estimate = await db.prepare(`
    SELECT e.id,c.id AS customerId,c.name AS customer,
      COALESCE((SELECT GROUP_CONCAT(ei.name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
    FROM estimates e JOIN customers c ON c.id=e.customer_id
    WHERE e.id=? LIMIT 1
  `).bind(estimateId).first<{id:string;customerId:string;customer:string;service:string}>();
  if (!estimate) return { recorded: false };
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(`stripe-payment-failed:${session.id}`,"payment_failed",`Payment was not completed by ${estimate.customer}`,`Stripe could not complete the payment for ${estimate.service}. No payment was recorded.`,estimate.customerId,estimateId,now)
    .run();
  return { recorded: true };
}

export async function reconcileStripeCheckout(db:Database,session:StripeCheckoutSession) {
  if (!session.id || session.payment_status !== "paid" || !session.amount_total) return { ok:false, reason:"unpaid" };
  const estimateId = session.metadata?.estimate_id?.trim();
  if (!estimateId) return { ok:false, reason:"missing_estimate" };
  if(session.client_reference_id && session.client_reference_id!==estimateId)return {ok:false,reason:"reference_mismatch"};

  const estimate = await db.prepare(`
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
  const maxTipCents=Math.min(Number(estimate.totalCents),50000);
  if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0||tipCents>maxTipCents)return {ok:false,reason:"tip_outside_allowed_range"};
  const tracked = await db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payment_checkout_sessions WHERE id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if (!tracked || tracked.estimateId !== estimateId || tracked.type !== paymentType || Number(tracked.amountCents) !== sessionAmount || !["open","paid"].includes(tracked.status)) {
    return { ok:false, reason:"untracked_or_stale_checkout" };
  }

  const providerCount=async(provider:string)=>Number((await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE provider_id=?").bind(provider).first<{count:number}>())?.count??0);
  if(await providerCount(session.id)>1||await providerCount(`${session.id}:tip`)>1)return {ok:false,reason:"duplicate_provider_ledger_requires_review"};
  const prior = await db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if(prior && (prior.estimateId!==estimateId||prior.type!==paymentType||prior.status!=="paid"||Number(prior.amountCents)!==expectedAmount))return {ok:false,reason:"payment_ledger_verification_failed"};
  const priorTip = await db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(`${session.id}:tip`).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if(priorTip && (tipCents===0||priorTip.estimateId!==estimateId||priorTip.type!=="Tip"||priorTip.status!=="paid"||Number(priorTip.amountCents)!==tipCents))return {ok:false,reason:"tip_ledger_verification_failed"};
  const existingPaidRow=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimateId).first<{amount:number}>();
  const existingPaid=Number(existingPaidRow?.amount??0);
  if(!Number.isSafeInteger(existingPaid)||!Number.isSafeInteger(existingPaid+(prior?0:expectedAmount)))return {ok:false,reason:"unsafe_paid_total"};
  const obligationCents=paymentType === "deposit" ? Number(estimate.depositCents) : Number(estimate.totalCents);
  if(!Number.isSafeInteger(obligationCents)||obligationCents<0)return {ok:false,reason:"unsafe_billing_total"};
  const now=new Date().toISOString();
  const ledger=[db.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
    SELECT ?,?,?,?,'paid',?,? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)
    AND NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=? AND (?=0 OR estimate_id<>? OR type<>'Tip' OR status<>'paid' OR amount_cents<>?))`)
    .bind(`stripe:${session.id}`,estimateId,paymentType,expectedAmount,session.id,now,session.id,`${session.id}:tip`,tipCents,estimateId,tipCents)];
  if(tipCents>0)ledger.push(db.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
    SELECT ?,?,'Tip',?,'paid',?,? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)
    AND EXISTS (SELECT 1 FROM payments WHERE provider_id=? AND estimate_id=? AND type=? AND status='paid' AND amount_cents=?)`)
    .bind(`stripe:${session.id}:tip`,estimateId,tipCents,`${session.id}:tip`,now,`${session.id}:tip`,session.id,estimateId,paymentType,expectedAmount));
  // D1 batch is transactional: principal and tip succeed or roll back together.
  const ledgerResult=await db.batch(ledger);
  const verify=async(provider:string,type:string,amount:number)=>{
    const row=await db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(provider).first<{estimateId:string;type:string;amountCents:number;status:string}>();
    return await providerCount(provider)===1&&row?.estimateId===estimateId&&row.type===type&&row.status==="paid"&&Number(row.amountCents)===amount;
  };
  if(!await verify(session.id,paymentType,expectedAmount))return {ok:false,reason:"payment_ledger_verification_failed"};
  if(tipCents>0&&!await verify(`${session.id}:tip`,"Tip",tipCents))return {ok:false,reason:"tip_ledger_verification_failed"};
  if(tipCents===0&&await db.prepare("SELECT id FROM payments WHERE provider_id=? LIMIT 1").bind(`${session.id}:tip`).first())return {ok:false,reason:"tip_ledger_verification_failed"};
  const refreshedPaid=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimateId).first<{amount:number}>();
  const nextPaid=Number(refreshedPaid?.amount??0);
  if(!Number.isSafeInteger(nextPaid)||nextPaid<0)return {ok:false,reason:"unsafe_paid_total"};
  const overpaymentCents=Math.max(0,nextPaid-obligationCents);
  if(!Number.isSafeInteger(overpaymentCents))return {ok:false,reason:"unsafe_overpayment_total"};

  const followups=[
    db.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id),
    db.prepare("INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(`stripe-payment:${session.id}`,"payment_received",`Payment received from ${estimate.customer}`,`${currency(expectedAmount)} ${paymentType} received for ${estimate.service}.`,estimate.customerId,estimateId,now),
  ];
  if(estimate.status==="completed"||paymentType==="balance")followups.unshift(
    db.prepare(`UPDATE invoices SET status=CASE
      WHEN ?>=total_cents THEN 'paid'
      WHEN ?>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(nextPaid,nextPaid,estimateId)
  );
  if(tipCents>0){
    followups.push(
      db.prepare("INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(`stripe-tip:${session.id}`,"tip_received",`Tip received from ${estimate.customer}`,`${currency(tipCents)} tip received with the final card payment.`,estimate.customerId,estimateId,now)
    );
  }
  if(overpaymentCents>0){
    const overpaymentBody=`${currency(overpaymentCents)} is currently recorded above the amount due. Review the Stripe payments and either refund the excess or intentionally keep it as an overpayment on this job.`;
    followups.push(
      db.prepare("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL")
        .bind(`Review overpayment from ${estimate.customer}`,overpaymentBody,estimateId),
      db.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL)`)
        .bind(crypto.randomUUID(),"payment_overage",`Review overpayment from ${estimate.customer}`,overpaymentBody,estimate.customerId,estimateId,now,estimateId)
    );
  }
  await db.batch(followups);
  return { ok:true, duplicate:!ledgerResult[0].meta.changes };
}

export async function recordStripeCheckoutSession(db:Database,session:StripeCheckoutSession){
  const result=await reconcileStripeCheckout(db,session);
  return {recorded:result.ok,duplicate:result.duplicate};
}
