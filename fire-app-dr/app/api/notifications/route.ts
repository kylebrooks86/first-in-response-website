import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    // Count ALL unread records before limiting the visible activity page.
    // A busy owner must not see a false 40-item maximum on the badge.
    const result=await env.DB.prepare("SELECT COUNT(CASE WHEN n.read_at IS NULL THEN 1 END) OVER() AS unreadTotal,n.id,n.type,n.title,n.body,n.customer_id AS customerId,n.estimate_id AS estimateId,n.read_at AS readAt,n.resolved_at AS resolvedAt,n.resolution_note AS resolutionNote,n.created_at AS createdAt FROM notifications n ORDER BY n.created_at DESC,n.id DESC LIMIT 40").all();
    const unread=result.results.length?Number(result.results[0].unreadTotal):0;
    if(!Number.isSafeInteger(unread)||unread<0)throw Error("Invalid unread count");
    const notifications=result.results.map(({unreadTotal,...item})=>item);
    return Response.json({notifications,unread},{headers:{"Cache-Control":"no-store, private"}});
  }catch{return Response.json({notifications:[],unread:0,error:"Notifications are temporarily unavailable."},{status:503});}
}

export async function PATCH(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const value=await request.json() as {id?:string;all?:boolean;resolve?:boolean;estimateId?:string;resolveOverpayment?:boolean;reconciliationHandled?:boolean;resolutionMode?:"keep"|string};
    const now=new Date().toISOString();
    if(value.all!==undefined&&value.all!==true)return Response.json({error:"Invalid mark-all request."},{status:400});
    if(value.all){
      if(Object.keys(value).some(key=>key!=="all"))return Response.json({error:"Choose one notification action."},{status:400});
      const write=await env.DB.prepare("UPDATE notifications SET read_at=? WHERE read_at IS NULL").bind(now).run();
      if((write as {success?:boolean}).success===false||!Number.isSafeInteger(write.meta?.changes)||write.meta.changes<0)throw Error("Read update not confirmed");
      const saved=await env.DB.prepare("SELECT COUNT(*) AS unread FROM notifications WHERE read_at IS NULL").first<{unread:number}>();
      if(!saved||!Number.isSafeInteger(saved.unread)||saved.unread<0)throw Error("Read count not confirmed");
      return Response.json({ok:true,readAt:now,resolvedAt:null,unread:saved.unread},{headers:{"Cache-Control":"no-store, private"}});
    }
    else if(value.estimateId&&value.resolveOverpayment){
      if(value.reconciliationHandled!==true)return Response.json({error:"Confirm the retained overpayment decision has been handled before resolving this billing exception."},{status:409});
      if(value.resolutionMode!=="keep")return Response.json({error:"Refunds must be processed from Payments → Refund on the original payment. This billing-exception action can only keep an intentional overpayment."},{status:409});
      const alert=await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL ORDER BY created_at ASC LIMIT 1").bind(value.estimateId).first<{id:string}>();
      if(!alert)return Response.json({error:"No open overpayment alert was found."},{status:404});
      const pendingRefund=await env.DB.prepare("SELECT id FROM payment_refunds WHERE estimate_id=? AND status='pending' LIMIT 1").bind(value.estimateId).first<{id:string}>();
      if(pendingRefund)return Response.json({error:"A refund is currently processing for this job. Wait for it to finish before resolving the overpayment."},{status:409});
      const billing=await env.DB.prepare(`SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents) AS totalCents,
        (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id) AS invoiceOwnershipMismatch
        FROM estimates e WHERE e.id=?`).bind(value.estimateId).first<{paidCents:number;totalCents:number;invoiceOwnershipMismatch:number}>();
      if(!billing)return Response.json({error:"Estimate not found."},{status:404});
      if(Number(billing.invoiceOwnershipMismatch)!==0)return Response.json({error:"This invoice belongs to another customer. Reconcile ownership before resolving this overpayment."},{status:409});
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
            > COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents)
          AND NOT EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id)
          AND NOT EXISTS(SELECT 1 FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending')
        )`).bind(now,now,value.estimateId,value.estimateId).run();
      if((kept as {success?:boolean}).success===false||!Number.isSafeInteger(kept.meta?.changes)||kept.meta.changes<0)
        return Response.json({error:"Overpayment decision was not confirmed. Reopen the job before retrying.",saveUncertain:true},{status:503,headers:{"Cache-Control":"no-store, private"}});
      if(!kept.meta.changes)return Response.json({error:"A refund or billing status changed during reconciliation. Refresh the job before another attempt."},{status:409});
      // A 200 transport ACK or changes count is not final evidence of a
      // durable financial alert resolution. Recheck the chosen exact alert,
      // ownership and pending refunds independently before success.
      const [savedAlert,remaining,ownershipAfter,pendingAfter]=await env.DB.batch([
        env.DB.prepare("SELECT read_at AS readAt,resolved_at AS resolvedAt,resolution_note AS resolutionNote FROM notifications WHERE id=? AND estimate_id=? AND type='payment_overage'").bind(alert.id,value.estimateId),
        env.DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL").bind(value.estimateId),
        env.DB.prepare("SELECT COUNT(*) AS count FROM invoices inv JOIN estimates e ON e.id=inv.estimate_id WHERE e.id=? AND inv.customer_id IS NOT e.customer_id").bind(value.estimateId),
        env.DB.prepare("SELECT COUNT(*) AS count FROM payment_refunds WHERE estimate_id=? AND status='pending'").bind(value.estimateId),
      ]);
      const saved=savedAlert.results[0] as {readAt:string|null;resolvedAt:string|null;resolutionNote:string|null}|undefined;
      const stillOpen=Number((remaining.results[0] as {count:number}|undefined)?.count);
      const wrongOwner=Number((ownershipAfter.results[0] as {count:number}|undefined)?.count);
      const refundPending=Number((pendingAfter.results[0] as {count:number}|undefined)?.count);
      if(!saved?.readAt||!saved.resolvedAt||saved.resolutionNote!=='kept_overpayment'||
         !Number.isSafeInteger(stillOpen)||stillOpen<0||
         !Number.isSafeInteger(wrongOwner)||wrongOwner!==0||
         !Number.isSafeInteger(refundPending)||refundPending!==0)
        return Response.json({error:"The saved overpayment decision could not be confirmed. Reopen the job and review the refund ledger.",saveUncertain:true},{status:503,headers:{"Cache-Control":"no-store, private"}});
      return Response.json({ok:true,readAt:saved.readAt,resolvedAt:saved.resolvedAt,resolutionMode:value.resolutionMode,paidCents:paidBefore,remainingOverpaymentCount:stillOpen},{headers:{"Cache-Control":"no-store, private"}});
    }
    else if(value.id&&value.resolve){
      const target=await env.DB.prepare("SELECT type FROM notifications WHERE id=?").bind(value.id).first<{type:string}>();
      if(!target)return Response.json({error:"Notification not found."},{status:404});
      if(target.type==="payment_overage")return Response.json({error:"Overpayment exceptions must be resolved from the job billing-exception action after the refund or retained overpayment is handled."},{status:409});
      const saved=await env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=COALESCE(resolved_at,?) WHERE id=? AND type<>'payment_overage' RETURNING read_at AS readAt,resolved_at AS resolvedAt")
        .bind(now,now,value.id).first<{readAt:string|null;resolvedAt:string|null}>();
      if(!saved?.readAt||!saved.resolvedAt)
        return Response.json({error:"Notification resolution was not confirmed. Refresh before retrying.",saveUncertain:true},{status:503,headers:{"Cache-Control":"no-store, private"}});
      return Response.json({ok:true,readAt:saved.readAt,resolvedAt:saved.resolvedAt},{headers:{"Cache-Control":"no-store, private"}});
    }
    else if(value.id){
      const saved=await env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? RETURNING read_at AS readAt")
        .bind(now,value.id).first<{readAt:string|null}>();
      if(!saved)return Response.json({error:"Notification not found. Refresh the list."},{status:404});
      if(!saved.readAt)return Response.json({error:"Notification read status was not confirmed. Refresh before retrying.",saveUncertain:true},{status:503,headers:{"Cache-Control":"no-store, private"}});
      return Response.json({ok:true,readAt:saved.readAt,resolvedAt:null},{headers:{"Cache-Control":"no-store, private"}});
    }
    else return Response.json({error:"Choose a notification."},{status:400});
  }catch{return Response.json({error:"Notifications could not be updated."},{status:500});}
}
