import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("photo");
    const customerId = String(form.get("customerId") ?? "").trim();
    const category = String(form.get("category") ?? "property").trim().toLowerCase();
    const caption = String(form.get("caption") ?? "").trim();
    if (!customerId || !(file instanceof File)) return Response.json({ error: "Choose a customer and photo." }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Only image files can be uploaded." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "That photo is larger than 15 MB. Choose a smaller image." }, { status: 413 });
    const customer = await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
    if (!customer) return Response.json({ error: "Customer not found." }, { status: 404 });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const safeCategory = ["before","after","property"].includes(category) ? category : "property";
    const extension = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0,8) : "jpg";
    const objectKey = `customers/${customerId}/${id}.${extension || "jpg"}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    const filename = file.name || `photo.${extension || "jpg"}`;
    // An ACK is not a saved photo. The photo's D1 metadata must be verified
    // against the exact R2 key just written before the customer sees success.
    // Never delete R2 bytes on an uncertain DB outcome: D1 may have committed.
    const uncertain = () => Response.json({
      error: "Photo save status is uncertain. Check this customer's Photos before uploading again.",
      saveUncertain: true,
    }, { status: 503, headers: { "cache-control": "no-store" } });
    try {
      const saved = await env.DB.prepare("INSERT INTO customer_photos (id,customer_id,category,caption,filename,content_type,size_bytes,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, customerId, safeCategory, caption || null, filename, file.type, file.size, objectKey, createdAt).run();
      if (saved.success !== true || saved.meta?.changes !== 1) return uncertain();
      const confirmed = await env.DB.prepare(`SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,object_key AS objectKey,created_at AS createdAt FROM customer_photos WHERE id=? LIMIT 1`)
        .bind(id).first<{id:string;customerId:string;category:string;caption:string|null;filename:string;contentType:string;sizeBytes:number;objectKey:string;createdAt:string}>();
      if (!confirmed || confirmed.id !== id || confirmed.customerId !== customerId ||
          confirmed.objectKey !== objectKey || confirmed.category !== safeCategory ||
          confirmed.contentType !== file.type || Number(confirmed.sizeBytes) !== file.size ||
          confirmed.filename !== filename || confirmed.caption !== (caption || null) ||
          confirmed.createdAt !== createdAt) return uncertain();
    } catch {
      // D1 may have committed before a lost ACK/read-back failure; preserve
      // the object and require a read-only gallery/storage review before retry.
      return uncertain();
    }
    return Response.json({ photo: { id, customerId, category: safeCategory, caption, filename, contentType: file.type, sizeBytes: file.size, createdAt } }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "We couldn't save this photo. Please try again." }, { status: 500 });
  }
}
