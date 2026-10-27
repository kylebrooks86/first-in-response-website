import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {BUSINESS_PREFERENCES_KEY,decodeBusinessPreferences,validBusinessPreferences} from '../../../lib/business-preferences';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
async function owner(){return (await getChatGPTUser())?.email.toLowerCase()==='kylebrooks8605@gmail.com';}
export async function GET(){if(!await owner())return json({error:'Unauthorized'},401);try{return json({preferences:decodeBusinessPreferences(await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(BUSINESS_PREFERENCES_KEY).first<{body:string}>())});}catch{return json({error:'Availability and repeat reminders could not be verified.'},503);}}
export async function PUT(request:Request){
 if(!await owner())return json({error:'Unauthorized'},401);
 let input:unknown;try{input=await request.json();}catch{return json({error:'Invalid settings.'},400);}
 if(!validBusinessPreferences(input))return json({error:'Review dates, time ranges and repeat intervals.'},400);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(BUSINESS_PREFERENCES_KEY).first<{body:string}>(),current=decodeBusinessPreferences(row);
  if(JSON.stringify(current.blocks)===JSON.stringify(input.blocks)&&JSON.stringify(current.repeatMonths)===JSON.stringify(input.repeatMonths))return json({preferences:current});
  if(current.revision!==input.revision)return json({error:'Settings changed on another device. Refresh before saving.'},409);
  const preferences={...input,revision:crypto.randomUUID()},encoded=JSON.stringify(preferences),stamp=new Date().toISOString();
  const result=row?await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(encoded,stamp,BUSINESS_PREFERENCES_KEY,row.body).run():await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(BUSINESS_PREFERENCES_KEY,encoded,stamp).run();
  if(result.meta.changes!==1)return json({error:'Settings changed while saving. Refresh first.'},409);return json({preferences});
 }catch{return json({error:'Save not confirmed. Refresh settings before retrying.'},503);}
}
