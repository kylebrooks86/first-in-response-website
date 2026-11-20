import {env} from 'cloudflare:workers';import {getChatGPTUser} from '../../../../chatgpt-auth';import {QUOTE_REVISION_PREFIX} from '../../../../../lib/quote-revisions';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if((await getChatGPTUser())?.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401});
 const {id}=await params;if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))return Response.json({error:'Invalid estimate.'},{status:400});
 try{
  const records=await env.DB.prepare("SELECT m.key,m.body FROM message_templates m WHERE m.key LIKE ? AND (json_extract(m.body,'$.originalId')=? OR json_extract(m.body,'$.replacementId')=?) LIMIT 3").bind(QUOTE_REVISION_PREFIX+'%',id,id).all<{key:string;body:string}>();
  const links=[];
  for(const row of records.results){const v=JSON.parse(row.body);if(v.version!==1||row.key!==QUOTE_REVISION_PREFIX+v.originalId||typeof v.replacementId!=='string'||!Number.isFinite(Date.parse(v.createdAt)))throw Error();const pair=await env.DB.prepare('SELECT a.id FROM estimates a JOIN estimates b ON b.customer_id=a.customer_id WHERE a.id=? AND b.id=?').bind(v.originalId,v.replacementId).first();if(!pair)throw Error();links.push({originalId:v.originalId,replacementId:v.replacementId,createdAt:v.createdAt});}
  return Response.json({links},{headers:{'cache-control':'private, no-store'}});
 }catch{return Response.json({error:'Estimate version history could not be verified.'},{status:503});}
}
