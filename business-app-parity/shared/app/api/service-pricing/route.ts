import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { FIRE_SERVICES } from '../../../lib/fire-services';
import { SERVICE_RATE_PREFIX,decodeServiceRate,validRate } from '../../../lib/service-pricing';
const OWNER='kylebrooks8605@gmail.com';
async function authorized(){const user=await getChatGPTUser();return user?.email.toLowerCase()===OWNER;}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
// Existing owner-settings override storage: distinct namespaced keys, never
// template keys. Existing full-table backups already preserve these records.
export async function GET(){
  if(!await authorized())return json({error:'Unauthorized'},401);
  try{
    const rows=await env.DB.prepare('SELECT key,body FROM message_templates WHERE key LIKE ?').bind(SERVICE_RATE_PREFIX+'%').all<{key:string;body:string}>();
    const map=new Map(rows.results.map(row=>[row.key,row]));
    return json({rates:FIRE_SERVICES.map(s=>decodeServiceRate(s.id,map.get(SERVICE_RATE_PREFIX+s.id)??null))});
  }catch{return json({error:'Standard prices could not be verified. Retry before selecting or resetting a service.'},503);}
}
export async function PUT(request:Request){
  if(!await authorized())return json({error:'Unauthorized'},401);
  let input:unknown;try{input=await request.json();}catch{return json({error:'Invalid pricing request.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid pricing request.'},400);
  const body=input as Record<string,unknown>;
  if(Object.keys(body).sort().join(',')!=='expectedRevision,id,rateCents'||!FIRE_SERVICES.some(s=>s.id===body.id)||!validRate(body.rateCents)||!(body.expectedRevision===null||typeof body.expectedRevision==='string'&&/^[0-9a-f-]{36}$/.test(body.expectedRevision)))return json({error:'Choose an existing service and a nonnegative price in whole cents.'},400);
  try{
    const key=SERVICE_RATE_PREFIX+body.id;
    const stored=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(key).first<{body:string}>();
    const current=decodeServiceRate(String(body.id),stored);
    // Lost-response retries of this absolute setting do not create another write.
    if(current.rateCents===body.rateCents)return json({rate:current});
    if(current.revision!==body.expectedRevision)return json({error:'This standard price changed on another device. Refresh prices before saving again.'},409);
    const rate={id:String(body.id),rateCents:body.rateCents,revision:crypto.randomUUID()};
    const encoded=JSON.stringify({rateCents:rate.rateCents,revision:rate.revision});
    const stamp=new Date().toISOString();
    const result=stored?await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(encoded,stamp,key,stored.body).run():await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(key,encoded,stamp).run();
    if(result.meta.changes!==1)return json({error:'This standard price changed while saving. Refresh before another attempt.'},409);
    return json({rate});
  }catch{return json({error:'Save could not be confirmed. Refresh standard prices before trying again.'},503);}
}
