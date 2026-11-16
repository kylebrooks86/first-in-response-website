import { env } from "cloudflare:workers";
import { readCustomerWriteJson } from "../../../../../../lib/customer-write-request-guard.mjs";

// A thrown D1 batch acknowledgment can mean the customer's signature was
// committed. Recover success ONLY for this exact current token-bound submission;
// never report somebody else's or an older acceptance as this write's receipt.
function matchesCurrentSubmission(current:{status:string;acceptedAt:string|null;signedAt:string|null;signedName:string|null;photoRelease:string|null}|null,
  now:string,signedName:string,photoRelease:string){
  return current?.status==="approved"&&current.acceptedAt===now&&
    current.signedAt===now&&current.signedName===signedName&&
    current.photoRelease===photoRelease;
}

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    const parsed=await readCustomerWriteJson(request,["signedName","photoRelease","acceptedTerms"],2048);
    if(parsed.response)return parsed.response;
    const {token}=await context.params;
    const body=parsed.value as {signedName?:string;photoRelease?:string;acceptedTerms?:boolean};
    const signedName=typeof body.signedName==="string"?body.signedName.trim():"";
    const photoRelease=body.photoRelease==="yes"?"yes":body.photoRelease==="no"?"no":"";
    if(signedName.length<2||signedName.length>120||!photoRelease||body.acceptedTerms!==true)return Response.json({error:"Please choose photo permission, type your full name, and accept the service agreement."},{status:400});
    const estimate=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.photo_release AS photoRelease,c.name AS customer,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
      FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;acceptedAt:string|null;signedName:string|null;signedAt:string|null;photoRelease:string|null;customer:string;service:string}>();
    if(!estimate)return Response.json({error:"Estimate not found."},{status:404});
    // Source-only owner exceptions cannot yet be signed: the public agreement
    // still labels every deposit as 50%. Refuse old-link approval until the
    // revised financial terms are actually rendered and expressly accepted.
    const exceptionPending=('FIRE_DEPOSIT_POLICY_CANDIDATE' in env&&env.FIRE_DEPOSIT_POLICY_CANDIDATE==='synthetic-tests-only')&&
      ('FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE' in env&&env.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE==='synthetic-contract-tests-only');
    if(exceptionPending){
      const audit=await env.DB.prepare('SELECT id FROM deposit_policy_events WHERE estimate_id=? LIMIT 1').bind(estimate.id).first();
      if(audit)return Response.json({error:'This estimate requires updated deposit terms and a new customer agreement before it can be approved. Contact First In Response Exteriors.'},{status:409});
    }
    // One token-bound readback serves BOTH already-approved replies and
    // lost-ACK/concurrent-submit recovery. A token can rotate after the first
    // SELECT; never return a signed name on the strength of stale rows.
    const confirmedAcceptance=()=>env.DB.prepare("SELECT accepted_at AS acceptedAt,status,signed_name AS signedName,signed_at AS signedAt,photo_release AS photoRelease FROM estimates WHERE id=? AND share_token=?")
      .bind(estimate.id,token).first<{acceptedAt:string|null;status:string;signedName:string|null;signedAt:string|null;photoRelease:string|null}>();
    if(estimate.status==="superseded")return Response.json({error:"This quote was replaced. Please review and sign the latest quote."},{status:409});
    if(estimate.acceptedAt){
      const current=await confirmedAcceptance();
      if(!current?.acceptedAt)return Response.json({error:"This quote link changed or was revoked. Please refresh and review the current agreement."},{status:409,headers:{"Cache-Control":"no-store"}});
      return Response.json({ok:true,acceptedAt:current.acceptedAt,signedName:current.signedName,signedAt:current.signedAt,photoRelease:current.photoRelease},{headers:{"Cache-Control":"no-store"}});
    }
    if(!["draft","sent"].includes(estimate.status))return Response.json({error:"This estimate is no longer available for approval. Please contact First In Response Exteriors."},{status:409});
    const now=new Date().toISOString();
    // Bearer-share revocation must remain effective if the token is changed
    // after SELECT but before this D1 batch. Retry readback is token-bound too.
    let acceptedChanges=0;
    try{
      const [accepted]=await env.DB.batch([
      env.DB.prepare(`UPDATE estimates SET status='approved',accepted_at=?,signed_name=?,signed_at=?,photo_release=?,contract_version='2026-09-21'
        WHERE id=? AND share_token=? AND accepted_at IS NULL AND status IN ('draft','sent')
        AND subtotal_cents BETWEEN 0 AND 9007199254740991
        AND discount_cents BETWEEN 0 AND 9007199254740991
        AND total_cents BETWEEN 0 AND 9007199254740991
        AND deposit_cents BETWEEN 0 AND 9007199254740991
        AND discount_cents<=subtotal_cents AND total_cents>=deposit_cents
        -- A signed quote must reconcile to its exact current itemized price,
        -- including stacked discounts; validate inside the same atomic UPDATE.
        -- Bounds on individual money fields alone do not prove these totals.
        AND total_cents=subtotal_cents-discount_cents
        AND subtotal_cents=(SELECT COALESCE(SUM(ei.total_cents),-1)
          FROM estimate_items ei WHERE ei.estimate_id=estimates.id)
        AND EXISTS (SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=estimates.id)
        AND NOT EXISTS (SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=estimates.id AND (ei.name IS NULL OR TRIM(ei.name)='' OR ei.quantity<=0 OR ei.total_cents<0 OR ei.total_cents>9007199254740991))
        ${exceptionPending?"AND NOT EXISTS(SELECT 1 FROM deposit_policy_events d WHERE d.estimate_id=estimates.id)":""}`)
        .bind(now,signedName,now,photoRelease,estimate.id,token),
      env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND accepted_at=? AND signed_at=?) AND NOT EXISTS (SELECT 1 FROM notifications WHERE type='estimate_accepted' AND estimate_id=?)`)
        .bind(crypto.randomUUID(),"estimate_accepted",`${estimate.customer} approved an estimate`,`${estimate.service} was approved. Contact the customer to schedule the job.`,estimate.customerId,estimate.id,now,estimate.id,now,now,estimate.id),
      ]);
      acceptedChanges=accepted.meta.changes;
    }catch{
      // D1 can commit and lose the batch acknowledgment. Query exactly once
      // using the STILL-current bearer token; never repeat the UPDATE/alert.
      // An absent, revoked or conflicting receipt is uncertain, not rejected.
      const current=await confirmedAcceptance().catch(()=>null);
      if(matchesCurrentSubmission(current,now,signedName,photoRelease))
        return Response.json({ok:true,acceptedAt:current!.acceptedAt,
          signedName:current!.signedName,signedAt:current!.signedAt,
          photoRelease:current!.photoRelease},
          {headers:{"Cache-Control":"no-store"}});
      return Response.json({error:"We could not confirm whether your agreement was saved. Refresh this estimate before trying again.",saveUncertain:true},
        {status:503,headers:{"Cache-Control":"no-store"}});
    }
    if(!acceptedChanges){
      const current=await confirmedAcceptance();
      if(current?.acceptedAt)return Response.json({ok:true,acceptedAt:current.acceptedAt,signedName:current.signedName,signedAt:current.signedAt,photoRelease:current.photoRelease},{headers:{"Cache-Control":"no-store"}});
      if(current&&["draft","sent"].includes(current.status))return Response.json({error:"This estimate has a billing or service-line integrity issue and cannot be approved yet. Please contact First In Response Exteriors."},{status:409});
      return Response.json({error:"This estimate changed while you were approving it. Please refresh or contact First In Response Exteriors."},{status:409});
    }
    return Response.json({ok:true,acceptedAt:now,signedName,signedAt:now,photoRelease},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"The estimate could not be approved. Please contact First In Response Exteriors."},{status:500});}
}
