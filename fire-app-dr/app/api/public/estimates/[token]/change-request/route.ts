import { env } from "cloudflare:workers";

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;
    const body=await request.json() as {message?:string};
    const message=String(body.message??"").trim();
    if(message.length<5)return Response.json({error:"Please describe what you would like changed."},{status:400});
    const estimate=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.accepted_at AS acceptedAt,c.name AS customer FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;acceptedAt:string|null;customer:string}>();
    if(!estimate)return Response.json({error:"Estimate not found."},{status:404});
    if(estimate.acceptedAt||!["draft","sent"].includes(estimate.status))return Response.json({error:"This estimate has already moved into the job workflow. Contact Kyle directly for any new scope changes."},{status:409});
    const now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO estimate_change_requests (id,estimate_id,customer_id,message,status,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),estimate.id,estimate.customerId,message,"open",now),
      env.DB.prepare("INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"estimate_change_requested",`${estimate.customer} requested an estimate change`,message,estimate.customerId,estimate.id,now),
    ]);
    return Response.json({ok:true});
  }catch{return Response.json({error:"The change request could not be sent. Please contact Kyle."},{status:500});}
}
