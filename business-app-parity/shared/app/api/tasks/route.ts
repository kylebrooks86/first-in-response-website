import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const rows=await env.DB.prepare(`SELECT t.id,t.title,t.customer_id AS customerId,t.estimate_id AS estimateId,t.due_at AS dueAt,t.status,t.notes,t.created_at AS createdAt,t.completed_at AS completedAt,c.name AS customer FROM tasks t LEFT JOIN customers c ON c.id=t.customer_id ORDER BY CASE WHEN t.status='open' THEN 0 ELSE 1 END,t.due_at ASC,t.created_at DESC`).all();return Response.json({tasks:rows.results});}

const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
 const body=await request.json() as Record<string,unknown>;
 const title=String(body.title??"").trim();
 if(!title)return Response.json({error:"Task title is required."},{status:400});
 if(body.requestId!==undefined&&(typeof body.requestId!=="string"||!v4.test(body.requestId)))return Response.json({error:"A valid task request ID is required."},{status:400});
 const id=typeof body.requestId==="string"?body.requestId:crypto.randomUUID();
 const createdAt=new Date().toISOString();
 let customerId=String(body.customerId??"").trim()||null;
 const estimateId=String(body.estimateId??"").trim()||null;
 const rawDueAt=String(body.dueAt??"").trim();
 let dueAt:string|null=null;
 if(rawDueAt){
  const parsedDueAt=new Date(rawDueAt);
  if(!Number.isFinite(parsedDueAt.getTime()))return Response.json({error:"Choose a valid task due date."},{status:400});
  dueAt=parsedDueAt.toISOString();
 }
 const notes=String(body.notes??"").trim()||null;
 if(estimateId){
  const linked=await env.DB.prepare("SELECT customer_id AS customerId FROM estimates WHERE id=?").bind(estimateId).first<{customerId:string}>();
  if(!linked)return Response.json({error:"Job not found. Refresh before creating this task."},{status:404});
  if(customerId&&linked.customerId!==customerId)return Response.json({error:"That job does not belong to the selected customer."},{status:409});
  customerId=linked.customerId;
 }else if(customerId){
  const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first<{id:string}>();
  if(!customer)return Response.json({error:"Customer not found."},{status:404});
 }
 // A repeated owner request reuses its primary key; never append a second task.
 const inserted=await env.DB.prepare("INSERT OR IGNORE INTO tasks (id,title,customer_id,estimate_id,due_at,status,notes,created_at) VALUES (?,?,?,?,?,'open',?,?)").bind(id,title,customerId,estimateId,dueAt,notes,createdAt).run();
 const saved=await env.DB.prepare("SELECT id,title,customer_id AS customerId,estimate_id AS estimateId,due_at AS dueAt,status,notes,created_at AS createdAt,completed_at AS completedAt FROM tasks WHERE id=?").bind(id).first<{id:string;title:string;customerId:string|null;estimateId:string|null;dueAt:string|null;status:string;notes:string|null;createdAt:string;completedAt:string|null}>();
 if(!saved||saved.title!==title||saved.customerId!==customerId||saved.estimateId!==estimateId||saved.dueAt!==dueAt||saved.notes!==notes)return Response.json({error:"That task request ID is already associated with different details. Review saved tasks before trying again."},{status:409});
 return Response.json({task:{...saved,customer:null},requestId:id,confirmed:true},{status:inserted.meta.changes===1?201:200});
}

export async function PATCH(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as {id?:string;status?:string};const id=String(body.id??"");const status=body.status==="completed"?"completed":"open";const completedAt=status==="completed"?new Date().toISOString():null;const updated=await env.DB.prepare("UPDATE tasks SET status=?,completed_at=? WHERE id=?").bind(status,completedAt,id).run();if(!updated.meta.changes)return Response.json({error:"Task not found."},{status:404});return Response.json({ok:true,status,completedAt});}
