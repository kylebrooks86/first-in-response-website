import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

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
    const value=await request.json() as {id?:string;all?:boolean;resolve?:boolean;estimateId?:string;resolveOverpayment?:boolean;reconciliationHandled?:boolean;resolutionMode?:"refund"|"keep";refundAmountCents?:number};
    const now=new Date().toISOString();
    if(value.all)await env.DB.prepare("UPDATE notifications SET read_at=? WHERE read_at IS NULL").bind(now).run();
    else if(value.estimateId&&value.resolveOverpayment){
      if(value.reconciliationHandled!==true)return Response.json({error:"Confirm the refund or retained overpayment has been handled before resolving this billing exception."},{status:409});
      if(value.resolutionMode!=="refund"&&value.resolutionMode!=="keep")return Response.json({error:"Choose whether the overpayment was refunded or intentionally kept as an overpayment."},{status:400});
      const alert=await env.DB.prepare("SELECT id FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL ORDER BY created_at ASC LIMIT 1").bind(value.estimateId).first<{id:string}>();
      if(!alert)return Response.json({error:"No open overpayment alert was found."},{status:404});
      const billing=await env.DB.prepare(`SELECT COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents,COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents FROM estimates e WHERE e.id=?`).bind(value.estimateId).first<{paidCents:number;totalCents:number}>();
      if(!billing)return Response.json({error:"Estimate not found."},{status:404});
      const paidBefore=Math.max(0,Number(billing.paidCents)||0);
      const billedTotal=Math.max(0,Number(billing.totalCents)||0);
      if(!Number.isSafeInteger(paidBefore)||!Number.isSafeInteger(billedTotal))return Response.json({error:"Billing totals are outside FIRE's safe accounting range. Stop and review this job before reconciling the overpayment."},{status:409});
      const currentOverpaymentCents=paidBefore-billedTotal;
      if(currentOverpaymentCents<=0)return Response.json({error:"This job is no longer overpaid. Refresh the job before resolving this billing exception."},{status:409});
      let paidCents:number|undefined;
      if(value.resolutionMode==="refund"){
        const refundAmountCents=Math.round(Number(value.refundAmountCents)||0);
        if(!Number.isSafeInteger(refundAmountCents)||refundAmountCents<=0)return Response.json({error:"Enter a valid actual refund amount before resolving this billing exception."},{status:400});
        if(refundAmountCents>paidBefore)return Response.json({error:"Refund amount cannot exceed payments currently recorded on this job."},{status:400});
        paidCents=paidBefore-refundAmountCents;
        const totalCents=billedTotal;
        if(paidCents>totalCents)return Response.json({error:`That refund would leave ${paidCents-totalCents} cents of the overpayment unresolved. Enter the full refund needed to clear the excess, or intentionally keep the remaining amount as an overpayment.`},{status:409});
        const adjustmentId=crypto.randomUUID();
        const providerId=`refund-adjustment:${alert.id}`;
        await env.DB.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at) SELECT ?,?,'Refund adjustment',?,'paid',?,? WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)").bind(adjustmentId,value.estimateId,-refundAmountCents,providerId,now,providerId).run();
        const persistedRefund=await env.DB.prepare("SELECT amount_cents AS amountCents FROM payments WHERE provider_id=? LIMIT 1").bind(providerId).first<{amountCents:number}>();
        if(Number(persistedRefund?.amountCents)!==-refundAmountCents)return Response.json({error:"A different refund reconciliation was recorded first. Refresh the job before resolving this billing exception again."},{status:409});
        const refreshedPaid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS paidCents FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(value.estimateId).first<{paidCents:number}>();
        paidCents=Number(refreshedPaid?.paidCents??0);
        await env.DB.batch([
          env.DB.prepare(`UPDATE invoices SET status=CASE
            WHEN ?>=total_cents THEN 'paid'
            WHEN ?>0 THEN 'partial'
            WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
            ELSE 'draft' END WHERE estimate_id=?`).bind(paidCents,paidCents,value.estimateId),
          env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=?, resolution_note=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL AND EXISTS (SELECT 1 FROM payments WHERE provider_id=? AND amount_cents=?)").bind(now,now,`refund:${refundAmountCents}`,value.estimateId,providerId,-refundAmountCents),
        ]);
      }else{
        const kept=await env.DB.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=?, resolution_note='kept_overpayment'
          WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL
          AND EXISTS (
            SELECT 1 FROM estimates e WHERE e.id=?
            AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
              > COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)
          )`).bind(now,now,value.estimateId,value.estimateId).run();
        if(!kept.meta.changes)return Response.json({error:"The overpayment state changed while resolving this exception. Refresh the job and verify the billing totals."},{status:409});
      }
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
