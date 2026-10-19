import {serviceLocationsEnabled,serviceAddressColumns,serviceAddressSql} from "../../../lib/service-location";
import { retrieveStripeCheckoutSession, recordStripeCheckoutSession } from "../../../lib/stripe-payments";
import { env } from "cloudflare:workers";
import { CheckCircle2, MapPin, ShieldCheck, X } from "lucide-react";
import { getChatGPTUser } from "../../chatgpt-auth";
import { AcceptEstimateButton } from "./accept-button";
import { PayButton } from "../../pay/[id]/pay-button";
import { SERVICE_AGREEMENT, templateByKey } from "../../../lib/fire-templates";
import { serviceDescriptionFor } from "../../../lib/fire-services";
import { paymentHandles } from "../../../lib/payment-methods";
import {agreementDigest,agreementScope,validateAgreementItems} from "../../../lib/deposit-agreement-commitment.mjs";
import {RevisedDepositAcceptButton} from "./revised-deposit-accept-button";
import {describeRevisedDepositTerms} from "../../../lib/deposit-agreement-revision.mjs";
import {verifySignedAgreementDigests} from "../../../lib/deposit-agreement-backup.mjs";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};
type RuntimeEnv=Cloudflare.Env&{STRIPE_RESTRICTED_KEY?:string;STRIPE_SECRET_KEY?:string;CASH_APP_HANDLE?:string;VENMO_HANDLE?:string};
const currency=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);

async function confirmPayment(sessionId:string,estimate:{id:string}){
  const runtime=env as RuntimeEnv;
  const stripeKey=runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY;
  if(!stripeKey)return false;
  const session=await retrieveStripeCheckoutSession(sessionId,stripeKey);
  if(!session||session.metadata?.estimate_id!==estimate.id)return false;
  return (await recordStripeCheckoutSession(env.DB,session)).recorded;
}

export default async function CustomerEstimatePage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{session_id?:string;from?:string;ownerPreview?:string}>}){
  const {token}=await params;
  const {session_id:sessionId,ownerPreview:previewRequested}=await searchParams;
  // The query is only a navigation hint, never authorization. Ordinary shared
  // links omit it; copying/forging it cannot expose owner controls to a customer.
  const previewUser=previewRequested==='1'?await getChatGPTUser():null;
  const ownerPreview=Boolean(previewUser?.email?.toLowerCase()==='kylebrooks8605@gmail.com');
  const row=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,(SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,e.deposit_cents AS depositCents,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_version AS contractVersion,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,c.name AS customer,${serviceAddressColumns(serviceLocationsEnabled(env))},(SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,(SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;invoiceTotalCents:number|null;depositCents:number;shareToken:string;firstViewedAt:string|null;acceptedAt:string|null;signedName:string|null;signedAt:string|null;contractVersion:string|null;contractInitials:string|null;photoRelease:string|null;customer:string;address:string|null;serviceAddressSource?:string;paymentOverageOpen:number;pendingRefundCount:number}>();
  if(!row)return <main className="pay-page"><section className="pay-card"><div className="pay-logo">F</div><h1>Estimate not found</h1><p>Please check the link or contact First In Response Exteriors.</p></section></main>;
  // Until revised terms appear in the actual signed customer agreement,
  // the portal's legacy "50% deposit" label is NOT safe for owner overrides.
  // Suppress old-link approvals, manual payment instructions and payment
  // session verification; never show misleading or stale deposit terms.
  const syntheticOwnerException=('FIRE_DEPOSIT_POLICY_CANDIDATE' in env&&env.FIRE_DEPOSIT_POLICY_CANDIDATE==='synthetic-tests-only')&&
    ('FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE' in env&&env.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE==='synthetic-contract-tests-only');
  const syntheticSignatureEnabled=syntheticOwnerException&&('FIRE_DEPOSIT_AGREEMENT_CANDIDATE' in env&&env.FIRE_DEPOSIT_AGREEMENT_CANDIDATE==='synthetic-signature-tests-only');
  if(syntheticOwnerException){
    // Read-only versioned disclosure. No legacy signature, checkout, or
    // payment instructions may leak through the stale 50% agreement.
    let held=false;
    let amendment:ReturnType<typeof describeRevisedDepositTerms>|null=null;
    let signedScope:{id:string;name:string;description:string;quantity:number;unit:string;total_cents:number}[]=[];
    let expectedDigest:string|null=null;
    let acceptedRevision:string|null=null;
    try{
      const history=await env.DB.prepare("SELECT * FROM deposit_policy_events WHERE estimate_id=? ORDER BY created_at DESC,id DESC LIMIT 101").bind(row.id).all<Record<string,unknown>>();
      if(history.results.length){
        held=true;
        const latest=history.results[0];
        const acceptedPrefix=latest&&typeof latest.id==='string'?'deposit-exception-v1:'+latest.id+':sha256:':null;
        if(row.acceptedAt&&row.signedAt&&row.signedName&&acceptedPrefix&&row.contractVersion?.startsWith(acceptedPrefix)&&
          /^[a-f0-9]{64}$/.test(row.contractVersion.slice(acceptedPrefix.length))){
          const stored=await env.DB.prepare("SELECT * FROM deposit_agreement_snapshots WHERE event_id=? AND estimate_id=?").bind(latest.id,row.id).first<Record<string,unknown>>();
          if(stored&&stored.document_version==='deposit-exception-v1:'+latest.id&&
             stored.document_digest===row.contractVersion.slice(acceptedPrefix.length)&&
             stored.signed_name===row.signedName&&stored.photo_release===row.photoRelease&&
             stored.accepted_at===row.acceptedAt&&stored.signed_at===row.signedAt&&
             stored.total_cents===row.totalCents&&stored.deposit_cents===row.depositCents&&stored.mode===latest.mode&&
             await verifySignedAgreementDigests({deposit_agreement_snapshots:[stored]})===null)
            acceptedRevision='deposit-exception-v1:'+latest.id;
        }
        if(history.results.length<=100){
          const state=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM payments WHERE estimate_id=?) AS paymentCount,(SELECT COUNT(*) FROM invoices WHERE estimate_id=?) AS invoiceCount,(SELECT COUNT(*) FROM payment_checkout_sessions WHERE estimate_id=? AND status='open') AS openCheckoutCount,(SELECT COUNT(*) FROM payment_refunds WHERE estimate_id=? AND status='pending') AS pendingRefundCount").bind(row.id,row.id,row.id,row.id).first<{paymentCount:number;invoiceCount:number;openCheckoutCount:number;pendingRefundCount:number}>();
          if(state)amendment=describeRevisedDepositTerms({
            estimate:{id:row.id,status:row.status,totalCents:row.totalCents,depositCents:row.depositCents,acceptedAt:row.acceptedAt,signedAt:row.signedAt},
            latestEvent:history.results[0],eventCount:history.results.length,...state
          });
        }
      }
    }catch{held=true;amendment=null;}
    if(held&&amendment&&syntheticSignatureEnabled){
      try{
        const source=await env.DB.prepare("SELECT id,name,description,quantity,unit,total_cents FROM estimate_items WHERE estimate_id=? ORDER BY rowid").bind(row.id).all<{id:string;name:string;description:string;quantity:number;unit:string;total_cents:number}>();
        if(!validateAgreementItems(source.results,row.subtotalCents,row.discountCents,row.totalCents))
          throw Error('Service scope is invalid');
        signedScope=source.results;
        const e=await env.DB.prepare("SELECT mode FROM deposit_policy_events WHERE id=? AND estimate_id=?").bind(amendment.eventId,row.id).first<{mode:string}>();
        if(!e||e.mode!==amendment.mode)throw Error('Audit version changed');
        expectedDigest=await agreementDigest({eventId:amendment.eventId,totalCents:amendment.totalCents,depositCents:amendment.depositCents,mode:amendment.mode,scope:agreementScope(signedScope),terms:SERVICE_AGREEMENT});
      }catch{amendment=null;expectedDigest=null;signedScope=[];}
    }
    // Viewing revised terms freezes the exposed draft before displaying it.
    // Without this, an owner could replace terms after the customer sees them.
    // The guarded D1 batch both records the first view and its notification;
    // a concurrent pricing/audit/payment change displays only a review hold.
    if(held&&amendment&&!ownerPreview&&!row.firstViewedAt){
      try{
        const viewedAt=new Date().toISOString();
        const recorded=await env.DB.batch([
          env.DB.prepare("UPDATE estimates SET first_viewed_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=? AND first_viewed_at IS NULL AND status IN ('draft','sent') AND signed_at IS NULL AND accepted_at IS NULL AND total_cents=? AND deposit_cents=? AND (SELECT id FROM deposit_policy_events WHERE estimate_id=? ORDER BY created_at DESC,id DESC LIMIT 1)=? AND NOT EXISTS(SELECT 1 FROM payments WHERE estimate_id=?) AND NOT EXISTS(SELECT 1 FROM invoices WHERE estimate_id=?) AND NOT EXISTS(SELECT 1 FROM payment_checkout_sessions WHERE estimate_id=? AND status='open') AND NOT EXISTS(SELECT 1 FROM payment_refunds WHERE estimate_id=? AND status='pending')")
            .bind(viewedAt,row.id,amendment.totalCents,amendment.depositCents,row.id,amendment.eventId,row.id,row.id,row.id,row.id),
          env.DB.prepare("INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) SELECT ?,'estimate_viewed',?,?,customer_id,id,? FROM estimates WHERE id=? AND first_viewed_at=? AND NOT EXISTS(SELECT 1 FROM notifications WHERE type='estimate_viewed' AND estimate_id=?)")
            .bind(crypto.randomUUID(),row.customer+' viewed revised deposit terms','Proposed deposit terms viewed; customer approval and payment are still pending.',viewedAt,row.id,viewedAt,row.id)
        ]);
        if(recorded[0]?.meta?.changes!==1)amendment=null;
      }catch{amendment=null;}
    }
    if(held&&acceptedRevision)return <main className="pay-page"><section className="pay-card estimate-portal">
      <header><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
      <h1>Revised agreement signed</h1>
      <p><strong>{row.signedName}</strong> signed the revised agreement.</p>
      <p>Accepted: {row.acceptedAt}</p><p>Revision: <code>{acceptedRevision}</code></p>
      <p>No payment has been initiated here. First In Response Exteriors will confirm collection and scheduling separately.</p>
    </section></main>;
    if(held)return <main className="pay-page"><section className="pay-card estimate-portal">
      <header><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
      <h1>{amendment?"Revised deposit terms for review":"Updated estimate required"}</h1>
      {amendment?<div className="portal-breakdown">
        <p><strong>{amendment.notice}</strong></p>
        <p>{amendment.modeName}{amendment.percent!==null?(" ("+amendment.percent+"%)"):""}</p>
        <p>Price after discounts: <strong>{amendment.totalDisplay}</strong></p>
        <p>Required deposit: <strong>{amendment.depositDisplay}</strong></p>
        <p>Remaining price after deposit: <strong>{amendment.balanceDisplay}</strong></p>
        <p>{amendment.explanation}</p>
        <p>{amendment.requirement}</p>
        <p>Revision reference: <code>{amendment.version}</code></p>
        {expectedDigest&&<div className="portal-service-list">
          <h2>Included services and scope</h2>
          {signedScope.map(item=><div className="pay-line" key={item.id}><div><strong>{item.name}</strong><p>{item.description}</p><small>{item.quantity} {item.unit}</small></div><strong>{currency(item.total_cents)}</strong></div>)}
        </div>}
        <div className="contract-box"><strong>Service Agreement &amp; Liability Waiver</strong><p>{SERVICE_AGREEMENT}</p></div>
        {syntheticSignatureEnabled&&expectedDigest&&!ownerPreview&&
          <RevisedDepositAcceptButton token={token} version={amendment.version} documentDigest={expectedDigest}/>}

      </div>:<p>Deposit terms need reconciliation. Contact First In Response Exteriors for an updated agreement before proceeding.</p>}
      <p className="pay-note">{syntheticSignatureEnabled&&expectedDigest?"Signing approves these exact revised terms. Scheduling and payments remain separate and disabled here.":"This is not an accepted agreement. Approval, scheduling, and payments are unavailable until revised terms are formally issued and signed."}</p>
    </section></main>;
  }
  const itemResult=await env.DB.prepare(`SELECT name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC`).bind(row.id).all<{name:string;description:string;quantity:number;unit:string;totalCents:number}>();
  const items=itemResult.results.map((item)=>({...item,quantity:Number(item.quantity),totalCents:Number(item.totalCents)}));
  const estimateItemsSafe=items.length>0&&items.every((item)=>Boolean(item.name?.trim())&&Number.isFinite(item.quantity)&&item.quantity>0&&Number.isSafeInteger(item.totalCents)&&item.totalCents>=0);
  const itemSubtotalCents=estimateItemsSafe?items.reduce((sum,item)=>sum+item.totalCents,0):0;
  const estimateSnapshotSafe=estimateItemsSafe&&Number.isSafeInteger(itemSubtotalCents)&&itemSubtotalCents===Number(row.subtotalCents)&&Number.isSafeInteger(Number(row.discountCents))&&Number(row.discountCents)>=0&&Number(row.discountCents)<=itemSubtotalCents;
  const paymentReviewPending=Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;
  const serviceSummary=items.map((item)=>item.name).join(", ")||"Exterior cleaning service";
  if(!ownerPreview&&!row.firstViewedAt){
    const now=new Date().toISOString();
    // If an owner amendment won the race after our initial audit read,
    // the legacy portal must NOT render its obsolete 50% deposit terms.
    const unmodifiedAuditGuard=syntheticOwnerException?" AND NOT EXISTS(SELECT 1 FROM deposit_policy_events d WHERE d.estimate_id=estimates.id)":"";
    const viewed=await env.DB.batch([
      env.DB.prepare("UPDATE estimates SET first_viewed_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END WHERE id=? AND first_viewed_at IS NULL"+unmodifiedAuditGuard).bind(now,row.id),
      env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type='estimate_viewed' AND estimate_id=?)`).bind(crypto.randomUUID(),"estimate_viewed",`${row.customer} viewed an estimate`,`${serviceSummary} estimate was opened for the first time.`,row.customerId,row.id,now,row.id),
    ]);
    if(syntheticOwnerException&&viewed[0]?.meta?.changes!==1)
      return <main className="pay-page"><section className="pay-card"><h1>Updated estimate required</h1><p>Deposit terms changed while this estimate was being opened. Please request the current revised agreement before signing or making a payment.</p></section></main>;
  }
  const billingTotalCents=Number(row.invoiceTotalCents??row.totalCents);
  const estimateAmountsSafe=estimateSnapshotSafe&&[billingTotalCents,Number(row.totalCents),Number(row.depositCents)].every((value)=>Number.isSafeInteger(value)&&value>=0)&&Number(row.depositCents)<=Number(row.totalCents);
  const paymentConfirmed=sessionId&&estimateAmountsSafe&&!paymentReviewPending?await confirmPayment(sessionId,{id:row.id}):false;
  const runtime=env as RuntimeEnv;
  const paymentsReady=Boolean(runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY);
  const handles=paymentHandles(runtime);
  const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").bind(row.id).first<{amount:number}>();
  const paidCents=Number(paid?.amount??0);
  const billingStateSafe=estimateAmountsSafe&&Number.isSafeInteger(paidCents)&&paidCents>=0;
  const balance=billingStateSafe?Math.max(0,billingTotalCents-paidCents):0;
  const depositRemaining=billingStateSafe?Math.max(0,row.depositCents-paidCents):0;
  const estimateApproved=Boolean(row.acceptedAt)||["approved","scheduled","completed"].includes(row.status);
  const canPayDeposit=billingStateSafe&&!paymentReviewPending&&estimateApproved&&row.status!=="completed"&&depositRemaining>0;
  const canPayBalance=billingStateSafe&&!paymentReviewPending&&row.status==="completed"&&balance>0;
  const footer=await env.DB.prepare("SELECT body FROM message_templates WHERE key='estimateFooter'").first<{body:string}>();
  const contract=await env.DB.prepare("SELECT body FROM message_templates WHERE key='contractTerms'").first<{body:string}>();
  return <main className={`pay-page${ownerPreview?' owner-estimate-preview':''}`}>
    {ownerPreview&&<a className="owner-estimate-preview-close" href={`/?openEstimate=${encodeURIComponent(row.id)}`} aria-label="Close estimate preview" title="Return to estimate details"><X aria-hidden="true"/></a>}
    <section className="pay-card estimate-portal">
    <header><img className="portal-logo" src="/fire-app-logo.png" alt="First In Response Exteriors"/><div><strong>FIRST IN RESPONSE</strong><small>EXTERIORS</small></div></header>
    {paymentConfirmed&&<div className="portal-payment-success"><CheckCircle2/><div><strong>Payment received</strong><p>Thank you, {row.customer}. First In Response Exteriors has been notified.</p></div></div>}
    <div className="pay-title"><p>ESTIMATE FOR</p><h1>{row.customer}</h1>{row.address&&<span><MapPin/>{row.address}</span>}{row.serviceAddressSource==="legacy-current-unverified"&&<small>Current customer address; original service address unverified.</small>}</div>
    <div className="portal-service-list">{items.map((item,index)=><div className="pay-line" key={`${item.name}-${index}`}><div><strong>{item.name}</strong>{item.quantity&&<span>{item.quantity} {item.unit}</span>}<p className="portal-service-description">{item.description||serviceDescriptionFor(item.name)}</p></div><strong>{currency(item.totalCents)}</strong></div>)}</div>
    <div className="portal-breakdown"><span><small>Services subtotal</small><strong>{currency(row.subtotalCents)}</strong></span><span><small>Discount</small><strong className="green-text">−{currency(row.discountCents)}</strong></span></div>
    <div className="pay-summary"><span><small>Estimate total</small><strong>{currency(row.totalCents)}</strong></span><span><small>50% deposit</small><strong className="red-text">{currency(row.depositCents)}</strong></span></div>
    <AcceptEstimateButton token={token} accepted={Boolean(row.acceptedAt)||["approved","scheduled","completed"].includes(row.status)} signedName={row.signedName} photoRelease={row.photoRelease} terms={contract?.body?.startsWith("I authorize First In Response Exteriors to perform the services listed")?SERVICE_AGREEMENT:(contract?.body||SERVICE_AGREEMENT)}/>
    {!billingStateSafe&&<p className="pay-note"><strong>Billing review required.</strong> Please contact First In Response Exteriors before making a payment.</p>}
    {paymentReviewPending&&<p className="pay-note">Payment or refund review in progress. Please contact First In Response Exteriors before sending another payment.</p>}
    {paymentsReady&&canPayDeposit&&<div className="portal-payment"><PayButton shareToken={token} paymentType="deposit" label={`Pay ${currency(depositRemaining)} deposit securely`}/></div>}
    {paymentsReady&&canPayBalance&&<div className="portal-payment"><PayButton shareToken={token} paymentType="balance" dueAmountCents={balance} tipBaseCents={billingTotalCents} label={`Pay ${currency(balance)} remaining balance securely`}/></div>}
    {paymentsReady&&!estimateApproved&&<p className="pay-note">Approve and sign the estimate first. After approval, the 50% deposit reserves your place on the schedule.</p>}
    {paymentsReady&&estimateApproved&&!canPayDeposit&&!canPayBalance&&balance>0&&<p className="pay-note">Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.</p>}
    {!paymentsReady&&<p className="pay-note">After approval, First In Response Exteriors will contact you to schedule the job and arrange the 50% deposit.</p>}
    {billingStateSafe&&!paymentReviewPending&&<p className="pay-note"><strong>Manual payment options:</strong> Cash App: {handles.cashApp} · Venmo: {handles.venmo}. Please include your name in the payment note.</p>}
    <p className="document-footer">{footer?.body||templateByKey("estimateFooter").body}</p>
    <div className="secure-note"><ShieldCheck/> Your private estimate link is unique to you.</div>
  </section></main>;
}
