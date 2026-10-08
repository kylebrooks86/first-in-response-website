import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized() {
  const user = await getChatGPTUser();
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
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN estimates pe ON pe.id=p.estimate_id WHERE pe.customer_id=c.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidTotal
        FROM customers c LEFT JOIN estimates e ON e.customer_id=c.id
        GROUP BY c.id ORDER BY c.created_at DESC
      `),
      env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,
          (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
          e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
          (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
          (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
          (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
          (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text','email')) AS lastReviewRequestAt,
          (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email')) AS lastRebookMessageAt
        FROM estimates e ORDER BY e.created_at DESC
      `),
      env.DB.prepare(`SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,customer_id AS customerId,status,total_cents AS totalCents,due_at AS dueAt,share_token AS shareToken,first_viewed_at AS firstViewedAt,created_at AS createdAt FROM invoices ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM customer_photos ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,e.customer_id AS customerId,p.type,p.amount_cents AS amountCents,p.processing_fee_cents AS processingFeeCents,p.gross_received_cents AS grossReceivedCents,p.bundled_tip_cents AS bundledTipCents,p.processing_method AS processingMethod,p.status,p.provider_id AS reference,p.created_at AS createdAt, (SELECT r.id FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundId, (SELECT r.amount_cents FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundAmountCents, CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
      CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents, CASE WHEN p.type IN ('deposit','balance','Tip') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE p.status='paid' ORDER BY p.created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items ORDER BY rowid ASC`),
    ]);
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

export async function PATCH(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const leadSource = String(body.leadSource ?? "Unknown").trim() || "Unknown";
    if (!id) return Response.json({ error: "Customer ID is required." }, { status: 400 });
    if (!name) return Response.json({ error: "Customer name is required." }, { status: 400 });

    const existing = await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(id).first<{id:string}>();
    if (!existing) return Response.json({ error: "That customer record could not be found." }, { status: 404 });

    const normalizedEmail = email.toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const others = await env.DB.prepare("SELECT id,email,phone FROM customers WHERE id<>?").bind(id).all<{id:string;email:string|null;phone:string|null}>();
    const duplicate = others.results.find((customer) =>
      (normalizedEmail && String(customer.email ?? "").trim().toLowerCase() === normalizedEmail) ||
      (normalizedPhone && String(customer.phone ?? "").replace(/\D/g, "") === normalizedPhone)
    );
    if (duplicate) return Response.json({ error: "Another customer already uses that email or phone number." }, { status: 409 });

    await env.DB.prepare("UPDATE customers SET name=?,email=?,phone=?,address=?,lead_source=? WHERE id=?")
      .bind(name, email || null, phone || null, address || null, leadSource, id).run();
    const customer = await env.DB.prepare("SELECT id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address,lead_source AS leadSource,created_at AS createdAt FROM customers WHERE id=? LIMIT 1")
      .bind(id).first();
    return Response.json({ customer });
  } catch {
    return Response.json({ error: "We couldn't update this customer. Please try again." }, { status: 500 });
  }
}
