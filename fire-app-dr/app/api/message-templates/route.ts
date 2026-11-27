import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import { readOwnerWriteObject } from "../../../lib/customer-write-request-guard.mjs";
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
    // Missing/soft-failed D1 results must not masquerade as an empty DR
    // customization table: that could display defaults over saved wording.
    if((saved as unknown as {success?:boolean}).success===false||!Array.isArray(saved.results))
      return privateJson({error:"Message templates could not be read. Saved templates were not changed."},503);
    const overrides=new Map(saved.results.map((item)=>[item.key,item]));
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
  // Mirror the QA-master owner-only streaming/same-origin guard. Never buffer
  // unbounded or foreign-origin settings writes before validating the request.
  const parsed=await readOwnerWriteObject(request,64_000);
  if(parsed.response){
    for(const [name,value] of Object.entries(privateHeaders))
      parsed.response.headers.set(name,value);
    return parsed.response;
  }
  const body=parsed.value as {key?:string;subject?:string;body?:string;reset?:boolean};
  // A string "false", number 1 or mixed reset+edit must never delete an
  // owner-customized template. Refuse coercible and unknown fields pre-D1.
  if(Object.keys(body).some(key=>!["key","subject","body","reset"].includes(key))||
     (body.reset!==undefined&&typeof body.reset!=="boolean")||
     (body.reset===true&&(body.subject!==undefined||body.body!==undefined))||
     (body.reset!==true&&(typeof body.body!=="string"||
       (body.subject!==undefined&&typeof body.subject!=="string"))))
    return privateJson({error:"Choose either an exact template update or an explicit reset."},400);
  const template=FIRE_TEMPLATES.find((item)=>item.key===body.key);
  if(!template)return privateJson({error:"Unknown template."},400);
  const uncertain=()=>privateJson({
    error:"Template save could not be verified. Refresh saved templates before retrying.",
    saveUncertain:true
  },503);
  try {
    if(body.reset===true){
      // D1 may commit the DELETE but lose its response. Only a readback
      // confirming the override is absent can report restored defaults.
      try{await env.DB.prepare("DELETE FROM message_templates WHERE key=?").bind(template.key).run();}
      catch{/* The write may already be committed. */ }
      const retained=await env.DB.prepare("SELECT key FROM message_templates WHERE key=?")
        .bind(template.key).first<{key:string}>();
      return retained?uncertain():privateJson({template});
    }
    const subject=String(body.subject??"").trim();
    const content=String(body.body??"").trim();
    if(!content)return privateJson({error:"Template message cannot be empty."},400);
    const updatedAt=new Date().toISOString();
    // A lost/soft-success D1 acknowledgement cannot stand in for a stored
    // template. Recover only when an independent SELECT matches exact text
    // and the new timestamp, mirroring the QA-master save behavior.
    try{
      await env.DB.prepare("INSERT INTO message_templates (key,subject,body,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at")
        .bind(template.key,subject,content,updatedAt).run();
    }catch{/* Confirm actual storage instead of blindly retrying. */ }
    const saved=await env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates WHERE key=?")
      .bind(template.key).first<{key:string;subject:string;body:string;updatedAt:string}>();
    if(!saved||saved.key!==template.key||saved.subject!==subject||saved.body!==content||saved.updatedAt!==updatedAt)
      return uncertain();
    return privateJson({template:{...template,subject:saved.subject,body:saved.body,updatedAt:saved.updatedAt}});
  }catch{return uncertain();}
  
}
