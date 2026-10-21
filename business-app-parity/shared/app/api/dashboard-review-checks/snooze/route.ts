import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../../chatgpt-auth";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store, private"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Receipt={id:string;customerId:string;estimateId:string|null;channel:string;template:string;body:string;createdAt:string};
/** A review-status CHECK snooze. Never sends a review request or claims a review arrived. */
export async function POST(request:Request){
 const owner=await getChatGPTUser();
 if(!owner||owner.email.toLowerCase()!=="kylebrooks8605@gmail.com")return json({error:"Unauthorized"},401);
 try{
  const input=await request.json() as Record<string,unknown>;
  const {customerId,requestedAt,operationId}=input;
  if(typeof customerId!=="string"||!customerId||customerId.length>128||
   typeof requestedAt!=="string"||requestedAt.length>64||!Number.isFinite(Date.parse(requestedAt))||
   typeof operationId!=="string"||!uuid.test(operationId))
   return json({error:"A customer, confirmed review date and saved action ID are required."},400);
  const id="review-check-snooze:"+operationId;
  const prior=()=>env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE id=?").bind(id).first<Receipt>();
  const confirm=(row:Receipt,status:number)=>{
   if(row.customerId!==customerId||row.channel!=="review_check_snoozed"||row.template!=="reviewCheckSnooze"||
      !Number.isFinite(Date.parse(row.body))||!row.estimateId)
    return json({error:"That saved operation belongs to another action."},409);
   return json({saved:true,customerId,snoozeUntil:row.body},status);
  };
  const previous=await prior();if(previous)return confirm(previous,200);
  const now=new Date();
  if(Date.parse(requestedAt)>now.getTime()-7*86400000)return json({error:"The review status check is not due yet."},409);
  const until=new Date(now.getTime()+7*86400000).toISOString();
  // The precise request is confirmed on a COMPLETED job; incomplete or
  // unrelated jobs cannot authorize a check deferral. No active deferrals
  // can stack and a new confirmed request supersedes older check snoozes.
  await env.DB.prepare(`
   INSERT OR IGNORE INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at)
   SELECT ?,m.customer_id,m.estimate_id,'review_check_snoozed','reviewCheckSnooze',?,?
   FROM customer_messages m JOIN estimates e ON e.id=m.estimate_id AND e.customer_id=m.customer_id
   WHERE m.customer_id=? AND m.created_at=? AND m.template='review'
     AND m.channel IN ('text_confirmed','email_confirmed') AND e.status='completed'
     AND NOT EXISTS(SELECT 1 FROM customer_notes n WHERE n.customer_id=m.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED')
     AND NOT EXISTS(SELECT 1 FROM customer_messages later
       JOIN estimates le ON le.id=later.estimate_id AND le.customer_id=later.customer_id
       WHERE later.customer_id=m.customer_id AND later.template='review'
         AND later.channel IN ('text_confirmed','email_confirmed') AND le.status='completed' AND later.created_at>m.created_at)
     AND NOT EXISTS(SELECT 1 FROM customer_messages defer
       WHERE defer.customer_id=m.customer_id AND defer.channel='review_check_snoozed'
         AND defer.template='reviewCheckSnooze' AND defer.body>?)
   ORDER BY m.id DESC LIMIT 1
  `).bind(id,until,now.toISOString(),customerId,requestedAt,now.toISOString()).run();
  const saved=await prior();
  if(saved)return confirm(saved,201);
  return json({error:"Review status changed or is already deferred. Refresh the customer and check saved history."},409);
 }catch{return json({error:"Review check snooze is unconfirmed. Check saved history before trying a new action."},503);}
}
