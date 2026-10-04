import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../owner-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
type RuntimeEnv=Cloudflare.Env&{STRIPE_SECRET_KEY?:string};
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}
type InvoiceItem={id?:string;name:string;description:string;quantity:number;unit:string;totalCents:number};

async function expireOpenCheckoutSessions(estimateId:string){
  const sessions=await env.DB.prepare("SELECT id FROM payment_checkout_sessions WHERE estimate_id=? AND status='open'").bind(estimateId).all<{id:string}>();
  if(!sessions.results.length)return {ok:true as const};
  const secret=(env as RuntimeEnv).STRIPE_SECRET_KEY;
  if(!secret)return {ok:false as const,error:"An active payment checkout must be closed before editing this invoice. Connect Stripe or wait for the checkout to finish."};
  for(const session of sessions.results){
    const headers={authorization:`Bearer ${secret}`};
    const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`,{method:"POST",headers});
    if(!response.ok){
      // A prior remote expiration can succeed even if the local status update failed.
      // Re-read Stripe before blocking invoice edits so stale local "open" tracking
      // cannot permanently lock an otherwise safe invoice revision.
      const inspect=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`,{headers});
      if(!inspect.ok)return {ok:false as const,error:"A customer payment checkout is already processing. Wait for it to finish or expire before editing the invoice."};
      const remote=await inspect.json() as {status?:string};
      if(remote.status!=="expired")return {ok:false as const,error:"A customer payment checkout is already processing. Wait for it to finish or expire before editing the invoice."};
    }
    await env.DB.prepare("UPDATE payment_checkout_sessions SET status='expired',expired_at=? WHERE id=? AND status='open'").bind(new Date().toISOString(),session.id).run();
  }
  return {ok:true as const};
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  const invoice=await env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,status,subtotal_cents AS subtotalCents,discount_cents AS discountCents,discount_type AS discountType,discount_value AS discountValue,total_cents AS totalCents,due_at AS dueAt,share_token AS shareToken,created_at AS createdAt FROM invoices WHERE id=?").bind(id).first();
  if(!invoice)return Response.json({error:"Invoice not found."},{status:404});
  const [items,revisions]=await Promise.all([
    env.DB.prepare("SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM invoice_items WHERE invoice_id=? ORDER BY rowid ASC").bind(id).all(),
    env.DB.prepare("SELECT id,subtotal_cents AS subtotalCents,discount_cents AS discountCents,discount_type AS discountType,discount_value AS discountValue,total_cents AS totalCents,due_at AS dueAt,status,items_json AS itemsJson,created_at AS createdAt FROM invoice_revisions WHERE invoice_id=? ORDER BY created_at DESC LIMIT 20").bind(id).all(),
  ]);
  const normalizedRevisions=(revisions.results??[]).map((revision)=>{
    const record=revision as Record<string,unknown>;
    let revisionItems:unknown[]=[];
    try{const parsed=JSON.parse(String(record.itemsJson??"[]"));revisionItems=Array.isArray(parsed)?parsed:[];}catch{revisionItems=[];}
    const {itemsJson:_itemsJson,...rest}=record;void _itemsJson;
    return {...rest,items:revisionItems};
  });
  return Response.json({invoice:{...invoice,items:items.results,revisions:normalizedRevisions}});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const {id}=await params;
    const body=await request.json() as Record<string,unknown>;
    const existing=await env.DB.prepare("SELECT id,estimate_id AS estimateId,status,first_viewed_at AS firstViewedAt,created_at AS createdAt FROM invoices WHERE id=?").bind(id).first<{id:string;estimateId:string;status:string;firstViewedAt:string|null;createdAt:string}>();
    if(!existing)return Response.json({error:"Invoice not found."},{status:404});
    const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(existing.estimateId).first<{id:string}>();
    if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before editing the final invoice."},{status:409});
    const items=(Array.isArray(body.items)?body.items:[]) as Record<string,unknown>[];
    const normalized:InvoiceItem[]=items.map((item)=>({id:String(item.id??"").trim()||undefined,name:String(item.name??"").trim(),description:String(item.description??"").trim().slice(0,5000),quantity:Number(item.quantity),unit:String(item.unit??"job").trim()||"job",totalCents:Math.round(Number(item.totalCents))}));
    if(!normalized.length||normalized.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0))return Response.json({error:"Every invoice service needs a name, quantity, and valid price."},{status:400});
    const subtotalCents=normalized.reduce((sum,item)=>sum+item.totalCents,0);
    if(!Number.isSafeInteger(subtotalCents))return Response.json({error:"The invoice total is too large to store safely."},{status:400});
    const discountType=String(body.discountType??"dollar")==="percent"?"percent":"dollar";
    const discountValue=Math.max(0,Math.round(Number(body.discountValue??0)));
    if(!Number.isSafeInteger(discountValue))return Response.json({error:"Enter a valid discount amount."},{status:400});
    let discountCents=0;
    if(discountType==="percent"){
      if(discountValue>5000)return Response.json({error:"Percentage discount cannot exceed 50%."},{status:400});
      discountCents=Math.round(subtotalCents*(discountValue/10000));
    }else{
      if(discountValue>subtotalCents)return Response.json({error:"Dollar discount cannot exceed the invoice subtotal."},{status:400});
      discountCents=discountValue;
    }
    const totalCents=subtotalCents>0?Math.max(15000,subtotalCents-discountCents):0;
    const appliedDiscountCents=Math.max(0,subtotalCents-totalCents);
    const paidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS paidCents FROM payments WHERE estimate_id=? AND status='paid'").bind(existing.estimateId).first<{paidCents:number}>();
    const paidCents=Number(paidRow?.paidCents||0);
    if(!Number.isSafeInteger(paidCents)||paidCents<0)return Response.json({error:"Recorded payments are outside FIRE's safe accounting range. Stop and review this job before editing the invoice."},{status:409});
    if(totalCents<paidCents)return Response.json({error:"Invoice total cannot be lower than payments already recorded. Record a refund or adjustment first."},{status:409});
    const checkoutGuard=await expireOpenCheckoutSessions(existing.estimateId);
    if(!checkoutGuard.ok)return Response.json({error:checkoutGuard.error},{status:409});
    const status=paidCents>=totalCents?"paid":paidCents>0?"partial":(existing.status==="sent"||Boolean(existing.firstViewedAt)?"sent":"draft");
    const updateDueAt=Object.prototype.hasOwnProperty.call(body,"dueAt");
    const rawDueAt=String(body.dueAt??"").trim();
    let dueAt:string|null|undefined;
    if(updateDueAt){
      if(rawDueAt==="receipt")dueAt=null;
      else if(/^\d{4}-\d{2}-\d{2}$/.test(rawDueAt)){const parsed=new Date(`${rawDueAt}T12:00:00.000Z`);if(Number.isNaN(parsed.getTime()))return Response.json({error:"Choose a valid invoice due date."},{status:400});dueAt=parsed.toISOString();}
      else return Response.json({error:"Choose a valid invoice due date."},{status:400});
    }
    const latestPaidRow=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS paidCents FROM payments WHERE estimate_id=? AND status='paid'").bind(existing.estimateId).first<{paidCents:number}>();
    const latestPaidCents=Number(latestPaidRow?.paidCents??0);
    if(!Number.isSafeInteger(latestPaidCents)||latestPaidCents<0)return Response.json({error:"Recorded payments changed outside FIRE's safe accounting range. Stop and review this job before editing the invoice."},{status:409});
    if(totalCents<latestPaidCents)return Response.json({error:"A payment changed while this invoice was being edited. Refresh the job before saving a lower invoice total."},{status:409});
    const currentItems=await env.DB.prepare("SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM invoice_items WHERE invoice_id=? ORDER BY rowid ASC").bind(id).all();
    const currentInvoice=await env.DB.prepare("SELECT subtotal_cents AS subtotalCents,discount_cents AS discountCents,discount_type AS discountType,discount_value AS discountValue,total_cents AS totalCents,due_at AS dueAt,status FROM invoices WHERE id=?").bind(id).first<Record<string,unknown>>();
    const revisionId=crypto.randomUUID();
    const revisionCreatedAt=new Date().toISOString();
    const statements=[env.DB.prepare("INSERT INTO invoice_revisions (id,invoice_id,subtotal_cents,discount_cents,discount_type,discount_value,total_cents,due_at,status,items_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(revisionId,id,Number(currentInvoice?.subtotalCents||0),Number(currentInvoice?.discountCents||0),String(currentInvoice?.discountType||"dollar"),Number(currentInvoice?.discountValue||0),Number(currentInvoice?.totalCents||0),currentInvoice?.dueAt?String(currentInvoice.dueAt):null,String(currentInvoice?.status||existing.status),JSON.stringify(currentItems.results),revisionCreatedAt),env.DB.prepare("DELETE FROM invoice_items WHERE invoice_id=?").bind(id)];
    for(const item of normalized)statements.push(env.DB.prepare("INSERT INTO invoice_items (id,invoice_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)").bind(item.id||crypto.randomUUID(),id,item.name,item.description,item.quantity,item.unit,item.totalCents));
    if(updateDueAt)statements.push(env.DB.prepare("UPDATE invoices SET subtotal_cents=?,discount_cents=?,discount_type=?,discount_value=?,total_cents=?,status=?,due_at=? WHERE id=?").bind(subtotalCents,appliedDiscountCents,discountType,discountValue,totalCents,status,dueAt,id));
    else statements.push(env.DB.prepare("UPDATE invoices SET subtotal_cents=?,discount_cents=?,discount_type=?,discount_value=?,total_cents=?,status=? WHERE id=?").bind(subtotalCents,appliedDiscountCents,discountType,discountValue,totalCents,status,id));
    await env.DB.batch(statements);
    return Response.json({invoice:{id,subtotalCents,discountCents:appliedDiscountCents,discountType,discountValue,totalCents,status,dueAt,items:normalized}});
  }catch{return Response.json({error:"We couldn't update this invoice."},{status:500});}
}
