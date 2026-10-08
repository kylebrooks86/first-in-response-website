// Approved DR per-payment refund behavior, adapted to LIVE owner auth and shared reconciliation.
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { finalizeRefund, recordRefundUpdate, type StripeRefund } from "../../../../lib/stripe-refunds";

const currency=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v/100);
const OWNER_EMAIL="kylebrooks8605@gmail.com";
type RuntimeEnv=Cloudflare.Env & { STRIPE_SECRET_KEY?:string; STRIPE_RESTRICTED_KEY?:string; FIRE_ENV?:string };
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}
async function stripeGet(path:string,secret:string){
  return fetch(`https://api.stripe.com/v1/${path}`,{headers:{authorization:`Bearer ${secret}`,"Stripe-Version":"2026-08-26.dahlia"}});
}

export async function POST(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  try{
    const value=await request.json() as Record<string,unknown>;
    const paymentId=String(value.paymentId??"").trim();
    const requestId=String(value.requestId??"").trim();
    const amountCents=value.amountCents;
    const externalRefundConfirmed=value.externalRefundConfirmed===true;
    const note=String(value.note??"").trim().slice(0,1000)||null;
    if(!paymentId||!requestId||requestId.length>120||typeof amountCents!=="number"||!Number.isSafeInteger(amountCents)||amountCents<=0)
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
      const result=await finalizeRefund(env.DB,requestId,existing.providerRefundId);
      return Response.json(result,{status:result.status});
    }
    if(existing?.status==="failed")return Response.json({error:"That refund attempt failed. Start a new refund request to try again."},{status:409});

    if(!stripePayment&&!externalRefundConfirmed)return Response.json({error:"Confirm the money was returned outside FIRE first."},{status:409});
    if(!existing){
      const available=await env.DB.prepare(`SELECT
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=? AND status='paid' AND CASE WHEN ?='Tip' THEN type IN ('Tip','Tip Refund') ELSE type NOT IN ('Tip','Tip Refund') END),0)
        -COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r JOIN payments p ON p.id=r.payment_id WHERE r.estimate_id=? AND r.status='pending' AND CASE WHEN ?='Tip' THEN p.type='Tip' ELSE p.type<>'Tip' END),0) AS amount`)
        .bind(payment.estimateId,payment.type,payment.estimateId,payment.type).first<{amount:number}>();
      if(!Number.isSafeInteger(Number(available?.amount))||amountCents>Number(available?.amount))return Response.json({error:"Refund exceeds the remaining recorded principal or tip proceeds."},{status:409});
      const now=new Date().toISOString();
      const reserved=await env.DB.prepare(`INSERT OR IGNORE INTO payment_refunds (id,payment_id,estimate_id,amount_cents,mode,status,note,created_at)
        SELECT ?,p.id,p.estimate_id,?,?,'pending',?,?
        FROM payments p
        WHERE p.id=? AND p.status='paid' AND p.amount_cents>0
          AND ? <= COALESCE((SELECT SUM(x.amount_cents) FROM payments x WHERE x.estimate_id=p.estimate_id AND x.status='paid' AND CASE WHEN p.type='Tip' THEN x.type IN ('Tip','Tip Refund') ELSE x.type NOT IN ('Tip','Tip Refund') END),0)-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r JOIN payments x ON x.id=r.payment_id WHERE r.estimate_id=p.estimate_id AND r.status='pending' AND CASE WHEN p.type='Tip' THEN x.type='Tip' ELSE x.type<>'Tip' END),0)
          AND ? <= p.amount_cents-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r WHERE r.payment_id=p.id AND r.status IN ('pending','succeeded')),0)`)
        .bind(requestId,amountCents,mode,note,now,paymentId,amountCents,amountCents).run();
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
      const result=await finalizeRefund(env.DB,requestId,null);
      return Response.json({...result,mode:"manual",moneyMovedByFire:false},{status:result.status});
    }

    const runtime=env as RuntimeEnv;
    const stripeSecret=runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY;
    if(!stripeSecret){
      await env.DB.prepare("UPDATE payment_refunds SET status='failed' WHERE id=? AND status='pending'").bind(requestId).run();
      return Response.json({error:"Stripe refunds are unavailable because Stripe is not configured."},{status:503});
    }

    if(runtime.FIRE_ENV==="staging"&&!/^(sk|rk|rkcs)_test_/.test(stripeSecret))return Response.json({error:"Staging only accepts sandbox Stripe keys."},{status:503});
    const pending=await env.DB.prepare('SELECT provider_refund_id AS providerRefundId FROM payment_refunds WHERE id=?').bind(requestId).first<{providerRefundId:string|null}>();
    if(pending?.providerRefundId){
      const check=await stripeGet(`refunds/${encodeURIComponent(pending.providerRefundId)}`,stripeSecret);
      const remote=await check.json() as StripeRefund;
      if(!check.ok)return Response.json({error:"Stripe confirmation is unavailable. Retry this same request; do not start another refund."},{status:503});
      if(remote.id!==pending.providerRefundId)return Response.json({error:"Stripe returned a different refund."},{status:409});
      const result=await recordRefundUpdate(env.DB,remote,stripeSecret);
      return Response.json({...result,mode:"stripe",error:result.reason},{status:!result.ok?409:result.pending?202:200});
    }
    const age=await env.DB.prepare("SELECT created_at AS createdAt FROM payment_refunds WHERE id=?").bind(requestId).first<{createdAt:string}>();
    if(!age||Date.now()-Date.parse(age.createdAt)>23*60*60*1000)return Response.json({error:"This unresolved request needs Stripe reconciliation before another attempt."},{status:409});

    const checkoutSessionId=payment.type==="Tip"?String(payment.providerId||"").replace(/:tip$/,""):payment.providerId!;
    const sessionResponse=await stripeGet(`checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,stripeSecret);
    const session=await sessionResponse.json() as {livemode?:boolean;payment_intent?:string|{id?:string};error?:{message?:string}};
    const paymentIntent=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
    if(!sessionResponse.ok||!paymentIntent||(runtime.FIRE_ENV==="staging"&&session.livemode!==false)){
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
      headers:{authorization:`Bearer ${stripeSecret}`,"content-type":"application/x-www-form-urlencoded","idempotency-key":`fire-refund-${requestId}`,"Stripe-Version":"2026-08-26.dahlia"},
      body:form.toString(),
    });
    const stripeRefund=await stripeResponse.json() as StripeRefund & {error?:{message?:string}};
    if(!stripeResponse.ok||!stripeRefund.id){
      // An uncertain network/Stripe response retains the reservation and original idempotency key.
      return Response.json({error:"Stripe has not confirmed this request. Retry the same refund request; do not submit a new one."},{status:503});
    }
    if(stripeRefund.metadata?.fire_refund_id!==requestId||stripeRefund.metadata?.fire_payment_id!==paymentId)return Response.json({error:"Stripe refund metadata did not match."},{status:409});
    const result=await recordRefundUpdate(env.DB,stripeRefund,stripeSecret);
    return Response.json({...result,mode:"stripe",moneyMovedByFire:result.ok&&!result.pending,error:result.reason},{status:!result.ok?409:result.pending?202:200});

  }catch{
    return Response.json({error:"The refund could not be completed. No new refund should be attempted until you refresh the payment history."},{status:500});
  }
}

