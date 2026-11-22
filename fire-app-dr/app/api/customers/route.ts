import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import {readOwnerWriteObject} from "../../../lib/customer-write-request-guard.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
// Keep DR customer CREATE aligned with QA-master contact/duplicate identity rules.
// This predicate is used within INSERT to block concurrent duplicate saves.
function validOwnerEmail(raw:string){return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(raw);}
function validOwnerPhone(raw:string){
  if(!/^[+0-9().\s-]+$/.test(raw))return false;
  const digits=raw.replace(/\D/g,'');
  return digits.length===10||(digits.length===11&&digits.startsWith("1"));
}
const contactDigits="replace(replace(replace(replace(replace(replace(COALESCE(phone,''),' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
function customerDuplicatePredicate(input:{name:string;email:string;phone:string;address:string}){
  const email=input.email.toLowerCase(),raw=input.phone.replace(/\D/g,'');
  const phone=raw.length===11&&raw.startsWith("1")?raw.slice(1):raw;
  const name=input.name.toLowerCase(),address=input.address.toLowerCase();
  return {
    sql:"((?<>'' AND lower(trim(COALESCE(email,'')))=?) OR (?<>'' AND "+
      "(CASE WHEN length("+contactDigits+")=11 AND substr("+contactDigits+",1,1)='1' THEN substr("+contactDigits+",2) ELSE "+contactDigits+" END)=?) OR "+
      "(?<>'' AND ?<>'' AND lower(trim(name))=? AND lower(trim(COALESCE(address,'')))=?))",
    values:[email,email,phone,phone,name,address,name,address]
  };
}

// Owner directory includes contact records, financial totals, and private invoice tokens.
const customerPrivateHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const customerPrivateJson=(body:unknown,status=200)=>Response.json(body,{status,headers:customerPrivateHeaders});
function customerPrivateGuardResponse(response:Response){
  const headers=new Headers(response.headers);
  for(const [name,value] of Object.entries(customerPrivateHeaders))headers.set(name,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function authorized() {
  try {
    const user = await getOwnerUser();
    return typeof user?.email === "string" && user.email.toLowerCase() === OWNER_EMAIL;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!await authorized()) return customerPrivateJson({error:"Unauthorized"},401);
  try {
    const batch = await env.DB.batch([
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
          (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceTotalCents,
          e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
          COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
          (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceId,
          (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceShareToken,
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
          NOT EXISTS(SELECT 1 FROM estimates owner_estimate WHERE owner_estimate.id=inv.estimate_id AND owner_estimate.customer_id=inv.customer_id) AS invoiceOwnershipMismatch,
          (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=inv.estimate_id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
          (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=inv.estimate_id AND r.status='pending') AS pendingRefundCount
          FROM invoices inv ORDER BY inv.created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,created_at AS createdAt FROM customer_photos ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC`),
      env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,e.customer_id AS customerId,p.type,p.amount_cents AS amountCents,p.processing_fee_cents AS processingFeeCents,p.gross_received_cents AS grossReceivedCents,p.bundled_tip_cents AS bundledTipCents,p.processing_method AS processingMethod,p.status,p.provider_id AS reference,p.created_at AS createdAt,
          CASE WHEN p.amount_cents>0 THEN COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status='succeeded'),0) ELSE 0 END AS refundedCents,
          CASE WHEN p.amount_cents>0 THEN MAX(0,p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)) ELSE 0 END AS refundableCents,
          CASE WHEN p.type IN ('deposit','balance','Tip') AND p.provider_id LIKE 'cs_%' THEN 1 ELSE 0 END AS stripePayment
          FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE p.status='paid' ORDER BY p.created_at DESC`),
      env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items ORDER BY rowid ASC`),
    ]);
    // A nonthrowing unsuccessful or incomplete D1 batch is NOT proof that
    // an owner's customers, invoices or payment history are empty.
    if (!Array.isArray(batch) || batch.length !== 8 ||
        batch.some(entry => !entry || (entry as {success?:boolean}).success === false || !Array.isArray(entry.results)))
      return customerPrivateJson({error:"Customer records are temporarily unavailable."},503);
    const [customers, estimates, notes, invoices, photos, messages, payments, estimateItems] = batch;
    if ((invoices.results as Record<string,unknown>[]).some(row => Number(row.invoiceOwnershipMismatch) !== 0))
      return customerPrivateJson({error:"An invoice is linked to a different customer than its estimate. Reconcile invoice ownership before using customer billing."},409);
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
    if(!customerFinancialsSafe||!estimateFinancialsSafe)return customerPrivateJson({error:"Customer billing totals require owner review before FIRE can safely summarize them."},409);
    const grouped=new Map<string,Record<string,unknown>[]>();
    for(const raw of estimateItems.results as Record<string,unknown>[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};const key=String(raw.estimateId);const group=grouped.get(key);if(group)group.push(row);else grouped.set(key,[row]);}
    const mappedEstimates=(estimates.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,items,service:items.map((item)=>String(item.name)).join(", ")||"Custom service",serviceDescription:String(items[0]?.description??"")};});
    return customerPrivateJson({ customers: customers.results, estimates: mappedEstimates, notes: notes.results, invoices: (invoices.results as Record<string,unknown>[]).map(({invoiceOwnershipMismatch:_checked,...row})=>{void _checked;return row;}), photos: photos.results, messages: messages.results, payments:payments.results },200);
  } catch {
    return customerPrivateJson({error:"Customer records are temporarily unavailable."},503);
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return customerPrivateJson({ error: "Unauthorized" },401);
  // The owner may retry after a D1 ACK is lost. A caller-supplied UUID is the
  // permanent operation identity: never silently turn that retry into a new row.
  const parsed=await readOwnerWriteObject(request,64_000);
  if(parsed.response)return customerPrivateGuardResponse(parsed.response);
  const body=parsed.value as Record<string, unknown>;
  const name=String(body.name??"").trim();
  const email=String(body.email??"").trim();
  const phone=String(body.phone??"").trim();
  const address=String(body.address??"").trim();
  const leadSource=String(body.leadSource??"Unknown").trim()||"Unknown";
  if(!name)return customerPrivateJson({error:"Customer name is required."},400);
  if(body.requestId!==undefined&&
    (typeof body.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)))
    return customerPrivateJson({error:"Invalid customer save identifier."},400);
  if(email&&!validOwnerEmail(email))return customerPrivateJson({error:"Enter a valid email address or leave it blank."},400);
  if(phone&&!validOwnerPhone(phone))return customerPrivateJson({error:"Enter a valid 10-digit U.S. phone number or leave it blank."},400);
  const identity=customerDuplicatePredicate({name,email,phone,address});
  const id=typeof body.requestId==="string"?body.requestId:crypto.randomUUID();
  type SavedCustomer={id:string;name:string;email:string;phone:string;address:string;leadSource:string;createdAt:string};
  const readReceipt=()=>env.DB.prepare(
    "SELECT id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address,COALESCE(lead_source,'Unknown') AS leadSource,created_at AS createdAt FROM customers WHERE id=? LIMIT 1"
  ).bind(id).first<SavedCustomer>();
  const matches=(saved:SavedCustomer)=>saved.id===id&&saved.name===name&&saved.email===email&&
    saved.phone===phone&&saved.address===address&&saved.leadSource===leadSource;
  const customer=(saved:SavedCustomer)=>({...saved,estimateCount:0,estimateTotal:0,paidTotal:0});
  try {
    if(body.requestId!==undefined){
      const previous=await readReceipt();
      if(previous){
        if(!matches(previous))return customerPrivateJson({error:"This save identifier belongs to different customer details. No saved record was overwritten."},409);
        return customerPrivateJson({requestId:id,duplicate:true,customer:customer(previous)},200);
      }
    }
    const createdAt=new Date().toISOString();
    let acknowledged=false;
    try {
      const result=await env.DB.prepare(`INSERT INTO customers (id,name,email,phone,address,lead_source,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE id=? OR ${identity.sql})`)
        .bind(id,name,email||null,phone||null,address||null,leadSource,createdAt,id,...identity.values).run();
      acknowledged=(result as {success?:boolean}|null)?.success!==false;
    }catch{
      // A failed network acknowledgement is not proof that INSERT rolled back.
      // Read the same operation ID, never issue a second INSERT in this call.
    }
    const saved=await readReceipt();
    if(!saved){
      // A duplicate prevented by the atomic INSERT must not appear as a
      // successful creation. Verify the existing identity, or fail uncertain.
      const duplicate=await env.DB.prepare(`SELECT id FROM customers WHERE ${identity.sql} LIMIT 1`).bind(...identity.values).first<{id:string}>();
      if(duplicate)return customerPrivateJson({error:"A matching customer already exists. Search and select the saved record instead of creating a duplicate."},409);
    }
    if(saved){
      if(!matches(saved))return customerPrivateJson({error:"This save identifier belongs to different customer details. No saved record was overwritten."},409);
      return customerPrivateJson({requestId:id,duplicate:!acknowledged,
        recoveredAfterUncertainSave:!acknowledged,customer:customer(saved)},acknowledged?201:200);
    }
  } catch {
    // D1 may have committed before a read or transport error.
  }
  return customerPrivateJson({error:"Customer save confirmation is uncertain. Check this same request ID before creating another customer.",
    saveUncertain:true,requestId:id},503);
}
