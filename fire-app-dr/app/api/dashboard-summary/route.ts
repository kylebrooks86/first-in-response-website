import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

export const dynamic = "force-dynamic";

// DR returns the same owner-private boundary as the QA-master dashboard.
// Never cache billing summaries, invoice share tokens or unauthenticated errors.
const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const privateHeaders = {"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const privateJson = (body: unknown, status = 200) => Response.json(body, {status, headers:privateHeaders});

export async function GET() {
  try {
    const owner = await getOwnerUser();
    if (typeof owner?.email !== "string" || owner.email.toLowerCase() !== OWNER_EMAIL)
      return privateJson({error:"Unauthorized"},401);
  } catch {
    return privateJson({error:"Unauthorized"},401);
  }
  try {
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS estimates,
      COALESCE(SUM(CASE WHEN status IN ('draft','sent') THEN total_cents ELSE 0 END),0) AS openValue,
      COALESCE(SUM(CASE
        WHEN status IN ('approved','scheduled') AND EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=estimates.id AND inv.customer_id=estimates.customer_id) THEN MAX(0, (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id AND inv.customer_id=estimates.customer_id LIMIT 1)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        WHEN status IN ('approved','scheduled') THEN MAX(0, deposit_cents-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        WHEN status='completed' THEN MAX(0, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id AND inv.customer_id=estimates.customer_id LIMIT 1), total_cents)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')))
        ELSE 0
      END),0) AS outstanding
      FROM estimates`),
    env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
      c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
      COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceId,
      (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceShareToken,
      (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1) AS invoiceTotalCents,
      (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
      (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest,
      (SELECT COUNT(*) FROM notifications n WHERE n.estimate_id=e.id AND n.type='payment_overage' AND n.resolved_at IS NULL) AS paymentOverageOpen,
      (SELECT COUNT(*) FROM payment_refunds r WHERE r.estimate_id=e.id AND r.status='pending') AS pendingRefundCount
      FROM estimates e JOIN customers c ON c.id=e.customer_id
      ORDER BY e.created_at DESC LIMIT 8`),
  ]);
  // A D1 read that did not confirm success must not masquerade as a zero-dollar
  // dashboard. A real SQL aggregate returns exactly one summary row, even
  // for a genuinely empty database.
  if (!Array.isArray(batch) || batch.length !== 2 ||
      batch.some(item => !item || (item as {success?:boolean}).success === false || !Array.isArray(item.results)))
    return privateJson({error:"Dashboard could not be verified. Retry when records are available."},503);
  const [summaryResult,recentResult] = batch;
  if (summaryResult.results.length !== 1 || !summaryResult.results[0])
    return privateJson({error:"Dashboard could not be verified. Retry when records are available."},503);
  const result=summaryResult.results[0] as {estimates:number;openValue:number;outstanding:number};
  const estimates=Number(result.estimates??0);
  const openValue=Number(result.openValue??0);
  const outstanding=Number(result.outstanding??0);
  const summarySafe=Number.isSafeInteger(estimates)&&estimates>=0&&Number.isSafeInteger(openValue)&&openValue>=0&&Number.isSafeInteger(outstanding)&&outstanding>=0;
  const recentSafe=(recentResult.results as Record<string,unknown>[]).every((row)=>{
    const values=[row.totalCents,row.depositCents,row.paidCents];
    if(row.invoiceTotalCents!==null&&row.invoiceTotalCents!==undefined)values.push(row.invoiceTotalCents);
    return values.every((value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0);
  });
  if(!summarySafe||!recentSafe)return privateJson({error:"Dashboard billing totals require owner review before FIRE can safely summarize them."},409);
  return privateJson({estimates,openValue,outstanding,recent:recentResult.results});
  } catch {
    return privateJson({error:"Dashboard could not be verified. Retry when records are available."},503);
  }
}
