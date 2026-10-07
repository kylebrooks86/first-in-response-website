import { env } from "cloudflare:workers";
import { CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { AcceptEstimateButton } from "./accept-button";
import { PayButton } from "../../pay/[id]/pay-button";
import { SERVICE_AGREEMENT, templateByKey } from "../../../lib/fire-templates";
import { serviceDescriptionFor } from "../../../lib/fire-services";
import { paymentHandles } from "../../../lib/payment-methods";
import { CustomerPortalNav } from "../../customer-portal-nav";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};
type RuntimeEnv=Cloudflare.Env&{STRIPE_SECRET_KEY?:string;CASH_APP_HANDLE?:string;VENMO_HANDLE?:string};
const currency=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);

async function confirmPayment(sessionId:string,estimate:{id:string;customerId:string;customer:string;service:string;status:string;totalCents:number;depositCents:number}){
  const runtime=env as RuntimeEnv;
  if(!runtime.STRIPE_SECRET_KEY)return false;
  const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}`}});
  if(!response.ok)return false;
  const session=await response.json() as {id:string;payment_status?:string;amount_total?:number;metadata?:{estimate_id?:string;payment_type?:string;expected_amount_cents?:string;tip_amount_cents?:string;expected_charge_cents?:string}};
  if(session.payment_status!=="paid"||session.metadata?.estimate_id!==estimate.id||!session.amount_total)return false;
  const sessionAmount=Number(session.amount_total);
  const paymentType=session.metadata?.payment_type==="balance"?"balance":"deposit";
  const expectedAmount=Number(session.metadata?.expected_amount_cents??sessionAmount);
  const tipCents=Number(session.metadata?.tip_amount_cents??0);
  const expectedCharge=Number(session.metadata?.expected_charge_cents??(expectedAmount+tipCents));
  if(!Number.isSafeInteger(sessionAmount)||sessionAmount<=0||!Number.isSafeInteger(expectedAmount)||expectedAmount<=0||!Number.isSafeInteger(tipCents)||tipCents<0||!Number.isSafeInteger(expectedCharge)||expectedCharge!==sessionAmount||expectedAmount+tipCents!==sessionAmount)return false;
  if(paymentType!=="balance"&&tipCents>0)return false;
  const tracked=await env.DB.prepare("SELECT estimate_id AS estimateId,type,amount_cents AS amountCents,status FROM payment_checkout_sessions WHERE id=? LIMIT 1").bind(session.id).first<{estimateId:string;type:string;amountCents:number;status:string}>();
  if(!tracked||tracked.estimateId!==estimate.id||tracked.type!==paymentType||!Number.isSafeInteger(Number(tracked.amountCents))||Number(tracked.amountCents)!==sessionAmount||!["open","paid"].includes(tracked.status))return false;
  const prior=await env.DB.prepare("SELECT id FROM payments WHERE provider_id=? LIMIT 1").bind(session.id).first();
  if(prior){
    if(tipCents>0)await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,'Tip',?,'paid',?,?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,new Date().toISOString(),`${session.id}:tip`).run();
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();
    return true;
  }
  const existingPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimate.id).first<{amount:number}>();
  const existingPaid=Number(existingPaidRow?.amount??0);
  if(!Number.isSafeInteger(existingPaid)||existingPaid<0||!Number.isSafeInteger(existingPaid+sessionAmount))return false;
  const now=new Date().toISOString();
  const obligationCents=paymentType==="deposit"?Number(estimate.depositCents):Number(estimate.totalCents);
  if(!Number.isSafeInteger(obligationCents)||obligationCents<0)return false;
  const inserted=await env.DB.prepare(`
    INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
    SELECT ?,?,?,?,'paid',?,?
    WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)
  `).bind(crypto.randomUUID(),estimate.id,paymentType,expectedAmount,session.id,now,session.id).run();
  if(!inserted.meta.changes){await env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id).run();return true;}
  if(tipCents>0)await env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
    SELECT ?,?,'Tip',?,'paid',?,?
    WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
    .bind(crypto.randomUUID(),estimate.id,tipCents,`${session.id}:tip`,now,`${session.id}:tip`).run();
  const refreshedPaid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(estimate.id).first<{amount:number}>();
  const nextPaid=Number(refreshedPaid?.amount??0);
  if(!Number.isSafeInteger(nextPaid)||nextPaid<0)return false;
  const overpaymentCents=Math.max(0,nextPaid-obligationCents);
  if(!Number.isSafeInteger(overpaymentCents))return false;
  const followups=[
    env.DB.prepare("UPDATE payment_checkout_sessions SET status='paid' WHERE id=?").bind(session.id),
    env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"payment_received",`Payment received from ${estimate.customer}`,`${currency(expectedAmount)} ${paymentType} received for ${estimate.service}.`,estimate.customerId,estimate.id,now),
  ];
  if(estimate.status==="completed"||paymentType==="balance")followups.unshift(
    env.DB.prepare(`UPDATE invoices SET status=CASE
      WHEN ?>=total_cents THEN 'paid'
      WHEN ?>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(nextPaid,nextPaid,estimate.id)
  );
  if(tipCents>0)followups.push(
    env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),"tip_received",`Tip received from ${estimate.customer}`,`${currency(tipCents)} tip received with the final card payment.`,estimate.customerId,estimate.id,now)
  );
  if(overpaymentCents>0){
    const overpaymentBody=`${currency(overpaymentCents)} is currently recorded above the amount due. Review the Stripe payments and either refund the excess or intentionally keep it as an overpayment on this job.`;
    followups.push(
      env.DB.prepare("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL").bind(`Review overpayment from ${estimate.customer}`,overpaymentBody,estimate.id),
      env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL)`).bind(crypto.randomUUID(),"payment_overage",`Review overpayment from ${estimate.customer}`,overpaymentBody,estimate.customerId,estimate.id,now,estimate.id)
    );
  }
  await env.DB.batch(followups);
  return true;
}

export default async function CustomerEstimatePage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{session_id?:string}>}){
  const {token}=await params;
  const {session_id:sessionId}=await searchParams;
  const row=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,(SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,e.deposit_cents AS depositCents,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,c.name AS customer,c.address,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
      (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount
      FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;invoiceTotalCents:number|null;depositCents:number;shareToken:string;firstViewedAt:string|null;acceptedAt:string|null;signedName:string|null;signedAt:string|null;contractInitials:string|null;photoRelease:string|null;customer:string;address:string|null;paymentOverageOpen:number;pendingRefundCount:number}>();
  if(!row)return <main className="pay-page"><section className="pay-card"><div className="pay-logo">F</div><h1>Estimate not found</h1><p>Please check the link or contact First In Response Exteriors.</p></section></main>;
  const itemResult=await env.DB.prepare(`SELECT name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC`).bind(row.id).all<{name:string;description:string;quantity:number;unit:string;totalCents:number}>();
  const items=itemResult.results.map((item)=>({...item,quantity:Number(item.quantity),totalCents:Number(item.totalCents)}));
  const estimateItemsSafe=items.length>0&&items.every((item)=>Boolean(item.name?.trim())&&Number.isFinite(item.quantity)&&item.quantity>0&&Number.isSafeInteger(item.totalCents)&&item.totalCents>=0);
  const itemSubtotalCents=estimateItemsSafe?items.reduce((sum,item)=>sum+item.totalCents,0):0;
  const estimateSnapshotSafe=estimateItemsSafe&&Number.isSafeInteger(itemSubtotalCents)&&itemSubtotalCents===Number(row.subtotalCents)&&Number.isSafeInteger(Number(row.discountCents))&&Number(row.discountCents)>=0&&Number(row.discountCents)<=itemSubtotalCents;
  const serviceSummary=items.map((item)=>item.name).join(", ")||"Exterior cleaning service";
  if(!row.firstViewedAt){
    const now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE estimates SET first_viewed_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=? AND first_viewed_at IS NULL").bind(now,row.id),
      env.DB.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND first_viewed_at=?)`)
        .bind(crypto.randomUUID(),"estimate_viewed",`${row.customer} viewed an estimate`,`${serviceSummary} estimate was opened for the first time.`,row.customerId,row.id,now,row.id,now),
    ]);
  }
  const billingTotalCents=Number(row.invoiceTotalCents??row.totalCents);
  const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.id).first<{amount:number}>();
  const paidCents=Number(paid?.amount??0);
  const billingStateSafe=estimateSnapshotSafe&&[billingTotalCents,Number(row.totalCents),Number(row.depositCents),paidCents].every((value)=>Number.isSafeInteger(value)&&value>=0)&&Number(row.depositCents)<=Number(row.totalCents);
  const paymentReviewPending=Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;
  const paymentConfirmed=sessionId&&billingStateSafe&&!paymentReviewPending?await confirmPayment(sessionId,{...row,totalCents:billingTotalCents,service:serviceSummary}):false;
  const runtime=env as RuntimeEnv;
  const paymentsReady=Boolean(runtime.STRIPE_SECRET_KEY);
  const handles=paymentHandles(runtime);
  const balance=billingStateSafe?Math.max(0,billingTotalCents-paidCents):0;
  const depositRemaining=billingStateSafe?Math.max(0,Number(row.depositCents)-paidCents):0;
  const estimateApproved=Boolean(row.acceptedAt)||["approved","scheduled","completed"].includes(row.status);
  const canPayDeposit=billingStateSafe&&!paymentReviewPending&&estimateApproved&&row.status!=="completed"&&depositRemaining>0;
  const canPayBalance=billingStateSafe&&!paymentReviewPending&&row.status==="completed"&&balance>0;
  const footer=await env.DB.prepare("SELECT body FROM message_templates WHERE key='estimateFooter'").first<{body:string}>();
  const contract=await env.DB.prepare("SELECT body FROM message_templates WHERE key='contractTerms'").first<{body:string}>();
  return <main className="pay-page"><section className="pay-card estimate-portal">
    <header><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
    {paymentConfirmed&&<div className="portal-payment-success"><CheckCircle2/><div><strong>Payment received</strong><p>Thank you, {row.customer}. Kyle has been notified.</p></div></div>}
    <div className="pay-title"><p>ESTIMATE FOR</p><h1>{row.customer}</h1>{row.address&&<span><MapPin/>{row.address}</span>}</div>
    <div className="portal-service-list">{items.map((item,index)=><div className="pay-line" key={`${item.name}-${index}`}><div><strong>{item.name}</strong>{item.quantity&&<span>{item.quantity} {item.unit}</span>}<p className="portal-service-description">{item.description||serviceDescriptionFor(item.name)}</p></div><strong>{currency(item.totalCents)}</strong></div>)}</div>
    <div className="portal-breakdown"><span><small>Services subtotal</small><strong>{currency(row.subtotalCents)}</strong></span><span><small>Discount</small><strong className="green-text">−{currency(row.discountCents)}</strong></span></div>
    <div className="pay-summary"><span><small>Estimate total</small><strong>{currency(row.totalCents)}</strong></span><span><small>50% deposit</small><strong className="red-text">{currency(row.depositCents)}</strong></span></div>
    <AcceptEstimateButton token={token} accepted={Boolean(row.acceptedAt)||["approved","scheduled","completed"].includes(row.status)} signedName={row.signedName} photoRelease={row.photoRelease} terms={contract?.body?.startsWith("I authorize First In Response Exteriors to perform the services listed")?SERVICE_AGREEMENT:(contract?.body||SERVICE_AGREEMENT)}/>
    {!billingStateSafe&&<p className="pay-note"><strong>Billing review required.</strong> Please contact First In Response Exteriors before making a payment.</p>}
    {Number(row.pendingRefundCount??0)>0?<p className="pay-note"><strong>Refund processing.</strong> FIRE is waiting for the refund to finish before any additional payment is accepted.</p>:Number(row.paymentOverageOpen??0)>0&&<p className="pay-note"><strong>Payment received — account review in progress.</strong> No additional payment is needed until FIRE finishes reviewing the account.</p>}
    {paymentsReady&&canPayDeposit&&<div className="portal-payment"><PayButton shareToken={token} paymentType="deposit" label={`Pay ${currency(depositRemaining)} deposit securely`}/></div>}
    {paymentsReady&&canPayBalance&&<div className="portal-payment"><PayButton shareToken={token} paymentType="balance" dueAmountCents={balance} tipBaseCents={billingTotalCents} label={`Pay ${currency(balance)} remaining balance securely`}/></div>}
    {paymentsReady&&!estimateApproved&&<p className="pay-note">Approve and sign the estimate first. After approval, the 50% deposit reserves your place on the schedule.</p>}
    {paymentsReady&&estimateApproved&&!canPayDeposit&&!canPayBalance&&balance>0&&<p className="pay-note">Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.</p>}
    {!paymentsReady&&<p className="pay-note">After approval, Kyle will contact you to schedule the job and arrange the 50% deposit.</p>}
    {billingStateSafe&&!paymentReviewPending&&estimateApproved&&((row.status!=="completed"&&depositRemaining>0)||(row.status==="completed"&&balance>0))&&<p className="pay-note"><strong>Manual payment options:</strong> Cash App: {handles.cashApp} · Venmo: {handles.venmo}. Please include your name in the payment note.</p>}
    <p className="document-footer">{footer?.body||templateByKey("estimateFooter").body}</p>
    <div className="secure-note"><ShieldCheck/> Your private estimate link is unique to you.</div>
    <CustomerPortalNav/>
  </section></main>;
}
