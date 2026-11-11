import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized()) return new Response("Unauthorized", { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable. Existing photo records have been preserved." }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT object_key AS objectKey,content_type AS contentType,size_bytes AS sizeBytes FROM customer_photos WHERE id=?").bind(id).first<{objectKey:string;contentType:string;sizeBytes:number}>();
  if (!row || !env.BUCKET) return new Response("Photo not found", { status: 404 });
  // Never show a different or altered R2 file under a customer's saved
  // photo record. The main photo archive also verifies these identities.
  try {
    const object = await env.BUCKET.get(row.objectKey);
    if (!object) return new Response("Photo not found", { status: 404 });
    if (!Number.isSafeInteger(Number(row.sizeBytes)) || Number(row.sizeBytes)<0 ||
        object.size!==Number(row.sizeBytes) || object.httpMetadata?.contentType!==row.contentType)
      return Response.json({error:"Saved photo and stored file do not match. Inspect photo storage before using this image.",photoIntegrityUncertain:true},
        {status:503,headers:{"cache-control":"private, no-store"}});
    return new Response(object.body, { headers: { "content-type": row.contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox", "content-disposition": "inline" } });
  } catch {
    return Response.json({error:"Photo bytes could not be verified. Original records were preserved.",photoIntegrityUncertain:true},
      {status:503,headers:{"cache-control":"private, no-store"}});
  }
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
    // Match both identity and object key: a stale lookup must not remove
    // bytes for a different photo record. D1 confirms one affected row.
    const deletion = await env.DB.prepare("DELETE FROM customer_photos WHERE id=? AND object_key=?").bind(id, row.objectKey).run();
    if (deletion.success !== true || deletion.meta?.changes !== 1) {
      return Response.json({
        error: "Photo changed or its deletion could not be confirmed. Refresh Photos before retrying.",
        deleteUncertain: true,
      }, { status: 503 });
    }
  } catch {
    // The D1 delete may have committed before the response failed. NEVER
    // destroy photo bytes when the metadata outcome is ambiguous.
    return Response.json({
      error: "Photo deletion status is uncertain. Refresh Photos before trying again.",
      deleteUncertain: true,
    }, { status: 503 });
  }
  // A D1 write ACK alone is insufficient proof to destroy the only copy of
  // photo bytes. After the metadata delete, independently confirm NO row
  // still uses this exact R2 key, including another record with a duplicate
  // object key. A lost readback keeps the bytes for Gate 7 recovery.
  try {
    const references=await env.DB.prepare("SELECT COUNT(*) AS count FROM customer_photos WHERE object_key=?")
      .bind(row.objectKey).first<{count:number}>();
    if(!references||!Number.isSafeInteger(Number(references.count))||
       Number(references.count)!==0)
      return Response.json({
        error:"Photo metadata deletion or shared storage references could not be verified. Storage bytes were preserved.",
        cleanupUncertain:true,
      },{status:503,headers:{"cache-control":"private, no-store"}});
  } catch {
    return Response.json({
      error:"Photo deletion readback is unavailable. Storage bytes were preserved for recovery.",
      cleanupUncertain:true,
    },{status:503,headers:{"cache-control":"private, no-store"}});
  }
  try {
    await env.BUCKET.delete(row.objectKey);
    // R2.delete may resolve without proving that the object is gone. Never
    // promise full cleanup when an independently read HEAD still finds bytes.
    const remaining=await env.BUCKET.head(row.objectKey);
    if(remaining)return Response.json({
      error:"Photo removed from records, but stored bytes are still present. Inspect storage before attempting cleanup.",
      cleanupUncertain:true,
    },{status:503,headers:{"cache-control":"private, no-store"}});
  } catch {
    return Response.json({
      error: "Photo removed from records, but storage cleanup could not be verified.",
      cleanupUncertain: true,
    }, { status: 503,headers:{"cache-control":"private, no-store"} });
  }
  return Response.json({ ok: true },{headers:{"cache-control":"private, no-store"}});
}
