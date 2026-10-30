import {currentInvoice} from "../../../lib/invoice-state.mjs";
import {customerPropertiesEnabled,propertyAssociationColumns} from '../../../lib/customer-properties';
import {serviceLocationsEnabled,serviceAddressColumns} from "../../../lib/service-location";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {customerIdentityPredicate,customerCreationReceipt} from '../../../lib/customer-identity';
import {usableCustomerPhone,usableCustomerEmail} from '../../../lib/customer-contact-links';

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized() {
  const user = await getChatGPTUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

async function readCustomerRequest(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function GET(request?: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Bounded read-only check for a possibly committed customer edit.
    // This never triggers another PATCH or exposes owner data to unauthenticated callers.
    const checkId=request?new URL(request.url).searchParams.get('confirmEdit'):null;
    if(checkId!==null){
      if(!checkId||checkId.length>128)return Response.json({error:'Invalid customer confirmation ID.'},{status:400});
      const customer=await env.DB.prepare("SELECT id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address,lead_source AS leadSource,created_at AS createdAt FROM customers WHERE id=? LIMIT 1")
        .bind(checkId).first();
      return customer?Response.json({customer},{headers:{'Cache-Control':'no-store, private'}}):Response.json({error:'Customer record not found.'},{status:404,headers:{'Cache-Control':'no-store, private'}});
    }
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
        SELECT e.id,e.customer_id AS customerId,${serviceAddressColumns(serviceLocationsEnabled(env),"(SELECT address FROM customers WHERE id=e.customer_id)")+propertyAssociationColumns(customerPropertiesEnabled(env))},e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,
          (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
          e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
          (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
          (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
          (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
          (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
          (SELECT MIN(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='estimate' AND cm.channel IN ('text_confirmed','email_confirmed')) AS firstEstimateSentAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp1' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage1At,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp3' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage3At,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp7' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage7At,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.channel='contact_recorded' AND cm.template='followupContact') AS lastManualContactAt,
          (SELECT body FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.channel='followup_snoozed' AND cm.template='followupSnooze' ORDER BY created_at DESC,id DESC LIMIT 1) AS snoozeUntil,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='estimate' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateSentAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('estimate','followUp1','followUp3','followUp7') AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateContactAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastReviewRequestAt,
          (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
               (SELECT MAX(n.created_at) FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt,
          (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
          (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email','text_confirmed','email_confirmed')) AS lastRebookMessageAt
        FROM estimates e ORDER BY e.created_at DESC
      `),
      env.DB.prepare(`SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,customer_id AS customerId,status,total_cents AS totalCents,due_at AS dueAt,share_token AS shareToken,first_viewed_at AS firstViewedAt,created_at AS createdAt,
        COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=invoices.estimate_id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=invoices.estimate_id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=invoices.estimate_id AND r.status='pending') AS pendingRefundCount${customerPropertiesEnabled(env)?",(SELECT pl.property_id FROM estimate_property_links pl WHERE pl.estimate_id=invoices.estimate_id AND pl.customer_id=invoices.customer_id) AS propertyId":""} FROM invoices ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM customer_photos ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,e.customer_id AS customerId,p.type,p.amount_cents AS amountCents,p.processing_fee_cents AS processingFeeCents,p.gross_received_cents AS grossReceivedCents,p.bundled_tip_cents AS bundledTipCents,p.processing_method AS processingMethod,p.status,p.provider_id AS reference,p.created_at AS createdAt, (SELECT r.id FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundId, (SELECT r.amount_cents FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundAmountCents, CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
      CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents, CASE WHEN p.type IN ('deposit','balance','Tip') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE p.status='paid' ORDER BY p.created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items ORDER BY rowid ASC`),
    ]);
    const grouped=new Map<string,Record<string,unknown>[]>();
    for(const raw of estimateItems.results as Record<string,unknown>[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};const key=String(raw.estimateId);grouped.set(key,[...(grouped.get(key)??[]),row]);}
    const mappedEstimates=(estimates.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,items,service:items.map((item)=>String(item.name)).join(", ")||"Custom service",serviceDescription:String(items[0]?.description??"")};});
    return Response.json({ customers: customers.results, estimates: mappedEstimates, notes: notes.results, invoices: invoices.results.map(currentInvoice), photos: photos.results, messages: messages.results, payments:payments.results },{headers:{"Cache-Control":"no-store, private"}});
  } catch {
    return Response.json({ error: "Customer records are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readCustomerRequest(request);
  if (!body) return Response.json({ error: "A valid customer request is required." }, { status: 400 });
  try {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const leadSource = String(body.leadSource ?? "Unknown").trim() || "Unknown";
    if (!name) return Response.json({ error: "Customer name is required." }, { status: 400 });
    const requestId=body.requestId;
    if(requestId!==undefined&&(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId)))return Response.json({error:'Invalid customer save identifier.'},{status:400});
    const id = typeof requestId==='string'?requestId:crypto.randomUUID();
    const replay=async()=>{
      const customer=await customerCreationReceipt(env.DB,id);
      if(!customer)return null;
      if(customer.name!==name||customer.email!==email||customer.phone!==phone||customer.address!==address||customer.leadSource!==leadSource)return Response.json({error:'This save identifier already belongs to different customer details. Check the saved customer; no records were overwritten.'},{status:409});
      return Response.json({requestId:id,duplicate:true,customer},{headers:{'Cache-Control':'no-store, private'}});
    };
    if(requestId){const receipt=await replay();if(receipt)return receipt;}
    const createdAt = new Date().toISOString();
    const match=customerIdentityPredicate({name,email,phone,address});
    const inserted=await env.DB.prepare(`INSERT INTO customers (id,name,email,phone,address,lead_source,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE id=? OR ${match.sql}) RETURNING id`)
      .bind(id,name,email||null,phone||null,address||null,leadSource,createdAt,id,...match.values).first();
    if(!inserted){if(requestId){const receipt=await replay();if(receipt)return receipt;}return Response.json({error:'A matching customer already exists. Search and select their saved record instead of creating a duplicate.'},{status:409});}
    return Response.json({ requestId:id,customer: { id, name, email, phone, address, leadSource, createdAt, estimateCount: 0, estimateTotal: 0, paidTotal: 0 } }, { status: 201,headers:{"Cache-Control":"no-store, private"} });
  } catch {
    return Response.json({ error: "Customer save confirmation is uncertain. Check the same request before creating another record." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readCustomerRequest(request);
  if (!body) return Response.json({ error: "A valid customer update is required." }, { status: 400 });
  try {
    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const leadSource = String(body.leadSource ?? "Unknown").trim() || "Unknown";
    if (!id) return Response.json({ error: "Customer ID is required." }, { status: 400 });
    if (!name) return Response.json({ error: "Customer name is required." }, { status: 400 });
    if(email&&!usableCustomerEmail(email))return Response.json({error:'Enter a valid email address or leave it blank.'},{status:400});
    if(phone&&!usableCustomerPhone(phone))return Response.json({error:'Enter a valid 10-digit U.S. phone number or leave it blank.'},{status:400});

    const existing = await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(id).first<{id:string}>();
    if (!existing) return Response.json({ error: "That customer record could not be found." }, { status: 404 });

    const normalizedEmail = email.toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const others = await env.DB.prepare("SELECT id,email,phone FROM customers WHERE id<>?").bind(id).all<{id:string;email:string|null;phone:string|null}>();
    const duplicateEmail=normalizedEmail&&others.results.some((customer)=>
      String(customer.email ?? "").trim().toLowerCase()===normalizedEmail);
    const duplicatePhone=normalizedPhone&&others.results.some((customer)=>
      String(customer.phone ?? "").replace(/\D/g,"")===normalizedPhone);
    if(duplicateEmail||duplicatePhone)
      return Response.json({error:duplicateEmail&&duplicatePhone?
        "Another customer already has this email and phone number. Nothing was changed.":
        duplicateEmail?"This email is already on another customer. Nothing was changed.":
        "This phone number is already on another customer. Nothing was changed."},{status:409});

    await env.DB.prepare("UPDATE customers SET name=?,email=?,phone=?,address=?,lead_source=? WHERE id=?")
      .bind(name, email || null, phone || null, address || null, leadSource, id).run();
    const customer = await env.DB.prepare("SELECT id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address,lead_source AS leadSource,created_at AS createdAt FROM customers WHERE id=? LIMIT 1")
      .bind(id).first();
    return Response.json({customer},{headers:{'Cache-Control':'no-store, private'}});
  } catch {
    return Response.json({ error: "We couldn't update this customer. Please try again." }, { status: 500 });
  }
}
