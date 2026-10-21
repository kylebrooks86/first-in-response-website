import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {estimateReminderStage, type ReminderRecord} from "../../../lib/follow-up-timing";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
// Explicit owner actions append history. They never send messages or alter estimates.
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401});
 try{
  const value=await request.json() as Record<string,unknown>;
  const {customerId,estimateId,action,operationId}=value;
  if(typeof customerId!=="string"||!customerId||customerId.length>128||typeof estimateId!=="string"||!estimateId||estimateId.length>128||(typeof action!=="string"||!['contacted','snooze'].includes(action))||typeof operationId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId))return Response.json({error:"A matching customer, estimate and explicit action are required."},{status:400});
  const channel=action==='contacted'?'contact_recorded':'followup_snoozed',template=action==='contacted'?'followupContact':'followupSnooze';
  const id='followup-action:'+operationId;
  const previous=await env.DB.prepare('SELECT customer_id AS customerId,estimate_id AS estimateId,channel,created_at AS createdAt,body FROM customer_messages WHERE id=?').bind(id).first<{customerId:string;estimateId:string;channel:string;createdAt:string;body:string}>();
  if(previous){if(previous.customerId!==customerId||previous.estimateId!==estimateId||previous.channel!==channel)return Response.json({error:"That operation belongs to a different action."},{status:409});return Response.json({action,createdAt:previous.createdAt,snoozeUntil:action==='snooze'?previous.body:null});}
  const record=await env.DB.prepare(`SELECT e.status,
   (SELECT MIN(created_at) FROM customer_messages WHERE estimate_id=e.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed')) AS firstEstimateSentAt,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND template='estimate' AND channel IN ('text_confirmed','email_confirmed')) AS lastEstimateSentAt,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND template IN ('estimate','followUp1','followUp3','followUp7') AND channel IN ('text_confirmed','email_confirmed')) AS lastEstimateContactAt,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND template='followUp1' AND channel IN ('text_confirmed','email_confirmed')) AS stage1At,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND template='followUp3' AND channel IN ('text_confirmed','email_confirmed')) AS stage3At,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND template='followUp7' AND channel IN ('text_confirmed','email_confirmed')) AS stage7At,
   (SELECT MAX(created_at) FROM customer_messages WHERE estimate_id=e.id AND channel='contact_recorded' AND template='followupContact') AS lastManualContactAt,
   (SELECT body FROM customer_messages WHERE estimate_id=e.id AND channel='followup_snoozed' AND template='followupSnooze' ORDER BY created_at DESC,id DESC LIMIT 1) AS snoozeUntil
   FROM estimates e WHERE e.id=? AND e.customer_id=? AND NOT EXISTS(SELECT 1 FROM invoices WHERE estimate_id=e.id) AND NOT EXISTS(SELECT 1 FROM notifications WHERE estimate_id=e.id AND type='payment_overage' AND resolved_at IS NULL)`).bind(estimateId,customerId).first<ReminderRecord>();
  const now=Date.now();if(!record||!estimateReminderStage(record,now).template)return Response.json({error:"Refresh and review this estimate before recording a follow-up action."},{status:409});
  const createdAt=new Date(now).toISOString(),body=action==='snooze'?new Date(now+7*86400000).toISOString():'Owner recorded customer contact. No message send or delivery is claimed.';
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM estimates e WHERE e.id=? AND e.customer_id=? AND e.status='sent' AND NOT EXISTS(SELECT 1 FROM invoices WHERE estimate_id=e.id) AND NOT EXISTS(SELECT 1 FROM notifications WHERE estimate_id=e.id AND type='payment_overage' AND resolved_at IS NULL))`).bind(id,customerId,estimateId,channel,template,body,createdAt,estimateId,customerId).run();
  if(result.meta.changes!==1){
   // Concurrent taps may both pass the initial read. The winning insert is
   // authoritative; recover the same immutable operation without a second
   // contact/snooze event or an unconfirmed-save error.
   const raced=await env.DB.prepare('SELECT customer_id AS customerId,estimate_id AS estimateId,channel,created_at AS createdAt,body FROM customer_messages WHERE id=?').bind(id).first<{customerId:string;estimateId:string;channel:string;createdAt:string;body:string}>();
   if(raced){
    if(raced.customerId!==customerId||raced.estimateId!==estimateId||raced.channel!==channel)
     return Response.json({error:"That operation belongs to a different action."},{status:409});
    return Response.json({action,createdAt:raced.createdAt,snoozeUntil:action==='snooze'?raced.body:null},{status:200});
   }
   return Response.json({error:"The estimate changed. Refresh before recording an action."},{status:409});
  }
  return Response.json({action,createdAt,snoozeUntil:action==='snooze'?body:null},{status:201});
 }catch{return Response.json({error:"Action save is not confirmed. Refresh to inspect saved history before trying again."},{status:503});}
}
