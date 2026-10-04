import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized() {
  const user = await getOwnerUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

export async function GET() {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [customers, estimates, notes, invoices, photos, messages, payments, estimateItems] = await env.DB.batch([
      env.DB.prepare(`
        SELECT c.id,c.name,c.email,c.phone,c.address,c.lead_source AS leadSource,c.created_at AS createdAt,
          COUNT(DISTINCT e.id) AS estimateCount,
          COALESCE((SELECT SUM(COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=ce.id LIMIT 1),ce.total_cents)) FROM estimates ce WHERE ce.customer_id=c.id),0) AS estimateTotal,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN estimates pe ON pe.id=p.estimate_id WHERE pe.customer_id=c.id AND p.status='paid'),0) AS paidTotal
        FROM customers c LEFT JOIN estimates e ON e.customer_id=c.id
        GROUP BY c.id ORDER BY c.created_at DESC
      `),
      env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,
          (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
          e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
          (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
          (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
          (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
          (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text','email')) AS lastReviewRequestAt,
          (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
          (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email')) AS lastRebookMessageAt
        FROM estimates e ORDER BY e.created_at DESC
      `),
      env.DB.prepare(`SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT inv.id,inv.estimate_id AS estimateId,inv.customer_id AS customerId,inv.status,inv.total_cents AS totalCents,inv.due_at AS dueAt,inv.share_token AS shareToken,inv.first_viewed_at AS firstViewedAt,inv.created_at AS createdAt,
          (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=inv.estimate_id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
          (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=inv.estimate_id AND r.status='pending') AS pendingRefundCount
          FROM invoices inv ORDER BY inv.created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM customer_photos ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,e.customer_id AS customerId,p.type,p.amount_cents AS amountCents,p.status,p.provider_id AS reference,p.created_at AS createdAt,
          CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
          CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents,
          CASE WHEN p.type IN ('deposit','balance') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment
          FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE p.status='paid' ORDER BY p.created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items ORDER BY rowid ASC`),
    ]);
    const customerFinancialsSafe=(customers.results as Record<string,unknown>[]).every((row)=>
      Number.isSafeInteger(Number(row.estimateCount))&&Number(row.estimateCount)>=0&&
      Number.isSafeInteger(Number(row.estimateTotal))&&Number(row.estimateTotal)>=0&&
      Number.isSafeInteger(Number(row.paidTotal))&&Number(row.paidTotal)>=0
    );
    const estimateFinancialsSafe=(estimates.results as Record<string,unknown>[]).every((row)=>{
      const values=[row.subtotalCents,row.discountCents,row.totalCents,row.depositCents,row.paidCents];
      if(row.invoiceTotalCents!==null&&row.invoiceTotalCents!==undefined)values.push(row.invoiceTotalCents);
      return values.every((value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0);
    });
    if(!customerFinancialsSafe||!estimateFinancialsSafe)return Response.json({error:"Customer billing totals require owner review before FIRE can safely summarize them."},{status:409});
    const grouped=new Map<string,Record<string,unknown>[]>();
    for(const raw of estimateItems.results as Record<string,unknown>[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};const key=String(raw.estimateId);grouped.set(key,[...(grouped.get(key)??[]),row]);}
    const mappedEstimates=(estimates.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,items,service:items.map((item)=>String(item.name)).join(", ")||"Custom service",serviceDescription:String(items[0]?.description??"")};});
    return Response.json({ customers: customers.results, estimates: mappedEstimates, notes: notes.results, invoices: invoices.results, photos: photos.results, messages: messages.results, payments:payments.results });
  } catch {
    return Response.json({ error: "Customer records are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const leadSource = String(body.leadSource ?? "Unknown").trim() || "Unknown";
    if (!name) return Response.json({ error: "Customer name is required." }, { status: 400 });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO customers (id,name,email,phone,address,lead_source,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id, name, email || null, phone || null, address || null, leadSource, createdAt).run();
    return Response.json({ customer: { id, name, email, phone, address, leadSource, createdAt, estimateCount: 0, estimateTotal: 0, paidTotal: 0 } }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't save this customer. Please try again." }, { status: 500 });
  }
}
