import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

// A valid 15 MiB photo needs only a small multipart framing budget.
// Bound bytes BEFORE request.formData(): a declared tiny length is not
// authoritative and an owner session must not allocate a 100 MiB body.
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const PHOTO_REQUEST_MAX_BYTES = PHOTO_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;
const PHOTO_TYPES: Record<string,string> = {
  "image/jpeg":"jpg",
  "image/png":"png",
  "image/webp":"webp",
  "image/gif":"gif",
  "image/heic":"heic",
  "image/heif":"heif",
  "image/avif":"avif",
  "image/bmp":"bmp",
  "image/tiff":"tiff",
};
async function boundedPhotoForm(request:Request):Promise<FormData|Response>{
  const contentType=request.headers.get("content-type")??"";
  if(!/^multipart\/form-data\s*;/i.test(contentType))
    return Response.json({error:"Choose a photo upload form."},{status:415,headers:{"cache-control":"no-store"}});
  const claimed=request.headers.get("content-length");
  if(claimed!==null&&(!/^\d{1,9}$/.test(claimed)||Number(claimed)>PHOTO_REQUEST_MAX_BYTES))
    return Response.json({error:"The photo request exceeds the upload limit."},{status:413,headers:{"cache-control":"no-store"}});
  if(!request.body)return Response.json({error:"The photo upload was empty."},{status:400});
  const reader=request.body.getReader();
  let size=0;const chunks:Uint8Array[]=[];
  try{
    while(true){
      const next=await reader.read();
      if(next.done)break;
      if(!(next.value instanceof Uint8Array))
        return Response.json({error:"Invalid photo upload."},{status:400});
      size+=next.value.byteLength;
      if(size>PHOTO_REQUEST_MAX_BYTES)
        return Response.json({error:"The photo request exceeds the upload limit."},{status:413,headers:{"cache-control":"no-store"}});
      chunks.push(next.value);
    }
  }catch{
    return Response.json({error:"Photo upload interrupted. Nothing was saved."},{status:400});
  }finally{
    try{await reader.cancel();}catch{}
    reader.releaseLock();
  }
  try{
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return await new Request(request.url,{method:"POST",headers:{"content-type":contentType},body:bytes}).formData();
  }catch{
    return Response.json({error:"Invalid photo upload form."},{status:400});
  }
}

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });
    const parsed=await boundedPhotoForm(request);
    if(parsed instanceof Response)return parsed;
    const form = parsed;
    const file = form.get("photo");
    const customerId = String(form.get("customerId") ?? "").trim();
    const category = String(form.get("category") ?? "property").trim().toLowerCase();
    const caption = String(form.get("caption") ?? "").trim();
    if (!customerId || !(file instanceof File)) return Response.json({ error: "Choose a customer and photo." }, { status: 400 });
    const photoExtension=PHOTO_TYPES[file.type.toLowerCase()];
    // Raster still photos only. SVG/XML/HTML can be executable documents,
    // not customer photographs, even if named "before.jpg".
    if (!photoExtension) return Response.json({ error: "Choose a JPEG, PNG, WebP, HEIC, AVIF, GIF, BMP or TIFF photo." }, { status: 415 });
    if (file.size > PHOTO_MAX_BYTES) return Response.json({ error: "That photo is larger than 15 MB. Choose a smaller image." }, { status: 413 });
    const customer = await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
    if (!customer) return Response.json({ error: "Customer not found." }, { status: 404 });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const safeCategory = ["before","after","property"].includes(category) ? category : "property";
    // The storage object's extension follows the trusted accepted MIME,
    // not attacker-controlled filename suffixes (e.g. photo.html or svg).
    const extension = photoExtension;
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
