import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user || String(user.email??"").toLowerCase() !== OWNER_EMAIL) return reply({ error: "Unauthorized" }, 401);
  const { id } = await params;
  try {
    // Owner permissions alone do not prove an invoice references its OWN
    // customer's estimate. Check the actual persisted relationship before
    // returning even an existing share token. A cross-customer link must never
    // be sent while records need repair.
    const source = `SELECT inv.share_token AS shareToken,
      CASE WHEN EXISTS (
        SELECT 1 FROM estimates e JOIN customers c ON c.id=e.customer_id
        WHERE e.id=inv.estimate_id AND e.customer_id=inv.customer_id
      ) THEN 1 ELSE 0 END AS ownershipOk
      FROM invoices inv WHERE inv.id=?`;
    const invoice = await env.DB.prepare(source).bind(id).first<{shareToken:string|null;ownershipOk:number}>();
    if (!invoice) return reply({ error: "Invoice not found." }, 404);
    if (Number(invoice.ownershipOk)!==1) return reply({ error: "Invoice customer ownership needs review before sharing." }, 409);
    if (invoice.shareToken) return reply({ shareToken: invoice.shareToken });
    const candidate = crypto.randomUUID().replaceAll("-", "");
    // Compare-and-set prevents concurrent requests from replacing a token.
    // Repeat the ownership predicate INSIDE the write; a customer reassignment
    // after the SELECT must not mint a link for a different household.
    try {
      await env.DB.prepare(`UPDATE invoices SET share_token=? WHERE id=? AND (share_token IS NULL OR share_token='')
        AND EXISTS(SELECT 1 FROM estimates e JOIN customers c ON c.id=e.customer_id
          WHERE e.id=invoices.estimate_id AND e.customer_id=invoices.customer_id)`).bind(candidate,id).run();
    } catch {
      // A failed ACK may still mean the write committed. Confirm through D1.
    }
    // The provider may commit and lose its ACK. Read back the persisted
    // invoice with the SAME relationship proof before returning a share link.
    const stored = await env.DB.prepare(source).bind(id).first<{shareToken:string|null;ownershipOk:number}>();
    if (stored && Number(stored.ownershipOk)!==1) return reply({ error: "Invoice customer ownership needs review before sharing." }, 409);
    if (!stored?.shareToken) return reply({ error: "The invoice share link could not be confirmed. Refresh and try again." }, 503);
    return reply({ shareToken: stored.shareToken });
  } catch {
    return reply({ error: "The invoice share link could not be confirmed. Refresh and try again." }, 503);
  }
}
