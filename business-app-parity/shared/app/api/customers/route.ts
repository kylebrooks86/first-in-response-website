import {currentInvoice} from "../../../lib/invoice-state.mjs";
import {customerPropertiesEnabled,propertyAssociationColumns} from '../../../lib/customer-properties';
import {serviceLocationsEnabled,serviceAddressColumns} from "../../../lib/service-location";
import {verifyNewLiveFirstJobState} from "../../../lib/new-live-clean-start.mjs";
import { env } from "cloudflare:workers";
import {refundLedgerObjectsPresent,refundLedgerNotReady} from "../../../lib/refund-ledger-readiness";
import { getChatGPTUser } from "../../chatgpt-auth";
import {customerIdentityPredicate,customerCreationReceipt} from '../../../lib/customer-identity';
import {usableCustomerPhone,usableCustomerEmail} from '../../../lib/customer-contact-links';
import {customerNumberingReady,customerNumberForCustomer,newCustomerNumberStatement} from '../../../lib/customer-numbering.mjs';
import {attachedJobNumbers} from '../../../lib/job-numbering.mjs';

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

export async function GET(request?:Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Read-only owner-authenticated customer listing and edit confirmation.
    const numbered=await customerNumberingReady(env.DB,env);
    const numberColumn=numbered?"(SELECT customer_number FROM fire_customer_numbers WHERE customer_id=c.id) AS customerNumber":"NULL AS customerNumber";
    const confirmId=request?new URL(request.url).searchParams.get("confirmEdit"):null;
    if(confirmId!==null){
      if(!confirmId||confirmId.length>128)return Response.json({error:"Invalid customer confirmation ID."},{status:400,headers:{"Cache-Control":"no-store, private"}});
      const customer=await env.DB.prepare("SELECT c.id,c.name,COALESCE(c.email,'') AS email,COALESCE(c.phone,'') AS phone,COALESCE(c.address,'') AS address,COALESCE(c.lead_source,'Unknown') AS leadSource,c.created_at AS createdAt,"+numberColumn+" FROM customers c WHERE c.id=? LIMIT 1").bind(confirmId).first();
      return customer?Response.json({customer},{headers:{"Cache-Control":"no-store, private"}}):Response.json({error:"Customer record not found."},{status:404,headers:{"Cache-Control":"no-store, private"}});
    }
    // The confirmEdit single-record read above is independent of payment
    // history. Full customer lists include financial/refund state and must
    // stop safely before any private row or joined-ledger query if the
    // legacy LIVE refund table/indexes are missing.
    if(!await refundLedgerObjectsPresent(env.DB))return refundLedgerNotReady();
    const [customers, estimates, notes, invoices, photos, messages, payments, estimateItems] = await env.DB.batch([
      env.DB.prepare(`
        SELECT c.id,c.name,COALESCE(c.email,'') AS email,COALESCE(c.phone,'') AS phone,COALESCE(c.address,'') AS address,COALESCE(c.lead_source,'Unknown') AS leadSource,c.created_at AS createdAt,${numberColumn},
          COUNT(DISTINCT e.id) AS estimateCount,
          COALESCE((SELECT SUM(COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=ce.id LIMIT 1),ce.total_cents)) FROM estimates ce WHERE ce.customer_id=c.id),0) AS estimateTotal,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN estimates pe ON pe.id=p.estimate_id WHERE pe.customer_id=c.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidTotal
        FROM customers c LEFT JOIN estimates e ON e.customer_id=c.id
        GROUP BY c.id ORDER BY c.created_at DESC
      `),
      env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,${serviceAddressColumns(serviceLocationsEnabled(env),"(SELECT address FROM customers WHERE id=e.customer_id)")+propertyAssociationColumns(customerPropertiesEnabled(env))},e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.total_cents AS totalCents,
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
        NOT EXISTS(SELECT 1 FROM estimates parent WHERE parent.id=invoices.estimate_id AND parent.customer_id=invoices.customer_id) AS invoiceOwnershipMismatch,
        COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=invoices.estimate_id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=invoices.estimate_id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=invoices.estimate_id AND r.status='pending') AS pendingRefundCount${customerPropertiesEnabled(env)?",(SELECT pl.property_id FROM estimate_property_links pl WHERE pl.estimate_id=invoices.estimate_id AND pl.customer_id=invoices.customer_id) AS propertyId":""} FROM invoices ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM customer_photos ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,e.customer_id AS customerId,p.type,p.amount_cents AS amountCents,p.processing_fee_cents AS processingFeeCents,p.gross_received_cents AS grossReceivedCents,p.bundled_tip_cents AS bundledTipCents,p.processing_method AS processingMethod,p.status,p.provider_id AS reference,p.created_at AS createdAt, (SELECT r.id FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundId, (SELECT r.amount_cents FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='pending' ORDER BY r.created_at LIMIT 1) AS pendingRefundAmountCents, CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
      CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents, CASE WHEN p.type IN ('deposit','balance','Tip') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE p.status='paid' ORDER BY p.created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items ORDER BY rowid ASC`),
    ]);
    // Customer profiles must not silently place another homeowner's invoice
    // into a record. Owner review is safer than an apparently payable balance.
    if(invoices.results.some(row=>Number((row as Record<string,unknown>).invoiceOwnershipMismatch)!==0))
      return Response.json({error:"An invoice is linked to a different customer than its estimate. Reconcile invoice ownership before using customer billing."},
        {status:409,headers:{"Cache-Control":"no-store, private"}});
    const grouped=new Map<string,Record<string,unknown>[]>();
    for(const raw of estimateItems.results as Record<string,unknown>[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};const key=String(raw.estimateId);grouped.set(key,[...(grouped.get(key)??[]),row]);}
    const customerNumbers=new Map((customers.results as Record<string,unknown>[]).map(row=>[String(row.id),row.customerNumber??null]));
    // The customer's completed-job counter and history MUST use the same
    // persisted Job # links as the global estimate/invoice views. Distinct
    // revisions of a single job otherwise look like multiple finished jobs.
    const showJobs=(env as typeof env & {FIRE_JOB_NUMBERS_CANDIDATE?:string}).FIRE_JOB_NUMBERS_CANDIDATE==='owner-approved-schema-v1';
    const jobNumbers=showJobs?await attachedJobNumbers(env.DB,(estimates.results as Record<string,unknown>[]).map(row=>String(row.id))):new Map();
    const mappedEstimates=(estimates.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,customerNumber:customerNumbers.get(String(row.customerId))??null,jobNumber:jobNumbers.get(String(row.id))??null,items,service:items.map((item)=>String(item.name)).join(", ")||"Custom service",serviceDescription:String(items[0]?.description??"")};});
    return Response.json({ customers: customers.results, estimates: mappedEstimates, notes: notes.results, invoices: (invoices.results as Record<string,unknown>[]).map(({invoiceOwnershipMismatch:_ownershipCheck,...row})=>{void _ownershipCheck;return {...currentInvoice(row),customerNumber:customerNumbers.get(String(row.customerId))??null,jobNumber:jobNumbers.get(String(row.estimateId))??null};}), photos: photos.results, messages: messages.results, payments:payments.results },{headers:{"Cache-Control":"no-store, private"}});
  } catch {
    return Response.json({ error: "Customer records are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readCustomerRequest(request);
  if (!body) return Response.json({ error: "A valid customer request is required." }, { status: 400 });
  // Preserve the same operation identity across a lost D1 acknowledgement.
  // Never issue a second INSERT automatically: a committed customer must be
  // recovered by authoritative readback, including its permanent number.
  const recoveryRequestId=typeof body.requestId==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
      ?body.requestId:null;
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
    // Enforce the permanent Customer # flag on the actual write path, not
    // merely on the customer-list GET. Fail closed before inserting anything.
    if((env as typeof env & {FIRE_NEW_LIVE_CLEAN_START?:string}).FIRE_NEW_LIVE_CLEAN_START==='required'&&
       (env as typeof env & {FIRE_CUSTOMER_NUMBERS_CANDIDATE?:string}).FIRE_CUSTOMER_NUMBERS_CANDIDATE!=='owner-approved-schema-v1')
      return Response.json({error:'NEW LIVE customer numbering is not enabled. No customer was created.'},
        {status:503,headers:{'Cache-Control':'no-store, private'}});
    const numbered=await customerNumberingReady(env.DB,env);
    if((env as typeof env & {FIRE_NEW_LIVE_CLEAN_START?:string}).FIRE_NEW_LIVE_CLEAN_START==='required'){
      try{
        await verifyNewLiveFirstJobState(env.DB);
      }catch{
        return Response.json({error:'NEW LIVE permanent customer and job identities are not verified. No customer was created.'},
          {status:503,headers:{'Cache-Control':'no-store, private'}});
      }
    }
    const replay=async()=>{
      const customer=await customerCreationReceipt(env.DB,id);
      if(!customer)return null;
      if(customer.name!==name||customer.email!==email||customer.phone!==phone||customer.address!==address||customer.leadSource!==leadSource)return Response.json({error:'This save identifier already belongs to different customer details. Check the saved customer; no records were overwritten.'},{status:409});
      const customerNumber=numbered?await customerNumberForCustomer(env.DB,id,env):null;
      if(numbered&&!customerNumber)return Response.json({error:'Saved customer number could not be confirmed.',saveUncertain:true,requestId:id},
        {status:503,headers:{'Cache-Control':'no-store, private'}});
      return Response.json({requestId:id,duplicate:true,customer:{...customer,customerNumber}},{headers:{'Cache-Control':'no-store, private'}});
    };
    if(requestId){const receipt=await replay();if(receipt)return receipt;}
    // Creation and editing must apply the SAME contact validity contract.
    // Otherwise a new customer can be saved with an unusable phone/email,
    // only to have Google Voice or a later edit reject that contact.
    // Check an existing request ID first so conflicting idempotent retries
    // still return the original 409 without modifying saved customer details.
    if(email&&!usableCustomerEmail(email))
      return Response.json({error:"Enter a valid email address or leave it blank."},
        {status:400,headers:{"Cache-Control":"no-store, private"}});
    if(phone&&!usableCustomerPhone(phone))
      return Response.json({error:"Enter a valid 10-digit U.S. phone number or leave it blank."},
        {status:400,headers:{"Cache-Control":"no-store, private"}});
    const createdAt = new Date().toISOString();
    const match=customerIdentityPredicate({name,email,phone,address});
    const insertStatement=env.DB.prepare(`INSERT INTO customers (id,name,email,phone,address,lead_source,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE id=? OR ${match.sql}) RETURNING id`)
      .bind(id,name,email||null,phone||null,address||null,leadSource,createdAt,id,...match.values);
    // D1 batch is atomic. No customer record can be committed without its
    // permanent number once the approved schema and backfill are enabled.
    const inserted=numbered?(await env.DB.batch([insertStatement,newCustomerNumberStatement(env.DB,id,createdAt)]))[0]?.results?.[0]
      :await insertStatement.first();
    if(!inserted){if(requestId){const receipt=await replay();if(receipt)return receipt;}return Response.json({error:'A matching customer already exists. Search and select their saved record instead of creating a duplicate.'},{status:409});}
    const customerNumber=numbered?await customerNumberForCustomer(env.DB,id,env):null;
    if(numbered&&!customerNumber)return Response.json({error:'Customer saved but permanent number could not be confirmed. Check this same request before another save.',saveUncertain:true,requestId:id},
      {status:503,headers:{'Cache-Control':'no-store, private'}});
    return Response.json({ requestId:id,customer: { id, name, email, phone, address, leadSource, createdAt,customerNumber, estimateCount: 0, estimateTotal: 0, paidTotal: 0 } }, { status: 201,headers:{"Cache-Control":"no-store, private"} });
  } catch {
    // A network failure can occur AFTER an atomic D1 batch commits. Confirm
    // the exact saved operation before asking the owner to retry or reenter.
    if(recoveryRequestId){
      try{
        const receipt=await customerCreationReceipt(env.DB,recoveryRequestId);
        if(receipt){
          const same=receipt.name===String(body.name??"").trim()&&
            receipt.email===String(body.email??"").trim()&&
            receipt.phone===String(body.phone??"").trim()&&
            receipt.address===String(body.address??"").trim()&&
            receipt.leadSource===(String(body.leadSource??"Unknown").trim()||"Unknown");
          if(!same)return Response.json({
            error:"This save identifier belongs to different customer details. Reopen the saved record before retrying."
          },{status:409,headers:{"Cache-Control":"no-store, private"}});
          const numbered=await customerNumberingReady(env.DB,env);
          const customerNumber=numbered?await customerNumberForCustomer(env.DB,recoveryRequestId,env):null;
          if(numbered&&!customerNumber)throw Error('Permanent customer number not confirmed');
          return Response.json({requestId:recoveryRequestId,duplicate:true,
            recoveredAfterUncertainSave:true,customer:{...receipt,customerNumber}},
            {status:200,headers:{"Cache-Control":"no-store, private"}});
        }
      }catch{
        // No reliable readback. Never infer whether the INSERT committed.
      }
    }
    return Response.json({error:"Customer save confirmation is uncertain. Check the same request before creating another record.",
      saveUncertain:true,requestId:recoveryRequestId},
      {status:503,headers:{"Cache-Control":"no-store, private"}});
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
    if(email&&!usableCustomerEmail(email))return Response.json({error:"Enter a valid email address or leave it blank."},{status:400});
    if(phone&&!usableCustomerPhone(phone))return Response.json({error:"Enter a valid 10-digit U.S. phone number or leave it blank."},{status:400});

    const existing = await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(id).first<{id:string}>();
    if (!existing) return Response.json({ error: "That customer record could not be found." }, { status: 404 });

    const normalizedEmail = email.toLowerCase();
    // Compare equivalent U.S. numbers in the SAME canonical +1 form used by
    // Call/Text handoff and customer creation. Raw digit strings would treat
    // 9185550101 and +1 9185550101 as two unrelated customers.
    const normalizedPhone = phone?usableCustomerPhone(phone):null;
    const others = await env.DB.prepare("SELECT id,name,email,phone,address FROM customers WHERE id<>?").bind(id)
      .all<{id:string;name:string;email:string|null;phone:string|null;address:string|null}>();
    const duplicateEmail=Boolean(normalizedEmail)&&others.results.some(customer=>String(customer.email??"").trim().toLowerCase()===normalizedEmail);
    const duplicatePhone=Boolean(normalizedPhone)&&others.results.some(customer=>usableCustomerPhone(String(customer.phone??""))===normalizedPhone);
    // The create route already refuses duplicate name+address when both are
    // supplied. Editing must preserve this SAME identity rule, including
    // names/addresses with harmless case or surrounding-space differences.
    // Otherwise editing an old customer could silently merge two identities.
    const normalizedName=name.toLowerCase(),normalizedAddress=address.toLowerCase();
    const duplicateNameAddress=Boolean(normalizedName&&normalizedAddress)&&
      others.results.some(customer=>String(customer.name??"").trim().toLowerCase()===normalizedName&&
        String(customer.address??"").trim().toLowerCase()===normalizedAddress);
    if(duplicateEmail||duplicatePhone||duplicateNameAddress)return Response.json({error:
      duplicateEmail&&duplicatePhone?"Another customer already has this email and phone number. Nothing was changed.":
      duplicateEmail?"This email is already on another customer. Nothing was changed.":
      duplicatePhone?"This phone number is already on another customer. Nothing was changed.":
      "Another customer already has this name and service address. Nothing was changed."},
      {status:409,headers:{"Cache-Control":"no-store, private"}});

    // Reuse the identical creation predicate at the SQL WRITE boundary.
    // A second editor could claim the same email, phone or name+address
    // after our preflight; the conditional UPDATE prevents that race.
    const match=customerIdentityPredicate({name,email,phone,address});
    // A nonthrowing D1 write, including an ambiguous/zero-change ACK, does
    // NOT prove the new contact details were saved. Read back the exact row
    // separately before telling the owner that the edit succeeded.
    // If the UPDATE committed but the network acknowledgement was lost, the
    // readback can still confirm success without repeating the write.
    try {
      await env.DB.prepare(`UPDATE customers SET name=?,email=?,phone=?,address=?,lead_source=?
        WHERE id=? AND NOT EXISTS(SELECT 1 FROM customers WHERE id<>? AND ${match.sql})`)
        .bind(name,email||null,phone||null,address||null,leadSource,id,
          id,...match.values).run();
    } catch {
      // Do not automatically retry a possibly committed UPDATE.
      // A separate authoritative SELECT below decides the result.
    }
    let customer: {id:string;name:string;email:string;phone:string;address:string;leadSource:string;createdAt:string}|null;
    try {
      customer = await env.DB.prepare("SELECT id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address,COALESCE(lead_source,'Unknown') AS leadSource,created_at AS createdAt FROM customers WHERE id=? LIMIT 1")
        .bind(id).first<{id:string;name:string;email:string;phone:string;address:string;leadSource:string;createdAt:string}>();
    } catch {
      return Response.json({error:"Customer save confirmation is unavailable. Reopen this record to check before retrying.",saveUncertain:true},
        {status:503,headers:{"Cache-Control":"no-store, private"}});
    }
    if(!customer || customer.id!==id || customer.name!==name ||
      customer.email!==email || customer.phone!==phone ||
      customer.address!==address || customer.leadSource!==leadSource) {
      // If the guarded UPDATE lost a contact race, report an actionable
      // conflict instead of inviting blind retry after a possible commit.
      // If conflict inspection fails, retain the existing uncertain status.
      try{
        const conflict=await env.DB.prepare(`SELECT id FROM customers WHERE id<>?
          AND ${match.sql} LIMIT 1`)
          .bind(id,...match.values).first();
        if(conflict)return Response.json({error:"Another customer now uses this email, phone number, or name and service address. No edit was confirmed; reopen the customer record before retrying.",saveUncertain:true},
          {status:409,headers:{"Cache-Control":"no-store, private"}});
      }catch{}
      return Response.json({error:"Customer changes could not be confirmed. Reopen this record to check before retrying.",saveUncertain:true},
        {status:503,headers:{"Cache-Control":"no-store, private"}});
    }
    const customerNumber=await customerNumberForCustomer(env.DB,id,env);
    return Response.json({ customer:{...customer,customerNumber} },{headers:{"Cache-Control":"no-store, private"}});
  } catch {
    return Response.json({ error: "Customer save confirmation is uncertain. Reopen this record to check before retrying.",saveUncertain:true },
      {status:503,headers:{"Cache-Control":"no-store, private"}});
  }
}
