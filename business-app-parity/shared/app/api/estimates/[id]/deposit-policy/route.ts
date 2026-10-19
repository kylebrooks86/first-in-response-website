import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {depositPolicyEnabled,depositPolicyColumns,depositSchedulingPolicy,type DepositPolicyRow} from '../../../../../lib/deposit-policy';
const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await getChatGPTUser();if(owner?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401,headers});
 try{const {id}=await params;const row=await env.DB.prepare(`SELECT ${depositPolicyColumns} FROM estimates e WHERE e.id=?`).bind(id).first<DepositPolicyRow>();if(!row)return Response.json({error:'Estimate not found.'},{status:404,headers});return Response.json({estimateId:row.id,customerId:row.customerId,policy:depositSchedulingPolicy(row,depositPolicyEnabled(env))},{headers});}
 catch{return Response.json({error:'Deposit and scheduling status could not be verified. No records changed.'},{status:503,headers});}
}


/**
 * SYNTHETIC-CONTRACT-TESTS ONLY. No hosted deployment is permitted for this
 * feature until the agreement, schedule, and payment lifecycles are reviewed.
 *
 * D1 batch transaction: guarded audit INSERT ... SELECT, followed by
 * UPDATE tied to the inserted audit ID. A zero-row insert cannot update an
 * estimate. Lost acknowledgements require audit reconciliation, never an
 * automatic repeated write. No payment or scheduling calls exist here.
 */
import {previewOwnerDepositException} from '../../../../../lib/deposit-exception-proposal.mjs';
const mutationEnabled=(e:{FIRE_DEPOSIT_POLICY_CANDIDATE?:string,FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE?:string})=>
 depositPolicyEnabled(e)&&e.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE==='synthetic-contract-tests-only';
const confirmationPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const lastAuditSql="SELECT id FROM deposit_policy_events WHERE estimate_id=? ORDER BY created_at DESC,id DESC LIMIT 1";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();
 if(user?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 if(!mutationEnabled(env))return json({error:'Owner deposit changes are not activated.'},404);
 const expectedOrigin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==expectedOrigin)return json({error:'The request must originate from this app.'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return json({error:'JSON is required.'},415);
 let body:Record<string,unknown>;
 try {
  const text=await request.text();
  if(text.length>4096)return json({error:'Request is too large.'},413);
  const input:unknown=JSON.parse(text);
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid request.'},400);
  body=input as Record<string,unknown>;
 }catch{return json({error:'Invalid JSON.'},400);}
 const confirmationId=body.confirmationId;
 const expectedLastEventId=body.expectedLastEventId;
 if(typeof confirmationId!=='string'||!confirmationPattern.test(confirmationId)||
    !(expectedLastEventId===null||(typeof expectedLastEventId==='string'&&confirmationPattern.test(expectedLastEventId))))
    return json({error:'A valid confirmation ID and expected audit revision are required.'},400);
 const {confirmationId:ignoredId,expectedLastEventId:ignoredLast,...input}=body;
 try{
  const {id}=await params;
  const previous=await env.DB.prepare("SELECT * FROM deposit_policy_events WHERE confirmation_id=?").bind(confirmationId).first<Record<string,unknown>>();
  if(previous){
   const current=await env.DB.prepare("SELECT deposit_cents AS depositCents,total_cents AS totalCents,status FROM estimates WHERE id=?").bind(id).first<{depositCents:number,totalCents:number,status:string}>();
   const same=previous.estimate_id===id&&previous.actor_email===user!.email.toLowerCase()&&
    previous.mode===input.mode&&previous.new_deposit_cents===current?.depositCents&&
    previous.previous_total_cents===input.expectedTotalCents&&previous.previous_deposit_cents===input.expectedDepositCents&&
    previous.reason===((typeof input.reason==='string'&&input.reason.trim())||null)&&
    previous.percent_basis_points===(input.mode==='percentage'?input.percentBasisPoints:null)&&
    previous.schedule_before_collection===(input.mode==='schedule-before-deposit'?1:0)&&
    current?.totalCents===previous.previous_total_cents;
   if(!same)return json({error:'This confirmation ID already belongs to another or changed deposit request. Review the audit and job before another action.'},409);
   return json({recorded:true,duplicate:true,auditEventId:previous.id,estimateId:id,canSchedule:false,hostedActivation:false});
  }
  const row=await env.DB.prepare("SELECT "+depositPolicyColumns+",e.contract_version AS contractVersion FROM estimates e WHERE e.id=?").bind(id).first<DepositPolicyRow&{contractVersion:string|null}>();
  if(!row)return json({error:'Estimate not found.'},404);
  if(!['draft','sent'].includes(row.status)||row.signedAt!==null||row.acceptedAt!==null||
     Number(row.paidCents)!==0)return json({error:'Signed, approved, scheduled or financially active jobs require a separate agreement-safe owner workflow. No terms changed.'},409);
  const paymentRecord=await env.DB.prepare("SELECT id FROM payments WHERE estimate_id=? LIMIT 1").bind(id).first();
  if(paymentRecord)return json({error:'Existing payment history requires reconciliation before any deposit adjustment.'},409);
  const latest=await env.DB.prepare(lastAuditSql).bind(id).first<{id:string}>();
  if((latest?.id??null)!==expectedLastEventId)return json({error:'Deposit audit history changed. Refresh the job before reconfirming.'},409);
  let preview;
  try{preview=previewOwnerDepositException({current:row,request:input,verifiedOwnerEmail:user!.email});}
  catch(e){return json({error:e instanceof Error?e.message:'Invalid proposed deposit exception.'},409);}
  if(preview.requiresSignedAgreementRevision)return json({error:'Customer agreement revision is required before this exception can be applied.'},409);
  const eventId=crypto.randomUUID(),createdAt=new Date().toISOString();
  const insert=[
    "INSERT INTO deposit_policy_events (id,estimate_id,confirmation_id,actor_email,mode,previous_total_cents,previous_deposit_cents,new_deposit_cents,",
    "paid_principal_cents,percent_basis_points,schedule_before_collection,previous_contract_version,updated_contract_version,",
    "previous_signed_at,requires_customer_reapproval,reason,created_at)",
    "SELECT ?,elig.id,?,?,?,elig.totalCents,elig.depositCents,?,elig.paidCents,?,?,elig.contractVersion,elig.contractVersion,elig.signedAt,0,?,?",
    "FROM (SELECT "+depositPolicyColumns+",e.contract_version AS contractVersion FROM estimates e WHERE e.id=?) elig",
    "WHERE elig.status=? AND elig.status IN ('draft','sent') AND elig.acceptedAt IS NULL AND elig.signedAt IS NULL",
    "AND elig.totalCents=? AND elig.depositCents=? AND elig.contractVersion IS ?",
    "AND typeof(elig.totalCents)='integer' AND elig.totalCents BETWEEN 0 AND 9007199254740991",
    "AND typeof(elig.depositCents)='integer' AND elig.depositCents BETWEEN 0 AND elig.totalCents",
    "AND typeof(elig.paidCents)='integer' AND elig.paidCents=0 AND elig.invalidPaymentCount=0",
    "AND elig.pendingRefundCount=0 AND elig.openCheckoutCount=0 AND elig.billingExceptionCount=0 AND elig.invoiceCount=0",
    "AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.estimate_id=elig.id)",
    "AND (SELECT id FROM deposit_policy_events WHERE estimate_id=elig.id ORDER BY created_at DESC,id DESC LIMIT 1) IS ?",
    "AND NOT EXISTS(SELECT 1 FROM deposit_policy_events WHERE confirmation_id=?)"
  ].join(' ');
  const update=[
    "UPDATE estimates SET deposit_cents=? WHERE id=? AND status=?",
    "AND signed_at IS NULL AND accepted_at IS NULL AND total_cents=? AND deposit_cents=? AND contract_version IS ?",
    "AND EXISTS(SELECT 1 FROM deposit_policy_events d WHERE d.id=? AND d.estimate_id=estimates.id",
    "AND d.previous_total_cents=estimates.total_cents AND d.previous_deposit_cents=estimates.deposit_cents",
    "AND d.new_deposit_cents=?)"
  ].join(' ');
  let results;
  try{results=await env.DB.batch([
   env.DB.prepare(insert).bind(eventId,confirmationId,preview.actorEmail,preview.mode,preview.proposedDepositCents,
    preview.mode==='percentage'?input.percentBasisPoints:null,preview.scheduleBeforeCollection?1:0,preview.reason||null,
    createdAt,id,row.status,row.totalCents,row.depositCents,row.contractVersion,expectedLastEventId,confirmationId),
   env.DB.prepare(update).bind(preview.proposedDepositCents,id,row.status,row.totalCents,row.depositCents,row.contractVersion,eventId,preview.proposedDepositCents)
  ]);}
  catch{return json({error:'The deposit confirmation is uncertain. Refresh the audit and estimate before any deliberate retry; no payment was initiated.',saveUncertain:true,confirmationId},503);}
  if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1)
   return json({error:'The financial or audit state changed while saving. Refresh and review the audit before reconfirming.',saveUncertain:results[0]?.meta?.changes===1,confirmationId},409);
  return json({recorded:true,duplicate:false,auditEventId:eventId,estimateId:id,mode:preview.mode,
   previousDepositCents:preview.originalDepositCents,requiredDepositCents:preview.proposedDepositCents,
   remainingJobPrincipalCents:preview.remainingJobPrincipalCents,
   scheduleBeforeCollectionRequested:preview.scheduleBeforeCollection,canSchedule:false,
   signedAgreementUnchanged:true,hostedActivation:false},201);
 }catch{
  return json({error:'Cannot confirm this deposit change. Review the estimate and audit before retrying. No payment was initiated.',saveUncertain:true,confirmationId},503);
 }
}
