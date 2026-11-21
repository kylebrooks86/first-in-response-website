import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import { FIRE_TEMPLATES, SERVICE_AGREEMENT } from "../../../lib/fire-templates";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
const privateHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const privateJson=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});

async function authorized(){
  try {
    const user=await getOwnerUser();
    return Boolean(user&&typeof user.email==="string"&&user.email.toLowerCase()===OWNER_EMAIL);
  } catch {
    // Never query or mutate independent DR owner templates after session failure.
    return false;
  }
}

export async function GET(){
  if(!await authorized())return privateJson({error:"Unauthorized"},401);
  try {
    const saved=await env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates").all<{key:string;subject:string;body:string;updatedAt:string}>();
    const overrides=new Map((saved.results??[]).map((item)=>[item.key,item]));
    return privateJson({templates:FIRE_TEMPLATES.map((item)=>{
      const override=overrides.get(item.key);
      if(item.key==="contractTerms"&&override?.body.startsWith("I authorize First In Response Exteriors to perform the services listed"))
        return {...item,body:SERVICE_AGREEMENT};
      return {...item,...override};
    })});
  } catch {
    return privateJson({error:"Message templates could not be read. Saved templates were not changed."},503);
  }
}

export async function PUT(request:Request){
  if(!await authorized())return privateJson({error:"Unauthorized"},401);
  let body:{key?:string;subject?:string;body?:string;reset?:boolean};
  try {
    const parsed:unknown=await request.json();
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
      return privateJson({error:"Choose a valid template."},400);
    body=parsed as typeof body;
  } catch {
    return privateJson({error:"Choose a valid template."},400);
  }
  const template=FIRE_TEMPLATES.find((item)=>item.key===body.key);
  if(!template)return privateJson({error:"Unknown template."},400);
  try {
    if(body.reset){
      await env.DB.prepare("DELETE FROM message_templates WHERE key=?").bind(template.key).run();
      return privateJson({template});
    }
    const subject=String(body.subject??"").trim();
    const content=String(body.body??"").trim();
    if(!content)return privateJson({error:"Template message cannot be empty."},400);
    const updatedAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO message_templates (key,subject,body,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at").bind(template.key,subject,content,updatedAt).run();
    return privateJson({template:{...template,subject,body:content,updatedAt}});
  } catch {
    // An unsuccessful ACK does not prove a D1 write was rolled back.
    return privateJson({error:"Template save could not be verified. Refresh saved templates before retrying.",saveUncertain:true},503);
  }
}
