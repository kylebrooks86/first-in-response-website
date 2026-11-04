import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const result=await env.DB.prepare("SELECT id,type,title,body,customer_id AS customerId,estimate_id AS estimateId,read_at AS readAt,resolved_at AS resolvedAt,resolution_note AS resolutionNote,created_at AS createdAt FROM notifications ORDER BY created_at DESC LIMIT 40").all();
    const unread=result.results.filter((item)=>!item.readAt).length;
    return Response.json({notifications:result.results,unread});
  }catch{return Response.json({notifications:[],unread:0,error:"Notifications are temporarily unavailable."},{status:503});}
}

export async function PATCH(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const value=await request.json() as {id?:string;all?:boolean;resolve?:boolean;estimateId?:string;resolveOverpayment?:boolean;reconciliationHandled?:boolean;resolutionMode?:"keep"|string};
    const now=new Date().toISOString();
    if(value.all)await env.DB.prepare("UPDATE notifications SET read_at=? WHERE read_at IS NULL").bind(now).run();
    else if(value.estimateId&&value.resolveOverpayment){
      if(value.reconciliationHandled!==true)return Response.json({error:"Confirm the retained overpayment decision has been handled before resolving this billing exception."},{status:409});
      if(value.resolutionMode!=="keep")return Response.json({error:"Refunds must be processed from Payments → Refund on the original payment. This billing-exception action can only keep an intentional overpayment."},{status:409});
      const alert=await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL ORDER BY created_at ASC LIMIT 1").bind(value.estimateId).first<{id:string}>();
      if(!alert)return Response.json({error:"No open overpayment alert was found."},{status:404});
      const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(value.estimateId).first<{id:string}>();
      if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before resolving the overpayment."},{status:409});
      const billing=await env.DB.prepare(`SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents,COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents FROM estimates e WHERE e.id=?`).bind(value.estimateId).first<{paidCents:number;totalCents:number}>();
      if(!billing)return Response.json({error:"Estimate not found."},{status:404});
      const paidBefore=Math.max(0,Number(billing.paidCents)||0);
      const billedTotal=Math.max(0,Number(billing.totalCents)||0);
      if(!Number.isSafeInteger(paidBefore)||!Number.isSafeInteger(billedTotal))return Response.json({error:"Billing totals are outside FIRE's safe accounting range. Stop and review this job before reconciling the overpayment."},{status:409});
      const currentOverpaymentCents=paidBefore-billedTotal;
      if(currentOverpaymentCents<=0)return Response.json({error:"This job is no longer overpaid. Refresh the job before resolving this billing exception."},{status:409});
      const kept=await env.DB.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=?, resolution_note='kept_overpayment'
        WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL
        AND EXISTS (
          SELECT 1 FROM estimates e WHERE e.id=?
          AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
            > COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)
        )`).bind(now,now,value.estimateId,value.estimateId).run();
      if(!kept.meta.changes)return Response.json({error:"The overpayment state changed while resolving this exception. Refresh the job and verify the billing totals."},{status:409});
      const paidCents=paidBefore;
      const remaining=await env.DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL").bind(value.estimateId).first<{count:number}>();
      return Response.json({ok:true,readAt:now,resolvedAt:now,resolutionMode:value.resolutionMode,paidCents,remainingOverpaymentCount:Number(remaining?.count??0)});
    }
    else if(value.id&&value.resolve){
      const target=await env.DB.prepare("SELECT type FROM notifications WHERE id=?").bind(value.id).first<{type:string}>();
      if(!target)return Response.json({error:"Notification not found."},{status:404});
      if(target.type==="payment_overage")return Response.json({error:"Overpayment exceptions must be resolved from the job billing-exception action after the refund or retained overpayment is handled."},{status:409});
      await env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=? WHERE id=?").bind(now,now,value.id).run();
    }
    else if(value.id)await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=?").bind(now,value.id).run();
    else return Response.json({error:"Choose a notification."},{status:400});
    return Response.json({ok:true,readAt:now,resolvedAt:value.resolve?now:null});
  }catch{return Response.json({error:"Notifications could not be updated."},{status:500});}
}
