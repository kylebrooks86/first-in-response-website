import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { FIRE_SERVICES } from '../../../lib/fire-services';
import { SERVICE_RATE_PREFIX,decodeServiceRate,validRate,validDetails,customServiceId } from '../../../lib/service-pricing';
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
    const ids=[...FIRE_SERVICES.map(s=>s.id),...rows.results.map(r=>r.key.slice(SERVICE_RATE_PREFIX.length)).filter(id=>customServiceId(id))];
    if(ids.length>FIRE_SERVICES.length+500)throw Error('Catalog limit exceeded.');
    return json({rates:ids.map(id=>decodeServiceRate(id,map.get(SERVICE_RATE_PREFIX+id)??null))});
  }catch{return json({error:'Standard prices could not be verified. Retry before selecting or resetting a service.'},503);}
}
export async function PUT(request:Request){
  if(!await authorized())return json({error:'Unauthorized'},401);
  let input:unknown;try{input=await request.json();}catch{return json({error:'Invalid pricing request.'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Invalid pricing request.'},400);
  const body=input as Record<string,unknown>;
  if(!['expectedRevision,id,rateCents','details,expectedRevision,id,rateCents'].includes(Object.keys(body).sort().join(','))||!(FIRE_SERVICES.some(s=>s.id===body.id)||customServiceId(body.id))||(body.details!==undefined&&!validDetails(body.details))||!validRate(body.rateCents)||!(body.expectedRevision===null||typeof body.expectedRevision==='string'&&/^[0-9a-f-]{36}$/.test(body.expectedRevision)))return json({error:'Choose an existing service and a nonnegative price in whole cents.'},400);
  let attempted:{key:string;encoded:string;revision:string;id:string}|null=null;
  try{
    const key=SERVICE_RATE_PREFIX+body.id;
    const stored=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(key).first<{body:string}>();
    if(!stored&&customServiceId(body.id)){
      if(!validDetails(body.details))return json({error:'New services need a name, unit and description.'},400);
      const count=await env.DB.prepare('SELECT key,body FROM message_templates WHERE key LIKE ?').bind(SERVICE_RATE_PREFIX+'catalog-%').all();
      if(count.results.length>=500)return json({error:'Catalog limit reached. Deactivate unused services.'},400);
    }
    const current=!stored&&customServiceId(body.id)?{id:String(body.id),rateCents:-1,revision:null,details:undefined}:decodeServiceRate(String(body.id),stored);
    const details=body.details??current.details;
    // Lost-response retries of this absolute setting do not create another write.
    if(current.rateCents===body.rateCents&&JSON.stringify(current.details)===JSON.stringify(details))return json({rate:current});
    if(current.revision!==body.expectedRevision)return json({error:'This standard price changed on another device. Refresh prices before saving again.'},409);
    const rate={id:String(body.id),rateCents:body.rateCents,revision:crypto.randomUUID(),...(details?{details}:{})};
    const encoded=JSON.stringify({rateCents:rate.rateCents,revision:rate.revision,...(rate.details?{details:rate.details}:{})});
    attempted={key,encoded,revision:rate.revision,id:rate.id};
    const stamp=new Date().toISOString();
    const result=stored?await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(encoded,stamp,key,stored.body).run():await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(key,encoded,stamp).run();
    if(result.meta.changes!==1)return json({error:'This standard price changed while saving. Refresh before another attempt.'},409);
    return json({rate});
  }catch{
    // D1 may commit an absolute price update before losing its response.
    // Confirm the exact revision and serialized settings, not merely the
    // same dollar amount, so a concurrent owner's change is never hidden.
    if(attempted){
      try{
        const saved=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?')
          .bind(attempted.key).first<{body:string}>();
        if(saved?.body===attempted.encoded){
          const rate=decodeServiceRate(attempted.id,saved);
          if(rate.revision===attempted.revision)
            return json({rate,recoveredAfterUncertainSave:true});
        }
      }catch{/* Do not assert a save without authoritative readback. */}
    }
    return json({error:'Save could not be confirmed. Refresh standard prices before trying again.',
      saveUncertain:true},503);
  }
}
