import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../owner-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
type RuntimeEnv=Cloudflare.Env & { STRIPE_SECRET_KEY?:string };
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}
const currency=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);

type RefundRow={
  id:string;paymentId:string;estimateId:string;amountCents:number;mode:string;status:string;providerRefundId:string|null;
  originalAmountCents:number;paymentType:string;providerId:string|null;customerId:string;customer:string;
};

async function refundRow(id:string){
  return env.DB.prepare(`SELECT r.id,r.payment_id AS paymentId,r.estimate_id AS estimateId,r.amount_cents AS amountCents,r.mode,r.status,
    r.provider_refund_id AS providerRefundId,p.amount_cents AS originalAmountCents,p.type AS paymentType,p.provider_id AS providerId,
    e.customer_id AS customerId,c.name AS customer
    FROM payment_refunds r
    JOIN payments p ON p.id=r.payment_id
    JOIN estimates e ON e.id=r.estimate_id
    JOIN customers c ON c.id=e.customer_id
    WHERE r.id=? LIMIT 1`).bind(id).first<RefundRow>();
}

async function finalizeRefund(id:string,providerRefundId:string|null){
  const row=await refundRow(id);
  if(!row)return {ok:false,status:404,error:"Refund request not found."};
  if(row.status==="succeeded"){
    const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.estimateId).first<{amount:number}>();
    const paidCents=Number(paid?.amount??0);
    if(!Number.isSafeInteger(paidCents)||paidCents<0)return {ok:false,status:409,error:"This completed refund has a payment total outside FIRE's safe accounting range."};
    return {ok:true,status:200,paidCents,duplicate:true};
  }
  if(row.status!=="pending")return {ok:false,status:409,error:"This refund request is no longer pending."};
  const amount=Number(row.amountCents);
  if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false,status:409,error:"Refund request amount is invalid."};

  const now=new Date().toISOString();
  const refundPaymentProvider=`refund:${row.paymentId}:${row.id}`;
  const statements=[
    env.DB.prepare("UPDATE payment_refunds SET status='succeeded',provider_refund_id=COALESCE(?,provider_refund_id),completed_at=? WHERE id=? AND status='pending'")
      .bind(providerRefundId,now,row.id),
    env.DB.prepare(`INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at)
      SELECT ?,?,CASE WHEN ?='Tip' THEN 'Tip Refund' ELSE 'Refund' END,?,'paid',?,?
      WHERE EXISTS (SELECT 1 FROM payment_refunds r WHERE r.id=? AND r.status='succeeded')
        AND NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)`)
      .bind(crypto.randomUUID(),row.estimateId,row.paymentType,-amount,refundPaymentProvider,now,row.id,refundPaymentProvider),
    env.DB.prepare(`UPDATE invoices SET status=CASE
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>=total_cents THEN 'paid'
      WHEN COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)>0 THEN 'partial'
      WHEN first_viewed_at IS NOT NULL OR status='sent' THEN 'sent'
      ELSE 'draft' END WHERE estimate_id=?`).bind(row.estimateId,row.estimateId,row.estimateId),
    env.DB.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,?),resolved_at=?,resolution_note=?
      WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL
      AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
        <= COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=? LIMIT 1),(SELECT e.total_cents FROM estimates e WHERE e.id=?))`)
      .bind(now,now,`refund:${amount}`,row.estimateId,row.estimateId,row.estimateId,row.estimateId),
    env.DB.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(`refund-note:${row.id}`,row.paymentType==="Tip"?"tip_refunded":"payment_refunded",row.paymentType==="Tip"?`Tip refund recorded for ${row.customer}`:`Refund recorded for ${row.customer}`,`${currency(amount)} ${row.paymentType==="Tip"?"tip refund":"refund"} recorded for this job.`,row.customerId,row.estimateId,now),
  ];
  await env.DB.batch(statements);
  const [verifiedRequest,verifiedLedger]=await Promise.all([
    env.DB.prepare("SELECT status,amount_cents AS amountCents FROM payment_refunds WHERE id=?").bind(row.id).first<{status:string;amountCents:number}>(),
    env.DB.prepare("SELECT amount_cents AS amountCents FROM payments WHERE provider_id=? LIMIT 1").bind(refundPaymentProvider).first<{amountCents:number}>(),
  ]);
  if(verifiedRequest?.status!=="succeeded"||Number(verifiedRequest.amountCents)!==amount||Number(verifiedLedger?.amountCents)!==-amount)
    return {ok:false,status:409,error:"Refund confirmation did not converge on one verified ledger entry. Refresh payment history before trying anything else."};
  const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.estimateId).first<{amount:number}>();
  const paidCents=Number(paid?.amount??0);
  if(!Number.isSafeInteger(paidCents)||paidCents<0)return {ok:false,status:409,error:"Refund was recorded, but the refreshed payment total requires owner review."};
  return {ok:true,status:200,paidCents,duplicate:false};
}

async function stripeGet(path:string,secret:string){
  return fetch(`https://api.stripe.com/v1/${path}`,{headers:{authorization:`Bearer ${secret}`}});
}

export async function POST(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const value=await request.json() as Record<string,unknown>;
    const paymentId=String(value.paymentId??"").trim();
    const requestId=String(value.requestId??"").trim();
    const amountCents=Math.round(Number(value.amountCents)||0);
    const externalRefundConfirmed=value.externalRefundConfirmed===true;
    const note=String(value.note??"").trim().slice(0,1000)||null;
    if(!paymentId||!requestId||requestId.length>120||!Number.isSafeInteger(amountCents)||amountCents<=0)
      return Response.json({error:"Choose a payment and enter a valid refund amount."},{status:400});

    const payment=await env.DB.prepare(`SELECT p.id,p.estimate_id AS estimateId,p.type,p.amount_cents AS amountCents,p.status,p.provider_id AS providerId,
      e.customer_id AS customerId,c.name AS customer
      FROM payments p JOIN estimates e ON e.id=p.estimate_id JOIN customers c ON c.id=e.customer_id WHERE p.id=? LIMIT 1`)
      .bind(paymentId).first<{id:string;estimateId:string;type:string;amountCents:number;status:string;providerId:string|null;customerId:string;customer:string}>();
    if(!payment)return Response.json({error:"Payment not found."},{status:404});
    const originalAmount=Number(payment.amountCents);
    if(payment.status!=="paid"||!Number.isSafeInteger(originalAmount)||originalAmount<=0)
      return Response.json({error:"Only a positive recorded payment can be refunded."},{status:409});

    const stripePayment=["deposit","balance","Tip"].includes(payment.type)&&Boolean(payment.providerId?.startsWith("cs_"));
    const mode=stripePayment?"stripe":"manual";

    const existing=await env.DB.prepare("SELECT payment_id AS paymentId,amount_cents AS amountCents,mode,status,provider_refund_id AS providerRefundId FROM payment_refunds WHERE id=? LIMIT 1")
      .bind(requestId).first<{paymentId:string;amountCents:number;mode:string;status:string;providerRefundId:string|null}>();
    if(existing&&(existing.paymentId!==paymentId||Number(existing.amountCents)!==amountCents||existing.mode!==mode))
      return Response.json({error:"That refund request ID is already tied to different refund details."},{status:409});
    if(existing?.status==="succeeded"){
      const result=await finalizeRefund(requestId,existing.providerRefundId);
      return Response.json(result,{status:result.status});
    }
    if(existing?.status==="failed")return Response.json({error:"That refund attempt failed. Start a new refund request to try again."},{status:409});

    if(!existing){
      const now=new Date().toISOString();
      const reserved=await env.DB.prepare(`INSERT INTO payment_refunds (id,payment_id,estimate_id,amount_cents,mode,status,note,created_at)
        SELECT ?,p.id,p.estimate_id,?,?,'pending',?,?
        FROM payments p
        WHERE p.id=? AND p.status='paid' AND p.amount_cents>0
          AND ? <= p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)`)
        .bind(requestId,amountCents,mode,note,now,paymentId,amountCents).run();
      if(!reserved.meta.changes){
        const totals=await env.DB.prepare(`SELECT p.amount_cents AS originalAmount,
          COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0) AS reservedRefunds
          FROM payments p WHERE p.id=?`).bind(paymentId).first<{originalAmount:number;reservedRefunds:number}>();
        const remaining=Math.max(0,Number(totals?.originalAmount??0)-Number(totals?.reservedRefunds??0));
        return Response.json({error:`Refund cannot exceed the remaining refundable amount of ${currency(remaining)}.`},{status:409});
      }
    }

    if(!stripePayment){
      if(!externalRefundConfirmed){
        await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
        return Response.json({error:"For Cash App, Venmo, cash, check, bank, Wave, or other manual payments, send the money back first and confirm the external refund before FIRE records it."},{status:409});
      }
      const result=await finalizeRefund(requestId,null);
      return Response.json({...result,mode:"manual",moneyMovedByFire:false},{status:result.status});
    }

    const runtime=env as RuntimeEnv;
    if(!runtime.STRIPE_SECRET_KEY){
      await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
      return Response.json({error:"Stripe refunds are unavailable because Stripe is not configured."},{status:503});
    }

    let pending=await refundRow(requestId);
    if(pending?.providerRefundId){
      const check=await stripeGet(`refunds/${encodeURIComponent(pending.providerRefundId)}`,runtime.STRIPE_SECRET_KEY);
      const remote=await check.json() as {id?:string;status?:string;failure_reason?:string};
      if(!check.ok||remote.status==="failed"){
        await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
        return Response.json({error:remote.failure_reason||"Stripe could not complete this refund."},{status:409});
      }
      if(remote.status!=="succeeded")return Response.json({ok:true,pending:true,mode:"stripe",providerRefundId:remote.id},{status:202});
      const result=await finalizeRefund(requestId,remote.id??pending.providerRefundId);
      return Response.json({...result,mode:"stripe",moneyMovedByFire:true},{status:result.status});
    }

    const checkoutSessionId=payment.type==="Tip"?String(payment.providerId||"").replace(/:tip$/,""):payment.providerId!;
    const sessionResponse=await stripeGet(`checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,runtime.STRIPE_SECRET_KEY);
    const session=await sessionResponse.json() as {payment_intent?:string|{id?:string};error?:{message?:string}};
    const paymentIntent=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
    if(!sessionResponse.ok||!paymentIntent){
      await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
      return Response.json({error:session.error?.message||"FIRE could not locate the Stripe payment to refund."},{status:409});
    }

    const form=new URLSearchParams();
    form.set("payment_intent",paymentIntent);
    form.set("amount",String(amountCents));
    form.set("metadata[fire_refund_id]",requestId);
    form.set("metadata[fire_payment_id]",paymentId);
    const stripeResponse=await fetch("https://api.stripe.com/v1/refunds",{
      method:"POST",
      headers:{authorization:`Bearer ${runtime.STRIPE_SECRET_KEY}`,"content-type":"application/x-www-form-urlencoded","idempotency-key":`fire-refund-${requestId}`},
      body:form.toString(),
    });
    const stripeRefund=await stripeResponse.json() as {id?:string;status?:string;failure_reason?:string;error?:{message?:string}};
    if(!stripeResponse.ok||!stripeRefund.id){
      await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
      return Response.json({error:stripeRefund.error?.message||stripeRefund.failure_reason||"Stripe could not create the refund."},{status:409});
    }
    await env.DB.prepare("UPDATE payment_refunds SET provider_refund_id=? WHERE id=? AND status='pending'").bind(stripeRefund.id,requestId).run();
    if(stripeRefund.status!=="succeeded")return Response.json({ok:true,pending:true,mode:"stripe",providerRefundId:stripeRefund.id},{status:202});

    const result=await finalizeRefund(requestId,stripeRefund.id);
    return Response.json({...result,mode:"stripe",moneyMovedByFire:true},{status:result.status});
  }catch{
    return Response.json({error:"The refund could not be completed. No new refund should be attempted until you refresh the payment history."},{status:500});
  }
}
