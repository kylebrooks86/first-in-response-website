import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getOwnerUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const customerId = String(body.customerId ?? "").trim();
    const noteBody = String(body.body ?? "").trim();
    if (!customerId || !noteBody) return Response.json({ error: "Write a note before saving." }, { status: 400 });
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first<{id:string}>();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO customer_notes (id,customer_id,body,created_at) VALUES (?,?,?,?)").bind(id, customerId, noteBody, createdAt).run();
    return Response.json({ note: { id, customerId, body: noteBody, createdAt } }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't save this note." }, { status: 500 });
  }
}
