import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {outstandingYardSigns,type YardSignNoteRow} from "../../../lib/dashboard-yard-signs";
export const dynamic="force-dynamic";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!==OWNER_EMAIL)return Response.json({error:"Unauthorized"},{status:401});
 try{
  // Read only the small set of yard-sign events; do not pull all customer finances,
  // photo metadata, or other customer notes into the Dashboard.
  const result=await env.DB.prepare(`SELECT n.id,n.customer_id AS customerId,c.name,c.address,n.body,n.created_at AS createdAt
    FROM customer_notes n JOIN customers c ON c.id=n.customer_id
    WHERE n.body LIKE '[FIRE FLAG] YARD_SIGN_%'
    ORDER BY n.created_at ASC,n.id ASC`).all<YardSignNoteRow>();
  return Response.json({signs:outstandingYardSigns(result.results??[])},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Unable to verify yard sign status. Try again."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
