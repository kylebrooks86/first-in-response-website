import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import {readOwnerWriteObject} from "../../../lib/customer-write-request-guard.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){try{const user=await getOwnerUser();return typeof user?.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL;}catch{return false;}}
const invoiceResponse=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","vary":"Cookie","x-content-type-options":"nosniff"}});

export async function GET() {
  if (!await authorized()) return invoiceResponse({ error: "Unauthorized" },401);
  try {
    const result = await env.DB.prepare(`SELECT inv.id,inv.estimate_id AS estimateId,inv.customer_id AS customerId,e.customer_id AS estimateCustomerId,inv.status,inv.subtotal_cents AS subtotalCents,inv.discount_cents AS discountCents,inv.discount_type AS discountType,inv.discount_value AS discountValue,inv.total_cents AS totalCents,inv.due_at AS dueAt,inv.share_token AS shareToken,inv.first_viewed_at AS firstViewedAt,inv.created_at AS createdAt,c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM invoice_items ii WHERE ii.invoice_id=inv.id),'Custom service') AS service,
      COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      COALESCE((SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL),0) AS paymentOverageOpen,
      COALESCE((SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending'),0) AS pendingRefundCount
      FROM invoices inv JOIN customers c ON c.id=inv.customer_id JOIN estimates e ON e.id=inv.estimate_id ORDER BY inv.created_at DESC`).all();
    // Never treat an unsuccessful, incomplete D1 read as an empty invoice ledger.
    if((result as {success?:boolean}).success===false||!Array.isArray(result?.results))
      return invoiceResponse({error:"Invoices are temporarily unavailable."},503);
    const invoiceRows=result.results as Record<string,unknown>[];
    // An invoice belonging to a different customer than its estimate must not
    // expose either customer's billing or bearer share token.
    if(invoiceRows.some(row=>typeof row.customerId!=="string"||typeof row.estimateCustomerId!=="string"||row.customerId!==row.estimateCustomerId))
      return invoiceResponse({error:"Invoice customer associations require owner review before billing."},409);
    const invoiceFinancialsSafe=invoiceRows.every((row)=>{
      const values=[row.subtotalCents,row.discountCents,row.totalCents,row.paidCents,row.paymentOverageOpen,row.pendingRefundCount];
      return values.every((value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0);
    });
    if(!invoiceFinancialsSafe)return invoiceResponse({error:"Invoice billing totals require owner review before FIRE can safely summarize them."},409);
    const invoices=invoiceRows.map(({estimateCustomerId,...invoice})=>invoice);
    return invoiceResponse({invoices});
  } catch { return invoiceResponse({ error: "Invoices are temporarily unavailable." },503); }
}

// A successful D1 batch acknowledgement does not establish that an invoice or
// its service rows were actually persisted. Shared by initial create and
// idempotent/recovery reads so a lost acknowledgement can never invent billing.
type FinalInvoiceLine={id:string;name:string;description:string;quantity:number;unit:string;totalCents:number};
type FinalInvoiceReceipt={id:string;estimateId:string;customerId:string;status:string;subtotalCents:number;discountCents:number;discountType:string;discountValue:number;totalCents:number;dueAt:string|null;shareToken:string|null;createdAt:string;items:FinalInvoiceLine[]};
async function savedFinalInvoice(estimateId:string,expectedCustomerId:string):Promise<FinalInvoiceReceipt|null>{
  const invoice=await env.DB.prepare(`SELECT id,estimate_id AS estimateId,customer_id AS customerId,status,subtotal_cents AS subtotalCents,discount_cents AS discountCents,discount_type AS discountType,discount_value AS discountValue,total_cents AS totalCents,due_at AS dueAt,share_token AS shareToken,created_at AS createdAt,
    NOT EXISTS(SELECT 1 FROM estimates parent WHERE parent.id=invoices.estimate_id AND parent.customer_id=invoices.customer_id) AS invoiceOwnershipMismatch
    FROM invoices WHERE estimate_id=? LIMIT 1`)
    .bind(estimateId).first<Omit<FinalInvoiceReceipt,'items'> & {invoiceOwnershipMismatch:number}>();
  if(!invoice||Number(invoice.invoiceOwnershipMismatch)!==0||!invoice.id||invoice.estimateId!==estimateId||invoice.customerId!==expectedCustomerId||
    typeof invoice.shareToken!=='string'||!invoice.shareToken||
    !['draft','sent','partial','paid','overdue'].includes(invoice.status)||
    !['percent','dollar'].includes(invoice.discountType)||
    !Number.isSafeInteger(invoice.subtotalCents)||invoice.subtotalCents<0||
    !Number.isSafeInteger(invoice.discountCents)||invoice.discountCents<0||
    !Number.isSafeInteger(invoice.discountValue)||invoice.discountValue<0||
    !Number.isSafeInteger(invoice.totalCents)||invoice.totalCents<0||
    invoice.subtotalCents-invoice.discountCents!==invoice.totalCents)return null;
  const items=await env.DB.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM invoice_items WHERE invoice_id=? ORDER BY rowid ASC')
    .bind(invoice.id).all<FinalInvoiceLine>();
  if((items as {success?:boolean}).success===false||!Array.isArray(items.results)||items.results.length===0||
    items.results.some(item=>!item||typeof item.id!=='string'||!item.id||
      typeof item.name!=='string'||!item.name.trim()||
      typeof item.description!=='string'||typeof item.unit!=='string'||!item.unit||
      !Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||
      !Number.isSafeInteger(Number(item.totalCents))||Number(item.totalCents)<0)||
    new Set(items.results.map(item=>item.id)).size!==items.results.length||
    items.results.reduce((sum,item)=>sum+Number(item.totalCents),0)!==invoice.subtotalCents)return null;
  const {invoiceOwnershipMismatch:_ownershipCheck,...validInvoice}=invoice;void _ownershipCheck;
  return {...validInvoice,items:items.results};
}
const uncertainInvoiceCreate=()=>Response.json({
  error:'Invoice creation could not be confirmed. Reopen the saved job and verify its invoice before trying again.',
  saveUncertain:true
},{status:503,headers:{'Cache-Control':'no-store, private'}});

async function createInvoice(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // A completed job's final invoice should never parse an unbounded body.
    // This owner-only route only needs the estimate ID, before D1 reads/writes.
    const parsed=await readOwnerWriteObject(request,16_000);
    if(parsed.response)return parsed.response;
    const body=parsed.value as Record<string,unknown>;
    const estimateId = String(body.estimateId ?? "").trim();
    const estimate = await env.DB.prepare(`
      SELECT e.id,e.customer_id AS customerId,e.total_cents AS totalCents,e.status,
             COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents
      FROM estimates e WHERE e.id=?
    `).bind(estimateId).first<{id:string;customerId:string;totalCents:number;status:string;paidCents:number}>();
    if (!estimate) return Response.json({ error: "Estimate not found." }, { status: 404 });
    if (estimate.status !== "completed") return Response.json({ error: "Mark the job completed before creating the final invoice." }, { status: 409 });
    const prior = await env.DB.prepare("SELECT id,customer_id AS customerId,share_token AS shareToken FROM invoices WHERE estimate_id=? LIMIT 1").bind(estimateId).first<{id:string;customerId:string;shareToken:string|null}>();
    if(prior&&prior.customerId!==estimate.customerId)return Response.json({error:"The existing invoice is linked to a different customer. Stop and review this job before billing."},{status:409});
    if(prior){
      const saved=await savedFinalInvoice(estimateId,estimate.customerId);
      if(!saved||saved.id!==prior.id||saved.shareToken!==prior.shareToken)
        return Response.json({error:'The saved invoice or service lines could not be verified. Review the invoice before billing.'},{status:409,headers:{'Cache-Control':'no-store, private'}});
      return Response.json({id:saved.id,estimateId:saved.estimateId,customerId:saved.customerId,shareToken:saved.shareToken,existing:true},{headers:{'Cache-Control':'no-store, private'}});
    }
    const itemResult=await env.DB.prepare("SELECT name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC").bind(estimateId).all<{name:string;description:string;quantity:number;unit:string;totalCents:number}>();
    if((itemResult as {success?:boolean}).success===false||!Array.isArray(itemResult.results))return uncertainInvoiceCreate();
    if(!itemResult.results.length||itemResult.results.some((item)=>!item.name||!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||!Number.isSafeInteger(Number(item.totalCents))||Number(item.totalCents)<0))return Response.json({error:"This completed job contains invalid service-line data. Review the estimate before creating its final invoice."},{status:409});
    const subtotalCents=itemResult.results.reduce((sum,item)=>sum+Number(item.totalCents),0);
    const estimateTotalCents=Number(estimate.totalCents);
    const paidSnapshotCents=Number(estimate.paidCents);
    if(!Number.isSafeInteger(subtotalCents)||!Number.isSafeInteger(estimateTotalCents)||estimateTotalCents<0||!Number.isSafeInteger(paidSnapshotCents)||paidSnapshotCents<0)return Response.json({error:"This completed job contains billing totals outside FIRE's safe accounting range. Review it before creating the final invoice."},{status:409});
    if(estimateTotalCents>subtotalCents)return Response.json({error:'Saved estimate exceeds its service subtotal. Review the original quote before creating an invoice.'},{status:409});
    const discountCents=Math.max(0,subtotalCents-estimateTotalCents);
    if(!Number.isSafeInteger(discountCents))return Response.json({error:"This completed job's discount cannot be represented safely. Review it before creating the final invoice."},{status:409});
    const id = crypto.randomUUID();
    const shareToken = crypto.randomUUID().replaceAll("-", "");
    const createdAt = new Date().toISOString();
    const dueAt = null;
    const paidCents = paidSnapshotCents;
    // A zero-dollar complimentary invoice with no payment is not paid in full.
    // Final invoice status must reflect positive, actually recorded principal.
    const invoiceStatus = estimateTotalCents > 0 && paidCents >= estimateTotalCents ? "paid" : paidCents > 0 ? "partial" : "draft";
    const newItems=itemResult.results.map(item=>({
      id:crypto.randomUUID(),name:item.name,description:item.description,quantity:Number(item.quantity),unit:item.unit,totalCents:Number(item.totalCents)
    }));
    // Guard ownership/status AGAIN at the actual database transaction, not
    // only during an earlier read. If the estimate changes homeowner or is
    // reopened between SELECT and D1.batch, no invoice header or line saves.
    // A concurrent invoice for this job must also never be duplicated.
    const statements=[env.DB.prepare(`INSERT INTO invoices
      (id,estimate_id,customer_id,status,subtotal_cents,discount_cents,discount_type,discount_value,total_cents,due_at,share_token,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?
      WHERE EXISTS(SELECT 1 FROM estimates e
        WHERE e.id=? AND e.customer_id=? AND e.status='completed')
        AND NOT EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=?)`)
      .bind(id,estimateId,estimate.customerId,invoiceStatus,subtotalCents,discountCents,"dollar",discountCents,estimateTotalCents,dueAt,shareToken,createdAt,estimateId,estimate.customerId,estimateId)];
    for(const item of newItems)statements.push(env.DB.prepare(`INSERT INTO invoice_items
      (id,invoice_id,name,description,quantity,unit,total_cents)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS(
        SELECT 1 FROM invoices inv JOIN estimates e ON e.id=inv.estimate_id
        WHERE inv.id=? AND inv.estimate_id=? AND inv.customer_id=?
          AND e.customer_id=inv.customer_id AND e.status='completed')`)
      .bind(item.id,id,item.name,item.description,item.quantity,item.unit,item.totalCents,
        id,estimateId,estimate.customerId));
    try{
      const receipts=await env.DB.batch(statements);
      if(!Array.isArray(receipts)||receipts.length!==statements.length||
        receipts.some(receipt=>!receipt||(receipt as {success?:boolean}).success===false||
          (typeof receipt.meta?.changes==='number'&&receipt.meta.changes!==1)))return uncertainInvoiceCreate();
    }catch{
      // D1 can commit while the acknowledgment is lost. A unique estimate
      // invoice must be inspected, not blindly recreated or echoed.
      let raced:FinalInvoiceReceipt|null=null;
      try{raced=await savedFinalInvoice(estimateId,estimate.customerId);}catch{return uncertainInvoiceCreate();}
      if(!raced)return uncertainInvoiceCreate();
      return Response.json({id:raced.id,estimateId:raced.estimateId,customerId:raced.customerId,shareToken:raced.shareToken,existing:true},{headers:{'Cache-Control':'no-store, private'}});
    }
    let saved:FinalInvoiceReceipt|null=null;
    try{saved=await savedFinalInvoice(estimateId,estimate.customerId);}catch{return uncertainInvoiceCreate();}
    if(!saved||saved.id!==id||saved.shareToken!==shareToken||saved.status!==invoiceStatus||
      saved.subtotalCents!==subtotalCents||saved.discountCents!==discountCents||
      saved.discountType!=='dollar'||saved.discountValue!==discountCents||
      saved.totalCents!==estimateTotalCents||saved.dueAt!==dueAt||
      saved.createdAt!==createdAt||saved.items.length!==newItems.length||
      saved.items.some((item,index)=>{
        const expected=newItems[index];return item.id!==expected.id||
          item.name!==expected.name||item.description!==expected.description||
          Number(item.quantity)!==expected.quantity||item.unit!==expected.unit||
          Number(item.totalCents)!==expected.totalCents;
      }))return uncertainInvoiceCreate();
    return Response.json({...saved}, { status: 201,headers:{'Cache-Control':'no-store, private'} });
  } catch { return Response.json({ error: "Invoice create status could not be verified. Reopen the saved job before trying again.",saveUncertain:true }, { status: 503,headers:{'Cache-Control':'no-store, private'} }); }
}

// Even legacy/save-race responses contain a private billing/share bearer token.
// Keep every success, denial, D1-failure and body-guard receipt session-private.
export async function POST(request:Request){
  let response:Response;
  try{response=await createInvoice(request);}
  catch{return invoiceResponse({error:"Invoice save could not be confirmed. Review saved invoices before retrying.",saveUncertain:true},503);}
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","private, no-store");
  headers.set("Vary","Cookie");
  headers.set("X-Content-Type-Options","nosniff");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

