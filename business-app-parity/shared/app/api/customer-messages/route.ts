import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {shouldOfferReviewAfterPayment} from "../../../lib/customer-review-invite.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }


// An interrupted SMS/Mail handoff can reload FIRE before the owner confirms
// the send. Recover only exact scoped prepared records; no delivery is inferred.
export async function GET(request:Request) {
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  const customerId=params.get("customerId")??"";
  const estimateId=params.get("estimateId")??"";
  const rawCursor=params.get("cursor");
  let cursor:{createdAt:string;id:string}|null=null;
  if(rawCursor!==null){
    if(rawCursor.length>210)return Response.json({error:"Invalid prepared-message cursor."},{status:400});
    const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\|([A-Za-z0-9:._-]{1,128})$/.exec(rawCursor);
    if(!match||!Number.isFinite(Date.parse(match[1])))return Response.json({error:"Invalid prepared-message cursor."},{status:400});
    cursor={createdAt:match[1],id:match[2]};
  }
  if(!customerId||customerId.length>128||estimateId.length>128)
    return Response.json({error:"A customer and optional job ID are required."},{status:400});
  try {
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    if(estimateId){
      const linked=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=?").bind(estimateId,customerId).first();
      if(!linked)return Response.json({error:"That job does not belong to the selected customer."},{status:409});
    }
    const result=await env.DB.prepare(`
      SELECT m.id,m.customer_id AS customerId,m.estimate_id AS estimateId,
       m.channel,m.template,m.body,m.created_at AS createdAt
      FROM customer_messages m
      WHERE m.customer_id=?
        AND ((?='' AND m.estimate_id IS NULL) OR (?<>'' AND m.estimate_id=?))
        AND m.channel IN ('text_prepared','email_prepared')
        AND NOT EXISTS (
          SELECT 1 FROM customer_messages confirmed
          WHERE confirmed.id=m.id||':owner-confirmed' AND confirmed.customer_id=m.customer_id
            AND confirmed.channel IN ('text_confirmed','email_confirmed')
        )
        AND NOT EXISTS (
          SELECT 1 FROM customer_messages cancelled
          WHERE cancelled.id=m.id||':owner-cancelled' AND cancelled.customer_id=m.customer_id
            AND cancelled.channel='send_cancelled'
        )
        AND (? IS NULL OR m.created_at<? OR (m.created_at=? AND m.id<?))
      ORDER BY m.created_at DESC,m.id DESC LIMIT 11
    `).bind(customerId,estimateId,estimateId,estimateId,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.id??null).all<{id:string;createdAt:string}>();
    const rows=result.results??[],page=rows.slice(0,10),last=page.at(-1);
    const nextCursor=rows.length>10&&last&&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(last.createdAt)&&
      /^[A-Za-z0-9:._-]{1,128}$/.test(last.id)
        ?last.createdAt+"|"+last.id:null;
    return Response.json({pending:page,mayHaveMore:rows.length>10,nextCursor},{headers:{"Cache-Control":"no-store, private"}});
  }catch{return Response.json({error:"Unconfirmed message history is unavailable. No send is assumed."},{status:503,headers:{"Cache-Control":"no-store, private"}});}
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value = await request.json() as Record<string, unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    if (!customerId || !body || !["text_prepared","email_prepared","copy"].includes(channel)) return Response.json({ error: "Customer, channel, and message are required." }, { status: 400 });
    // New mobile clients keep the same operation UUID across uncertain POST
    // acknowledgements. Legacy clients without a UUID remain supported.
    const requestId=value.requestId;
    if(requestId!==undefined&&(typeof requestId!=="string"||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)))
      return Response.json({error:"Invalid message preparation request identifier."},{status:400});
    const stableId=typeof requestId==="string"?"owner-message-prep:"+requestId:null;
    const matches=(row:{customerId:string;estimateId:string|null;channel:string;template:string;body:string})=>
      row.customerId===customerId&&(row.estimateId??"")===(estimateId||"")&&row.channel===channel&&row.template===template&&row.body===body;
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(customerId).first<{id:string}>();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return Response.json({error:"That estimate does not belong to this customer."},{status:409});
    }
    if(template==="review"){
      if(!estimateId)return Response.json({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS billingTotalCents,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
        (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number;openCheckoutCount:number}>();
      if(!reviewState||!shouldOfferReviewAfterPayment({
        status:reviewState.status,totalCents:Number(reviewState.billingTotalCents),
        paidCents:Number(reviewState.paidCents),paymentReviewPending:Number(reviewState.paymentOverageOpen)>0||Number(reviewState.pendingRefundCount)>0||Number(reviewState.openCheckoutCount)>0
      }))
        return Response.json({error:"Complete the job, verify exact final payment and resolve any checkout, refund or billing hold before preparing a review request."},{status:409});
    }
    // Review eligibility must be revalidated even for an old identical
    // request. A later refund or open checkout cannot authorize a handoff.
    if(stableId){
      const existing=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(stableId).first<{
        id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string
      }>();
      if(existing){
        if(!matches(existing))return Response.json({error:"That message operation already belongs to different content. Review saved messages before retrying."},{status:409});
        const closed=await env.DB.prepare("SELECT id FROM customer_messages WHERE id IN (?,?) AND channel IN ('text_confirmed','email_confirmed','send_cancelled') LIMIT 1")
          .bind(stableId+":owner-confirmed",stableId+":owner-cancelled").first();
        if(closed)return Response.json({error:"This prepared message has already been marked sent or discarded. Review saved history; no new handoff was started."},{status:409});
        return Response.json({message:existing,duplicate:true},{status:200});
      }
    }
    const id=stableId??crypto.randomUUID();
    const createdAt=new Date().toISOString();
    // A concurrent double POST with the same operation ID can commit once only.
    // Read back the actual immutable row and refuse conflicting attempts.
    const write=await env.DB.prepare("INSERT OR IGNORE INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id,customerId,estimateId||null,channel,template,body,createdAt).run();
    const saved=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(id).first<{
      id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string
    }>();
    if(!saved)return Response.json({error:"Message preparation is not verified. Check saved drafts before retrying."},{status:503});
    if(!matches(saved))return Response.json({error:"This message operation was already used with different content. No second preparation was created."},{status:409});
    return Response.json({message:saved,duplicate:write.meta.changes!==1},{status:write.meta.changes===1?201:200});
  } catch {
    return Response.json({ error: "We couldn't save this communication." }, { status: 500 });
  }
}

// Confirmation appends evidence; preparation and legacy history stay immutable.
export async function PATCH(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value=await request.json() as Record<string,unknown>;
    const id=String(value.preparedMessageId??"").trim();
    const customerId=String(value.customerId??"").trim();
    const confirmed=value.ownerConfirmedSent===true, cancelled=value.ownerConfirmedNotSent===true;
    if(!id||!customerId||confirmed===cancelled)return Response.json({error:"Explicitly confirm either sent or not sent, but never both."},{status:400});
    const prepared=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(id,customerId).first<{id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string}>();
    if(!prepared||!["text_prepared","email_prepared"].includes(prepared.channel))return Response.json({error:"A matching prepared message is required."},{status:409});
    const confirmedId=prepared.id+":owner-confirmed";
    const cancelledId=prepared.id+":owner-cancelled";
    const channel=prepared.channel==="text_prepared"?"text_confirmed":"email_confirmed";
    const createdAt=new Date().toISOString();
    if(cancelled){
      // Never delete the prepared message. Its cancellation is a separate,
      // idempotent owner event that is impossible after a confirmed send.
      await env.DB.prepare(`INSERT OR IGNORE INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at)
        SELECT ?,m.customer_id,m.estimate_id,'send_cancelled',m.template,'Owner confirmed this prepared message was not sent.',?
        FROM customer_messages m WHERE m.id=? AND m.customer_id=? AND m.channel IN ('text_prepared','email_prepared')
        AND NOT EXISTS(SELECT 1 FROM customer_messages c WHERE c.id=? AND c.channel IN ('text_confirmed','email_confirmed'))`)
        .bind(cancelledId,createdAt,prepared.id,customerId,confirmedId).run();
      const receipt=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? AND channel='send_cancelled' LIMIT 1").bind(cancelledId,customerId).first();
      if(!receipt)return Response.json({error:"This draft has already been confirmed sent or changed. Refresh saved message history."},{status:409});
      return Response.json({message:receipt,cancelled:true});
    }
    const alreadyCancelled=await env.DB.prepare("SELECT id FROM customer_messages WHERE id=? AND customer_id=? AND channel='send_cancelled' LIMIT 1").bind(cancelledId,customerId).first();
    if(alreadyCancelled)return Response.json({error:"This draft was marked not sent. A later confirmation cannot change its history."},{status:409});
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) SELECT ?,customer_id,estimate_id,?,template,body,? FROM customer_messages WHERE id=? AND customer_id=? AND channel=? AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=?) AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND channel='send_cancelled')").bind(confirmedId,channel,createdAt,prepared.id,customerId,prepared.channel,confirmedId,cancelledId),
      env.DB.prepare("UPDATE estimates SET status='sent' WHERE id=? AND customer_id=? AND status='draft' AND NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=estimates.id) AND EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND customer_id=? AND estimate_id=estimates.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed'))").bind(prepared.estimateId,customerId,confirmedId,customerId),
    ]);
    const message=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(confirmedId,customerId).first();
    if(!message)return Response.json({error:"This prepared message was marked not sent or changed. No send confirmation was recorded."},{status:409});
    const estimate=prepared.estimateId?await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(prepared.estimateId,customerId).first<{status:string}>():null;
    return Response.json({message,estimateStatus:estimate?.status});
  }catch{return Response.json({error:"Send confirmation could not be saved. No delivery is claimed."},{status:500});}
}
