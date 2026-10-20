import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const rows=await env.DB.prepare(`SELECT x.id,x.estimate_id AS estimateId,x.category,x.description,x.amount_cents AS amountCents,x.incurred_at AS incurredAt,x.created_at AS createdAt,c.name AS customer,
    COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'') AS service
    FROM expenses x LEFT JOIN estimates e ON e.id=x.estimate_id LEFT JOIN customers c ON c.id=e.customer_id ORDER BY x.incurred_at DESC,x.created_at DESC,x.id DESC`).all<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string;customer:string|null;service:string|null}>();
  if(new URL(request.url).searchParams.get("format")==="csv"){
    // Excel and other spreadsheet tools can evaluate formula-looking CSV cells even when quoted.
    // Prefix text with an apostrophe when its first non-whitespace character is a formula operator.
    const escape=(value:unknown)=>{
      const original=String(value??"");
      const safe=/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(original)?"'"+original:original;
      return `"${safe.replaceAll('"','""')}"`;
    };
    const csv=["Date,Category,Description,Amount,Customer,Job",...(rows.results??[]).map((item)=>[item.incurredAt.slice(0,10),item.category,item.description,(item.amountCents/100).toFixed(2),item.customer,item.service].map(escape).join(","))].join("\n");
    return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=fire-expenses-wave.csv","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }
  return Response.json({expenses:rows.results},{headers:{"cache-control":"private, no-store"}});
}

const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;
 try{
  const parsed:unknown=await request.json();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid payload");
  body=parsed as Record<string,unknown>;
 }catch{return Response.json({error:"A valid expense request is required."},{status:400});}
 const description=String(body.description??"").trim();
 const rawAmount=body.amountCents;
 if((typeof rawAmount!=="number"&&typeof rawAmount!=="string")||(typeof rawAmount==="string"&&!rawAmount.trim())||!Number.isSafeInteger(Number(rawAmount))||Number(rawAmount)<=0||!description)
  return Response.json({error:"Description and a valid whole-cent amount are required."},{status:400});
 const amountCents=Number(rawAmount);
 if(body.requestId!==undefined&&(typeof body.requestId!=="string"||!v4.test(body.requestId)))return Response.json({error:"A valid expense request ID is required."},{status:400});
 const id=typeof body.requestId==="string"?body.requestId:crypto.randomUUID();
 const estimateId=String(body.estimateId??"").trim()||null;
 if(estimateId){
  const estimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=?").bind(estimateId).first<{id:string}>();
  if(!estimate)return Response.json({error:"Job not found. Refresh before attaching this expense."},{status:404});
 }
 const rawIncurredAt=String(body.incurredAt??new Date().toISOString());
 const parsedIncurredAt=new Date(rawIncurredAt);
 if(!Number.isFinite(parsedIncurredAt.getTime()))return Response.json({error:"Choose a valid expense date."},{status:400});
 const category=String(body.category??"Supplies");
 const incurredAt=parsedIncurredAt.toISOString();
 const createdAt=new Date().toISOString();
 // A repeated owner request must resolve to the original expense, not a duplicate.
 const inserted=await env.DB.prepare("INSERT OR IGNORE INTO expenses (id,estimate_id,category,description,amount_cents,incurred_at,created_at) VALUES (?,?,?,?,?,?,?)").bind(id,estimateId,category,description,amountCents,incurredAt,createdAt).run();
 const saved=await env.DB.prepare("SELECT id,estimate_id AS estimateId,category,description,amount_cents AS amountCents,incurred_at AS incurredAt,created_at AS createdAt FROM expenses WHERE id=?").bind(id).first<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string}>();
 if(!saved||saved.estimateId!==estimateId||saved.category!==category||saved.description!==description||Number(saved.amountCents)!==amountCents||saved.incurredAt!==incurredAt)
  return Response.json({error:"That expense request ID is already associated with different details. Review saved expenses before trying again."},{status:409});
 return Response.json({expense:saved,requestId:id,confirmed:true},{status:inserted.meta.changes===1?201:200});
}
