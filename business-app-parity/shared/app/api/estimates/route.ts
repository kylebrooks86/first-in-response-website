import {submittedDiscountCents, quoteDiscounts, discountSnapshot, readDiscountSnapshot, DISCOUNT_SNAPSHOT_PREFIX} from '../../../lib/discount-input';
import {SAVED_PROMOTIONS_KEY,decodeSavedPromotions} from '../../../lib/saved-promotions';
import {ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX,buildPromotionAttribution,promotionServiceNames} from '../../../lib/estimate-promotion-attribution';
import {serviceLocationsEnabled,serviceAddressColumns,serviceAddressSql} from "../../../lib/service-location";
import {customerPropertiesEnabled,propertyAssociationColumns,propertyEstimatesTestEnabled,selectEstimateProperty,PropertySelectionError} from '../../../lib/customer-properties';
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {customerIdentityPredicate,duplicateCustomer} from '../../../lib/customer-identity';
import {ESTIMATE_CREATE_PROOF_PREFIX,validEstimateCreateRequestId,fingerprintEstimateCreateRequest,readEstimateCreateProof,type EstimateCreateProof} from '../../../lib/estimate-create-idempotency';

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

type ItemRow={id:string;estimateId:string;name:string;description:string;quantity:number;unit:string;totalCents:number};

export async function GET() {
  if(!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [estimateResult,itemResult]=await env.DB.batch([
      env.DB.prepare(`
        SELECT e.id,e.customer_id AS customerId,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.total_cents AS totalCents,e.deposit_cents AS depositCents,
               e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,c.name AS customer,c.email,c.phone,${serviceAddressColumns(serviceLocationsEnabled(env))+propertyAssociationColumns(customerPropertiesEnabled(env))},
               COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
               (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
               (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
               (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
               (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
               (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='estimate' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateSentAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('estimate','followUp1','followUp3','followUp7') AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastEstimateContactAt,
          (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template='review' AND cm.channel IN ('text_confirmed','email_confirmed')) AS lastReviewRequestAt,
               (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
               (SELECT MAX(n.created_at) FROM customer_notes n WHERE n.customer_id=e.customer_id AND n.body='[FIRE FLAG] REVIEW_RECEIVED') AS reviewReceivedAt,
               (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount,
               (SELECT COUNT(*) FROM payment_checkout_sessions s WHERE s.estimate_id=e.id AND s.status='open') AS openCheckoutCount,
               (SELECT MAX(created_at) FROM customer_messages cm WHERE cm.estimate_id=e.id AND cm.template IN ('winBack6','winBack11') AND cm.channel IN ('text','email','text_confirmed','email_confirmed')) AS lastRebookMessageAt
        FROM estimates e JOIN customers c ON c.id = e.customer_id
        ORDER BY e.created_at DESC LIMIT 100
      `),
      env.DB.prepare(`SELECT i.id,i.estimate_id AS estimateId,i.name,i.description,i.quantity,i.unit,i.total_cents AS totalCents FROM estimate_items i JOIN estimates e ON e.id=i.estimate_id ORDER BY e.created_at DESC,i.rowid ASC`),
    ]);
    const grouped=new Map<string,ItemRow[]>();
    for(const raw of itemResult.results as unknown as ItemRow[]){const row={...raw,quantity:Number(raw.quantity),totalCents:Number(raw.totalCents)};grouped.set(row.estimateId,[...(grouped.get(row.estimateId)??[]),row]);}
    const estimates=(estimateResult.results as Record<string,unknown>[]).map((row)=>{const items=grouped.get(String(row.id))??[];return {...row,items,service:items.map((item)=>item.name).join(", ")||"Custom service",serviceDescription:items[0]?.description??""};});
    return Response.json({ estimates });
  } catch {
    return Response.json({ estimates: [], message: "Estimates are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if(!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let body:Record<string,unknown>;
    try{const parsed:unknown=await request.json();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid object');body=parsed as Record<string,unknown>;}
    catch{return Response.json({error:'A valid estimate request object is required.'},{status:400});}
    if(body.requestId!==undefined&&!validEstimateCreateRequestId(body.requestId))return Response.json({error:'A valid estimate creation request ID is required.'},{status:400});
    const requestId=typeof body.requestId==='string'?body.requestId:null;
    const requestHash=requestId?await fingerprintEstimateCreateRequest(body):null;
    // A completed request replays its original immutable receipt. Never create
    // another estimate or re-evaluate now-expired offers for the same request ID.
    if(requestId){
      const existing=await env.DB.prepare('SELECT id,customer_id AS customerId,status,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents,share_token AS shareToken,appreciation_discount AS appreciationDiscount,additional_discount_type AS additionalDiscountType,additional_discount_value AS additionalDiscountValue FROM estimates WHERE id=?').bind(requestId).first<{id:string;customerId:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;shareToken:string;appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number}>();
      if(existing){
        const stored=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_CREATE_PROOF_PREFIX+requestId).first<{body:string}>();
        let proof:EstimateCreateProof|null=null;
        try{proof=readEstimateCreateProof(stored?.body??null);}catch{/* Invalid or missing proof never authorizes replay. */}
        if(!proof||proof.requestId!==requestId||proof.requestHash!==requestHash||proof.customerId!==existing.customerId||existing.status!=='draft'||
          ['subtotalCents','discountCents','totalCents','depositCents'].some(field=>Number(existing[field as keyof typeof existing])!==proof![field as keyof EstimateCreateProof])||
          Number(existing.appreciationDiscount)!==proof.appreciationDiscount||existing.additionalDiscountType!==proof.additionalDiscountType||Number(existing.additionalDiscountValue)!==proof.additionalDiscountValue)
          return Response.json({error:'This estimate request was already used or the saved quote has changed. Review the saved estimate; no new quote was created.'},{status:409});
        const rawItems=Array.isArray(body.items)?body.items as Record<string,unknown>[]:[];
        const incoming=rawItems.map(item=>({name:String(item.name??'').trim(),description:String(item.description??'').trim().slice(0,5000),quantity:Number(item.quantity),unit:String(item.unit??'job').trim()||'job',totalCents:Math.round(Number(item.totalCents))}));
        const savedRows=await env.DB.prepare('SELECT name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC').bind(requestId).all();
        const persisted=savedRows.results.map(row=>({name:String(row.name),description:String(row.description),quantity:Number(row.quantity),unit:String(row.unit),totalCents:Number(row.totalCents)}));
        if(JSON.stringify(incoming)!==JSON.stringify(persisted))return Response.json({error:'The saved service scope changed after this request. Review the existing estimate; no duplicate created.'},{status:409});
        if(proof.promotionAttributionSaved&&!await env.DB.prepare('SELECT key FROM message_templates WHERE key=?').bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+requestId).first())return Response.json({error:'Original promotion audit is unavailable. Review saved estimate.'},{status:409});
        if(proof.bundleDiscountCents>0&&!await env.DB.prepare('SELECT key FROM message_templates WHERE key=?').bind(DISCOUNT_SNAPSHOT_PREFIX+requestId).first())return Response.json({error:'Original bundle discount audit is unavailable. Review saved estimate.'},{status:409});
        return Response.json({id:requestId,requestId,replayed:true,customerId:proof.customerId,customer:String(body.customer??'').trim(),email:String(body.email??'').trim(),phone:String(body.phone??'').trim(),address:String(body.address??'').trim(),propertyId:proof.propertyId,propertyRevision:proof.propertyRevision,shareToken:existing.shareToken,customerPath:'/estimate/'+existing.shareToken,subtotalCents:proof.subtotalCents,discountCents:proof.discountCents,totalCents:proof.totalCents,depositCents:proof.depositCents,appreciationDiscount:proof.appreciationDiscount,additionalDiscountType:proof.additionalDiscountType,additionalDiscountValue:proof.additionalDiscountValue,bundleDiscountCents:proof.bundleDiscountCents,promotionAttributionSaved:proof.promotionAttributionSaved},{status:200,headers:{'cache-control':'private, no-store'}});
      }
    }
    const existingCustomerId = String(body.customerId ?? "").trim();
    const propertyTests=propertyEstimatesTestEnabled(env);
    if(Object.prototype.hasOwnProperty.call(body,'propertyId')&&(!propertyTests||!existingCustomerId))return Response.json({error:'Property-linked estimates are disabled pending association and backup verification. No estimate created.'},{status:409});
    if(!propertyTests&&customerPropertiesEnabled(env)&&existingCustomerId){const properties=await env.DB.prepare('SELECT COUNT(*) AS total FROM customer_properties WHERE customer_id=?').bind(existingCustomerId).first<{total:number}>();if(Number(properties?.total)>0)return Response.json({error:'This customer has retained properties. Property-linked estimate creation is not enabled until association and backup checks pass. No estimate created.'},{status:409});}
    let selection:Awaited<ReturnType<typeof selectEstimateProperty>>=null;
    if(propertyTests&&existingCustomerId){try{selection=await selectEstimateProperty(env.DB,existingCustomerId,body.propertyId,body.propertyRevision,body.propertySelectionMode);}catch(error){if(error instanceof PropertySelectionError)return Response.json({error:error.message},{status:409});throw error;}}
    let customer = String(body.customer ?? "").trim();
    let email = String(body.email ?? "").trim();
    let phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const rawItems=Array.isArray(body.items)?body.items as Record<string,unknown>[]:[];
    const items=rawItems.map((item)=>({name:String(item.name??"").trim(),description:String(item.description??"").trim().slice(0,5000),quantity:Number(item.quantity),unit:String(item.unit??"job").trim()||"job",totalCents:Math.round(Number(item.totalCents))}));
    if(!customer||!items.length) return Response.json({error:"Customer and at least one service are required."},{status:400});
    if(items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0)) return Response.json({error:"Every service needs a name, quantity, and valid price."},{status:400});
    const subtotal=items.reduce((sum,item)=>sum+item.totalCents,0);
    if(!Number.isSafeInteger(subtotal))return Response.json({error:"The estimate total is too large to store safely."},{status:400});
    const appreciationDiscount=body.appreciationDiscount===true?1:0;
    const additionalDiscountType=String(body.additionalDiscountType??"percent")==="dollar"?"dollar":"percent";
    const additionalDiscountValue=submittedDiscountCents(body.additionalDiscountValue);
    if(additionalDiscountValue===null)return Response.json({error:"Enter a valid nonnegative discount in exact cents."},{status:400});
    const bundleDiscountCents=body.bundleDiscountCents===undefined?0:typeof body.bundleDiscountCents==='number'?submittedDiscountCents(body.bundleDiscountCents):null;
    if(bundleDiscountCents===null)return Response.json({error:'Enter a valid bundle discount in exact cents.'},{status:400});
    let pricing:ReturnType<typeof quoteDiscounts>;
    try{pricing=quoteDiscounts(subtotal,Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents);}catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid discounts.'},{status:400});}
    const {total,appliedDiscount,deposit}=pricing;
    const customerId=existingCustomerId||crypto.randomUUID();
    const estimateId=requestId??crypto.randomUUID();
    let promotionAttribution:ReturnType<typeof buildPromotionAttribution>|null=null;
    if(Object.prototype.hasOwnProperty.call(body,'promotionEvidence')){
      try{
        const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(SAVED_PROMOTIONS_KEY).first<{body:string}>();
        promotionAttribution=buildPromotionAttribution({serviceNames:await promotionServiceNames(env.DB),estimateId,rawEvidence:body.promotionEvidence,
         catalog:decodeSavedPromotions(row),now:new Date(),items,subtotalCents:subtotal,
         appreciationDiscount:Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents,totalCents:total,depositCents:deposit});
      }catch(err){return Response.json({error:err instanceof Error?err.message:'Promotion rules changed. Refresh before saving.'},{status:409});}
    }const shareToken=crypto.randomUUID().replaceAll("-","");const now=new Date().toISOString();
    const statements=[];
    let serviceAddress=address;
    if(existingCustomerId){
      const existing=await env.DB.prepare("SELECT id,name,email,phone,address FROM customers WHERE id=?").bind(existingCustomerId).first<{id:string;name:string;email:string|null;phone:string|null;address:string|null}>();
      if(!existing)return Response.json({error:"That customer record could not be found."},{status:404});
      if(body.customerLookupSelection===true){
        if(customer!==existing.name.trim()||email!==String(existing.email??'').trim()||phone!==String(existing.phone??'').trim()||!selection&&address!==String(existing.address??'').trim())return Response.json({error:'The selected customer changed. Review their current information and service properties before saving.',customerSelectionStale:true},{status:409});
        customer=existing.name;email=existing.email??'';phone=existing.phone??'';serviceAddress=existing.address??'';
      }else if(!Object.prototype.hasOwnProperty.call(body,"address"))serviceAddress=String(existing.address??"");
    }else{
      const identity={name:customer,email,phone,address};
      if(await duplicateCustomer(env.DB,identity))return Response.json({error:'A matching customer already exists. Search and explicitly select their saved record. No estimate created.',duplicateCustomer:true},{status:409});
      const match=customerIdentityPredicate(identity);
      // Recheck within the same atomic batch. A concurrent duplicate causes
      // the dependent estimate FK to abort the batch, never an orphan/history split.
      statements.push(env.DB.prepare(`INSERT INTO customers (id,name,email,phone,address,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE ${match.sql})`).bind(customerId,customer,email||null,phone||null,address||null,now,...match.values));
    }
    if(selection)serviceAddress=selection.property.address+(selection.property.designation?' · '+selection.property.designation:'');
    statements.push(env.DB.prepare("INSERT INTO estimates (id,customer_id,status,subtotal_cents,discount_cents,appreciation_discount,additional_discount_type,additional_discount_value,total_cents,deposit_cents,share_token,created_at) VALUES (?,?,'draft',?,?,?,?,?,?,?,?,?)").bind(estimateId,customerId,subtotal,appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,total,deposit,shareToken,now));
    if(serviceLocationsEnabled(env))statements.push(env.DB.prepare("INSERT INTO estimate_service_locations(estimate_id,customer_id,address,captured_at) VALUES(?,?,?,?)").bind(estimateId,customerId,serviceAddress,now));
    if(selection)statements.push(env.DB.prepare('INSERT INTO estimate_property_links(estimate_id,customer_id,property_id,property_revision,selection_mode,captured_at) VALUES(?,?,?,?,?,?)').bind(estimateId,customerId,selection.property.id,selection.property.revision,selection.mode,now));
    for(const item of items)statements.push(env.DB.prepare("INSERT INTO estimate_items (id,estimate_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),estimateId,item.name,item.description,item.quantity,item.unit,item.totalCents));
    if(bundleDiscountCents>0)statements.push(env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?)").bind(DISCOUNT_SNAPSHOT_PREFIX+estimateId,JSON.stringify(discountSnapshot(estimateId,subtotal,Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents)),now));
    if(promotionAttribution)statements.push(env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?)").bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+estimateId,JSON.stringify(promotionAttribution),now));
    if(requestId&&requestHash){const proof:EstimateCreateProof={version:1,requestId,requestHash,customerId,subtotalCents:subtotal,discountCents:appliedDiscount,totalCents:total,depositCents:deposit,bundleDiscountCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,propertyId:selection?.property.id??null,propertyRevision:selection?.property.revision??null,promotionAttributionSaved:Boolean(promotionAttribution)};
      statements.push(env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?)").bind(ESTIMATE_CREATE_PROOF_PREFIX+requestId,JSON.stringify(proof),now));}
    await env.DB.batch(statements);
    return Response.json({id:estimateId,...(requestId?{requestId,replayed:false}:{}),customerId,customer,email,phone,address:serviceAddress,propertyId:selection?.property.id??null,propertyRevision:selection?.property.revision??null,shareToken,customerPath:`/estimate/${shareToken}`,subtotalCents:subtotal,discountCents:appliedDiscount,totalCents:total,depositCents:deposit,appreciationDiscount,additionalDiscountType,additionalDiscountValue,bundleDiscountCents,promotionAttributionSaved:Boolean(promotionAttribution)},{status:201,headers:{'cache-control':'private, no-store'}});
  } catch {
    return Response.json({ error: propertyEstimatesTestEnabled(env)?'Estimate save was not confirmed. Review stored records before another deliberate attempt.':"We couldn't save this estimate. Please try again." }, { status: 500 });
  }
}
