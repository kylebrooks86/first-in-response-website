import {env} from 'cloudflare:workers';
import {SERVICE_AGREEMENT} from '../../../../../../lib/fire-templates';
import {agreementVersion,agreementScope,agreementDigest,validateAgreementItems} from '../../../../../../lib/deposit-agreement-commitment.mjs';
import {describeRevisedDepositTerms} from '../../../../../../lib/deposit-agreement-revision.mjs';
const h={'Cache-Control':'no-store, private','Vary':'Cookie'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:h});
const active=(e:Cloudflare.Env)=>('FIRE_DEPOSIT_POLICY_CANDIDATE' in e&&e.FIRE_DEPOSIT_POLICY_CANDIDATE==='synthetic-tests-only')&&
 ('FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE' in e&&e.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE==='synthetic-contract-tests-only')&&
 ('FIRE_DEPOSIT_AGREEMENT_CANDIDATE' in e&&e.FIRE_DEPOSIT_AGREEMENT_CANDIDATE==='synthetic-signature-tests-only');
const scopeSql="COALESCE((SELECT json_group_array(json_array(id,name,description,quantity,unit,total_cents)) FROM (SELECT id,name,description,quantity,unit,total_cents FROM estimate_items WHERE estimate_id=estimates.id ORDER BY rowid)),'[]')";
const version=/^deposit-exception-v1:([0-9a-f-]{36})$/i;
const hex=/^[0-9a-f]{64}$/;

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 if(!active(env))return reply({error:'Revised agreement signature is not enabled.'},404);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return reply({error:'JSON required.'},415);
 let body:{version?:unknown;documentDigest?:unknown;signedName?:unknown;photoRelease?:unknown;acceptedTerms?:unknown};
 try{
  const raw=await request.text();if(raw.length>4096)return reply({error:'Request too large.'},413);
  body=JSON.parse(raw);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['version','documentDigest','signedName','photoRelease','acceptedTerms'].includes(k)))return reply({error:'Invalid signature request.'},400);
 }catch{return reply({error:'Invalid signature request.'},400);}
 const name=typeof body.signedName==='string'?body.signedName.trim():'';
 const photo=body.photoRelease;
 if(name.length<2||name.length>120||!['yes','no'].includes(String(photo))||body.acceptedTerms!==true||
   typeof body.version!=='string'||!version.test(body.version)||typeof body.documentDigest!=='string'||!hex.test(body.documentDigest))
   return reply({error:'Review and sign the exact current deposit agreement and photo permission.'},400);
 const docHash=body.documentDigest.toLowerCase(),acceptedVersion=body.version+':sha256:'+docHash;
 try{
  const {token}=await params;
  const e=await env.DB.prepare("SELECT e.id,e.customer_id AS customerId,e.status,e.total_cents AS totalCents,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.deposit_cents AS depositCents,e.accepted_at AS acceptedAt,e.signed_at AS signedAt,e.signed_name AS signedName,e.photo_release AS photoRelease,e.contract_version AS contractVersion,e.first_viewed_at AS firstViewedAt,c.name AS customer FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1")
   .bind(token).first<{id:string;customerId:string;status:string;totalCents:number;subtotalCents:number;discountCents:number;depositCents:number;acceptedAt:string|null;signedAt:string|null;signedName:string|null;photoRelease:string|null;contractVersion:string|null;firstViewedAt:string|null;customer:string}>();
  if(!e)return reply({error:'Estimate not found.'},404);
  const receipt={ok:true,estimateId:e.id,version:body.version,documentDigest:docHash,acceptedAt:e.acceptedAt,signedAt:e.signedAt,signedName:e.signedName,photoRelease:e.photoRelease,canSchedule:false,automaticPayment:false};
  if(e.acceptedAt){
   if(e.contractVersion===acceptedVersion&&e.signedName===name&&e.photoRelease===photo&&e.signedAt){
    const signed=await env.DB.prepare("SELECT * FROM deposit_agreement_snapshots WHERE estimate_id=? AND document_version=?").bind(e.id,body.version).first<Record<string,unknown>>();
    if(signed?.event_id===body.version.slice('deposit-exception-v1:'.length)&&signed?.document_digest===docHash&&
       signed?.signed_name===name&&signed?.photo_release===photo&&signed?.signed_at===e.signedAt&&signed?.accepted_at===e.acceptedAt)
      return reply({...receipt,replayed:true});
    return reply({error:'Signed document snapshot could not be independently verified. No records changed.'},409);
   }
   return reply({error:'A different or already accepted agreement is on file. Contact First In Response Exteriors.'},409);
  }
  if(!['draft','sent'].includes(e.status)||e.signedAt||!e.firstViewedAt)return reply({error:'The revised agreement was not viewed or is no longer signable.'},409);
  const audit=await env.DB.prepare("SELECT * FROM deposit_policy_events WHERE estimate_id=? ORDER BY created_at DESC,id DESC LIMIT 101").bind(e.id).all<Record<string,unknown>>();
  if(audit.results.length===0||audit.results.length>100||body.version!==agreementVersion(audit.results[0].id))return reply({error:'Revised deposit terms changed. Refresh before signing.'},409);
  const financial=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM payments WHERE estimate_id=?) paymentCount,(SELECT COUNT(*) FROM invoices WHERE estimate_id=?) invoiceCount,(SELECT COUNT(*) FROM payment_checkout_sessions WHERE estimate_id=? AND status='open') openCheckoutCount,(SELECT COUNT(*) FROM payment_refunds WHERE estimate_id=? AND status='pending') pendingRefundCount").bind(e.id,e.id,e.id,e.id).first<{paymentCount:number;invoiceCount:number;openCheckoutCount:number;pendingRefundCount:number}>();
  if(!financial)return reply({error:'Unable to verify financial records.'},409);
  try{describeRevisedDepositTerms({estimate:{id:e.id,status:e.status,totalCents:e.totalCents,depositCents:e.depositCents,acceptedAt:e.acceptedAt,signedAt:e.signedAt},latestEvent:audit.results[0],eventCount:audit.results.length,...financial});}
  catch{return reply({error:'Agreement, deposit or financial records require reconciliation.'},409);}
  const items=await env.DB.prepare("SELECT id,name,description,quantity,unit,total_cents FROM estimate_items WHERE estimate_id=? ORDER BY rowid").bind(e.id).all<{id:string;name:string;description:string;quantity:number;unit:string;total_cents:number}>();
  if(!validateAgreementItems(items.results,e.subtotalCents,e.discountCents,e.totalCents))return reply({error:'Service lines and total need review.'},409);
  const scope=agreementScope(items.results);
  const computed=await agreementDigest({eventId:audit.results[0].id,totalCents:e.totalCents,depositCents:e.depositCents,mode:audit.results[0].mode,scope,terms:SERVICE_AGREEMENT});
  if(computed!==docHash)return reply({error:'Agreement content or services changed. Refresh and review the current document.'},409);
  const now=new Date().toISOString();
  const guardedSql="UPDATE estimates SET status='approved',accepted_at=?,signed_at=?,signed_name=?,photo_release=?,contract_version=? WHERE id=? AND share_token=? AND status=? AND status IN ('draft','sent') AND first_viewed_at IS NOT NULL AND accepted_at IS NULL AND signed_at IS NULL AND total_cents=? AND deposit_cents=? AND subtotal_cents=? AND discount_cents=? AND "+scopeSql+"=? AND (SELECT id FROM deposit_policy_events WHERE estimate_id=estimates.id ORDER BY created_at DESC,id DESC LIMIT 1)=? AND NOT EXISTS(SELECT 1 FROM payments WHERE estimate_id=estimates.id) AND NOT EXISTS(SELECT 1 FROM invoices WHERE estimate_id=estimates.id) AND NOT EXISTS(SELECT 1 FROM payment_checkout_sessions WHERE estimate_id=estimates.id AND status='open') AND NOT EXISTS(SELECT 1 FROM payment_refunds WHERE estimate_id=estimates.id AND status='pending')";
  let result;
  try{
   result=await env.DB.batch([
    env.DB.prepare(guardedSql).bind(now,now,name,photo,acceptedVersion,e.id,token,e.status,e.totalCents,e.depositCents,e.subtotalCents,e.discountCents,scope,audit.results[0].id),
    env.DB.prepare("INSERT INTO deposit_agreement_snapshots(event_id,estimate_id,document_version,document_digest,total_cents,deposit_cents,mode,scope_json,agreement_text,signed_name,photo_release,signed_at,accepted_at) SELECT ?,id,?,?,?,?,?,?,?,?,?,?,? FROM estimates WHERE id=? AND accepted_at=? AND signed_at=? AND contract_version=? AND total_cents=? AND deposit_cents=? AND (SELECT id FROM deposit_policy_events WHERE estimate_id=estimates.id ORDER BY created_at DESC,id DESC LIMIT 1)=?")
     .bind(audit.results[0].id,body.version,docHash,e.totalCents,e.depositCents,audit.results[0].mode,scope,SERVICE_AGREEMENT,name,photo,now,now,e.id,now,now,acceptedVersion,e.totalCents,e.depositCents,audit.results[0].id),
    env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) SELECT ?,'estimate_accepted',?,?,customer_id,id,? FROM estimates WHERE id=? AND accepted_at=? AND contract_version=? AND EXISTS(SELECT 1 FROM deposit_agreement_snapshots WHERE estimate_id=? AND document_version=? AND document_digest=?) AND NOT EXISTS(SELECT 1 FROM notifications WHERE type='estimate_accepted' AND estimate_id=?)")
     .bind(crypto.randomUUID(),e.customer+' signed revised deposit terms','Customer signed deposit revision '+body.version+'. Scheduling still requires separate eligibility.',now,e.id,now,acceptedVersion,e.id,body.version,docHash,e.id)
   ]);
  }catch{
   return reply({error:'Signature save is uncertain. Retry the same exact agreement to review its receipt; no payment was initiated.',saveUncertain:true,version:body.version},503);
  }
  if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)return reply({error:'Estimate or signed document changed during signing. Refresh and review before trying again.',version:body.version},409);
  return reply({ok:true,estimateId:e.id,version:body.version,documentDigest:docHash,acceptedAt:now,signedAt:now,signedName:name,photoRelease:photo,canSchedule:false,automaticPayment:false},201);
 }catch{return reply({error:'Cannot confirm revised agreement. Refresh and retry the exact same request; no payment was initiated.',saveUncertain:true},503);}
}
