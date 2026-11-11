import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../owner-auth";
import {submittedDiscountCents,quoteDiscounts,discountSnapshot,verifiedSavedDiscounts,DISCOUNT_SNAPSHOT_PREFIX} from "../../../../lib/discount-input";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getOwnerUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }
const statuses = new Set(["draft","sent","approved","scheduled","completed","declined"]);
type EditItem={id?:string;name:string;description:string;quantity:number;unit:string;totalCents:number};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const status = String(body.status ?? "").trim();
    let scheduledAt = String(body.scheduledAt ?? "").trim();
    if(scheduledAt){const parsedSchedule=new Date(scheduledAt);if(Number.isNaN(parsedSchedule.getTime()))return Response.json({error:"Choose a valid job date and time."},{status:400});scheduledAt=parsedSchedule.toISOString();}
    if (status && !statuses.has(status)) return Response.json({ error: "Choose a valid estimate status." }, { status: 400 });
    const existing = await env.DB.prepare(`
      SELECT e.id,e.status,e.subtotal_cents AS subtotalCents,e.discount_cents AS discountCents,e.total_cents AS totalCents,e.appreciation_discount AS appreciationDiscount,e.additional_discount_type AS additionalDiscountType,e.additional_discount_value AS additionalDiscountValue,e.scheduled_at AS scheduledAt,e.deposit_cents AS depositCents,e.accepted_at AS acceptedAt,e.signed_at AS signedAt,
             COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
             (SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id) AS invoiceCount
      FROM estimates e WHERE e.id=?
    `).bind(id).first<{id:string;status:string;subtotalCents:number;discountCents:number;totalCents:number;appreciationDiscount:number;additionalDiscountType:string;additionalDiscountValue:number;scheduledAt:string|null;depositCents:number;acceptedAt:string|null;signedAt:string|null;paidCents:number;invoiceCount:number}>();
    if (!existing) return Response.json({ error: "Estimate not found." }, { status: 404 });

    const statements=[];
    let responseFields:Record<string,unknown>={id};
    if(Array.isArray(body.items)){
      if(existing.signedAt||existing.acceptedAt||["approved","scheduled","completed","superseded"].includes(existing.status)||Number(existing.paidCents)>0||Number(existing.invoiceCount)>0)
        return Response.json({error:"This estimate is already approved or financially active. Keep the accepted estimate unchanged and make any final service or price changes on the invoice."},{status:409});
      const savedDiscount=await env.DB.prepare("SELECT body FROM message_templates WHERE key=?").bind(DISCOUNT_SNAPSHOT_PREFIX+id).first<{body:string}>();
      try{verifiedSavedDiscounts(id,savedDiscount?.body??null,existing);}
      catch{return Response.json({error:"Saved discount terms require review. Refresh this quote before editing.",saveUncertain:true},{status:409});}
      if(savedDiscount&&!Object.hasOwn(body,"bundleDiscountCents"))
        return Response.json({error:"This estimate has saved bundle discounts. Refresh with the current editor before repricing."},{status:409});
      const items=(body.items as Record<string,unknown>[]).map((item):EditItem=>({
        id:String(item.id??"").trim()||undefined,
        name:String(item.name??"").trim(),
        description:String(item.description??"").trim().slice(0,5000),
        quantity:Number(item.quantity),
        unit:String(item.unit??"job").trim()||"job",
        totalCents:typeof item.totalCents==="number"?item.totalCents:NaN,
      }));
      if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0))return Response.json({error:"Every service needs a name, quantity, and valid price."},{status:400});
      const subtotal=items.reduce((sum,item)=>sum+item.totalCents,0);
      if(!Number.isSafeInteger(subtotal))return Response.json({error:"The estimate total is too large to store safely."},{status:400});
      const appreciationDiscount=body.appreciationDiscount===true?1:0;
      const additionalDiscountType=String(body.additionalDiscountType??"percent")==="dollar"?"dollar":"percent";
      const additionalDiscountValue=submittedDiscountCents(body.additionalDiscountValue);
      if(additionalDiscountValue===null)return Response.json({error:"Enter valid discounts in exact cents."},{status:400});
      const bundleDiscountCents=body.bundleDiscountCents===undefined?0:
        typeof body.bundleDiscountCents==="number"?submittedDiscountCents(body.bundleDiscountCents):null;
      if(bundleDiscountCents===null)return Response.json({error:"Enter a valid bundle discount in exact cents."},{status:400});
      let pricing:ReturnType<typeof quoteDiscounts>;
      try{pricing=quoteDiscounts(subtotal,Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents);}
      catch(error){return Response.json({error:error instanceof Error?error.message:"Invalid discounts."},{status:400});}
      const {total,appliedDiscount,deposit}=pricing;
      // A signed/paid/invoiced estimate may change while this owner is
      // editing. These conditions are checked inside the one D1 transaction,
      // not solely in the earlier SELECT.
      const eligible="SELECT 1 FROM estimates e WHERE e.id=? AND e.status IN ('draft','sent','declined') AND e.accepted_at IS NULL AND e.signed_at IS NULL AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.estimate_id=e.id AND p.status='paid') AND NOT EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=e.id)";
      const persistedItems=items.map(item=>({...item,id:item.id||crypto.randomUUID()}));
      statements.push(env.DB.prepare(`DELETE FROM estimate_items WHERE estimate_id=? AND EXISTS(${eligible})`).bind(id,id));
      for(const item of persistedItems)statements.push(env.DB.prepare(`INSERT INTO estimate_items (id,estimate_id,name,description,quantity,unit,total_cents) SELECT ?,?,?,?,?,?,? WHERE EXISTS(${eligible})`).bind(item.id,id,item.name,item.description,item.quantity,item.unit,item.totalCents,id));
      statements.push(env.DB.prepare(`UPDATE estimates SET subtotal_cents=?,discount_cents=?,appreciation_discount=?,additional_discount_type=?,additional_discount_value=?,total_cents=?,deposit_cents=? WHERE id=? AND EXISTS(${eligible})`).bind(subtotal,appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,total,deposit,id,id));
      if(bundleDiscountCents>0||savedDiscount)statements.push(env.DB.prepare(
        `INSERT INTO message_templates(key,subject,body,updated_at) SELECT ?,'',?,? WHERE EXISTS(SELECT 1 FROM estimates WHERE id=? AND subtotal_cents=? AND total_cents=?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`
      ).bind(DISCOUNT_SNAPSHOT_PREFIX+id,JSON.stringify(discountSnapshot(id,subtotal,Boolean(appreciationDiscount),additionalDiscountType,additionalDiscountValue,bundleDiscountCents)),new Date().toISOString(),id,subtotal,total));
      responseFields={...responseFields,bundleDiscountCents,subtotalCents:subtotal,discountCents:appliedDiscount,appreciationDiscount,additionalDiscountType,additionalDiscountValue,totalCents:total,depositCents:deposit,items:persistedItems,service:items.map((item)=>item.name).join(", "),serviceDescription:items[0]?.description??""};
    }

    const changingStatus=Boolean(status)||Object.prototype.hasOwnProperty.call(body,"scheduledAt");
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
      statements.push(env.DB.prepare("UPDATE estimates SET status=?, scheduled_at=? WHERE id=?").bind(nextStatus,nextSchedule,id));
      responseFields={...responseFields,status:nextStatus,scheduledAt:nextSchedule};
    }
    if (body.resolveChangeRequests === true) statements.push(env.DB.prepare("UPDATE estimate_change_requests SET status='resolved' WHERE estimate_id=? AND status='open'").bind(id));
    if(changingStatus){
      const latestWorkflow=await env.DB.prepare(`SELECT status,accepted_at AS acceptedAt,signed_at AS signedAt,COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents FROM estimates e WHERE e.id=?`).bind(id).first<{status:string;acceptedAt:string|null;signedAt:string|null;paidCents:number}>();
      if(!latestWorkflow)return Response.json({error:"Estimate not found."},{status:404});
      const latestPaidCents=Number(latestWorkflow.paidCents);
      if(!Number.isSafeInteger(latestPaidCents)||latestPaidCents<0)return Response.json({error:"This job's payment state is outside FIRE's safe accounting range. Stop and review it before changing workflow status."},{status:409});
      if(latestWorkflow.status!==existing.status||latestWorkflow.acceptedAt!==existing.acceptedAt||latestWorkflow.signedAt!==existing.signedAt)return Response.json({error:"This job changed while you were updating its status or schedule. Refresh it before trying again."},{status:409});
    }
    if(Array.isArray(body.items)){
      const latest=await env.DB.prepare(`SELECT status,COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,(SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id) AS invoiceCount FROM estimates e WHERE e.id=?`).bind(id).first<{status:string;paidCents:number;invoiceCount:number}>();
      if(!latest||["approved","scheduled","completed","superseded"].includes(latest.status)||Number(latest.paidCents)>0||Number(latest.invoiceCount)>0)return Response.json({error:"This estimate became approved or financially active while you were editing it. Refresh the job; keep the accepted estimate unchanged and make later billing changes on the final invoice."},{status:409});
      if(!Number.isSafeInteger(Number(latest.paidCents))||Number(latest.paidCents)<0)return Response.json({error:"This estimate's payment state is outside FIRE's safe accounting range. Stop and review the job before editing the estimate."},{status:409});
    }
    if(statements.length)await env.DB.batch(statements);
    if(Array.isArray(body.items)){
      const saved=await env.DB.prepare("SELECT id,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents,accepted_at AS acceptedAt,signed_at AS signedAt FROM estimates WHERE id=?").bind(id)
        .first<{id:string;subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;acceptedAt:string|null;signedAt:string|null}>();
      const stored=await env.DB.prepare("SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid").bind(id)
        .all<{id:string;name:string;description:string;quantity:number;unit:string;totalCents:number}>();
      const intended=responseFields.items as EditItem[];
      if(!saved||saved.acceptedAt||saved.signedAt||
         saved.subtotalCents!==responseFields.subtotalCents||saved.discountCents!==responseFields.discountCents||
         saved.totalCents!==responseFields.totalCents||saved.depositCents!==responseFields.depositCents||
         stored.results.length!==intended.length||stored.results.some((row,index)=>{
           const expected=intended[index];
           return row.id!==expected.id||row.name!==expected.name||row.description!==expected.description||
                  Number(row.quantity)!==expected.quantity||row.unit!==expected.unit||Number(row.totalCents)!==expected.totalCents;
         }))
        return Response.json({error:"The edited estimate could not be confirmed. Reopen the job and review its saved price before retrying.",saveUncertain:true},{status:503,headers:{"cache-control":"private, no-store"}});
    }
    return Response.json({ estimate: responseFields },{headers:{"cache-control":"private, no-store"}});
  } catch {
    return Response.json({ error: "We couldn't update this estimate. Please try again." }, { status: 500 });
  }
}
