import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {readOwnerWriteObject} from "../../../lib/customer-write-request-guard.mjs";
import {shouldOfferReviewAfterPayment} from "../../../lib/customer-review-invite.mjs";
import {usableCustomerPhone,usableCustomerEmail,customerReminderIsTomorrowInTulsa,tulsaReminderExpiryUtc} from "../../../lib/customer-contact-links";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
// Prepared texts can contain homeowner addresses, contact details and private invoice links.
const privatePreparedHistoryHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
// Prepared and owner-confirmed customer messages may include private contacts,
// quote URLs and prices. Wrap every write response without changing its status,
// body, set-cookie or the underlying exact-ID D1 save/recovery behavior.
function privatePreparedWriteResponse(response:Response):Response {
  response.headers.set("Cache-Control","private, no-store");
  const vary=response.headers.get("Vary");
  if(!vary||!vary.split(",").some(token=>token.trim().toLowerCase()==="cookie"))
    response.headers.set("Vary",vary?vary+", Cookie":"Cookie");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
}
function privatePreparedWriteJson(value:unknown,init?:ResponseInit):Response {
  return privatePreparedWriteResponse(Response.json(value,init));
}
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&typeof user.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL); }


// An interrupted SMS/Mail handoff can reload FIRE before the owner confirms
// the send. Recover only exact scoped prepared records; no delivery is inferred.
export async function GET(request:Request) {
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401,headers:privatePreparedHistoryHeaders});
  const params=new URL(request.url).searchParams;
  const customerId=params.get("customerId")??"";
  const estimateId=params.get("estimateId")??"";
  const rawCursor=params.get("cursor");
  let cursor:{createdAt:string;id:string}|null=null;
  if(rawCursor!==null){
    if(rawCursor.length>210)return Response.json({error:"Invalid prepared-message cursor."},{status:400,headers:privatePreparedHistoryHeaders});
    const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\|([A-Za-z0-9:._-]{1,128})$/.exec(rawCursor);
    if(!match||!Number.isFinite(Date.parse(match[1])))return Response.json({error:"Invalid prepared-message cursor."},{status:400,headers:privatePreparedHistoryHeaders});
    cursor={createdAt:match[1],id:match[2]};
  }
  if(!customerId||customerId.length>128||estimateId.length>128)
    return Response.json({error:"A customer and optional job ID are required."},{status:400,headers:privatePreparedHistoryHeaders});
  try {
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
    if(!customer)return Response.json({error:"Customer not found."},{status:404,headers:privatePreparedHistoryHeaders});
    if(estimateId){
      const linked=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=?").bind(estimateId,customerId).first();
      if(!linked)return Response.json({error:"That job does not belong to the selected customer."},{status:409,headers:privatePreparedHistoryHeaders});
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
    return Response.json({pending:page,mayHaveMore:rows.length>10,nextCursor},{headers:privatePreparedHistoryHeaders});
  }catch{return Response.json({error:"Unconfirmed message history is unavailable. No send is assumed."},{status:503,headers:privatePreparedHistoryHeaders});}
}

export async function POST(request: Request) {
  if (!await authorized()) return privatePreparedWriteJson({ error: "Unauthorized" }, { status: 401 });
  let uncertainOperation:{id:string;customerId:string;estimateId:string;channel:string;template:string;body:string}|null=null;
  try {
    // Bound owner-prepared message bytes before parsing; keep existing
    // prepared-ID retry and customer/job ownership verification unchanged.
    const parsed=await readOwnerWriteObject(request,64_000);
    if(parsed.response)return privatePreparedWriteResponse(parsed.response);
    const value=parsed.value as Record<string,unknown>;
    const customerId = String(value.customerId ?? "").trim();
    const estimateId = String(value.estimateId ?? "").trim();
    const channel = String(value.channel ?? "").trim();
    const template = String(value.template ?? "custom").trim();
    const body = String(value.body ?? "").trim();
    // New owner clients bind the exact contact displayed while preparing an
    // external Text/Email handoff. Old clients without a snapshot retain the
    // existing semantics, but still must pass fresh server contact checks.
    if(value.recipientSnapshot!==undefined&&typeof value.recipientSnapshot!=="string")
      return privatePreparedWriteJson({error:"Invalid message recipient snapshot."},{status:400});
    const recipientSnapshot=typeof value.recipientSnapshot==="string"?value.recipientSnapshot:null;
    // Raw saved timestamp is a concurrency token for appointment messages.
    // A different future date is NOT the date the owner already previewed.
    const appointmentScheduledAt=typeof value.appointmentScheduledAt==="string"?value.appointmentScheduledAt:"";
    if (!customerId || !body || !["text_prepared","email_prepared","copy"].includes(channel)) return privatePreparedWriteJson({ error: "Customer, channel, and message are required." }, { status: 400 });
    // New mobile clients keep the same operation UUID across uncertain POST
    // acknowledgements. Legacy clients without a UUID remain supported.
    const requestId=value.requestId;
    if(requestId!==undefined&&(typeof requestId!=="string"||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)))
      return privatePreparedWriteJson({error:"Invalid message preparation request identifier."},{status:400});
    const stableId=typeof requestId==="string"?"owner-message-prep:"+requestId:null;
    if(stableId)uncertainOperation={id:stableId,customerId,estimateId,channel,template,body};
    const matches=(row:{customerId:string;estimateId:string|null;channel:string;template:string;body:string})=>
      row.customerId===customerId&&(row.estimateId??"")===(estimateId||"")&&row.channel===channel&&row.template===template&&row.body===body;
    const customer=await env.DB.prepare("SELECT id,phone,email FROM customers WHERE id=? LIMIT 1")
      .bind(customerId).first<{id:string;phone:string|null;email:string|null}>();
    if(!customer)return privatePreparedWriteJson({error:"Customer not found."},{status:404});
    // A saved customer can lose or change contact details on another device.
    // Never rely only on the React button check or create a misleading
    // text/email-prepared receipt for a missing, malformed or changed recipient.
    const contactColumn=channel==="text_prepared"?"phone":channel==="email_prepared"?"email":null;
    const savedContact=contactColumn==="phone"?customer.phone:contactColumn==="email"?customer.email:null;
    const contactReady=contactColumn==="phone"?usableCustomerPhone(savedContact):
      contactColumn==="email"?usableCustomerEmail(savedContact):null;
    const contactError="Customer contact details are missing or changed. Reopen this customer and verify the saved phone or email before preparing the message.";
    if(contactColumn&&(!contactReady||(recipientSnapshot!==null&&recipientSnapshot!==savedContact)))
      return privatePreparedWriteJson({error:contactError},{status:409,headers:{"Cache-Control":"no-store, private"}});
    if(estimateId){
      const linkedEstimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
      if(!linkedEstimate)return privatePreparedWriteJson({error:"That estimate does not belong to this customer."},{status:409});
    }
    // The client rechecks at the actual Text/Email/Copy click, but its
    // browser state can be stale or bypassed. Confirm the *saved* appointment
    // on the server before returning an idempotent draft as well as before INSERT.
    const appointmentTemplate=template==="appointment"||template==="appointmentReminder";
    // Capture one wall-clock instant. If midnight passes before INSERT, its
    // exact deadline becomes past and the database must reject this draft.
    const appointmentClock=Date.now();
    const appointmentError="This saved appointment is no longer confirmed for a future time. Review the job status and schedule before preparing an appointment message.";
    const reminderError="A 24-hour reminder can only be prepared the day before this saved appointment in Tulsa. Choose Appointment confirmation for a later date.";
    if(appointmentTemplate){
      if(!estimateId)return privatePreparedWriteJson({error:appointmentError},{status:409});
      const currentJob=await env.DB.prepare("SELECT status,scheduled_at AS scheduledAt FROM estimates WHERE id=? AND customer_id=? LIMIT 1")
        .bind(estimateId,customerId).first<{status:string;scheduledAt:string|null}>();
      const time=currentJob?.scheduledAt?Date.parse(currentJob.scheduledAt):NaN;
      if(currentJob?.status!=="scheduled"||!Number.isFinite(time)||time<=appointmentClock||
         !appointmentScheduledAt||currentJob.scheduledAt!==appointmentScheduledAt)
        return privatePreparedWriteJson({error:appointmentError},{status:409});
      // The canned reminder says "tomorrow"; a future date next week is
      // a valid confirmation, NOT a truthful 24-hour reminder.
      if(template==="appointmentReminder"&&!customerReminderIsTomorrowInTulsa(currentJob.scheduledAt,appointmentClock))
        return privatePreparedWriteJson({error:reminderError},{status:409});
    }
    if(template==="review"){
      if(!estimateId)return privatePreparedWriteJson({error:"A completed paid job is required before requesting a review."},{status:409});
      const reviewState=await env.DB.prepare(`SELECT e.status,
        COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents) AS billingTotalCents,
        (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id) AS invoiceOwnershipMismatch,
        COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
        (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
        (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
        (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount
        FROM estimates e WHERE e.id=? AND e.customer_id=?`).bind(estimateId,customerId).first<{status:string;billingTotalCents:number;invoiceOwnershipMismatch:number;paidCents:number;paymentOverageOpen:number;pendingRefundCount:number;openCheckoutCount:number}>();
      if(!reviewState||Number(reviewState.invoiceOwnershipMismatch)!==0||!shouldOfferReviewAfterPayment({
        status:reviewState.status,totalCents:Number(reviewState.billingTotalCents),
        paidCents:Number(reviewState.paidCents),paymentReviewPending:Number(reviewState.paymentOverageOpen)>0||Number(reviewState.pendingRefundCount)>0||Number(reviewState.openCheckoutCount)>0
      }))
        return privatePreparedWriteJson({error:"Complete the job, verify exact final payment and resolve any checkout, refund or billing hold before preparing a review request."},{status:409});
    }
    // Review eligibility must be revalidated even for an old identical
    // request. A later refund or open checkout cannot authorize a handoff.
    if(stableId){
      const existing=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(stableId).first<{
        id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string
      }>();
      if(existing){
        if(!matches(existing))return privatePreparedWriteJson({error:"That message operation already belongs to different content. Review saved messages before retrying."},{status:409});
        const closed=await env.DB.prepare("SELECT id FROM customer_messages WHERE id IN (?,?) AND channel IN ('text_confirmed','email_confirmed','send_cancelled') LIMIT 1")
          .bind(stableId+":owner-confirmed",stableId+":owner-cancelled").first();
        if(closed)return privatePreparedWriteJson({error:"This prepared message has already been marked sent or discarded. Review saved history; no new handoff was started."},{status:409});
        return privatePreparedWriteJson({message:existing,duplicate:true},{status:200});
      }
    }
    const id=stableId??crypto.randomUUID();
    const createdAt=new Date().toISOString();
    // A concurrent double POST with the same operation ID can commit once only.
    // Read back the actual immutable row and refuse conflicting attempts.
    // The review eligibility SELECT above is not atomic with this INSERT.
    // A Stripe refund, new checkout, invoice reassignment, or billing exception
    // can arrive on another device in between. Recheck those facts in the
    // SAME SQLite/D1 write that creates the review draft; no text/email sends.
    const reviewGuard=template==="review"?` AND EXISTS (
       SELECT 1 FROM estimates e WHERE e.id=? AND e.customer_id=? AND e.status='completed'
       AND NOT EXISTS (SELECT 1 FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id)
       AND COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents)>0
       AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
           =COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1),e.total_cents)
       AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL)
       AND NOT EXISTS(SELECT 1 FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending')
       AND NOT EXISTS(SELECT 1 FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open')
     )`:"";
    // The appointment can be completed, rescheduled or cancelled by another
    // owner device AFTER the read above. Verify it again in the very same
    // SQLite write; no old scheduled message may create a new prepared row.
    const appointmentGuard=appointmentTemplate?` AND EXISTS (
      SELECT 1 FROM estimates e WHERE e.id=? AND e.customer_id=? AND e.status='scheduled'
        AND e.scheduled_at=? AND julianday(e.scheduled_at)>julianday('now')
    )`:"";
    // A prepared reminder must not cross midnight while the owner waits for
    // the database. This SQLite condition uses the actual Tulsa-local
    // tomorrow-to-today boundary, including daylight-saving transitions.
    const reminderExpiry=template==="appointmentReminder"?tulsaReminderExpiryUtc(appointmentClock):null;
    const reminderGuard=template==="appointmentReminder"?
      " AND julianday('now') < julianday(?)":"";
    // Compare the current customer contact in the SAME conditional INSERT.
    // A changed/deleted phone/email between GET and write cannot produce an
    // apparently ready handoff. Copy-only audits remain contact-independent.
    const contactGuard=contactColumn?` AND EXISTS (
      SELECT 1 FROM customers c WHERE c.id=? AND c.${contactColumn}=?
    )`:"";
    const write=await env.DB.prepare(`INSERT OR IGNORE INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at)
      SELECT ?,?,?,?,?,?,? WHERE 1=1${reviewGuard}${appointmentGuard}${reminderGuard}${contactGuard}`)
      .bind(id,customerId,estimateId||null,channel,template,body,createdAt,
        ...(template==="review"?[estimateId,customerId]:[]),
        ...(appointmentTemplate?[estimateId,customerId,appointmentScheduledAt]:[]),
        ...(template==="appointmentReminder"?[reminderExpiry]:[]),
        ...(contactColumn?[customerId,savedContact]:[])).run();
    const saved=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(id).first<{
      id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string
    }>();
    if(!saved)return privatePreparedWriteJson({error:template==="review"?
      "Review invitation eligibility changed during preparation. Recheck job completion, payment and refund status before trying again.":
      appointmentTemplate?(template==="appointmentReminder"?reminderError:appointmentError):
      contactColumn?contactError:
      "Message preparation is not verified. Check saved drafts before retrying."},
      {status:(template==="review"||appointmentTemplate||contactColumn)&&write.meta.changes===0?409:503,
       headers:{"Cache-Control":"no-store, private"}});
    if(!matches(saved))return privatePreparedWriteJson({error:"This message operation was already used with different content. No second preparation was created."},{status:409});
    return privatePreparedWriteJson({message:saved,duplicate:write.meta.changes!==1},{status:write.meta.changes===1?201:200});
  } catch {
    // D1 can commit a prepared handoff before its acknowledgement is lost.
    // Recover only the EXACT saved operation, never infer an SMS/email send.
    // Review invitations need fresh payment eligibility, so do not turn an
    // old recovered draft into a newly authorized review handoff here.
    if(uncertainOperation&&uncertainOperation.template!=='review'){
      const op=uncertainOperation;
      try{
        const saved=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1")
          .bind(op.id,op.customerId).first<{id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string}>();
        if(saved){
          if(saved.customerId!==op.customerId||(saved.estimateId??'')!==op.estimateId||
             saved.channel!==op.channel||saved.template!==op.template||saved.body!==op.body)
            return privatePreparedWriteJson({error:'This preparation identifier belongs to different saved content. No handoff was started.'},
              {status:409,headers:{"Cache-Control":"no-store, private"}});
          const terminal=await env.DB.prepare("SELECT id FROM customer_messages WHERE id IN (?,?) AND channel IN ('text_confirmed','email_confirmed','send_cancelled') LIMIT 1")
            .bind(op.id+':owner-confirmed',op.id+':owner-cancelled').first();
          if(terminal)return privatePreparedWriteJson({error:'This prepared message was already confirmed or discarded. Reopen its history; no new handoff was started.'},
            {status:409,headers:{"Cache-Control":"no-store, private"}});
          return privatePreparedWriteJson({message:saved,duplicate:true,recoveredAfterUncertainPreparation:true,
            deliveryConfirmed:false},{status:200,headers:{"Cache-Control":"no-store, private"}});
        }
      }catch{/* No authoritative readback means no asserted save or delivery. */}
    }
    return privatePreparedWriteJson({error:"Message preparation could not be confirmed. Reopen the saved drafts before retrying.",
      saveUncertain:true,requestId:uncertainOperation?.id??null,deliveryConfirmed:false},
      {status:503,headers:{"Cache-Control":"no-store, private"}});
  }
}

// Confirmation appends evidence; preparation and legacy history stay immutable.
export async function PATCH(request: Request) {
  if (!await authorized()) return privatePreparedWriteJson({ error: "Unauthorized" }, { status: 401 });
  let confirmationOperation:{id:string;customerId:string;channel:string;cancelled:boolean;preparedId:string;estimateId:string|null;template:string;body:string}|null=null;
  try {
    // Confirm only a bounded owner request; never infer delivery or
    // alter an idempotent prepared-message receipt on malformed input.
    const parsed=await readOwnerWriteObject(request,64_000);
    if(parsed.response)return privatePreparedWriteResponse(parsed.response);
    const value=parsed.value as Record<string,unknown>;
    const id=String(value.preparedMessageId??"").trim();
    const customerId=String(value.customerId??"").trim();
    const confirmed=value.ownerConfirmedSent===true, cancelled=value.ownerConfirmedNotSent===true;
    if(!id||!customerId||confirmed===cancelled)return privatePreparedWriteJson({error:"Explicitly confirm either sent or not sent, but never both."},{status:400});
    const prepared=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(id,customerId).first<{id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string}>();
    if(!prepared||!["text_prepared","email_prepared"].includes(prepared.channel))return privatePreparedWriteJson({error:"A matching prepared message is required."},{status:409});
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
      if(!receipt)return privatePreparedWriteJson({error:"This draft has already been confirmed sent or changed. Refresh saved message history."},{status:409});
      return privatePreparedWriteJson({message:receipt,cancelled:true,ownerConfirmedSent:false,
        deliveryConfirmed:false,confirmationSource:'owner'},
        {headers:{"Cache-Control":"no-store, private"}});
    }
    const alreadyCancelled=await env.DB.prepare("SELECT id FROM customer_messages WHERE id=? AND customer_id=? AND channel='send_cancelled' LIMIT 1").bind(cancelledId,customerId).first();
    if(alreadyCancelled)return privatePreparedWriteJson({error:"This draft was marked not sent. A later confirmation cannot change its history."},{status:409});
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) SELECT ?,customer_id,estimate_id,?,template,body,? FROM customer_messages WHERE id=? AND customer_id=? AND channel=? AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=?) AND NOT EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND channel='send_cancelled')").bind(confirmedId,channel,createdAt,prepared.id,customerId,prepared.channel,confirmedId,cancelledId),
      env.DB.prepare("UPDATE estimates SET status='sent' WHERE id=? AND customer_id=? AND status='draft' AND NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=estimates.id) AND EXISTS (SELECT 1 FROM customer_messages WHERE id=? AND customer_id=? AND estimate_id=estimates.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed'))").bind(prepared.estimateId,customerId,confirmedId,customerId),
    ]);
    const message=await env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1").bind(confirmedId,customerId).first();
    if(!message)return privatePreparedWriteJson({error:"This prepared message was marked not sent or changed. No send confirmation was recorded."},{status:409});
    const estimate=prepared.estimateId?await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(prepared.estimateId,customerId).first<{status:string}>():null;
    return privatePreparedWriteJson({message,estimateStatus:estimate?.status,ownerConfirmedSent:true,
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
            return privatePreparedWriteJson({error:'Saved send decision does not match this prepared message. Review message history.',
              saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
          const otherId=op.id.replace(/:(owner-confirmed|owner-cancelled)$/,op.cancelled?':owner-confirmed':':owner-cancelled');
          const conflicting=await env.DB.prepare("SELECT id FROM customer_messages WHERE id=? AND customer_id=? LIMIT 1")
            .bind(otherId,op.customerId).first();
          if(conflicting)return privatePreparedWriteJson({error:'Conflicting send decisions require manual review.',
            saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
          const estimate=op.estimateId&&!op.cancelled?
            await env.DB.prepare("SELECT status FROM estimates WHERE id=? AND customer_id=? LIMIT 1")
              .bind(op.estimateId,op.customerId).first<{status:string}>():null;
          return privatePreparedWriteJson({message:receipt,cancelled:op.cancelled,
            ...(estimate?{estimateStatus:estimate.status}:{}),
            recoveredAfterUncertainConfirmation:true,ownerConfirmedSent:!op.cancelled,
            deliveryConfirmed:false,confirmationSource:'owner'},
            {headers:{"Cache-Control":"no-store, private"}});
        }
      }catch{/* No authoritative evidence; never infer delivery. */}
    }
    return privatePreparedWriteJson({error:"Send confirmation could not be verified. Reopen the saved message history; no delivery is inferred.",
      saveUncertain:true,deliveryConfirmed:false},{status:503,headers:{"Cache-Control":"no-store, private"}});
  }
}
