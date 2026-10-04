import { env } from "cloudflare:workers";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { PayButton } from "./pay-button";
import { paymentHandles } from "../../../lib/payment-methods";
import { CustomerPortalNav } from "../../customer-portal-nav";

export const dynamic = "force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};
const currency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { id: shareToken } = await params;
  const { paid } = await searchParams;
  const row = await env.DB.prepare(`
    SELECT e.id, e.total_cents AS estimateTotalCents, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents, e.deposit_cents AS depositCents, e.status, e.accepted_at AS acceptedAt,
           c.name AS customer, c.address,
           COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
           COALESCE((SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL),0) AS paymentOverageOpen
    FROM estimates e JOIN customers c ON c.id=e.customer_id
    WHERE e.share_token=? LIMIT 1
  `).bind(shareToken).first<{ id:string; estimateTotalCents:number; totalCents:number; depositCents:number; status:string; acceptedAt:string|null; paidCents:number; paymentOverageOpen:number; customer:string; address:string|null }>();
  if (!row) return <main className="pay-page"><section className="pay-card"><div className="pay-logo">F</div><h1>Estimate not found</h1><p>Please check the link or contact First In Response Exteriors.</p></section></main>;
  const itemResult = await env.DB.prepare(`SELECT name,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC`).bind(row.id).all<{name:string;quantity:number;unit:string;totalCents:number}>();
  const items = itemResult.results.map((item)=>({...item,quantity:Number(item.quantity),totalCents:Number(item.totalCents)}));
  const paidCents = Number(row.paidCents??0);
  const depositRemaining = Math.max(0,row.depositCents-paidCents);
  const balance = Math.max(0,row.totalCents-paidCents);
  const paymentReviewPending = Number(row.paymentOverageOpen??0)>0;
  const approved = Boolean(row.acceptedAt)||["approved","scheduled","completed"].includes(row.status);
  const paymentType: "deposit"|"balance" = row.status==="completed"?"balance":"deposit";
  const dueNow = paymentType==="deposit"?depositRemaining:balance;
  const canPay = dueNow>0&&approved&&(paymentType==="deposit"||row.status==="completed");
  const handles = paymentHandles(env as Cloudflare.Env & { CASH_APP_HANDLE?:string; VENMO_HANDLE?:string });
  return <main className="pay-page"><section className="pay-card">
    <header><div className="pay-logo">F</div><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
    {paid === "1" ? <div className="paid-state"><CheckCircle2 /><h1>Payment received</h1><p>Thank you, {row.customer}. Your payment has been recorded successfully.</p></div> : <>
      <div className="pay-title"><p>ESTIMATE FOR</p><h1>{row.customer}</h1>{row.address && <span>{row.address}</span>}</div>
      <div className="portal-service-list">{items.map((item,index)=><div className="pay-line" key={`${item.name}-${index}`}><div><strong>{item.name}</strong><span>{item.quantity} {item.unit}</span></div><strong>{currency(item.totalCents)}</strong></div>)}</div>
      <div className="pay-summary"><span><small>Estimate total</small><strong>{currency(row.totalCents)}</strong></span><span><small>Paid</small><strong>{currency(paidCents)}</strong></span><span><small>{paymentType==="deposit"?"Deposit remaining":"Balance due"}</small><strong className="red-text">{currency(dueNow)}</strong></span></div>
      <p className="pay-note">After approval, the 50% deposit reserves your place on the schedule. The remaining balance is due upon completion of the work.</p>
      <p className="pay-note"><strong>Manual payment options:</strong> Cash App: {handles.cashApp} · Venmo: {handles.venmo}. Please include your name in the payment note.</p>
      {canPay?<PayButton shareToken={shareToken} paymentType={paymentType} label={paymentType==="deposit"?`Pay ${currency(dueNow)} deposit securely`:`Pay ${currency(dueNow)} remaining balance securely`}/>:paymentReviewPending?<p className="pay-note">Payment received — account review in progress.</p>:balance===0?<p className="pay-note">This job is paid in full.</p>:!approved?<p className="pay-note">Approve and sign the estimate before making the reservation deposit.</p>:<p className="pay-note">Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.</p>}
      <div className="secure-note"><ShieldCheck /> Card details are handled securely by Stripe.</div>
      <CustomerPortalNav/>
    </>}
  </section></main>;
}
