import { env } from "cloudflare:workers";
import { requireOwnerUser } from "../../owner-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireOwnerUser("/api/dashboard-summary");
  const [summaryResult,recentResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS estimates,
      COALESCE(SUM(CASE WHEN status IN ('draft','sent') THEN total_cents ELSE 0 END),0) AS openValue,
      COALESCE(SUM(CASE
        WHEN status IN ('approved','scheduled') AND EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=estimates.id) THEN MAX(0, (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        WHEN status IN ('approved','scheduled') THEN MAX(0, deposit_cents-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        WHEN status='completed' THEN MAX(0, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1), total_cents)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        ELSE 0
      END),0) AS outstanding
      FROM estimates`),
    env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
      c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
      COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
      (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
      (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
      (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
      (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
      (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount
      FROM estimates e JOIN customers c ON c.id=e.customer_id
      ORDER BY e.created_at DESC LIMIT 8`),
  ]);
  const result=(summaryResult.results[0]??{estimates:0,openValue:0,outstanding:0}) as {estimates:number;openValue:number;outstanding:number};
  const estimates=Number(result.estimates??0);
  const openValue=Number(result.openValue??0);
  const outstanding=Number(result.outstanding??0);
  const summarySafe=Number.isSafeInteger(estimates)&&estimates>=0&&Number.isSafeInteger(openValue)&&openValue>=0&&Number.isSafeInteger(outstanding)&&outstanding>=0;
  const recentSafe=(recentResult.results as Record<string,unknown>[]).every((row)=>{
    const values=[row.totalCents,row.depositCents,row.paidCents];
    if(row.invoiceTotalCents!==null&&row.invoiceTotalCents!==undefined)values.push(row.invoiceTotalCents);
    return values.every((value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0);
  });
  if(!summarySafe||!recentSafe)return Response.json({error:"Dashboard billing totals require owner review before FIRE can safely summarize them."},{status:409});
  return Response.json({estimates,openValue,outstanding,recent:recentResult.results});
}
