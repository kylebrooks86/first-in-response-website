import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
const headers={"Cache-Control":"no-store, private"};
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401,headers});
 const params=new URL(request.url).searchParams,estimateId=params.get("estimateId")??"",customerId=params.get("customerId")??"";
 if(!/^[A-Za-z0-9:_-]{1,128}$/.test(estimateId)||!/^[A-Za-z0-9:_-]{1,128}$/.test(customerId))
   return Response.json({error:"Valid customer and estimate identifiers are required."},{status:400,headers});
 try{
  const linked=await env.DB.prepare("SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1").bind(estimateId,customerId).first<{id:string}>();
  if(!linked)return Response.json({error:"That estimate does not belong to this customer."},{status:404,headers});
  const result=await env.DB.prepare(`SELECT id,channel,template,created_at AS createdAt FROM customer_messages
    WHERE estimate_id=? AND customer_id=? ORDER BY created_at DESC,id DESC LIMIT 13`)
    .bind(estimateId,customerId).all<{id:string;channel:string;template:string;createdAt:string}>();
  return Response.json({estimateId,customerId,events:result.results.slice(0,12),hasMore:result.results.length>12},{headers});
 }catch{return Response.json({error:"Saved contact history could not be verified."},{status:503,headers});}
}
