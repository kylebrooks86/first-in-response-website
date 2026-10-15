import { LOCAL_CUSTOMER_DEPLOYMENT } from "../../../../local-customer-deployment";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { reconcileStripeCheckout, type StripeCheckoutSession } from "../../../../../lib/stripe-payments";

type RuntimeEnv=Cloudflare.Env & {STRIPE_RESTRICTED_KEY?:string;STRIPE_SECRET_KEY?:string;FIRE_ENV?:string};
type RemoteSession=StripeCheckoutSession & {status?:string;livemode?:boolean};
const OWNER_EMAIL="kylebrooks8605@gmail.com";

export async function POST(request:Request){
  const owner=await getChatGPTUser();
  if(!owner||owner.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const reservationId=String(body.reservationId??"").trim();
    const sessionId=String(body.sessionId??"").trim();
    const provisional=/^fire-creating:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId);
    const tracked=/^cs_(test|live)_[a-zA-Z0-9]+$/.test(reservationId);
    if((!provisional&&!tracked)||!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)
      ||(tracked&&reservationId!==sessionId))
      return Response.json({error:"Enter the original unresolved checkout and its complete Stripe Session ID."},{status:400});
    const reservation=await env.DB.prepare(`SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents
      FROM payment_checkout_sessions WHERE id=? AND status='open' LIMIT 1`)
      .bind(reservationId).first<{id:string;estimateId:string;type:string;amountCents:number}>();
    if(!reservation)return Response.json({error:"This checkout is no longer awaiting reconciliation. Refresh Payment History."},{status:409});
    const runtime=env as RuntimeEnv;
    const sandbox=String(LOCAL_CUSTOMER_DEPLOYMENT)!=="live"||/(?:staging|doomsday|synthetic|sandbox)/i.test(runtime.FIRE_ENV||"");
    const secret=runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY;
    if(!secret||(sandbox&&!/^(sk|rk|rkcs)_test_/.test(secret)))
      return Response.json({error:"A matching test/live Stripe connection is required to verify this checkout."},{status:503});
    if(sandbox&&!sessionId.startsWith("cs_test_"))
      return Response.json({error:"An isolated candidate cannot reconcile live Stripe payments."},{status:409});
    const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{
      headers:{authorization:`Bearer ${secret}`,"Stripe-Version":"2026-08-26.dahlia"}
    });
    if(!response.ok)return Response.json({error:"Stripe did not verify that session. Keep the checkout blocked and review its ID."},{status:503});
    const session=await response.json() as RemoteSession;
    const meta=session.metadata;
    const amount=Number(session.amount_total);
    if(session.id!==sessionId||session.livemode!==(sandbox?false:sessionId.startsWith("cs_live_"))
      ||(provisional&&meta?.fire_checkout_reservation_id!==reservationId)
      ||meta?.estimate_id!==reservation.estimateId||meta?.payment_type!==reservation.type
      ||session.client_reference_id!==reservation.estimateId
      ||!Number.isSafeInteger(amount)||amount!==Number(reservation.amountCents)
      ||String(meta?.expected_charge_cents??"")!==String(reservation.amountCents))
      return Response.json({error:"Stripe session identity, mode, job or amount did not match the reserved checkout. Nothing changed."},{status:409});
    if(session.payment_status==="paid"){
      const result=await reconcileStripeCheckout(env.DB,session);
      if(!result.ok)return Response.json({error:"Stripe confirms payment, but FIRE could not safely reconcile it. Review the ledger.",reason:result.reason},{status:409});
      return Response.json({resolved:true,action:"paid",duplicate:Boolean(result.duplicate),message:"Stripe payment verified and recorded against the matching job."});
    }
    if(session.status==="expired"&&session.payment_status==="unpaid"){
      const result=await env.DB.prepare(`UPDATE payment_checkout_sessions SET status='expired',expired_at=?
        WHERE id=? AND estimate_id=? AND type=? AND amount_cents=? AND status='open'`)
        .bind(new Date().toISOString(),reservationId,reservation.estimateId,reservation.type,reservation.amountCents).run();
      if(!result.meta.changes)return Response.json({error:"Checkout changed during verification. Refresh before retrying."},{status:409});
      return Response.json({resolved:true,action:"expired",message:"Stripe confirmed this checkout expired without payment. The blocked slot was released."});
    }
    // Never clear an open, asynchronously-processing or unverifiable checkout.
    return Response.json({resolved:false,action:"pending",message:"Stripe has not confirmed payment or expiration. This checkout remains blocked to prevent a duplicate charge."},{status:202});
  }catch{
    return Response.json({error:"Verification is uncertain. The checkout remains blocked; retry the same session."},{status:503});
  }
}
