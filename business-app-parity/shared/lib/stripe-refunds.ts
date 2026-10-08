type Database=Cloudflare.Env["DB"];
export type StripeRefund={id:string;status?:string;amount?:number;payment_intent?:string|{id?:string}|null;metadata?:{fire_refund_id?:string;fire_payment_id?:string}};
const currency=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);

type RefundRow={
  id:string;paymentId:string;estimateId:string;amountCents:number;mode:string;status:string;providerRefundId:string|null;
  originalAmountCents:number;paymentType:string;providerId:string|null;customerId:string;customer:string;
};

async function refundRow(db:Database,id:string){
  return db.prepare(`SELECT r.id,r.payment_id AS paymentId,r.estimate_id AS estimateId,r.amount_cents AS amountCents,r.mode,r.status,
    r.provider_refund_id AS providerRefundId,p.amount_cents AS originalAmountCents,p.type AS paymentType,p.provider_id AS providerId,
    e.customer_id AS customerId,c.name AS customer
    FROM payment_refunds r
    JOIN payments p ON p.id=r.payment_id AND p.estimate_id=r.estimate_id AND p.status='paid' AND p.amount_cents>0
    JOIN estimates e ON e.id=r.estimate_id
    JOIN customers c ON c.id=e.customer_id
    WHERE r.id=? LIMIT 1`).bind(id).first<RefundRow>();
}

export async function finalizeRefund(db:Database,id:string,providerRefundId:string|null){
  const row=await refundRow(db,id);
  if(!row)return {ok:false,status:404,error:"Refund request not found."};
  const amount=Number(row.amountCents);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(row.originalAmountCents))return {ok:false,status:409,error:"Refund request amount is invalid."};
  if(row.providerRefundId&&row.providerRefundId!==providerRefundId)return {ok:false,status:409,error:"Refund provider does not match the recorded request."};
  if(row.mode==="stripe"&&!providerRefundId)return {ok:false,status:409,error:"Stripe refund confirmation is required."};
  const ledgerProvider=`refund:${row.paymentId}:${row.id}`;
  const ledgerCount=await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE provider_id=?").bind(ledgerProvider).first<{count:number}>();
  if(Number(ledgerCount?.count??0)>1)return {ok:false,status:409,error:"Duplicate refund ledger entries require owner review."};
  const ledger=await db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=?").bind(ledgerProvider).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if(ledger&&(ledger.estimateId!==row.estimateId||ledger.type!==(row.paymentType==="Tip"?"Tip Refund":"Refund")||Number(ledger.amountCents)!==-amount||ledger.status!=="paid"))return {ok:false,status:409,error:"Existing refund ledger does not match this request."};
  // A signed success can repair an interrupted acknowledgement. Never create another Stripe refund here.
  if(row.status!=="pending"&&row.status!=="succeeded")return {ok:false,status:409,error:"This refund request is no longer pending."};
  const now=new Date().toISOString();
  const refundPaymentProvider=`refund:${row.paymentId}:${row.id}`;
  const statements=[
    db.prepare("UPDATE payment_refunds SET status='succeeded',provider_refund_id=COALESCE(?,provider_refund_id),completed_at=? WHERE id=? AND status IN ('pending','succeeded') AND (provider_refund_id IS NULL OR provider_refund_id IS ?)")
      .bind(providerRefundId,now,row.id,providerRefundId),
    db.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,CASE WHEN ?='Tip' THEN 'Tip Refund' ELSE 'Refund' END,?,'paid',?,?
      WHERE EXISTS (SELECT 1 FROM payment_refunds r WHERE r.id=? AND r.status='succeeded' AND r.provider_refund_id IS ?)
        AND NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(`refund:${row.id}`,row.estimateId,row.paymentType,-amount,refundPaymentProvider,now,row.id,providerRefundId,refundPaymentProvider),
    db.prepare(`UPDATE invoices SET status=CASE
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>=total_cents THEN 'paid'
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(row.estimateId,row.estimateId,row.estimateId),
    db.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,?),resolved_at=?,resolution_note=?
      WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL
      AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
        <= COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=? LIMIT 1),(SELECT e.total_cents FROM estimates e WHERE e.id=?))`)
      .bind(now,now,`refund:${amount}`,row.estimateId,row.estimateId,row.estimateId,row.estimateId),
    db.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(`refund-note:${row.id}`,row.paymentType==="Tip"?"tip_refunded":"payment_refunded",row.paymentType==="Tip"?`Tip refund recorded for ${row.customer}`:`Refund recorded for ${row.customer}`,`${currency(amount)} ${row.paymentType==="Tip"?"tip refund":"refund"} recorded for this job.`,row.customerId,row.estimateId,now),
  ];
  await db.batch(statements);
  const [verifiedRequest,verifiedLedger]=await Promise.all([
    db.prepare("SELECT status,payment_id AS paymentId,estimate_id AS estimateId,provider_refund_id AS providerRefundId,amount_cents AS amountCents FROM payment_refunds WHERE id=?").bind(row.id).first<{status:string;paymentId:string;estimateId:string;providerRefundId:string|null;amountCents:number}>(),
    db.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payments WHERE provider_id=? LIMIT 1").bind(refundPaymentProvider).first<{estimateId:string;type:string;amountCents:number;status:string}>(),
  ]);
  const verifiedCount=await db.prepare("SELECT COUNT(*) AS count FROM payments WHERE provider_id=?").bind(refundPaymentProvider).first<{count:number}>();
  const expectedLedgerType=row.paymentType==="Tip"?"Tip Refund":"Refund";
  if(Number(verifiedCount?.count)!==1||verifiedRequest?.paymentId!==row.paymentId||verifiedRequest?.estimateId!==row.estimateId||verifiedRequest?.providerRefundId!==providerRefundId||verifiedLedger?.estimateId!==row.estimateId||verifiedRequest?.status!=="succeeded"||Number(verifiedRequest.amountCents)!==amount||verifiedLedger?.type!==expectedLedgerType||verifiedLedger?.status!=="paid"||Number(verifiedLedger?.amountCents)!==-amount)
    return {ok:false,status:409,error:"Refund confirmation did not converge on one verified ledger entry. Refresh payment history before trying anything else."};
  const paid=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.estimateId).first<{amount:number}>();
  const paidCents=Number(paid?.amount??0);
  if(!Number.isSafeInteger(paidCents)||paidCents<0)return {ok:false,status:409,error:"Refund was recorded, but the refreshed payment total requires owner review."};
  return {ok:true,status:200,paidCents,duplicate:row.status==="succeeded"};
}

async function stripeCheckoutForPaymentIntent(paymentIntent:string,secret:string){
  const query=new URLSearchParams({payment_intent:paymentIntent,limit:"1"});
  const response=await fetch(`https://api.stripe.com/v1/checkout/sessions?${query.toString()}`,{headers:{authorization:`Bearer ${secret}`,"Stripe-Version":"2026-08-26.dahlia"}});
  const payload=await response.json() as {data?:Array<{id?:string}>;error?:{message?:string}};
  if(!response.ok)return {id:null,error:payload.error?.message||"Stripe Checkout lookup failed."};
  return {id:payload.data?.[0]?.id??null,error:null};
}

export async function recordRefundUpdate(db:Database,refund:StripeRefund,stripeSecret?:string){
  if(!refund.id?.startsWith("re_")||!Number.isSafeInteger(refund.amount)||Number(refund.amount)<=0||!["succeeded","pending","requires_action","failed","canceled"].includes(refund.status||""))return {ok:false,reason:"invalid_refund"};
  let requestId=refund.metadata?.fire_refund_id?.trim()||"";
  let paymentId=refund.metadata?.fire_payment_id?.trim()||"";

  if(!requestId||!paymentId){
    const paymentIntent=typeof refund.payment_intent==="string"?refund.payment_intent:refund.payment_intent?.id;
    if(!paymentIntent)return {ok:false,reason:"missing_refund_payment_intent"};
    if(!stripeSecret)return {ok:false,reason:"stripe_secret_missing"};
    const lookup=await stripeCheckoutForPaymentIntent(paymentIntent,stripeSecret);
    if(!lookup.id)return {ok:false,reason:"checkout_lookup_failed"};

    const original=await db.prepare(`SELECT p.id,p.estimate_id AS estimateId,p.amount_cents AS originalAmount,e.customer_id AS customerId,c.name AS customer
      FROM payments p JOIN estimates e ON e.id=p.estimate_id JOIN customers c ON c.id=e.customer_id
      WHERE p.provider_id=? AND p.status='paid' AND p.amount_cents>0 LIMIT 1`).bind(lookup.id)
      .first<{id:string;estimateId:string;originalAmount:number;customerId:string;customer:string}>();
    if(!original)return {ok:false,reason:"original_payment_not_found"};

    const amount=Number(refund.amount);
    if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false,reason:"refund_amount_invalid"};
    const alreadyReserved=await db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS amount
      FROM payment_refunds WHERE payment_id=? AND status IN ('pending','succeeded') AND COALESCE(provider_refund_id,'')<>?`)
      .bind(original.id,refund.id).first<{amount:number}>();
    const priorAmount=Number(alreadyReserved?.amount??0);
    if(!Number.isSafeInteger(priorAmount)||priorAmount<0||priorAmount+amount>Number(original.originalAmount))
      return {ok:false,reason:"refund_exceeds_original_payment"};

    requestId=`stripe-external:${refund.id}`;
    paymentId=original.id;
    const now=new Date().toISOString();
    const imported=await db.prepare(`INSERT INTO payment_refunds (id,payment_id,estimate_id,amount_cents,mode,status,provider_refund_id,note,created_at)
      SELECT ?,p.id,p.estimate_id,?,'stripe','pending',?,'Imported from Stripe webhook',?
      FROM payments p
      WHERE p.id=? AND p.status='paid' AND p.amount_cents>0
        AND ? <= p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded') AND COALESCE(r.provider_refund_id,'')<>?),0)
        AND NOT EXISTS (SELECT 1 FROM payment_refunds WHERE provider_refund_id=? OR id=?)`)
      .bind(requestId,amount,refund.id,now,paymentId,amount,refund.id,refund.id,requestId).run();
    if(!imported.meta.changes){
      const duplicate=await db.prepare("SELECT id FROM payment_refunds WHERE provider_refund_id=? OR id=? LIMIT 1").bind(refund.id,requestId).first<{id:string}>();
      if(!duplicate)return {ok:false,reason:"refund_reservation_conflict"};
      requestId=duplicate.id;
    }
  }

  const requestRow=await db.prepare(`SELECT r.id,r.payment_id AS paymentId,r.estimate_id AS estimateId,r.amount_cents AS amountCents,r.mode,r.status,r.provider_refund_id AS providerRefundId,
    p.amount_cents AS originalAmount,p.type AS paymentType,e.customer_id AS customerId,c.name AS customer
    FROM payment_refunds r JOIN payments p ON p.id=r.payment_id AND p.estimate_id=r.estimate_id AND p.status='paid' AND p.amount_cents>0 JOIN estimates e ON e.id=r.estimate_id JOIN customers c ON c.id=e.customer_id
    WHERE r.id=? LIMIT 1`).bind(requestId).first<{id:string;paymentId:string;estimateId:string;amountCents:number;mode:string;status:string;providerRefundId:string|null;originalAmount:number;paymentType:string;customerId:string;customer:string}>();
  if(!requestRow||requestRow.paymentId!==paymentId)return {ok:false,reason:"refund_request_not_found"};
  if(requestRow.mode!=="stripe")return {ok:false,reason:"refund_mode_mismatch"};
  if(!refund.id||!Number.isSafeInteger(refund.amount)||Number(refund.amount)!==Number(requestRow.amountCents))return {ok:false,reason:"refund_amount_mismatch"};
  if(requestRow.providerRefundId&&requestRow.providerRefundId!==refund.id)return {ok:false,reason:"refund_provider_mismatch"};
  if(refund.status==="failed"||refund.status==="canceled"){
    await db.prepare("UPDATE payment_refunds SET status='failed',provider_refund_id=? WHERE id=? AND status='pending'").bind(refund.id,requestRow.id).run();
    return {ok:true,failed:true};
  }
  if(refund.status!=="succeeded"){
    await db.prepare("UPDATE payment_refunds SET provider_refund_id=? WHERE id=? AND status='pending'").bind(refund.id,requestRow.id).run();
    return {ok:true,pending:true};
  }
  const result=await finalizeRefund(db,requestRow.id,refund.id);
  return {...result,reason:result.error};
}


