import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {buildPaymentCloseoutActions,type CloseoutRow} from "../../../lib/payment-closeout-actions";
export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store, private"}});
/** Authenticated, no-write list of confirmed closeouts requiring owner review-message attention. */
export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!=="kylebrooks8605@gmail.com")return json({error:"Unauthorized"},401);
 try{
  const result=await env.DB.prepare(`
   SELECT e.id AS estimateId,e.customer_id AS customerId,c.name AS customerName,e.status,
    COALESCE((SELECT i.total_cents FROM invoices i WHERE i.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents,
    COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
    (SELECT MAX(p.created_at) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund') AND p.amount_cents>0) AS lastPaidAt,
    (SELECT MAX(m.created_at) FROM customer_messages m WHERE m.estimate_id=e.id AND m.template='review' AND m.channel IN ('text_prepared','email_prepared')) AS reviewPreparedAt,
    (SELECT MAX(m.created_at) FROM customer_messages m WHERE m.estimate_id=e.id AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed')) AS reviewConfirmedAt,
    (SELECT MAX(n.created_at) FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt,
    (SELECT COUNT(*) FROM payment_refunds x WHERE x.estimate_id=e.id AND x.status='pending') AS pendingRefundCount,
    (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
    (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
   FROM estimates e JOIN customers c ON c.id=e.customer_id
   WHERE e.status='completed'
    AND EXISTS(SELECT 1 FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.amount_cents>0 AND p.type NOT IN ('Tip','Tip Refund'))
    AND NOT EXISTS(SELECT 1 FROM customer_messages m WHERE m.estimate_id=e.id AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed'))
    AND NOT EXISTS(SELECT 1 FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED')
    -- Filter the ledger BEFORE LIMIT so newer partial payments cannot hide
    -- an older eligible paid-in-full job from the owner action queue.
    AND COALESCE((SELECT i.total_cents FROM invoices i WHERE i.estimate_id=e.id LIMIT 1),e.total_cents)>0
    AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
      =COALESCE((SELECT i.total_cents FROM invoices i WHERE i.estimate_id=e.id LIMIT 1),e.total_cents)
    AND NOT EXISTS(SELECT 1 FROM payment_refunds x WHERE x.estimate_id=e.id AND x.status='pending')
    AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open')
   ORDER BY lastPaidAt DESC,e.id DESC LIMIT 201
  `).all<CloseoutRow>();
  const rows=result.results??[];
  return json({actions:buildPaymentCloseoutActions(rows.slice(0,200)),mayHaveMore:rows.length>200});
 }catch{return json({error:"Review status could not be verified. Payment records remain unchanged."},503);}
}
