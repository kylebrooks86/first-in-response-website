import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
const OWNER_EMAIL='kylebrooks8605@gmail.com';
const headers={'Cache-Control':'no-store, private'};
type Context={params:Promise<{id:string}>};
async function owner(){const user=await getChatGPTUser();return user?.email.toLowerCase()===OWNER_EMAIL?user:null;}
async function history(id:string){
  const rows=await env.DB.prepare(`SELECT cr.id,cr.message,cr.status,cr.created_at AS createdAt,
    n.created_at AS resolvedAt,n.body AS resolutionNote
    FROM estimate_change_requests cr JOIN estimates e ON e.id=cr.estimate_id AND e.customer_id=cr.customer_id
    LEFT JOIN customer_notes n ON n.id='change-request-resolved:'||cr.id AND n.customer_id=cr.customer_id
    WHERE cr.estimate_id=? ORDER BY cr.created_at DESC,cr.id DESC LIMIT 501`).bind(id).all();
  if(rows.results.length>500)throw Error('History limit exceeded');
  return rows.results;
}
export async function GET(_request:Request,{params}:Context){
  if(!await owner())return Response.json({error:'Unauthorized'},{status:401,headers});
  try{
    const {id}=await params;
    if(!await env.DB.prepare('SELECT id FROM estimates WHERE id=?').bind(id).first())return Response.json({error:'Estimate not found.'},{status:404,headers});
    return Response.json({requests:await history(id)},{headers});
  }catch{return Response.json({error:'Complete change-request history could not be loaded. Refresh history before resolving a request.'},{status:503,headers});}
}
export async function PATCH(request:Request,{params}:Context){
  const user=await owner();if(!user)return Response.json({error:'Unauthorized'},{status:401,headers});
  try{
    const {id}=await params,body=await request.json() as {requestId?:unknown;confirm?:unknown};
    if(typeof body.requestId!=='string'||!body.requestId||body.requestId.length>200||body.confirm!==true)return Response.json({error:'Choose and explicitly confirm one change request.'},{status:400,headers});
    const row=await env.DB.prepare(`SELECT cr.id,cr.customer_id AS customerId,cr.message,cr.status,cr.created_at AS createdAt
      FROM estimate_change_requests cr JOIN estimates e ON e.id=cr.estimate_id AND e.customer_id=cr.customer_id
      WHERE cr.id=? AND cr.estimate_id=?`).bind(body.requestId,id).first<{id:string;customerId:string;message:string;status:string;createdAt:string}>();
    if(!row)return Response.json({error:'Change request not found for this estimate.'},{status:404,headers});
    if(!['open','resolved'].includes(row.status))return Response.json({error:'This request has an unsupported state. Refresh and review it.'},{status:409,headers});
    // A stable note identity plus one native D1 batch makes retries harmless.
    // Historical resolved rows are never backfilled with an invented actor/time.
    if(row.status==='open'){
      const noteId='change-request-resolved:'+row.id,now=new Date().toISOString();
      const note=`Estimate ${id}: change request marked resolved by owner ${user.email} at ${now}. This is not customer approval or payment. Original request (${row.createdAt}): ${row.message}`;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO customer_notes(id,customer_id,body,created_at)
          SELECT ?,cr.customer_id,?,? FROM estimate_change_requests cr JOIN estimates e ON e.id=cr.estimate_id AND e.customer_id=cr.customer_id
          WHERE cr.id=? AND cr.estimate_id=? AND cr.status='open'
          AND NOT EXISTS(SELECT 1 FROM customer_notes WHERE id=?)`).bind(noteId,note,now,row.id,id,noteId),
        env.DB.prepare(`UPDATE estimate_change_requests SET status='resolved' WHERE id=? AND estimate_id=? AND status='open'
          AND EXISTS(SELECT 1 FROM customer_notes n WHERE n.id=? AND n.customer_id=estimate_change_requests.customer_id AND n.body=? AND n.created_at=?)`).bind(row.id,id,noteId,note,now),
      ]);
    }
    const requests=await history(id);
    if(requests.find(r=>r.id===row.id)?.status!=='resolved')return Response.json({error:'Request changed while saving. Refresh history before trying again.'},{status:409,headers});
    return Response.json({requests},{headers});
  }catch{return Response.json({error:'Resolution result is unconfirmed. Refresh history before retrying.'},{status:503,headers});}
}
