import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){
  try {
    const user=await getOwnerUser();
    return typeof user?.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL;
  } catch {
    // Missing, malformed or unavailable owner sessions must never read DR tasks.
    return false;
  }
}

const privateTaskHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const privateTaskReadJson=(body:unknown,status=200)=>Response.json(body,{status,headers:privateTaskHeaders});

export async function GET(){
  if(!await authorized())return privateTaskReadJson({error:"Unauthorized"},401);
  try {
    const rows=await env.DB.prepare(`SELECT t.id,t.title,t.customer_id AS customerId,t.estimate_id AS estimateId,t.due_at AS dueAt,t.status,t.notes,t.created_at AS createdAt,t.completed_at AS completedAt,c.name AS customer FROM tasks t LEFT JOIN customers c ON c.id=t.customer_id ORDER BY CASE WHEN t.status='open' THEN 0 ELSE 1 END,CASE WHEN t.status='open' AND t.due_at IS NOT NULL THEN 0 ELSE 1 END,t.due_at ASC,t.created_at DESC`).all();
    // D1 can return a nonthrowing failed read: no authoritative empty list exists
    // without both a confirmed result and a readable results array.
    if((rows as {success?:boolean}|null)?.success===false||!Array.isArray(rows?.results))
      return privateTaskReadJson({error:"Saved tasks are temporarily unavailable. No tasks were changed."},503);
    return privateTaskReadJson({tasks:rows.results});
  } catch {
    return privateTaskReadJson({error:"Saved tasks are temporarily unavailable. No tasks were changed."},503);
  }
}

export async function POST(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as Record<string,unknown>;const title=String(body.title??"").trim();if(!title)return Response.json({error:"Task title is required."},{status:400});const id=crypto.randomUUID();const createdAt=new Date().toISOString();let customerId=String(body.customerId??"").trim()||null;const estimateId=String(body.estimateId??"").trim()||null;const rawDueAt=String(body.dueAt??"").trim();let dueAt:string|null=null;if(rawDueAt){const parsedDueAt=new Date(rawDueAt);if(Number.isNaN(parsedDueAt.getTime()))return Response.json({error:"Choose a valid task due date."},{status:400});dueAt=parsedDueAt.toISOString();}const notes=String(body.notes??"").trim()||null;if(estimateId){const linked=await env.DB.prepare("SELECT customer_id AS customerId FROM estimates WHERE id=?").bind(estimateId).first<{customerId:string}>();if(!linked)return Response.json({error:"Job not found. Refresh before creating this task."},{status:404});if(customerId&&linked.customerId!==customerId)return Response.json({error:"That job does not belong to the selected customer."},{status:409});customerId=linked.customerId;}else if(customerId){const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first<{id:string}>();if(!customer)return Response.json({error:"Customer not found."},{status:404});}await env.DB.prepare("INSERT INTO tasks (id,title,customer_id,estimate_id,due_at,status,notes,created_at) VALUES (?,?,?,?,?,'open',?,?)").bind(id,title,customerId,estimateId,dueAt,notes,createdAt).run();return Response.json({task:{id,title,customerId,estimateId,dueAt,status:"open",notes,createdAt,customer:null}},{status:201});}

export async function PATCH(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as {id?:string;status?:string};const id=String(body.id??"");const status=body.status==="completed"?"completed":"open";const completedAt=status==="completed"?new Date().toISOString():null;const updated=await env.DB.prepare("UPDATE tasks SET status=?,completed_at=? WHERE id=?").bind(status,completedAt,id).run();if(!updated.meta.changes)return Response.json({error:"Task not found."},{status:404});return Response.json({ok:true,status,completedAt});}
