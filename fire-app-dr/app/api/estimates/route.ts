import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getOwnerUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

type ItemRow={id:string;estimateId:string;name:string;description:string;quantity:number;unit:string;totalCents:number};

export async function GET() {
  if(!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [estimateResult,itemResult]=await env.DB.batch([
      env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.total_cents AS totalCents,e.deposit_cents AS depositCents,
               e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,c.name AS customer,c.email,c.phone,c.address,
               COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
               (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
               (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
               (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
               (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
               (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text','email')) AS lastReviewRequestAt,
               (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
      (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email')) AS lastRebookMessageAt
        FROM estimates e JOIN customers c ON c.id = e.customer_id
        ORDER BY e.created_at DESC LIMIT 100
      `),
      env.DB.prepare(`SELECT i.id,i.estimate_id AS estimateId,i.name,i.description,i.quantity,i.unit,i.total_cents AS totalCents FROM estimate_items i JOIN estimates e ON e.id=i.estimate_id ORDER BY e.created_at DESC,i.rowid ASC`),
    ]);
    const grouped=new Map<string,ItemRow[]>();
    for(const raw of itemResult.results as unknown as ItemRow[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};grouped.set(row.estimateId,[...(grouped.get(row.estimateId)??[]),row]);}
    const estimates=(estimateResult.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,items,service:items.map((item)=>item.name).join(", ")||"Custom service",serviceDescription:items[0]?.description??""};});
    return Response.json({ estimates });
  } catch {
    return Response.json({ estimates: [], message: "Estimates are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if(!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const existingCustomerId = String(body.customerId ?? "").trim();
    const customer = String(body.customer ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const rawItems=Array.isArray(body.items)?body.items as Record<string,unknown>[]:[];
    const items=rawItems.map((item)=>({name:String(item.name??"").trim(),description:String(item.description??"").trim().slice(0,5000),quantity:Number(item.quantity),unit:String(item.unit??"job").trim()||"job",totalCents:Math.round(Number(item.totalCents))}));
    if(!customer||!items.length) return Response.json({error:"Customer and at least one service are required."},{status:400});
    if(items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0)) return Response.json({error:"Every service needs a name, quantity, and valid price."},{status:400});
    const subtotal=items.reduce((sum,item)=>sum+item.totalCents,0);
    if(!Number.isSafeInteger(subtotal))return Response.json({error:"The estimate total is too large to store safely."},{status:400});
    const appreciationDiscount=body.appreciationDiscount===true?1:0;
    const additionalDiscountType=String(body.additionalDiscountType??"percent")==="dollar"?"dollar":"percent";
    const additionalDiscountValue=Math.max(0,Math.round(Number(body.additionalDiscountValue??0)));
    if(!Number.isSafeInteger(additionalDiscountValue))return Response.json({error:"Enter a valid discount amount."},{status:400});
    let additionalDiscountCents=0;
    if(additionalDiscountType==="percent"){
      const maxBasisPoints=(appreciationDiscount?45:50)*100;
      if(additionalDiscountValue>maxBasisPoints)return Response.json({error:`Additional percentage discount cannot exceed ${maxBasisPoints/100}%.`},{status:400});
      additionalDiscountCents=Math.round(subtotal*(additionalDiscountValue/10000));
    } else {
      if(additionalDiscountValue>subtotal)return Response.json({error:"Dollar discount cannot exceed the service subtotal."},{status:400});
      additionalDiscountCents=additionalDiscountValue;
    }
    const appreciationCents=appreciationDiscount?Math.round(subtotal*0.05):0;
    const requestedDiscount=Math.min(subtotal,appreciationCents+additionalDiscountCents);
    const total=Math.max(15000,subtotal-requestedDiscount);
    const appliedDiscount=Math.max(0,subtotal-total);
    const deposit=Math.round(total/2);
    const customerId=existingCustomerId||crypto.randomUUID();
    const estimateId=crypto.randomUUID();const shareToken=crypto.randomUUID().replaceAll("-","");const now=new Date().toISOString();
    const statements=[];
    if(existingCustomerId){const existing=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(existingCustomerId).first();if(!existing)return Response.json({error:"That customer record could not be found."},{status:404});}
    else statements.push(env.DB.prepare("INSERT INTO customers (id,name,email,phone,address,created_at) VALUES (?,?,?,?,?,?)").bind(customerId,customer,email||null,phone||null,address||null,now));
    statements.push(env.DB.prepare("INSERT INTO estimates (id,customer_id,status,subtotal_cents,discount_cents,appreciation_discount,additional_discount_type,additional_discount_value,total_cents,deposit_cents,share_token,created_at) VALUES (?,?,'draft',?,?,?,?,?,?,?,?,?)").bind(estimateId,customerId,subtotal,appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,total,deposit,shareToken,now));
    for(const item of items)statements.push(env.DB.prepare("INSERT INTO estimate_items (id,estimate_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),estimateId,item.name,item.description,item.quantity,item.unit,item.totalCents));
    await env.DB.batch(statements);
    return Response.json({id:estimateId,customerId,shareToken,customerPath:`/estimate/${shareToken}`,subtotalCents:subtotal,discountCents:appliedDiscount,totalCents:total,depositCents:deposit,appreciationDiscount,additionalDiscountType,additionalDiscountValue},{status:201});
  } catch {
    return Response.json({ error: "We couldn't save this estimate. Please try again." }, { status: 500 });
  }
}
