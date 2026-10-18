import {env} from 'cloudflare:workers';
type Receipt={id:string;estimateId:string;customerId:string;message:string;status:string;createdAt:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const confirmed=(row:Receipt)=>reply({ok:true,request:{id:row.id,message:row.message,status:row.status,createdAt:row.createdAt}});
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;
  const body=await request.json() as {message?:unknown;requestId?:unknown};
  if(typeof body.message!=='string')return reply({error:'Please describe what you would like changed.'},400);
  const message=body.message.trim();
  if(message.length<5||message.length>4000)return reply({error:'Describe the requested change using 5 to 4,000 characters.'},400);
  if(body.requestId!==undefined&&(typeof body.requestId!=='string'||!uuid.test(body.requestId)))return reply({error:'The change request identity is invalid. Refresh before submitting.'},400);
  const requestId=typeof body.requestId==='string'?body.requestId:crypto.randomUUID();
  const estimate=await env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.accepted_at AS acceptedAt,c.name AS customer FROM estimates e JOIN customers c ON c.id=e.customer_id WHERE e.share_token=? LIMIT 1`).bind(token).first<{id:string;customerId:string;status:string;acceptedAt:string|null;customer:string}>();
  if(!estimate)return reply({error:'Estimate not found.'},404);
  const findById=()=>env.DB.prepare('SELECT id,estimate_id AS estimateId,customer_id AS customerId,message,status,created_at AS createdAt FROM estimate_change_requests WHERE id=?').bind(requestId).first<Receipt>();
  const previous=await findById();
  if(previous){
   if(previous.estimateId!==estimate.id||previous.customerId!==estimate.customerId||previous.message!==message)return reply({error:'This request identity belongs to a different change. Keep the original request and review its status.'},409);
   return confirmed(previous);
  }
  // Legacy clients and a refreshed tab may use a new UUID. An identical open
  // request is still the same pending change, not a second notification.
  const findOpen=()=>env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,message,status,created_at AS createdAt FROM estimate_change_requests WHERE estimate_id=? AND customer_id=? AND message=? AND status='open' ORDER BY created_at,id LIMIT 1").bind(estimate.id,estimate.customerId,message).first<Receipt>();
  const open=await findOpen();if(open)return confirmed(open);
  if(estimate.acceptedAt||!['draft','sent'].includes(estimate.status))return reply({error:'This estimate has already moved into the job workflow. Contact First In Response Exteriors directly for new scope changes.'},409);
  const now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO estimate_change_requests (id,estimate_id,customer_id,message,status,created_at)
    SELECT ?,e.id,e.customer_id,?,'open',? FROM estimates e WHERE e.id=? AND e.share_token=? AND e.accepted_at IS NULL AND e.status IN ('draft','sent')
    AND NOT EXISTS (SELECT 1 FROM estimate_change_requests WHERE id=?)
    AND NOT EXISTS (SELECT 1 FROM estimate_change_requests WHERE estimate_id=e.id AND message=? AND status='open')`).bind(requestId,message,now,estimate.id,token,requestId,message),
   env.DB.prepare(`INSERT INTO notifications (id,type,title,body,customer_id,estimate_id,created_at)
    SELECT ?,'estimate_change_requested',?,r.message,r.customer_id,r.estimate_id,r.created_at FROM estimate_change_requests r
    WHERE r.id=? AND r.estimate_id=? AND r.customer_id=? AND r.message=? AND r.created_at=?
    AND NOT EXISTS (SELECT 1 FROM notifications WHERE id=?)`).bind('change:'+requestId,`${estimate.customer} requested an estimate change`,requestId,estimate.id,estimate.customerId,message,now,'change:'+requestId),
  ]);
  const saved=await findById()??await findOpen();
  if(!saved||saved.estimateId!==estimate.id||saved.customerId!==estimate.customerId||saved.message!==message)return reply({error:'This estimate changed before the request could be recorded. Refresh and review it before submitting again.'},409);
  return confirmed(saved);
 }catch{return reply({error:'The change request was not confirmed. Retry this same request to check whether it was recorded; do not submit a different copy.'},500);}
}
