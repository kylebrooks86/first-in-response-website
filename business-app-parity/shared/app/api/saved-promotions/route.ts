import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {SAVED_PROMOTIONS_KEY,decodeSavedPromotions,validPromotions} from '../../../lib/saved-promotions';
import {confirmedSettingCAS} from '../../../lib/confirmed-setting-cas.mjs';

const OWNER='kylebrooks8605@gmail.com';
async function authorized(){const user=await getChatGPTUser();return user?.email.toLowerCase()===OWNER;}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store, private'}});
export async function GET(){
  if(!await authorized())return json({error:'Unauthorized'},401);
  try{
    const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(SAVED_PROMOTIONS_KEY).first<{body:string}>();
    return json({catalog:decodeSavedPromotions(row)});
  }catch{return json({error:'Saved promotions could not be verified; automatic application must remain blocked.'},503);}
}
export async function PUT(request:Request){
  if(!await authorized())return json({error:'Unauthorized'},401);
  let input:unknown;try{input=await request.json();}catch{return json({error:'Invalid promotions request.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid promotions request.'},400);
  const body=input as Record<string,unknown>;
  if(Object.keys(body).sort().join(',')!=='expectedRevision,promotions'||!validPromotions(body.promotions)||
    !(body.expectedRevision===null||typeof body.expectedRevision==='string'&&/^[0-9a-f-]{36}$/i.test(body.expectedRevision)))
    return json({error:'Review promotion names, dates, amounts and services before saving.'},400);
  try{
    const stored=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(SAVED_PROMOTIONS_KEY).first<{body:string}>();
    const current=decodeSavedPromotions(stored);
    // A committed-but-lost response is safe to re-read; exact duplicates do not write again.
    if(JSON.stringify(current.promotions)===JSON.stringify(body.promotions))return json({catalog:current});
    if(current.revision!==body.expectedRevision)return json({error:'Saved promotions changed on another device. Refresh before saving.'},409);
    const catalog={revision:crypto.randomUUID(),promotions:body.promotions};
    const encoded=JSON.stringify(catalog),stamp=new Date().toISOString();
    const result=await confirmedSettingCAS(env.DB,{
      key:SAVED_PROMOTIONS_KEY,previousBody:stored?.body??null,encoded,updatedAt:stamp
    });
    if(result.status==='conflict')return json({error:'Another device saved promotions first. Refresh before trying again.'},409);
    if(result.status!=='confirmed')
      return json({error:'Save could not be confirmed. Read current promotions before retrying.',saveUncertain:true},503);
    return json({catalog,...(result.recoveredAfterUncertainSave?{recoveredAfterUncertainSave:true}:{})});
  }catch{return json({error:'Save could not be confirmed. Read current promotions before retrying.',saveUncertain:true},503);}
}
