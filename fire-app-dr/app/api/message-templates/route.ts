import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import { FIRE_TEMPLATES, SERVICE_AGREEMENT } from "../../../lib/fire-templates";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const saved=await env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates").all<{key:string;subject:string;body:string;updatedAt:string}>();
  const overrides=new Map((saved.results??[]).map((item)=>[item.key,item]));
  return Response.json({templates:FIRE_TEMPLATES.map((item)=>{const override=overrides.get(item.key);if(item.key==="contractTerms"&&override?.body.startsWith("I authorize First In Response Exteriors to perform the services listed"))return {...item,body:SERVICE_AGREEMENT};return {...item,...override};})});
}

export async function PUT(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json() as {key?:string;subject?:string;body?:string;reset?:boolean};
  const template=FIRE_TEMPLATES.find((item)=>item.key===body.key);
  if(!template)return Response.json({error:"Unknown template."},{status:400});
  if(body.reset){await env.DB.prepare("DELETE FROM message_templates WHERE key=?").bind(template.key).run();return Response.json({template});}
  const subject=String(body.subject??"").trim();
  const content=String(body.body??"").trim();
  if(!content)return Response.json({error:"Template message cannot be empty."},{status:400});
  const updatedAt=new Date().toISOString();
  await env.DB.prepare("INSERT INTO message_templates (key,subject,body,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at").bind(template.key,subject,content,updatedAt).run();
  return Response.json({template:{...template,subject,body:content,updatedAt}});
}
