import {submittedDiscountCents, quoteDiscounts, discountSnapshot, verifiedSavedDiscounts, DISCOUNT_SNAPSHOT_PREFIX} from '../../../../lib/discount-input';
import {ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX,readPromotionAttribution,promotionAttributionStillApplies} from '../../../../lib/estimate-promotion-attribution';
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import {depositPolicyEnabled,depositPolicyColumns,depositSchedulingPolicy,depositSchedulingGuard,type DepositPolicyRow} from '../../../../lib/deposit-policy';

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }
const statuses = new Set(["draft","sent","approved","scheduled","completed","declined"]);
type EditItem={id?:string;name:string;description:string;quantity:number;unit:string;totalCents:number};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let guardedSchedule=false;
  let estimateWriteAttempted=false;
  let statusWriteAttempted=false;
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    if(depositPolicyEnabled(env)&&Object.keys(body).some(key=>/^(?:deposit|overrideDeposit|allowSchedulingBeforeDeposit)/i.test(key)))return Response.json({error:'Deposit exceptions are not enabled. This request cannot change deposit terms or bypass collection.'},{status:400});
    if(Object.prototype.hasOwnProperty.call(body,'bundleDiscountCents')&&!Array.isArray(body.items))return Response.json({error:'Discount changes require the complete current service list.'},{status:400});
    const status = String(body.status ?? "").trim();
    let scheduledAt = String(body.scheduledAt ?? "").trim();
    if(scheduledAt){const parsedSchedule=new Date(scheduledAt);if(Number.isNaN(parsedSchedule.getTime()))return Response.json({error:"Choose a valid job date and time."},{status:400});scheduledAt=parsedSchedule.toISOString();}
    if (status && !statuses.has(status)) return Response.json({ error: "Choose a valid estimate status." }, { status: 400 });
    const existing = await env.DB.prepare(`
      SELECT e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.id,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,e.status,e.scheduled_at AS scheduledAt,e.deposit_cents AS depositCents,e.accepted_at AS acceptedAt,e.signed_at AS signedAt,
             COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
             (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id) AS invoiceCount
      FROM estimates e WHERE e.id=?
    `).bind(id).first<{appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;subtotalCents:number;discountCents:number;totalCents:number;id:string;status:string;scheduledAt:string|null;depositCents:number;acceptedAt:string|null;signedAt:string|null;paidCents:number;invoiceCount:number}>();
    if (!existing) return Response.json({ error: "Estimate not found." }, { status: 404 });

    const statements=[];
    let guardedScheduleIndex=-1;
    let responseFields:Record<string,unknown>={id};
    if(Array.isArray(body.items)&&depositPolicyEnabled(env)&&'FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE' in env&&env.FIRE_DEPOSIT_EXCEPTION_WRITE_CANDIDATE==='synthetic-contract-tests-only'){
      const audit=await env.DB.prepare("SELECT id FROM deposit_policy_events WHERE estimate_id=? LIMIT 1").bind(id).first();
      if(audit)return Response.json({error:"An owner deposit exception was recorded. Reprice only through a reviewed deposit/agreement revision workflow, not a silent estimate edit."},{status:409});
    }
    if(Array.isArray(body.items)){
      if(existing.signedAt||existing.acceptedAt||["approved","scheduled","completed"].includes(existing.status)||Number(existing.paidCents)>0||Number(existing.invoiceCount)>0)
        return Response.json({error:"This estimate is already approved or financially active. Keep the accepted estimate unchanged and make any final service or price changes on the invoice."},{status:409});
      if(Object.prototype.hasOwnProperty.call(body,'promotionEvidence'))return Response.json({error:'Automatic promotion attribution is available on new estimates only. Refresh saved terms and explicitly review draft repricing.'},{status:409});
      const savedDiscount=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DISCOUNT_SNAPSHOT_PREFIX+id).first<{body:string}>();
      try{verifiedSavedDiscounts(id,savedDiscount?.body??null,existing);}catch{return Response.json({error:'Saved discount breakdown requires review. Refresh before editing.'},{status:409});}
      if(savedDiscount&&!Object.prototype.hasOwnProperty.call(body,'bundleDiscountCents'))return Response.json({error:'This estimate has saved discount components. Refresh with the current editor before repricing.'},{status:409});
      const items=(body.items as Record<string,unknown>[]).map((item):EditItem=>({
        id:String(item.id??"").trim()||undefined,
        name:String(item.name??"").trim(),
        description:String(item.description??"").trim().slice(0,5000),
        quantity:Number(item.quantity),
        unit:String(item.unit??"job").trim()||"job",
        totalCents:Math.round(Number(item.totalCents)),
      }));
      if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0))return Response.json({error:"Every service needs a name, quantity, and valid price."},{status:400});
      // Generate the exact database IDs before the atomic batch. Never return
      // temporary UI ids or pretend an unpersisted line has a stable identity.
      const persistedItems=items.map(item=>({...item,id:item.id||crypto.randomUUID()}));
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
      statements.push(env.DB.prepare("DELETE FROM estimate_items WHERE estimate_id=?").bind(id));
      for(const item of persistedItems)statements.push(env.DB.prepare("INSERT INTO estimate_items (id,estimate_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)").bind(item.id,id,item.name,item.description,item.quantity,item.unit,item.totalCents));
      statements.push(env.DB.prepare("UPDATE estimates SET subtotal_cents=?,discount_cents=?,appreciation_discount=?,additional_discount_type=?,additional_discount_value=?,total_cents=?,deposit_cents=? WHERE id=?").bind(subtotal,appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,total,deposit,id));
      const savedPromotion=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+id).first<{body:string}>();
      if(savedPromotion){
        let original:ReturnType<typeof readPromotionAttribution>;
        try{original=readPromotionAttribution(id,savedPromotion.body,existing);}catch{return Response.json({error:'Saved promotion history requires review before editing. Agreed prices are unchanged.'},{status:409});}
        if(!original||!promotionAttributionStillApplies(original,items,{subtotalCents:subtotal,totalCents:total,depositCents:deposit,additionalDiscountType,additionalDiscountValue,bundleDiscountCents}))
          statements.push(env.DB.prepare("DELETE FROM message_templates WHERE key=?").bind(ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+id));
      }
      if(bundleDiscountCents>0||savedDiscount)statements.push(env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at").bind(DISCOUNT_SNAPSHOT_PREFIX+id,JSON.stringify(discountSnapshot(id,subtotal,Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents)),new Date().toISOString()));
      responseFields={...responseFields,bundleDiscountCents,subtotalCents:subtotal,discountCents:appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,totalCents:total,depositCents:deposit,items:persistedItems,service:items.map((item)=>item.name).join(", "),serviceDescription:items[0]?.description??""};
    }

    const changingStatus=Boolean(status)||Object.prototype.hasOwnProperty.call(body,"scheduledAt");
    if(changingStatus&&existing.status==="superseded")return Response.json({error:"This quote is historical. Open its replacement to schedule or update the job."},{status:409});
    if(changingStatus){
      const nextStatus = scheduledAt ? "scheduled" : (status || existing.status);
      const nextSchedule = Object.prototype.hasOwnProperty.call(body, "scheduledAt") ? (scheduledAt || null) : existing.scheduledAt;
      const rank:Record<string,number>={draft:0,sent:1,approved:2,scheduled:3,completed:4};
      if(nextStatus==="approved"&&existing.status!=="approved"&&(!existing.acceptedAt||!existing.signedAt))
        return Response.json({error:"Customer approval must come from the signed estimate link. FIRE cannot manually mark an unsigned estimate approved."},{status:409});
      if(nextStatus==="declined"&&(Boolean(existing.acceptedAt)||Number(existing.paidCents)>0||Number(existing.invoiceCount)>0))
        return Response.json({error:"An accepted or financially active job cannot be changed to declined."},{status:409});
      if(nextStatus!=="declined"&&rank[nextStatus]!==undefined&&rank[existing.status]!==undefined&&rank[nextStatus]<rank[existing.status]&&(Boolean(existing.acceptedAt)||Number(existing.paidCents)>0||Number(existing.invoiceCount)>0))
        return Response.json({error:"This job has already advanced in the customer or billing workflow and cannot be moved backward."},{status:409});
      if(nextStatus==="scheduled"){
        if(!nextSchedule) return Response.json({error:"Choose a job date and time before marking this estimate scheduled."},{status:409});
        if(!existing.acceptedAt||!existing.signedAt)return Response.json({error:"The customer must approve and sign the estimate before the job can be scheduled."},{status:409});
        if(existing.status!=="scheduled"&&existing.status!=="approved")return Response.json({error:"Only an approved estimate can be scheduled."},{status:409});
      }
      if(nextStatus==="completed"&&existing.status!=="completed"){
        if(existing.status!=="scheduled") return Response.json({error:"Schedule the job before marking it complete."},{status:409});
        const report=await env.DB.prepare("SELECT status FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC LIMIT 1").bind(id).first<{status:string}>();
        if(report?.status!=="completed")return Response.json({error:"Complete and save the service completion report before marking this job complete."},{status:409});
      }
      // Owner retired the availability-block feature. Keep optimistic approval/status
      // protection on scheduled writes without consulting legacy blocked dates.
      if(nextStatus==='scheduled'&&nextSchedule){
        guardedSchedule=true;guardedScheduleIndex=statements.length;
      }
      if(nextStatus==='scheduled'&&depositPolicyEnabled(env)){
        const row=await env.DB.prepare(`SELECT ${depositPolicyColumns} FROM estimates e WHERE e.id=?`).bind(id).first<DepositPolicyRow>();
        if(!row)return Response.json({error:'Estimate not found.'},{status:404});
        const policy=depositSchedulingPolicy(row,true);
        if(!policy.canSchedule)return Response.json({error:policy.message,depositPolicy:policy},{status:409});
        guardedSchedule=true;guardedScheduleIndex=statements.length;
        statements.push(env.DB.prepare(`UPDATE estimates SET status=?,scheduled_at=? WHERE id=? AND EXISTS(SELECT 1 FROM (SELECT ${depositPolicyColumns} FROM estimates e WHERE e.id=?) eligibility WHERE ${depositSchedulingGuard} AND status=? AND acceptedAt IS ? AND signedAt IS ?)`).bind(nextStatus,nextSchedule,id,id,existing.status,existing.acceptedAt,existing.signedAt));
      }else if(guardedSchedule) statements.push(env.DB.prepare('UPDATE estimates SET status=?, scheduled_at=? WHERE id=? AND status=? AND accepted_at IS ? AND signed_at IS ?').bind(nextStatus,nextSchedule,id,existing.status,existing.acceptedAt,existing.signedAt));
      else statements.push(env.DB.prepare('UPDATE estimates SET status=?, scheduled_at=? WHERE id=?').bind(nextStatus,nextSchedule,id));
      responseFields={...responseFields,status:nextStatus,scheduledAt:nextSchedule};
    }
    if (body.resolveChangeRequests === true) return Response.json({error:"Refresh the app and resolve a specific request from Customer change-request history."},{status:409});
    if(changingStatus){
      const latestWorkflow=await env.DB.prepare(`SELECT status,accepted_at AS acceptedAt,signed_at AS signedAt,COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents FROM estimates e WHERE e.id=?`).bind(id).first<{status:string;acceptedAt:string|null;signedAt:string|null;paidCents:number}>();
      if(!latestWorkflow)return Response.json({error:"Estimate not found."},{status:404});
      const latestPaidCents=Number(latestWorkflow.paidCents);
      if(!Number.isSafeInteger(latestPaidCents)||latestPaidCents<0)return Response.json({error:"This job's payment state is outside FIRE's safe accounting range. Stop and review it before changing workflow status."},{status:409});
      if(latestWorkflow.status!==existing.status||latestWorkflow.acceptedAt!==existing.acceptedAt||latestWorkflow.signedAt!==existing.signedAt)return Response.json({error:"This job changed while you were updating its status or schedule. Refresh it before trying again."},{status:409});
    }
    if(Array.isArray(body.items)){
      const latest=await env.DB.prepare(`SELECT status,signed_at AS signedAt,accepted_at AS acceptedAt,COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,(SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id) AS invoiceCount FROM estimates e WHERE e.id=?`).bind(id).first<{signedAt:string|null;acceptedAt:string|null;status:string;paidCents:number;invoiceCount:number}>();
      if(!latest||latest.signedAt||latest.acceptedAt||["approved","scheduled","completed"].includes(latest.status)||Number(latest.paidCents)>0||Number(latest.invoiceCount)>0)return Response.json({error:"This estimate became approved or financially active while you were editing it. Refresh the job; keep the accepted estimate unchanged and make later billing changes on the final invoice."},{status:409});
      if(!Number.isSafeInteger(Number(latest.paidCents))||Number(latest.paidCents)<0)return Response.json({error:"This estimate's payment state is outside FIRE's safe accounting range. Stop and review the job before editing the estimate."},{status:409});
    }
    if(statements.length){
      estimateWriteAttempted=Array.isArray(body.items);
      statusWriteAttempted=changingStatus;
      const results=await env.DB.batch(statements);
      if(guardedScheduleIndex>=0&&results[guardedScheduleIndex]?.meta.changes!==1)return Response.json({error:'Deposit, payment or approval changed before scheduling was saved. Refresh the job and review its records before another deliberate attempt.'},{status:409});
      if(changingStatus){
        // Status and appointment updates previously echoed the attempted
        // values without independently inspecting the saved D1 row. A
        // nonthrowing zero-write batch, lost receipt or conflicting read can
        // make a job appear Scheduled/Completed when it never changed.
        const uncertainStatus=()=>Response.json({
          error:'Job status or schedule save could not be verified. Reopen this job and review the saved status before another change.',
          saveUncertain:true
        },{status:503,headers:{'Cache-Control':'no-store, private'}});
        const receipt=results[statements.length-1] as {success?:boolean;meta?:{changes?:number}}|undefined;
        if(!Array.isArray(results)||results.length!==statements.length||
          !receipt||receipt.success===false||receipt.meta?.changes===0)return uncertainStatus();
        const saved=await env.DB.prepare('SELECT id,status,scheduled_at AS scheduledAt FROM estimates WHERE id=?')
          .bind(id).first<{id:string;status:string;scheduledAt:string|null}>();
        if(!saved||saved.id!==id||saved.status!==responseFields.status||
          (saved.scheduledAt??null)!==(responseFields.scheduledAt??null))return uncertainStatus();
        responseFields={...responseFields,status:saved.status,scheduledAt:saved.scheduledAt??null};
      }
      if(estimateWriteAttempted){
        const uncertain=()=>Response.json({error:'Estimate save confirmation is uncertain. Reopen the saved estimate and check its services and amounts before another edit.',saveUncertain:true},
          {status:503,headers:{'Cache-Control':'no-store, private'}});
        if(!Array.isArray(results)||results.length!==statements.length||
          results.some(result=>(result as {success?:boolean})?.success===false))return uncertain();
        // Read the durable row and EVERY line in original order before
        // telling the owner a changed quote was saved. Do not let an
        // accidentally stale or empty D1 result become a successful 200.
        const actual=await env.DB.prepare('SELECT id,subtotal_cents AS subtotalCents,discount_cents AS discountCents,appreciation_discount AS appreciationDiscount,additional_discount_type AS additionalDiscountType,additional_discount_value AS additionalDiscountValue,total_cents AS totalCents,deposit_cents AS depositCents FROM estimates WHERE id=?')
          .bind(id).first<{id:string;subtotalCents:number;discountCents:number;appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;totalCents:number;depositCents:number}>();
        const lines=await env.DB.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC')
          .bind(id).all<Required<EditItem>>();
        const expected=responseFields as Record<string,any>;
        if(!actual||actual.id!==id||
          ['subtotalCents','discountCents','appreciationDiscount','additionalDiscountValue','totalCents','depositCents'].some(key=>
            !Number.isSafeInteger(Number(actual[key as keyof typeof actual]))||
            Number(actual[key as keyof typeof actual])!==Number(expected[key]))||
          actual.additionalDiscountType!==expected.additionalDiscountType||
          !Array.isArray(lines.results)||lines.results.length!==(expected.items as EditItem[]).length||
          lines.results.some((row,i)=>{
            const submitted=(expected.items as EditItem[])[i];
            return row.id!==submitted.id||row.name!==submitted.name||
              row.description!==submitted.description||Number(row.quantity)!==submitted.quantity||
              row.unit!==submitted.unit||Number(row.totalCents)!==submitted.totalCents;
          }))return uncertain();
        responseFields={...responseFields,items:lines.results};
      }
    }
    return Response.json({ estimate: responseFields },{headers:{'Cache-Control':'no-store, private'}});
  } catch {
    if(guardedSchedule)return Response.json({error:'Schedule confirmation is uncertain. Refresh the job before another attempt; the schedule may already have saved. No payment was initiated.',saveUncertain:true},{status:503,headers:{'Cache-Control':'no-store, private'}});
    if(estimateWriteAttempted)return Response.json({error:'Estimate save confirmation is unavailable. Reopen the saved estimate and verify its services and amounts before retrying.',saveUncertain:true},{status:503,headers:{'Cache-Control':'no-store, private'}});
    if(statusWriteAttempted)return Response.json({error:'Job status confirmation is unavailable. Reopen the job and check its saved status before retrying.',saveUncertain:true},{status:503,headers:{'Cache-Control':'no-store, private'}});
    return Response.json({ error: "We couldn't update this estimate. Please try again." }, { status: 500 });
  }
}
