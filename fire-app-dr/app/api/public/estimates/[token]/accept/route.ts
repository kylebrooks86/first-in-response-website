import { env } from "cloudflare:workers";

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    const {token}=await context.params;
    const body=await request.json() as {signedName?:string;photoRelease?:string;acceptedTerms?:boolean};
    const signedName=String(body.signedName??"").trim();
    const photoRelease=body.photoRelease==="yes"?"yes":body.photoRelease==="no"?"no":"";
    if(signedName.length<2||signedName.length>120||!photoRelease||body.acceptedTerms!==true)return Response.json({error:"Please choose photo permission, type your full name, and accept the service agreement."},{status:400});
    const estimate=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.accepted_at AS acceptedAt,c.name AS customer,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Exterior cleaning service') AS service
      FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;acceptedAt:string|null;customer:string;service:string}>();
    if(!estimate)return Response.json({error:"Estimate not found."},{status:404});
    if(estimate.acceptedAt)return Response.json({ok:true,acceptedAt:estimate.acceptedAt});
    if(!["draft","sent"].includes(estimate.status))return Response.json({error:"This estimate is no longer available for approval. Please contact Kyle."},{status:409});
    const now=new Date().toISOString();
    const [accepted]=await env.DB.batch([
      env.DB.prepare(`UPDATE estimates SET status='approved',accepted_at=?,signed_name=?,signed_at=?,photo_release=?,contract_version='2026-09-21'
        WHERE id=? AND accepted_at IS NULL AND status IN ('draft','sent')
        AND subtotal_cents BETWEEN 0 AND 9007199254740991
        AND discount_cents BETWEEN 0 AND 9007199254740991
        AND total_cents BETWEEN 0 AND 9007199254740991
        AND deposit_cents BETWEEN 0 AND 9007199254740991
        AND discount_cents<=subtotal_cents AND total_cents>=deposit_cents
        AND EXISTS (SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=estimates.id)
        AND NOT EXISTS (SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=estimates.id AND (ei.name IS NULL OR TRIM(ei.name)='' OR ei.quantity<=0 OR ei.total_cents<0 OR ei.total_cents>9007199254740991))`)
        .bind(now,signedName,now,photoRelease,estimate.id),
      env.DB.prepare(`INSERT OR IGNORE INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
        SELECT ?,?,?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND accepted_at=? AND signed_at=?)`)
        .bind(crypto.randomUUID(),"estimate_accepted",`${estimate.customer} approved an estimate`,`${estimate.service} was approved. Contact the customer to schedule the job.`,estimate.customerId,estimate.id,now,estimate.id,now,now),
    ]);
    if(!accepted.meta.changes){
      const current=await env.DB.prepare("SELECT accepted_at AS acceptedAt,status FROM estimates WHERE id=?").bind(estimate.id).first<{acceptedAt:string|null;status:string}>();
      if(current?.acceptedAt)return Response.json({ok:true,acceptedAt:current.acceptedAt});
      if(current&&["draft","sent"].includes(current.status))return Response.json({error:"This estimate has a billing or service-line integrity issue and cannot be approved yet. Please contact Kyle."},{status:409});
      return Response.json({error:"This estimate changed while you were approving it. Please refresh or contact Kyle."},{status:409});
    }
    return Response.json({ok:true,acceptedAt:now,signedName});
  }catch{return Response.json({error:"The estimate could not be approved. Please contact Kyle."},{status:500});}
}
