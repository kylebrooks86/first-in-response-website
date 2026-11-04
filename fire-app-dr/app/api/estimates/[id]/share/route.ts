import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../../../owner-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getOwnerUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const {id}=await context.params;
  const existing=await env.DB.prepare("SELECT share_token AS shareToken FROM estimates WHERE id=?").bind(id).first<{shareToken:string|null}>();
  if(!existing)return Response.json({error:"Estimate not found."},{status:404});
  const shareToken=existing.shareToken||crypto.randomUUID().replaceAll("-","");
  if(!existing.shareToken)await env.DB.prepare("UPDATE estimates SET share_token=? WHERE id=? AND share_token IS NULL").bind(shareToken,id).run();
  return Response.json({shareToken,customerPath:`/estimate/${shareToken}`});
}
