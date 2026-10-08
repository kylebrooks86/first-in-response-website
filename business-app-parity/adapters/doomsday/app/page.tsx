import { env } from "cloudflare:workers";
import { Dashboard } from "./dashboard";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  if (user.email.toLowerCase() !== OWNER_EMAIL) {
    return <main className="access-page"><div className="access-card"><img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" /><h1>Private FIRE app</h1><p>This account does not have access to Kyle&apos;s business records.</p><a href={chatGPTSignOutPath("/")}>Sign out and use Kyle&apos;s account</a></div></main>;
  }
  const [summaryResult, recentResult] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS estimates,
      COALESCE(SUM(CASE WHEN status IN ('draft','sent') THEN total_cents ELSE 0 END),0) AS openValue,
      COALESCE(SUM(total_cents-(SELECT COALESCE(SUM(amount_cents),0) FROM payments p WHERE p.estimate_id=estimates.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund'))),0) AS outstanding
      FROM estimates`),
    env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,e.total_cents AS totalCents,e.deposit_cents AS depositCents,e.scheduled_at AS scheduledAt,e.share_token AS shareToken,e.first_viewed_at AS firstViewedAt,e.accepted_at AS acceptedAt,e.signed_name AS signedName,e.signed_at AS signedAt,e.contract_initials AS contractInitials,e.photo_release AS photoRelease,e.created_at AS createdAt,
      c.name AS customer,c.email,c.phone,c.address,
      COALESCE((SELECT GROUP_CONCAT(ei.name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
      COALESCE((SELECT GROUP_CONCAT(ei.description, '\n\n') FROM estimate_items ei WHERE ei.estimate_id=e.id),'') AS serviceDescription,
      COALESCE((SELECT SUM(amount_cents) FROM payments p WHERE p.estimate_id=e.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidCents,
      (SELECT id FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceId,
      (SELECT share_token FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceShareToken,
      (SELECT COUNT(*) FROM estimate_change_requests cr WHERE cr.estimate_id=e.id AND cr.status='open') AS pendingChangeCount,
      (SELECT message FROM estimate_change_requests cr WHERE cr.estimate_id=e.id ORDER BY cr.created_at DESC LIMIT 1) AS latestChangeRequest
      FROM estimates e JOIN customers c ON c.id=e.customer_id ORDER BY e.created_at DESC LIMIT 8`),
  ]);
  const summary=(summaryResult.results[0]??{estimates:0,openValue:0,outstanding:0}) as {estimates:number;openValue:number;outstanding:number};
  return <Dashboard environment="DOOMSDAY" userName={user.fullName?.split(" ")[0]??"Kyle"} metrics={{estimates:Number(summary.estimates),openValue:Number(summary.openValue),outstanding:Number(summary.outstanding)}} estimates={recentResult.results as never[]} />;
}
