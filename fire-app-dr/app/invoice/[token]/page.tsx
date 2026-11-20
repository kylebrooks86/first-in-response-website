import { env } from "cloudflare:workers";
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { templateByKey } from "../../../lib/fire-templates";
import { serviceDescriptionFor } from "../../../lib/fire-services";
import { PayButton } from "../../pay/[id]/pay-button";
import { paymentHandles } from "../../../lib/payment-methods";
import { CustomerPortalNav } from "../../customer-portal-nav";

export const dynamic = "force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};
type RuntimeEnv = Cloudflare.Env & { STRIPE_SECRET_KEY?: string; CASH_APP_HANDLE?:string; VENMO_HANDLE?:string };
const currency = (value:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value/100);

const invoiceDueLabel = (dueAt:string|null, createdAt:string) => {
  if (!dueAt) return "Payment due on receipt";
  const due = new Date(dueAt);
  const created = new Date(createdAt);
  const sameCalendarDay = due.getFullYear()===created.getFullYear() && due.getMonth()===created.getMonth() && due.getDate()===created.getDate();
  if (sameCalendarDay) return "Payment due on receipt";
  return `Payment due ${new Intl.DateTimeFormat("en-US", { month:"long", day:"numeric", year:"numeric" }).format(due)}`;
};

export default async function CustomerInvoicePage({ params }: { params:Promise<{token:string}> }) {
  const { token } = await params;
  const row = await env.DB.prepare(`
    SELECT inv.id,inv.estimate_id AS estimateId,inv.customer_id AS customerId,inv.status,inv.subtotal_cents AS subtotalCents,inv.discount_cents AS discountCents,inv.total_cents AS totalCents,
      inv.due_at AS dueAt,inv.created_at AS createdAt,inv.first_viewed_at AS firstViewedAt,c.name AS customer,c.address,e.share_token AS estimateShareToken,e.status AS estimateStatus,
      COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=inv.estimate_id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=inv.estimate_id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
      (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=inv.estimate_id AND r.status='pending') AS pendingRefundCount
    FROM invoices inv JOIN customers c ON c.id=inv.customer_id JOIN estimates e ON e.id=inv.estimate_id
    WHERE inv.share_token=? LIMIT 1
  `).bind(token).first<{id:string;estimateId:string;customerId:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;dueAt:string|null;createdAt:string;firstViewedAt:string|null;customer:string;address:string|null;estimateShareToken:string|null;estimateStatus:string;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number}>();
  if (!row) return <main className="pay-page"><section className="pay-card"><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><h1>Invoice not found</h1><p>Please check the link or contact First In Response Exteriors.</p></section></main>;
  const itemResult=await env.DB.prepare(`SELECT name,description,quantity,unit,total_cents AS totalCents FROM invoice_items WHERE invoice_id=? ORDER BY rowid ASC`).bind(row.id).all<{name:string;description:string;quantity:number;unit:string;totalCents:number}>();
  const items=itemResult.results.map((item)=>({...item,quantity:Number(item.quantity),totalCents:Number(item.totalCents)}));
  const invoiceItemsSafe=items.length>0&&items.every((item)=>Boolean(item.name?.trim())&&Number.isFinite(item.quantity)&&item.quantity>0&&Number.isSafeInteger(item.totalCents)&&item.totalCents>=0);
  const itemSubtotalCents=invoiceItemsSafe?items.reduce((sum,item)=>sum+item.totalCents,0):0;
  const storedSubtotalCents=Number(row.subtotalCents);
  const storedDiscountCents=Number(row.discountCents);
  const storedTotalCents=Number(row.totalCents);
  const expectedStoredTotal=itemSubtotalCents>0?Math.max(15000,itemSubtotalCents-storedDiscountCents):0;
  const invoiceItemSnapshotSafe=invoiceItemsSafe&&Number.isSafeInteger(itemSubtotalCents)&&Number.isSafeInteger(storedSubtotalCents)&&Number.isSafeInteger(storedDiscountCents)&&Number.isSafeInteger(storedTotalCents)&&storedDiscountCents>=0&&storedDiscountCents<=itemSubtotalCents&&storedSubtotalCents===itemSubtotalCents&&storedTotalCents===expectedStoredTotal;
  const serviceSummary=items.map((item)=>item.name).join(", ")||"Exterior cleaning service";
  if (!row.firstViewedAt) {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE invoices SET first_viewed_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=? AND first_viewed_at IS NULL").bind(now,row.id),
      env.DB.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND first_viewed_at=?)`)
        .bind(crypto.randomUUID(),"invoice_viewed",`${row.customer} viewed an invoice`,`${serviceSummary} invoice was opened for the first time.`,row.customerId,row.estimateId,now,row.id,now),
    ]);
  }
  const paidCents = Number(row.paidCents??0);
  const totalCents=Number(row.totalCents);
  const billingStateSafe=invoiceItemSnapshotSafe&&Number.isSafeInteger(paidCents)&&paidCents>=0&&Number.isSafeInteger(totalCents)&&totalCents>=0;
  const balance = billingStateSafe?Math.max(0,totalCents-paidCents):0;
  const paymentReviewPending = Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;
  const runtime = env as RuntimeEnv;
  const paymentsReady = Boolean(runtime.STRIPE_SECRET_KEY);
  const handles = paymentHandles(runtime);
  const footer=await env.DB.prepare("SELECT body FROM message_templates WHERE key='invoiceFooter'").first<{body:string}>();
  return <main className="pay-page"><section className="pay-card estimate-portal invoice-portal">
    <header><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
    <div className="pay-title"><p>INVOICE FOR</p><h1>{row.customer}</h1>{row.address&&<span><MapPin/>{row.address}</span>}</div>
    <div className="portal-service-list">{items.map((item,index)=><div className="pay-line" key={`${item.name}-${index}`}><div><strong>{item.name}</strong>{item.quantity&&<span>{item.quantity} {item.unit}</span>}<p className="portal-service-description">{item.description||serviceDescriptionFor(item.name)}</p></div><strong>{currency(item.totalCents)}</strong></div>)}</div>
    <div className="pay-summary"><span><small>Invoice total</small><strong>{currency(row.totalCents)}</strong></span><span><small>Balance due</small><strong className="red-text">{currency(balance)}</strong></span></div>
    <p className="invoice-due"><CalendarDays/> {!billingStateSafe?"Billing review required":Number(row.pendingRefundCount??0)>0?"Refund processing":Number(row.paymentOverageOpen??0)>0?"Payment received — account review in progress":balance===0?"Paid in full":invoiceDueLabel(row.dueAt,row.createdAt)}</p>
    {!billingStateSafe&&<p className="pay-note"><strong>Please contact First In Response Exteriors before making a payment.</strong> This invoice needs an owner billing review.</p>}
    {billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&paymentsReady&&row.estimateShareToken&&<div className="portal-payment"><PayButton shareToken={row.estimateShareToken} paymentType="balance" dueAmountCents={balance} tipBaseCents={totalCents} label={`Pay ${currency(balance)} remaining balance securely`}/></div>}
    {billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&<p className="pay-note"><strong>Manual payment options:</strong> Cash App: {handles.cashApp} · Venmo: {handles.venmo}. Please include your name in the payment note.</p>}
    <p className="pay-note">{footer?.body||templateByKey("invoiceFooter").body}</p>
    <div className="secure-note"><ShieldCheck/> Your private invoice link is unique to you.</div>
    <CustomerPortalNav/>
  </section></main>;
}
