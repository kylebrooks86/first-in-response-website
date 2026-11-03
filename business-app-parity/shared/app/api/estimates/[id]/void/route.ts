import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";

/**
 * Owner-only, non-destructive removal of an unsent/sent unaccepted quote.
 * Existing schema intentionally uses "declined" (the historical/Lost lane).
 * This never deletes an estimate, an agreement, a ledger row, or a customer.
 */
export async function POST(_request: Request, {params}: {params: Promise<{id:string}>}) {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL)
    return Response.json({error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});

  const {id} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return Response.json({error:"Invalid estimate ID."},{status:400,headers:{"Cache-Control":"no-store"}});

  try {
    // Guard the transition AT the UPDATE, not just against an earlier
    // read, so a concurrent approval/payment cannot be lost to a void.
    const update = await env.DB.prepare(`
      UPDATE estimates SET status='declined', scheduled_at=NULL
      WHERE id=? AND status IN ('draft','sent')
        AND accepted_at IS NULL AND signed_at IS NULL AND scheduled_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM invoices WHERE estimate_id=?)
        AND NOT EXISTS (SELECT 1 FROM payments WHERE estimate_id=?)
        AND NOT EXISTS (SELECT 1 FROM payment_refunds WHERE estimate_id=?)
        AND NOT EXISTS (SELECT 1 FROM payment_checkout_sessions WHERE estimate_id=?)
        AND NOT EXISTS (SELECT 1 FROM job_reports WHERE estimate_id=?)
    `).bind(id,id,id,id,id,id).run();

    if (update.meta.changes !== 1) {
      const existing=await env.DB.prepare(
        "SELECT status FROM estimates WHERE id=? LIMIT 1"
      ).bind(id).first<{status:string}>();
      return Response.json(
        {error: existing
          ? "This estimate cannot be voided safely. It may already be approved, scheduled, or linked to customer, job, or financial history. Refresh before any further action."
          : "Estimate not found."},
        {status:existing?409:404,headers:{"Cache-Control":"no-store"}}
      );
    }
    return Response.json(
      {ok:true,estimate:{id,status:"declined",scheduledAt:null},retained:true},
      {headers:{"Cache-Control":"no-store"}}
    );
  } catch {
    return Response.json(
      {error:"Void confirmation is unavailable. Refresh the saved estimate before trying again.",saveUncertain:true},
      {status:503,headers:{"Cache-Control":"no-store"}}
    );
  }
}
