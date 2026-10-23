import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const rows=await env.DB.prepare(`SELECT t.id,t.title,t.customer_id AS customerId,t.estimate_id AS estimateId,t.due_at AS dueAt,t.status,t.notes,t.created_at AS createdAt,t.completed_at AS completedAt,c.name AS customer FROM tasks t LEFT JOIN customers c ON c.id=t.customer_id ORDER BY CASE WHEN t.status='open' THEN 0 ELSE 1 END,CASE WHEN t.status='open' AND t.due_at IS NOT NULL THEN 0 ELSE 1 END,t.due_at ASC,t.created_at DESC`).all();return Response.json({tasks:rows.results},{headers:{"cache-control":"private, no-store"}});}

const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;
 try{
  const parsed:unknown=await request.json();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid payload");
  body=parsed as Record<string,unknown>;
 }catch{return Response.json({error:"A valid task request is required."},{status:400});}
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

export async function PATCH(request:Request){
 if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
 let body:{id?:unknown;status?:unknown;expectedStatus?:unknown;operation?:unknown;dueAt?:unknown;expectedDueAt?:unknown};
 try{
  const parsed:unknown=await request.json();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid task update");
  body=parsed as typeof body;
 }catch{return Response.json({error:"Task update requires a valid JSON object."},{status:400});}
 const id=typeof body.id==="string"?body.id.trim():"";
 // Rescheduling is separate from status toggles: it cannot complete a task,
 // alter linked customer/estimate identities, or rewrite a yard-sign/review marker.
 if(body.operation!==undefined&&body.operation!=="reschedule")
  return Response.json({error:"Unknown task operation."},{status:400});
 if(body.operation==="reschedule"){
  const taskId=typeof body.id==="string"?body.id.trim():"";
  const next=body.dueAt,expected=body.expectedDueAt;
  const validSaved=(value:unknown)=>value===null||(typeof value==="string"&&value.length<=64&&Number.isFinite(Date.parse(value)));
  const validNew=(value:unknown)=>value===null||(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value);
  if(!taskId||taskId.length>128||body.status!==undefined||body.expectedStatus!=="open"||!validSaved(expected)||!validNew(next))
   return Response.json({error:"Choose a valid open task and a precise due date."},{status:400});
  // A conditional write protects a newer edit or completion on another phone.
  // NULL and date values must both match the caller's last verified GET.
  const changed=await env.DB.prepare("UPDATE tasks SET due_at=? WHERE id=? AND status='open' AND due_at IS ?")
   .bind(next,taskId,expected).run();
  const saved=await env.DB.prepare("SELECT status,due_at AS dueAt FROM tasks WHERE id=?").bind(taskId).first<{status:string;dueAt:string|null}>();
  if(!saved)return Response.json({error:"Task not found. Refresh saved tasks."},{status:404});
  if(saved.status!=="open")return Response.json({error:"Task is no longer open. Refresh saved tasks before editing."},{status:409});
  if(saved.dueAt===next)return Response.json({ok:true,id:taskId,status:"open",dueAt:saved.dueAt,replayed:changed.meta.changes!==1});
  return Response.json({error:"The task due date changed on another device. Refresh saved tasks before rescheduling.",currentDueAt:saved.dueAt},{status:409});
 }
 if(!id||id.length>128||!(body.status==="completed"||body.status==="open")||(body.expectedStatus!==undefined&&body.expectedStatus!=="open"&&body.expectedStatus!=="completed"))
  return Response.json({error:"Choose a valid task and status."},{status:400});
 const status=body.status;
 const completedAt=status==="completed"?new Date().toISOString():null;
 // A repeated request that already reached the target must never rewrite completed_at.
 // The expected-status condition still rejects stale changes by another device.
 const statement=body.expectedStatus===undefined
  ?env.DB.prepare("UPDATE tasks SET status=?,completed_at=? WHERE id=? AND status<>?").bind(status,completedAt,id,status)
  :env.DB.prepare("UPDATE tasks SET status=?,completed_at=? WHERE id=? AND status=? AND status<>?").bind(status,completedAt,id,body.expectedStatus,status);
 const result=await statement.run();
 if(result.meta.changes===1)return Response.json({ok:true,status,completedAt});
 const saved=await env.DB.prepare("SELECT status,completed_at AS completedAt FROM tasks WHERE id=?").bind(id).first<{status:string;completedAt:string|null}>();
 if(!saved)return Response.json({error:"Task not found. Refresh the task list."},{status:404});
 if(saved.status===status)return Response.json({ok:true,status:saved.status,completedAt:saved.completedAt});
 return Response.json({error:"The task changed elsewhere. Refresh the task list before updating it again.",currentStatus:saved.status},{status:409});
}
