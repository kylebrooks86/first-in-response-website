import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const estimateId=new URL(request.url).searchParams.get("estimateId")||"";const rows=await env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,notes,airflow_before AS airflowBefore,airflow_after AS airflowAfter,status,created_at AS createdAt,completed_at AS completedAt FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC").bind(estimateId).all();return Response.json({reports:rows.results});}

export async function POST(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as {estimateId?:string;customerId?:string;checklist?:unknown;notes?:string;airflowBefore?:string;airflowAfter?:string;status?:string;complete?:boolean};if(!body.estimateId||!body.customerId)return Response.json({error:"Job and customer are required."},{status:400});const job=await env.DB.prepare("SELECT customer_id AS customerId,status FROM estimates WHERE id=?").bind(body.estimateId).first<{customerId:string;status:string}>();if(!job||job.customerId!==body.customerId)return Response.json({error:"That job does not belong to the selected customer."},{status:409});const createdAt=new Date().toISOString();const complete=body.complete||body.status==="complete"||body.status==="completed";if(complete&&!["scheduled","completed"].includes(job.status))return Response.json({error:"Schedule the approved job before completing its service report."},{status:409});if(complete){
 const c=(body.checklist??{}) as Record<string,boolean>;
 const before=["Property condition documented","Before photos captured","Plants and fragile areas protected","Service completed as quoted","After photos captured"];
 const walkthrough=c["Customer walkthrough completed"]===true;
 const absent=c["Customer absent — completion documented for follow-up"]===true;
 if(!c||typeof c!=="object"||before.some(key=>c[key]!==true)||walkthrough===absent||(absent&&!String(body.notes??"").trim()))
  return Response.json({error:"Complete all service steps, then confirm a real walkthrough or document customer absence in technician notes."},{status:409});
}
const status=complete?"completed":"draft";const completedAt=complete?createdAt:null;const existing=await env.DB.prepare("SELECT id,customer_id AS customerId,created_at AS createdAt FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC LIMIT 1").bind(body.estimateId).first<{id:string;customerId:string;createdAt:string}>();if(existing&&existing.customerId!==body.customerId)return Response.json({error:"The existing job report is linked to a different customer. Stop and review this record before editing it."},{status:409});const id=existing?.id||crypto.randomUUID();if(existing){await env.DB.prepare("UPDATE job_reports SET checklist=?,notes=?,airflow_before=?,airflow_after=?,status=?,completed_at=? WHERE id=?").bind(JSON.stringify(body.checklist??{}),String(body.notes??""),String(body.airflowBefore??"")||null,String(body.airflowAfter??"")||null,status,completedAt,id).run();}else{await env.DB.prepare("INSERT INTO job_reports (id,estimate_id,customer_id,checklist,notes,airflow_before,airflow_after,status,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,body.estimateId,body.customerId,JSON.stringify(body.checklist??{}),String(body.notes??""),String(body.airflowBefore??"")||null,String(body.airflowAfter??"")||null,status,createdAt,completedAt).run();}try{
 const saved=await env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,notes,airflow_before AS airflowBefore,airflow_after AS airflowAfter,status,created_at AS createdAt,completed_at AS completedAt FROM job_reports WHERE id=?").bind(id).first<{
  id:string;estimateId:string;customerId:string;checklist:string;notes:string;airflowBefore:string|null;airflowAfter:string|null;status:string;createdAt:string;completedAt:string|null
 }>();
 if(!saved||saved.id!==id||saved.estimateId!==body.estimateId||saved.customerId!==body.customerId||
    saved.checklist!==JSON.stringify(body.checklist??{})||saved.notes!==String(body.notes??"")||
    String(saved.airflowBefore??"")!==String(body.airflowBefore??"")||
    String(saved.airflowAfter??"")!==String(body.airflowAfter??"")||
    saved.status!==status||saved.createdAt!==(existing?.createdAt||createdAt)||
    saved.completedAt!==completedAt)throw Error("Incorrect saved job report.");
 return Response.json({report:saved},{status:existing?200:201,headers:{"Cache-Control":"no-store, private"}});
 }catch{return Response.json({error:"Report save was not confirmed. Reopen the saved report before repeating this operation.",saveUncertain:true},{status:503,headers:{"Cache-Control":"no-store, private"}});}
}
