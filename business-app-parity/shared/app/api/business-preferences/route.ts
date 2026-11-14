import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {BUSINESS_PREFERENCES_KEY,decodeBusinessPreferences,validBusinessPreferences} from '../../../lib/business-preferences';
import {confirmedSettingCAS} from '../../../lib/confirmed-setting-cas.mjs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
async function owner(){return (await getChatGPTUser())?.email.toLowerCase()==='kylebrooks8605@gmail.com';}
export async function GET(){if(!await owner())return json({error:'Unauthorized'},401);try{return json({preferences:decodeBusinessPreferences(await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(BUSINESS_PREFERENCES_KEY).first<{body:string}>())});}catch{return json({error:'Availability and repeat reminders could not be verified.'},503);}}
export async function PUT(request:Request){
 if(!await owner())return json({error:'Unauthorized'},401);
 let input:unknown;try{input=await request.json();}catch{return json({error:'Invalid settings.'},400);}
 if(!validBusinessPreferences(input)||input.blocks.length!==0)return json({error:'Availability time blocks have been retired. Only repeat-service intervals can be saved.'},400);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(BUSINESS_PREFERENCES_KEY).first<{body:string}>(),current=decodeBusinessPreferences(row);
  if(JSON.stringify(current.blocks)===JSON.stringify(input.blocks)&&JSON.stringify(current.repeatMonths)===JSON.stringify(input.repeatMonths))return json({preferences:current});
  if(current.revision!==input.revision)return json({error:'Settings changed on another device. Refresh before saving.'},409);
  const preferences={...input,revision:crypto.randomUUID()},encoded=JSON.stringify(preferences),stamp=new Date().toISOString();
  const result=await confirmedSettingCAS(env.DB,{
   key:BUSINESS_PREFERENCES_KEY,previousBody:row?.body??null,encoded,updatedAt:stamp
  });
  if(result.status==='conflict')return json({error:'Settings changed while saving. Refresh first.'},409);
  if(result.status!=='confirmed')return json({error:'Save not confirmed. Refresh settings before retrying.',saveUncertain:true},503);
  return json({preferences,...(result.recoveredAfterUncertainSave?{recoveredAfterUncertainSave:true}:{})});
 }catch{return json({error:'Save not confirmed. Refresh settings before retrying.',saveUncertain:true},503);}
}
