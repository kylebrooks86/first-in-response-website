import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return new Response("Unauthorized", { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable. Existing photo records have been preserved." }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT object_key AS objectKey,content_type AS contentType FROM customer_photos WHERE id=?").bind(id).first<{objectKey:string;contentType:string}>();
  if (!row || !env.BUCKET) return new Response("Photo not found", { status: 404 });
  const object = await env.BUCKET.get(row.objectKey);
  if (!object) return new Response("Photo not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": row.contentType, "cache-control": "private, max-age=3600", "content-disposition": "inline" } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable. Existing photo records have been preserved." }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT object_key AS objectKey FROM customer_photos WHERE id=?").bind(id).first<{objectKey:string}>();
  if (!row) return Response.json({ error: "Photo not found." }, { status: 404 });
  if (env.BUCKET) await env.BUCKET.delete(row.objectKey);
  await env.DB.prepare("DELETE FROM customer_photos WHERE id=?").bind(id).run();
  return Response.json({ ok: true });
}
