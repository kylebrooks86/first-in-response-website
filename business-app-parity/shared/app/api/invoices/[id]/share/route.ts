import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await env.DB.prepare("SELECT share_token AS shareToken FROM invoices WHERE id=?").bind(id).first<{shareToken:string|null}>();
  if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });
  if (invoice.shareToken) return Response.json({ shareToken: invoice.shareToken });
  const shareToken = crypto.randomUUID().replaceAll("-", "");
  await env.DB.prepare("UPDATE invoices SET share_token=? WHERE id=?").bind(shareToken, id).run();
  return Response.json({ shareToken });
}
