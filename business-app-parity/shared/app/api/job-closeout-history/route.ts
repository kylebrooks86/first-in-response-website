import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {closeoutHistoryItem,type CloseoutHistoryRow} from '../../../lib/job-closeout-history';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
/** Customer-level tracking from existing completed-job messages/flags; no message bodies or writes. */
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 const cursor=new URL(request.url).searchParams.get('cursor');
 if(cursor!==null&&!/^[A-Za-z0-9:_-]{1,128}$/.test(cursor))return json({error:'Invalid closeout history cursor.'},400);
 try{
  const rows=await env.DB.prepare(`WITH history AS (
   SELECT c.id AS customerId,c.name AS customerName,
    (SELECT m.created_at FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
     WHERE m.customer_id=c.id AND e.status='completed' AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed') ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS requestedAt,
    (SELECT m.estimate_id FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
     WHERE m.customer_id=c.id AND e.status='completed' AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed') ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS requestedEstimateId,
    (SELECT MAX(n.created_at) FROM customer_notes n WHERE n.customer_id=c.id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt,
    (SELECT m.created_at FROM customer_messages m WHERE m.customer_id=c.id AND m.template='reviewCheckSnooze' AND m.channel='review_check_snoozed' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS checkSnoozedAt,
    (SELECT m.body FROM customer_messages m WHERE m.customer_id=c.id AND m.template='reviewCheckSnooze' AND m.channel='review_check_snoozed' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS checkSnoozeUntil,
    (SELECT m.created_at FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
     WHERE m.customer_id=c.id AND e.status='completed' AND m.template='reviewSnooze' AND m.channel='review_snoozed' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS requestSnoozedAt,
    (SELECT m.body FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
     WHERE m.customer_id=c.id AND e.status='completed' AND m.template='reviewSnooze' AND m.channel='review_snoozed' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS requestSnoozeUntil,
    (SELECT m.estimate_id FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
     WHERE m.customer_id=c.id AND e.status='completed' AND m.template='reviewSnooze' AND m.channel='review_snoozed' ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS snoozedEstimateId,
    (SELECT e.id FROM estimates e WHERE e.customer_id=c.id AND e.status='completed' ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS latestCompletedId
   FROM customers c WHERE (? IS NULL OR c.id>?) AND EXISTS(SELECT 1 FROM estimates e WHERE e.customer_id=c.id AND e.status='completed')
  ) SELECT customerId,customerName,COALESCE(requestedEstimateId,snoozedEstimateId,latestCompletedId) AS estimateId,
    requestedAt,reviewReceivedAt,checkSnoozedAt,checkSnoozeUntil,requestSnoozedAt,requestSnoozeUntil
   FROM history WHERE requestedAt IS NOT NULL OR reviewReceivedAt IS NOT NULL OR requestSnoozeUntil>?
   ORDER BY customerId ASC LIMIT 201`).bind(cursor,cursor,new Date().toISOString()).all<CloseoutHistoryRow>();
  const page=(rows.results??[]).slice(0,200),hasMore=(rows.results??[]).length>200;
  return json({items:page.map(row=>closeoutHistoryItem(row)),nextCursor:hasMore?page.at(-1)!.customerId:null});
 }catch{return json({error:'Closeout history could not be verified. Refresh before acting on review status.'},503);}
}
