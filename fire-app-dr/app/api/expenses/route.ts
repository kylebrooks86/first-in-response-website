import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const rows=await env.DB.prepare(`SELECT x.id,x.estimate_id AS estimateId,x.category,x.description,x.amount_cents AS amountCents,x.incurred_at AS incurredAt,x.created_at AS createdAt,c.name AS customer,
    COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'') AS service
    FROM expenses x LEFT JOIN estimates e ON e.id=x.estimate_id LEFT JOIN customers c ON c.id=e.customer_id ORDER BY x.incurred_at DESC`).all<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string;customer:string|null;service:string|null}>();
  if(new URL(request.url).searchParams.get("format")==="csv"){
    const escape=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
    const csv=["Date,Category,Description,Amount,Customer,Job",...(rows.results??[]).map((item)=>[item.incurredAt.slice(0,10),item.category,item.description,(item.amountCents/100).toFixed(2),item.customer,item.service].map(escape).join(","))].join("\n");
    return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=fire-expenses-wave.csv"}});
  }
  return Response.json({expenses:rows.results});
}

export async function POST(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as Record<string,unknown>;const description=String(body.description??"").trim();const amountCents=Math.round(Number(body.amountCents)||0);if(!description||!Number.isSafeInteger(amountCents)||amountCents<=0)return Response.json({error:"Description and a valid amount are required."},{status:400});const estimateId=String(body.estimateId??"").trim()||null;if(estimateId){const estimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=?").bind(estimateId).first<{id:string}>();if(!estimate)return Response.json({error:"Job not found. Refresh before attaching this expense."},{status:404});}const rawIncurredAt=String(body.incurredAt??new Date().toISOString());const parsedIncurredAt=new Date(rawIncurredAt);if(Number.isNaN(parsedIncurredAt.getTime()))return Response.json({error:"Choose a valid expense date."},{status:400});const expense={id:crypto.randomUUID(),estimateId,category:String(body.category??"Supplies"),description,amountCents,incurredAt:parsedIncurredAt.toISOString(),createdAt:new Date().toISOString()};await env.DB.prepare("INSERT INTO expenses (id,estimate_id,category,description,amount_cents,incurred_at,created_at) VALUES (?,?,?,?,?,?,?)").bind(expense.id,expense.estimateId,expense.category,expense.description,expense.amountCents,expense.incurredAt,expense.createdAt).run();return Response.json({expense},{status:201});}
