import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {dueReviewChecks,type ReviewRequestRow} from "../../../lib/dashboard-review-checks";
export const dynamic="force-dynamic";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401});
 try{
  // Read only completed-work customers with a confirmed review request.
  // Prepared/copied messages never qualify. Manual "review received" logs
  // suppress the prompt, but do not claim Google verified the review.
  const results=await env.DB.prepare(`SELECT c.id AS customerId,c.name AS customerName,
   (SELECT MAX(m.created_at) FROM customer_messages m
     WHERE m.customer_id=c.id AND m.template='review'
       AND m.channel IN ('text_confirmed','email_confirmed')
       AND EXISTS(SELECT 1 FROM estimates e WHERE e.id=m.estimate_id AND e.customer_id=c.id AND e.status='completed')) AS requestedAt,
   (SELECT MAX(n.created_at) FROM customer_notes n
     WHERE n.customer_id=c.id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt
   FROM customers c
   WHERE EXISTS(SELECT 1 FROM estimates e WHERE e.customer_id=c.id AND e.status='completed')
     AND EXISTS(SELECT 1 FROM customer_messages m WHERE m.customer_id=c.id
       AND m.template='review' AND m.channel IN ('text_confirmed','email_confirmed')
       AND EXISTS(SELECT 1 FROM estimates e WHERE e.id=m.estimate_id AND e.customer_id=c.id AND e.status='completed'))
   ORDER BY c.name ASC,c.id ASC`).all<ReviewRequestRow>();
  return Response.json({checks:dueReviewChecks(results.results??[])},{headers:{"Cache-Control":"no-store, private"}});
 }catch{return Response.json({error:"Unable to verify review checks. Try again."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
