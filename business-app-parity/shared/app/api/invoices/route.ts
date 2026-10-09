import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function GET() {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await env.DB.prepare(`SELECT e.status AS estimateStatus,e.deposit_cents AS depositCents,inv.id,inv.estimate_id AS estimateId,inv.customer_id AS customerId,inv.status,inv.subtotal_cents AS subtotalCents,inv.discount_cents AS discountCents,inv.discount_type AS discountType,inv.discount_value AS discountValue,inv.total_cents AS totalCents,inv.due_at AS dueAt,inv.share_token AS shareToken,inv.first_viewed_at AS firstViewedAt,inv.created_at AS createdAt,c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM invoice_items ii WHERE ii.invoice_id=inv.id),'Custom service') AS service,
      COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      COALESCE((SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL),0) AS paymentOverageOpen
      FROM invoices inv JOIN customers c ON c.id=inv.customer_id JOIN estimates e ON e.id=inv.estimate_id ORDER BY inv.created_at DESC`).all();
    return Response.json({ invoices: result.results });
  } catch { return Response.json({ error: "Invoices are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
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
    if (prior) return Response.json({ id: prior.id, shareToken: prior.shareToken, existing: true });
    const itemResult=await env.DB.prepare("SELECT name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC").bind(estimateId).all<{name:string;description:string;quantity:number;unit:string;totalCents:number}>();
    if(!itemResult.results.length||itemResult.results.some((item)=>!item.name||!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||!Number.isSafeInteger(Number(item.totalCents))||Number(item.totalCents)<0))return Response.json({error:"This completed job contains invalid service-line data. Review the estimate before creating its final invoice."},{status:409});
    const subtotalCents=itemResult.results.reduce((sum,item)=>sum+Number(item.totalCents),0);
    const estimateTotalCents=Number(estimate.totalCents);
    const paidSnapshotCents=Number(estimate.paidCents);
    if(!Number.isSafeInteger(subtotalCents)||!Number.isSafeInteger(estimateTotalCents)||estimateTotalCents<0||!Number.isSafeInteger(paidSnapshotCents)||paidSnapshotCents<0)return Response.json({error:"This completed job contains billing totals outside FIRE's safe accounting range. Review it before creating the final invoice."},{status:409});
    const discountCents=Math.max(0,subtotalCents-estimateTotalCents);
    if(!Number.isSafeInteger(discountCents))return Response.json({error:"This completed job's discount cannot be represented safely. Review it before creating the final invoice."},{status:409});
    const id = crypto.randomUUID();
    const shareToken = crypto.randomUUID().replaceAll("-", "");
    const createdAt = new Date().toISOString();
    const dueAt = null;
    const paidCents = paidSnapshotCents;
    const invoiceStatus = paidCents >= estimateTotalCents ? "paid" : paidCents > 0 ? "partial" : "draft";
    const statements=[env.DB.prepare("INSERT INTO invoices (id,estimate_id,customer_id,status,subtotal_cents,discount_cents,discount_type,discount_value,total_cents,due_at,share_token,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, estimateId, estimate.customerId, invoiceStatus, subtotalCents, discountCents, "dollar", discountCents, estimateTotalCents, dueAt, shareToken, createdAt)];
    for(const item of itemResult.results)statements.push(env.DB.prepare("INSERT INTO invoice_items (id,invoice_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,item.name,item.description,Number(item.quantity),item.unit,Number(item.totalCents)));
    try{
      await env.DB.batch(statements);
    }catch{
      const raced=await env.DB.prepare("SELECT id,customer_id AS customerId,share_token AS shareToken FROM invoices WHERE estimate_id=? LIMIT 1").bind(estimateId).first<{id:string;customerId:string;shareToken:string|null}>();
      if(raced&&raced.customerId!==estimate.customerId)return Response.json({error:"The concurrently created invoice is linked to a different customer. Stop and review this job before billing."},{status:409});
      if(raced)return Response.json({id:raced.id,shareToken:raced.shareToken,existing:true});
      throw new Error("invoice-create-failed");
    }
    return Response.json({ id, estimateId, customerId: estimate.customerId, status: invoiceStatus, subtotalCents, discountCents, discountType:"dollar", discountValue:discountCents, totalCents: estimateTotalCents, dueAt, shareToken, createdAt }, { status: 201 });
  } catch { return Response.json({ error: "We couldn't create this invoice." }, { status: 500 }); }
}
