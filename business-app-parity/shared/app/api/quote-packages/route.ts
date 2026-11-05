import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {QUOTE_PACKAGES_KEY,decodeQuotePackages,validQuotePackages} from '../../../lib/quote-packages';
const OWNER='kylebrooks8605@gmail.com';
async function authorized(){return (await getChatGPTUser())?.email.toLowerCase()===OWNER;}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function GET(){
 if(!await authorized())return json({error:'Unauthorized'},401);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(QUOTE_PACKAGES_KEY).first<{body:string}>();
  return json({catalog:decodeQuotePackages(row)});
 }catch{return json({error:'Quote packages could not be verified. Do not use a stale package until refreshed.'},503);}
}
export async function PUT(request:Request){
 if(!await authorized())return json({error:'Unauthorized'},401);
 let body:Record<string,unknown>;
 try{const parsed:unknown=await request.json();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();body=parsed as Record<string,unknown>;}
 catch{return json({error:'A valid package catalog request is required.'},400);}
 const keys=Object.keys(body).sort().join(',');
 if(keys!=='expectedRevision,packages'||!validQuotePackages(body.packages)||
  !(body.expectedRevision===null||typeof body.expectedRevision==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.expectedRevision)))
  return json({error:'Choose a unique package name and existing services. No customer details or prices can be saved.'},400);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(QUOTE_PACKAGES_KEY).first<{body:string}>();
  const current=decodeQuotePackages(row);
  // A committed catalog may have lost its HTTP response; replay never rewrites it.
  if(JSON.stringify(current.packages)===JSON.stringify(body.packages))return json({catalog:current});
  if(current.revision!==body.expectedRevision)return json({error:'Packages changed on another device. Refresh before saving.'},409);
  const catalog={revision:crypto.randomUUID(),packages:body.packages};
  const encoded=JSON.stringify(catalog),now=new Date().toISOString();
  const result=row
   ?await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(encoded,now,QUOTE_PACKAGES_KEY,row.body).run()
   :await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(QUOTE_PACKAGES_KEY,encoded,now).run();
  if(result.meta.changes!==1)return json({error:'Another device saved packages first. Refresh before trying again.'},409);
  return json({catalog});
 }catch{return json({error:'Package save was not confirmed. Refresh stored packages before another attempt.'},503);}
}
