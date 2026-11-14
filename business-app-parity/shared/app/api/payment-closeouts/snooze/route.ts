import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../../chatgpt-auth";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, private"}});
type SnoozeReceipt={id:string;customerId:string;estimateId:string;channel:string;template:string;body:string;createdAt:string};
const OP=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Owner-controlled seven-day review-request snooze; never sends a message. */
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!=="kylebrooks8605@gmail.com")return json({error:"Unauthorized"},401);
 try{
  const value=await request.json() as Record<string,unknown>;
  const {estimateId,customerId,operationId}=value;
  if(typeof estimateId!=="string"||!estimateId||estimateId.length>128||
   typeof customerId!=="string"||!customerId||customerId.length>128||
   typeof operationId!=="string"||!OP.test(operationId))return json({error:"A matching customer, job and saved snooze request are required."},400);
  const id="review-snooze:"+operationId;
  const existing=()=>env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(id).first<SnoozeReceipt>();
  const receipt=(row:SnoozeReceipt)=>{
   if(row.customerId!==customerId||row.estimateId!==estimateId||row.channel!=="review_snoozed"||row.template!=="reviewSnooze"||
    !Number.isFinite(Date.parse(row.body)))return json({error:"This request was already used for a different action."},409);
   return json({saved:true,estimateId,customerId,snoozeUntil:row.body},200);
  };
  const before=await existing();
  if(before)return receipt(before);
  const now=new Date(),until=new Date(now.getTime()+7*86400000).toISOString();
  const result=await env.DB.prepare(`
   INSERT OR IGNORE INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at)
   SELECT ?,e.customer_id,e.id,'review_snoozed','reviewSnooze',?,? FROM estimates e
   WHERE e.id=? AND e.customer_id=? AND e.status='completed'
    AND COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)>0
    AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0)
      =COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)
    AND EXISTS(SELECT 1 FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.amount_cents>0 AND p.type NOT IN ('Tip','Tip Refund'))
    AND NOT EXISTS(SELECT 1 FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending')
    AND NOT EXISTS(SELECT 1 FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open')
    AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM customer_messages m WHERE m.estimate_id=e.id AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed'))
    AND NOT EXISTS(SELECT 1 FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED')
    AND NOT EXISTS(SELECT 1 FROM customer_messages m WHERE m.estimate_id=e.id AND m.channel='review_snoozed' AND m.template='reviewSnooze' AND m.body>?)
  `).bind(id,until,now.toISOString(),estimateId,customerId,now.toISOString()).run();
  const after=await existing();
  if(after){
   const confirmation=receipt(after);
   return result.meta.changes===1?json({saved:true,estimateId,customerId,snoozeUntil:after.body},201):confirmation;
  }
  return json({error:"That review action changed or is already snoozed. Refresh verified customer history before trying again."},409);
 }catch{return json({error:"Snooze could not be confirmed. Keep this action visible until its saved status is verified."},503);}
}
