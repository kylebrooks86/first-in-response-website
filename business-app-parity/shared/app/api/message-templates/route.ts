import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { FIRE_TEMPLATES, SERVICE_AGREEMENT, businessTemplateOverride } from "../../../lib/fire-templates";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const saved=await env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates").all<{key:string;subject:string;body:string;updatedAt:string}>();
  const overrides=new Map((saved.results??[]).map((item)=>[item.key,businessTemplateOverride(item)]));
  return Response.json({templates:FIRE_TEMPLATES.map((item)=>{const override=overrides.get(item.key);if(item.key==="contractTerms"&&override?.body.startsWith("I authorize First In Response Exteriors to perform the services listed"))return {...item,body:SERVICE_AGREEMENT};return {...item,...override};})});
}

export async function PUT(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json() as {key?:string;subject?:string;body?:string;reset?:boolean};
  const template=FIRE_TEMPLATES.find((item)=>item.key===body.key);
  if(!template)return Response.json({error:"Unknown template."},{status:400});
  const uncertain=()=>Response.json({
    error:"Template save not confirmed. Your edits may already be stored. Reopen Settings and check the saved version before trying again.",
    saveUncertain:true
  },{status:503,headers:{"Cache-Control":"no-store, private"}});
  if(body.reset){
    try{
      await env.DB.prepare("DELETE FROM message_templates WHERE key=?").bind(template.key).run();
      // An OK HTTP response is not proof the restored default is saved.
      // The original is active only when no override row survives in D1.
      const retained=await env.DB.prepare("SELECT key FROM message_templates WHERE key=?").bind(template.key).first<{key:string}>();
      if(retained)return uncertain();
      return Response.json({template},{headers:{"Cache-Control":"no-store, private"}});
    }catch{return uncertain();}
  }
  const subject=String(body.subject??"").trim();
  const content=String(body.body??"").trim();
  if(!content)return Response.json({error:"Template message cannot be empty."},{status:400});
  const updatedAt=new Date().toISOString();
  try{
    await env.DB.prepare("INSERT INTO message_templates (key,subject,body,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at").bind(template.key,subject,content,updatedAt).run();
    const saved=await env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates WHERE key=?")
      .bind(template.key).first<{key:string;subject:string;body:string;updatedAt:string}>();
    if(!saved||saved.key!==template.key||saved.subject!==subject||saved.body!==content||saved.updatedAt!==updatedAt)
      return uncertain();
    return Response.json({template:{...template,subject:saved.subject,body:saved.body,updatedAt:saved.updatedAt}},{headers:{"Cache-Control":"no-store, private"}});
  }catch{return uncertain();}
}
