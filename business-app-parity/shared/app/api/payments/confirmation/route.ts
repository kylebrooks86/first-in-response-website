import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private'}});
// Read only: a lost acknowledgement must never trigger another financial write.
export async function GET(request:Request){
 const owner=await getChatGPTUser();
 if(owner?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 const params=new URL(request.url).searchParams,estimateId=params.get('estimateId'),requestId=params.get('requestId');
 if(!estimateId||estimateId.length>200||!requestId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return json({error:'Invalid payment confirmation identifiers.'},400);
 try{
  // D1 batch gives both reads one consistent database snapshot.
  const [jobs,records]=await env.DB.batch([
   env.DB.prepare(`SELECT e.id,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE estimate_id=e.id AND status='paid' AND type NOT IN ('Tip','Tip Refund')),0) AS paidCents FROM estimates e WHERE e.id=?`).bind(estimateId),
   env.DB.prepare(`SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents,status,provider_id AS reference,processing_fee_cents AS processingFeeCents,gross_received_cents AS grossReceivedCents,bundled_tip_cents AS bundledTipCents,processing_method AS processingMethod FROM payments WHERE id IN (?,?)`).bind('manual-'+requestId,'manual-'+requestId+'-tip'),
  ]);
  const job=jobs.results[0] as {id:string;paidCents:number}|undefined;
  if(!job)return json({error:'That job is unavailable. Keep the saved payment attempt for review.'},404);
  if(!Number.isSafeInteger(job.paidCents)||job.paidCents<0)return json({error:'Recorded totals require owner review.'},409);
  const rows=records.results as {estimateId:string}[];
  if(rows.some(row=>row.estimateId!==estimateId))return json({error:'This payment attempt belongs to another job.'},409);
  return json({estimateId,requestId,confirmed:rows.length>0,paidCents:job.paidCents,records:rows});
 }catch{return json({error:'Payment status is still uncertain. Keep the saved attempt and check again.'},503);}
}
