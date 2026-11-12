import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";

const OWNER_EMAIL="kylebrooks8605@gmail.com";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&String(user.email??"").toLowerCase()===OWNER_EMAIL);}

export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  if(!await authorized())return reply({error:"Unauthorized"},401);
  const {id}=await context.params;
  try{
    // The owner can only issue a link for an estimate whose customer still
    // exists. A broken relationship must not generate or disclose a token.
    const source=`SELECT e.share_token AS shareToken,
      CASE WHEN EXISTS(SELECT 1 FROM customers c WHERE c.id=e.customer_id)
        THEN 1 ELSE 0 END AS ownershipOk
      FROM estimates e WHERE e.id=?`;
    const existing=await env.DB.prepare(source).bind(id).first<{shareToken:string|null;ownershipOk:number}>();
    if(!existing)return reply({error:"Estimate not found."},404);
    if(Number(existing.ownershipOk)!==1)return reply({error:"Estimate customer ownership needs review before sharing."},409);
    if(existing.shareToken)return reply({shareToken:existing.shareToken,customerPath:`/estimate/${existing.shareToken}`});
    const candidate=crypto.randomUUID().replaceAll("-","");
    // A second request can win this race. Never overwrite its issued token.
    // Do not infer that a successful (or uncertain) D1 write saved ours.
    try{
      await env.DB.prepare(`UPDATE estimates SET share_token=? WHERE id=? AND (share_token IS NULL OR share_token='')
        AND EXISTS(SELECT 1 FROM customers c WHERE c.id=estimates.customer_id)`).bind(candidate,id).run();
    }catch{
      // D1 could have committed despite a lost ACK. Read the actual row before
      // deciding whether a customer link can be returned.
    }
    // Verify the customer link again after the conditional write, including
    // when the D1 acknowledgment was lost after a possible commit.
    const stored=await env.DB.prepare(source).bind(id).first<{shareToken:string|null;ownershipOk:number}>();
    if(stored&&Number(stored.ownershipOk)!==1)return reply({error:"Estimate customer ownership needs review before sharing."},409);
    if(!stored?.shareToken)return reply({error:"The estimate share link could not be confirmed. Refresh and try again."},503);
    return reply({shareToken:stored.shareToken,customerPath:`/estimate/${stored.shareToken}`});
  }catch{
    return reply({error:"The estimate share link could not be confirmed. Refresh and try again."},503);
  }
}
