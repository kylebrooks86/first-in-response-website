import { env } from "cloudflare:workers";
import { Dashboard } from "./dashboard";
import { requireOwnerUser } from "./owner-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireOwnerUser("/");
  const [summaryResult, recentResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS estimates,
      COALESCE(SUM(CASE WHEN status IN ('draft','sent') THEN total_cents ELSE 0 END),0) AS openValue,
      COALESCE(SUM(CASE
        WHEN status IN ('approved','scheduled') AND EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=estimates.id) THEN MAX(0, (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid'))
        WHEN status IN ('approved','scheduled') THEN MAX(0, deposit_cents-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid'))
        WHEN status='completed' THEN MAX(0, COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1), total_cents)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid'))
        ELSE 0
      END),0) AS outstanding
      FROM estimates`),
    env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
      c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
      COALESCE((SELECT description FROM estimate_items ei WHERE ei.estimate_id=e.id ORDER BY rowid ASC LIMIT 1),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid'),0) AS paidCents,
      (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
      (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
      (SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents,
      (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
      (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest
      FROM estimates e JOIN customers c ON c.id=e.customer_id
      ORDER BY e.created_at DESC LIMIT 8`),
  ]);
  const summary=(summaryResult.results[0]??{estimates:0,openValue:0,outstanding:0}) as {estimates:number;openValue:number;outstanding:number};
  return <Dashboard userName={user.fullName?.split(" ")[0]??"Kyle"} metrics={{estimates:Number(summary.estimates),openValue:Number(summary.openValue),outstanding:Number(summary.outstanding)}} estimates={recentResult.results as never[]} />;
}
