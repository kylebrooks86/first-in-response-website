import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {CUSTOMER_PHONE_SQL} from '../../../../lib/customer-identity';
import {customerPropertiesEnabled} from '../../../../lib/customer-properties';
const columns="id,name,COALESCE(email,'') AS email,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address";
export async function GET(request:Request){
 const user=await getChatGPTUser();
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','vary':'Cookie'}});
 if(user?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 const url=new URL(request.url),id=url.searchParams.get('customerId'),query=(url.searchParams.get('q')??'').trim();
 if(query.length>160||id!==null&&(!id.trim()||id.length>128)||id!==null&&url.searchParams.has('q'))return json({error:'Invalid customer lookup.'},400);
 try{
  if(id!==null){const customer=await env.DB.prepare(`SELECT ${columns} FROM customers WHERE id=? LIMIT 1`).bind(id).first();return customer?json({customer}):json({error:'That customer is no longer available. Choose a customer again.'},404);}
  if(!query)return json({customers:[],hasMore:false});
  const raw=query.replace(/\D/g,''),digits=raw.startsWith('1')&&(query.startsWith('+1')||raw.length===11)?raw.slice(1):raw;
  const properties=customerPropertiesEnabled(env);
  const result=await env.DB.prepare(`SELECT ${columns} FROM customers WHERE instr(lower(name),lower(?))>0 OR instr(lower(COALESCE(email,'')),lower(?))>0 OR instr(lower(COALESCE(address,'')),lower(?))>0 OR (?<>'' AND instr(${CUSTOMER_PHONE_SQL},?)>0)${properties?" OR EXISTS(SELECT 1 FROM customer_properties p WHERE p.customer_id=customers.id AND instr(lower(p.address||' '||p.designation),lower(?))>0)":''} ORDER BY name COLLATE NOCASE,id LIMIT 13`).bind(query,query,query,digits.length>=2?digits:'',digits,...(properties?[query]:[])).all();
  return json({customers:result.results.slice(0,12),hasMore:result.results.length>12});
 }catch{return json({error:'Customer search is unavailable. No records changed.'},503);}
}
