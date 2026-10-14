import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getOwnerUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return new Response("Unauthorized", { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable. Existing photo records have been preserved." }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT object_key AS objectKey,content_type AS contentType FROM customer_photos WHERE id=?").bind(id).first<{objectKey:string;contentType:string}>();
  if (!row || !env.BUCKET) return new Response("Photo not found", { status: 404 });
  const object = await env.BUCKET.get(row.objectKey);
  if (!object) return new Response("Photo not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": row.contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox", "content-disposition": "inline" } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable. Existing photo records have been preserved." }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT object_key AS objectKey FROM customer_photos WHERE id=?").bind(id).first<{objectKey:string}>();
  if (!row) return Response.json({ error: "Photo not found." }, { status: 404 });
  // Remove the database reference FIRST. Deleting R2 bytes first can strand a
  // committed customer_photos row if the D1 deletion fails or its ACK is lost.
  try {
    await env.DB.prepare("DELETE FROM customer_photos WHERE id=?").bind(id).run();
  } catch {
    // The D1 delete may have committed before the response failed. NEVER
    // destroy photo bytes when the metadata outcome is ambiguous.
    return Response.json({
      error: "Photo deletion status is uncertain. Refresh Photos before trying again.",
      deleteUncertain: true,
    }, { status: 503 });
  }
  try {
    await env.BUCKET.delete(row.objectKey);
  } catch {
    // D1 no longer references the object, but its storage cleanup is uncertain.
    // Do not roll back metadata or silently claim a complete deletion.
    return Response.json({
      error: "Photo removed from records, but storage cleanup could not be verified.",
      cleanupUncertain: true,
    }, { status: 503 });
  }
  return Response.json({ ok: true });
}
