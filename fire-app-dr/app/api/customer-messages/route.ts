import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import { readOwnerWriteObject } from "../../../lib/customer-write-request-guard.mjs";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
// Customer message receipts contain owner-private contacts and manually prepared text.
const privateResponse=(response:Response):Response=>{
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Vary","Cookie");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
};
const privateJson=(value:unknown,init?:ResponseInit)=>privateResponse(Response.json(value,init));
async function authorized(){
  try{
    const user=await getOwnerUser();
    return Boolean(user&&typeof user.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL);
  }catch{return false;}
}

// QA-master-compatible pending prepared-message recovery, read-only. Never
// treat a failed D1 read as an empty handoff queue or infer message delivery.
export async function GET(request:Request) {
  if(!await authorized())return privateJson({error:"Unauthorized"},{status:401});
  const params=new URL(request.url).searchParams;
  const customerId=params.get("customerId")??"";
  const estimateId=params.get("estimateId")??"";
  const rawCursor=params.get("cursor");
  let cursor:{createdAt:string;id:string}|null=null;
  if(rawCursor!==null){
    if(rawCursor.length>210)return privateJson({error:"Invalid prepared-message cursor."},{status:400});
    const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\|([A-Za-z0-9:._-]{1,128})$/.exec(rawCursor);
    if(!match||!Number.isFinite(Date.parse(match[1])))
      return privateJson({error:"Invalid prepared-message cursor."},{status:400});
    cursor={createdAt:match[1],id:match[2]};
  }
  if(!customerId||customerId.length>128||estimateId.length>128)
    return privateJson({error:"A customer and optional job ID are required."},{status:400});
  try{
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
    if(!customer)return privateJson({error:"Customer not found."},{status:404});
    if(estimateId){
      const linked=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=?").bind(estimateId,customerId).first();
      if(!linked)return privateJson({error:"That job does not belong to the selected customer."},{status:409});
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
    `).bind(customerId,estimateId,estimateId,estimateId,
      cursor?.createdAt??null,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.id??null)
      .all<{id:string;createdAt:string}>();
    if((result as unknown as {success?:boolean}).success===false||!Array.isArray(result.results))
      return privateJson({error:"Unconfirmed message history is unavailable. No send is assumed."},{status:503});
    const rows=result.results,page=rows.slice(0,10),last=page.at(-1);
    const nextCursor=rows.length>10&&last&&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(last.createdAt)&&
      /^[A-Za-z0-9:._-]{1,128}$/.test(last.id)
        ?last.createdAt+"|"+last.id:null;
    return privateJson({pending:page,mayHaveMore:rows.length>10,nextCursor});
  }catch{
    return privateJson({error:"Unconfirmed message history is unavailable. No send is assumed."},{status:503});
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return privateJson({ error: "Unauthorized" }, { status: 401 });
  try {
    // Reuse the QA/DR bounded, same-origin owner guard before any D1 reads/writes.
    const parsed=await readOwnerWriteObject(request,64_000);
    if(parsed.response)return privateResponse(parsed.response);
    const value=parsed.value as Record<string,unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    if (!customerId || !body || !["text","email","copy"].includes(channel)) return privateJson({ error: "Customer, channel, and message are required." }, { status: 400 });
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(customerId).first<{id:string}>();
    if(!customer)return privateJson({error:"Customer not found."},{status:404});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return privateJson({error:"That estimate does not belong to this customer."},{status:409});
    }
    if(template==="review"){
      if(!estimateId)return privateJson({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents) AS billingTotalCents,
        (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id) AS invoiceOwnershipMismatch,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
        (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number;invoiceOwnershipMismatch:number;openCheckoutCount:number}>();
      const reviewPaidCents=Number(reviewState?.paidCents);
      const reviewBillingTotalCents=Number(reviewState?.billingTotalCents);
      const reviewBillingSafe=Boolean(reviewState)&&Number.isSafeInteger(reviewPaidCents)&&reviewPaidCents>=0&&
        Number.isSafeInteger(reviewBillingTotalCents)&&reviewBillingTotalCents>0;
      const noHolds=Boolean(reviewState)&&[reviewState?.invoiceOwnershipMismatch,reviewState?.paymentOverageOpen,
        reviewState?.pendingRefundCount,reviewState?.openCheckoutCount]
        .every(value=>Number.isSafeInteger(Number(value))&&Number(value)===0);
      // No review handoff while invoice ownership, exact payment or a ledger hold differs.
      if(!reviewState||!reviewBillingSafe||!noHolds||reviewState.status!=="completed"||reviewPaidCents!==reviewBillingTotalCents)
        return privateJson({error:"Resolve billing and record the final payment before requesting a review."},{status:409});
    }
    if(body.length>10000)return privateJson({error:"Message is too long to save."},{status:400});
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if(template==="review"){
      const inserted=await env.DB.prepare(`INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE NOT EXISTS (
          SELECT 1 FROM customer_messages
          WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
            AND datetime(created_at)>=datetime('now','-30 seconds')
        )`)
        .bind(id,customerId,estimateId,channel,template,body,createdAt,customerId,estimateId,channel).run();
      if((inserted as unknown as {success?:boolean}).success===false||!Number.isSafeInteger(Number(inserted.meta?.changes)))
        return privateJson({error:"Communication save could not be confirmed. Refresh saved messages before retrying.",saveUncertain:true},{status:503});
      if(!inserted.meta.changes){
        const recent=await env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt
          FROM customer_messages WHERE customer_id=? AND estimate_id=? AND channel=? AND template='review'
            AND datetime(created_at)>=datetime('now','-30 seconds')
          ORDER BY created_at DESC LIMIT 1`).bind(customerId,estimateId,channel).first();
        if(recent)return privateJson({message:recent,duplicate:true});
        return privateJson({error:"Review request was not saved. Recheck the job and payment status."},{status:409});
      }
    }else{
      const inserted=await env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id, customerId, estimateId || null, channel, template, body, createdAt).run();
      if((inserted as unknown as {success?:boolean}).success===false||Number(inserted.meta?.changes)!==1)
        return privateJson({error:"Communication save could not be confirmed. Refresh saved messages before retrying.",saveUncertain:true},{status:503});
    }
    // D1 may report a successful INSERT while persisting no row, or the
    // acknowledgement may be inconsistent with committed storage. Never tell
    // the owner a customer communication was saved without an independent
    // exact-ID, exact-content readback. This does not send any communication.
    const saved=await env.DB.prepare(`SELECT id,customer_id AS customerId,estimate_id AS estimateId,
      channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?`)
      .bind(id).first<{id:string;customerId:string;estimateId:string|null;
        channel:string;template:string;body:string;createdAt:string}>();
    if(!saved||saved.id!==id||saved.customerId!==customerId||
      (saved.estimateId??"")!==(estimateId||"")||saved.channel!==channel||
      saved.template!==template||saved.body!==body||saved.createdAt!==createdAt)
      return privateJson({error:"Communication save could not be confirmed. Refresh saved messages before retrying.",saveUncertain:true},{status:503});
    return privateJson({message:saved},{status:201});
  } catch {
    return privateJson({ error: "Communication save could not be verified. Refresh saved messages before retrying.",saveUncertain:true }, { status: 503 });
  }
}

// DR owner confirmation follows the QA-master's immutable prepared-message
// receipt contract. This never sends a Text or Email; it records owner intent.
// Confirmation appends evidence; preparation and legacy history stay immutable.
export async function PATCH(request: Request) {
  if (!await authorized()) return privateJson({ error: "Unauthorized" }, { status: 401 });
  let confirmationOperation:{id:string;customerId:string;channel:string;cancelled:boolean;preparedId:string;estimateId:string|null;template:string;body:string}|null=null;
  try {
    // Confirm only a bounded owner request; never infer delivery or
    // alter an idempotent prepared-message receipt on malformed input.
    const parsed=await readOwnerWriteObject(request,64_000);
    if(parsed.response)return privateResponse(parsed.response);
    const value=parsed.value as Record<string,unknown>;
    const id=String(value.preparedMessageId??"").trim();
    const customerId=String(value.customerId??"").trim();
    const confirmed=value.ownerConfirmedSent===true, cancelled=value.ownerConfirmedNotSent===true;
    if(!id||!customerId||confirmed===cancelled)return privateJson({error:"Explicitly confirm either sent or not sent, but never both."},{status:400});
    const prepared=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(id,customerId).first<{id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string}>();
    if(!prepared||!["text_prepared","email_prepared"].includes(prepared.channel))return privateJson({error:"A matching prepared message is required."},{status:409});
    const confirmedId=prepared.id+":owner-confirmed";
    const cancelledId=prepared.id+":owner-cancelled";
    const channel=prepared.channel==="text_prepared"?"text_confirmed":"email_confirmed";
    confirmationOperation={id:cancelled?cancelledId:confirmedId,customerId,channel:cancelled?'send_cancelled':channel,cancelled,preparedId:prepared.id,estimateId:prepared.estimateId,template:prepared.template,body:prepared.body};
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
      if(!receipt)return privateJson({error:"This draft has already been confirmed sent or changed. Refresh saved message history."},{status:409});
      return privateJson({message:receipt,cancelled:true,ownerConfirmedSent:false,
        deliveryConfirmed:false,confirmationSource:'owner'},
        {headers:{"Cache-Control":"no-store, private"}});
    }
    const alreadyCancelled=await env.DB.prepare("SELECT id FROM customer_messages WHERE id=? AND customer_id=? AND channel='send_cancelled' LIMIT 1").bind(cancelledId,customerId).first();
    if(alreadyCancelled)return privateJson({error:"This draft was marked not sent. A later confirmation cannot change its history."},{status:409});
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) SELECT ?,customer_id,estimate_id,?,template,body,? FROM customer_messages WHERE id=? AND customer_id=? AND channel=? AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=?) AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND channel='send_cancelled')").bind(confirmedId,channel,createdAt,prepared.id,customerId,prepared.channel,confirmedId,cancelledId),
      env.DB.prepare("UPDATE estimates SET status='sent' WHERE id=? AND customer_id=? AND status='draft' AND NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=estimates.id) AND EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND customer_id=? AND estimate_id=estimates.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed'))").bind(prepared.estimateId,customerId,confirmedId,customerId),
    ]);
    const message=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(confirmedId,customerId).first();
    if(!message)return privateJson({error:"This prepared message was marked not sent or changed. No send confirmation was recorded."},{status:409});
    const estimate=prepared.estimateId?await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(prepared.estimateId,customerId).first<{status:string}>():null;
    return privateJson({message,estimateStatus:estimate?.status,ownerConfirmedSent:true,
      deliveryConfirmed:false,confirmationSource:'owner'},
      {headers:{"Cache-Control":"no-store, private"}});
  }catch{
    // Owner's explicit send/not-sent decision may have committed before the
    // D1 response failed. Read back its exact immutable evidence event.
    const op=confirmationOperation;
    if(op){
      try{
        const message=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? AND channel=? LIMIT 1")
          .bind(op.id,op.customerId,op.channel).first();
        if(message){
          const receipt=message as {id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string};
          const expectedBody=op.cancelled?'Owner confirmed this prepared message was not sent.':op.body;
          if(receipt.customerId!==op.customerId||(receipt.estimateId??'')!==(op.estimateId??'')||
             receipt.channel!==op.channel||receipt.template!==op.template||receipt.body!==expectedBody||
             typeof receipt.createdAt!=='string'||!Number.isFinite(Date.parse(receipt.createdAt)))
            return privateJson({error:'Saved send decision does not match this prepared message. Review message history.',
              saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
          const otherId=op.id.replace(/:(owner-confirmed|owner-cancelled)$/,op.cancelled?':owner-confirmed':':owner-cancelled');
          const conflicting=await env.DB.prepare("SELECT id FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1")
            .bind(otherId,op.customerId).first();
          if(conflicting)return privateJson({error:'Conflicting send decisions require manual review.',
            saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
          const estimate=op.estimateId&&!op.cancelled?
            await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1")
              .bind(op.estimateId,op.customerId).first<{status:string}>():null;
          return privateJson({message:receipt,cancelled:op.cancelled,
            ...(estimate?{estimateStatus:estimate.status}:{}),
            recoveredAfterUncertainConfirmation:true,ownerConfirmedSent:!op.cancelled,
            deliveryConfirmed:false,confirmationSource:'owner'},
            {headers:{"Cache-Control":"no-store, private"}});
        }
      }catch{/* No authoritative evidence; never infer delivery. */}
    }
    return privateJson({error:"Send confirmation could not be verified. Reopen the saved message history; no delivery is inferred.",
      saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
  }
}
