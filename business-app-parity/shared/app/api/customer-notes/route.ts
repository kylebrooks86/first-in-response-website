import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized(){ const user=await getChatGPTUser(); return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL); }
const requestIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body:Record<string,unknown>;
  try{
    const parsed:unknown=await request.json();
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid note');
    body=parsed as Record<string,unknown>;
  }catch{return Response.json({error:'A valid customer note request is required.'},{status:400});}
  if(typeof body.customerId!=='string'||!body.customerId.trim()||typeof body.body!=='string'||!body.body.trim()||body.body.trim().length>5000)return Response.json({error:'Choose a customer and write a note of 1–5,000 characters.'},{status:400});
  if(body.requestId!==undefined&&(typeof body.requestId!=='string'||!requestIdPattern.test(body.requestId)))return Response.json({error:'A valid note request ID is required.'},{status:400});
  const customerId=body.customerId.trim(),noteBody=body.body.trim(),id=typeof body.requestId==='string'?body.requestId:crypto.randomUUID();
  try {
    const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first<{id:string}>();
    if(!customer)return Response.json({error:"Customer not found."},{status:404});
    const createdAt = new Date().toISOString();
    const inserted=await env.DB.prepare("INSERT OR IGNORE INTO customer_notes (id,customer_id,body,created_at) VALUES (?,?,?,?)").bind(id, customerId, noteBody, createdAt).run();
    const note=await env.DB.prepare('SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes WHERE id=?').bind(id).first<{id:string;customerId:string;body:string;createdAt:string}>();
    if(!note||note.customerId!==customerId||note.body!==noteBody)return Response.json({error:'That note request ID belongs to different details. Refresh saved notes before another attempt.'},{status:409});
    return Response.json({note,requestId:id,confirmed:true},{status:inserted.meta.changes===1?201:200,headers:{'cache-control':'no-store, private'}});
  } catch {
    return Response.json({ error: "The note save was not confirmed. Keep the same request ID when retrying." }, { status: 500 });
  }
}
