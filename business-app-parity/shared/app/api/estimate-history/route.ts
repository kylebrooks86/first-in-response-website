import {customerPropertiesEnabled,propertyAssociationColumns} from '../../../lib/customer-properties';
import {serviceLocationsEnabled,serviceAddressColumns,serviceAddressSql} from "../../../lib/service-location";
import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401});
 const url=new URL(request.url),sizeText=url.searchParams.get("limit")??"50";
 if(!/^(?:[1-9]|[1-4][0-9]|50)$/.test(sizeText))return Response.json({error:"Page size must be 1 through 50."},{status:400});
 const focus=url.searchParams.get("focus"),search=(url.searchParams.get("q")??"").trim(),status=url.searchParams.get("status")??"all";
 if(search.length>128||!["all","draft","sent","approved","scheduled","completed","declined"].includes(status)||focus!==null&&(!focus||focus.length>128))return Response.json({error:"Invalid estimate history filter."},{status:400});
 const pattern="%"+search.replace(/[\\%_]/g,value=>"\\"+value)+"%";
 const size=focus?1:Number(sizeText),encoded=url.searchParams.get("cursor");let cursor:{createdAt:string;id:string}|null=null;
 if(encoded!==null){try{
  if(!encoded||encoded.length>512||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error();
  const value=JSON.parse(atob(encoded.replace(/-/g,"+").replace(/_/g,"/"))) as Record<string,unknown>;
  if(Object.keys(value).length!==2||typeof value.createdAt!=="string"||value.createdAt.length>64||!Number.isFinite(Date.parse(value.createdAt))||typeof value.id!=="string"||!value.id||value.id.length>128)throw Error();
  cursor={createdAt:value.createdAt,id:value.id};
 }catch{return Response.json({error:"Invalid estimate history cursor."},{status:400});}}
 try{
  const result=await env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.total_cents AS totalCents,e.deposit_cents AS depositCents,
               e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
               COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
               COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,c.name AS customer,c.email,c.phone,${serviceAddressColumns(serviceLocationsEnabled(env))+propertyAssociationColumns(customerPropertiesEnabled(env))},
               COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
               (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
               (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
               (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
               (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
               (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='estimate' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateSentAt,
               (SELECT MIN(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='estimate' AND cm.channel IN ('text_confirmed','email_confirmed')) AS firstEstimateSentAt,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp1' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage1At,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp3' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage3At,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='followUp7' AND cm.channel IN ('text_confirmed','email_confirmed')) AS stage7At,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('estimate','followUp1','followUp3','followUp7') AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateContactAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastReviewRequestAt,
               (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
               (SELECT MAX(n.created_at) FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt,
               (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
               (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email','text_confirmed','email_confirmed')) AS lastRebookMessageAt
        FROM estimates e JOIN customers c ON c.id = e.customer_id
        WHERE (? IS NULL OR e.id=?)
          AND (?='all' OR e.status=?)
          AND (?='' OR c.name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR ${serviceAddressSql(serviceLocationsEnabled(env))} LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=e.id AND ei.name LIKE ? ESCAPE '\\'))
          AND (? IS NULL OR e.created_at < ? OR (e.created_at = ? AND e.id < ?))
        ORDER BY e.created_at DESC,e.id DESC LIMIT ?
      `).bind(focus,focus,status,status,search,pattern,pattern,pattern,pattern,pattern,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.id??null,size+1).all<{id:string;createdAt:string}>();
  const page=result.results.slice(0,size),last=page.at(-1);
  const grouped=new Map<string,Record<string,unknown>[]>();
  if(page.length){const placeholders=page.map(()=>"?").join(",");const items=await env.DB.prepare(`SELECT id,estimate_id AS estimateId,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...page.map(row=>row.id)).all<Record<string,unknown>>();
   for(const raw of items.results){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};const id=String(raw.estimateId);grouped.set(id,[...(grouped.get(id)??[]),row]);}
  }
  const estimates=page.map(row=>({...row,items:grouped.get(row.id)??[]}));
  const nextCursor=!focus&&result.results.length>size&&last?btoa(JSON.stringify({createdAt:last.createdAt,id:last.id})).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""):null;
  return Response.json({estimates,nextCursor,pageSize:size},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Estimate history could not be read."},{status:503});}
}
