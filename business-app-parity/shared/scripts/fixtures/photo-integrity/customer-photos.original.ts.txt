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
    try {
      await env.DB.prepare("INSERT INTO customer_photos (id,customer_id,category,caption,filename,content_type,size_bytes,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, customerId, safeCategory, caption || null, file.name || `photo.${extension}`, file.type, file.size, objectKey, createdAt).run();
    } catch (error) {
      await env.BUCKET.delete(objectKey);
      throw error;
    }
    return Response.json({ photo: { id, customerId, category: safeCategory, caption, filename: file.name, contentType: file.type, sizeBytes: file.size, createdAt } }, { status: 201 });
  } catch {
    return Response.json({ error: "We couldn't save this photo. Please try again." }, { status: 500 });
  }
}
