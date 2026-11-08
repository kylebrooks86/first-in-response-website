import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user || String(user.email??"").toLowerCase() !== OWNER_EMAIL) return reply({ error: "Unauthorized" }, 401);
  const { id } = await params;
  try {
    const invoice = await env.DB.prepare("SELECT share_token AS shareToken FROM invoices WHERE id=?").bind(id).first<{shareToken:string|null}>();
    if (!invoice) return reply({ error: "Invoice not found." }, 404);
    if (invoice.shareToken) return reply({ shareToken: invoice.shareToken });
    const candidate = crypto.randomUUID().replaceAll("-", "");
    // Compare-and-set prevents concurrent share requests from overwriting a
    // link already sent. Only the persisted token is safe to return.
    try {
      await env.DB.prepare("UPDATE invoices SET share_token=? WHERE id=? AND (share_token IS NULL OR share_token='')").bind(candidate, id).run();
    } catch {
      // A failed ACK may still mean the write committed. Confirm through D1.
    }
    const stored = await env.DB.prepare("SELECT share_token AS shareToken FROM invoices WHERE id=?").bind(id).first<{shareToken:string|null}>();
    if (!stored?.shareToken) return reply({ error: "The invoice share link could not be confirmed. Refresh and try again." }, 503);
    return reply({ shareToken: stored.shareToken });
  } catch {
    return reply({ error: "The invoice share link could not be confirmed. Refresh and try again." }, 503);
  }
}
