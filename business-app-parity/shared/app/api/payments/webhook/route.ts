import { recordRefundUpdate, type StripeRefund } from "../../../../lib/stripe-refunds";
import { reconcileStripeCheckout, type StripeCheckoutSession } from "../../../../lib/stripe-payments";
import { env } from "cloudflare:workers";

type RuntimeEnv = Cloudflare.Env & { STRIPE_WEBHOOK_SECRET?: string; STRIPE_RESTRICTED_KEY?:string; STRIPE_SECRET_KEY?:string; FIRE_ENV?:string };

type StripeEvent = {
  livemode?:boolean;
  id?: string;
  type?: string;
  data?: { object?: StripeCheckoutSession & StripeRefund };
};

const currency = (value:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value/100);
const encoder = new TextEncoder();

function toHex(bytes:ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte)=>byte.toString(16).padStart(2,"0")).join("");
}

function constantTimeEqual(a:string,b:string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody:string, signatureHeader:string, secret:string) {
  const parts = signatureHeader.split(",").map((part)=>part.trim());
  const timestamp = parts.find((part)=>part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part)=>part.startsWith("v1=")).map((part)=>part.slice(3));
  if (!timestamp || !signatures.length) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const nowSeconds = Math.floor(Date.now()/1000);
  if (Math.abs(nowSeconds-timestampNumber) > 300) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = toHex(digest);
  return signatures.some((signature)=>constantTimeEqual(expected, signature));
}

export async function POST(request:Request) {
  const runtime = env as RuntimeEnv;
  if (!runtime.STRIPE_WEBHOOK_SECRET) return Response.json({ error:"Stripe webhook is not configured." }, { status:503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error:"Missing Stripe signature." }, { status:400 });

  const rawBody = await request.text();
  if (!await verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)) {
    return Response.json({ error:"Invalid Stripe signature." }, { status:400 });
  }

  let event:StripeEvent;
  try { event = JSON.parse(rawBody) as StripeEvent; }
  catch { return Response.json({ error:"Invalid webhook payload." }, { status:400 }); }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return Response.json({ error:"Invalid webhook payload." }, { status:400 });
  }

  if(runtime.FIRE_ENV==="staging"&&event.livemode!==false)return Response.json({error:"Staging rejects live Stripe events."},{status:400});
  if(["refund.created","refund.updated"].includes(event.type??"")){
    if(!event.data?.object)return Response.json({error:"Missing refund."},{status:400});
    try{
      const result=await recordRefundUpdate(env.DB,event.data.object,runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY);
      return Response.json({received:result.ok,...result},{status:result.ok?200:409});
    }catch{return Response.json({error:"Refund reconciliation unavailable; Stripe should retry."},{status:503});}
  }
  if (!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type ?? "")) {
    return Response.json({ received:true, ignored:true });
  }

  const session = event.data?.object;
  if (!session) return Response.json({ error:"Missing checkout session." }, { status:400 });
  const result = await reconcileStripeCheckout(env.DB,session);
  if (!result.ok) return Response.json({ error:`Payment event rejected: ${result.reason}.` }, { status:400 });
  return Response.json({ received:true, duplicate:Boolean(result.duplicate) });
}
