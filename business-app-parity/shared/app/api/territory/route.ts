import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {serviceLocationsEnabled,serviceAddressSql} from '../../../lib/service-location';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
/** Minimal read-only directory: no contacts, signatures, messages or financial data. */
export async function GET(){
 if((await getChatGPTUser())?.email.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 try{
  const enabled=serviceLocationsEnabled(env);
  const [customers,jobs]=await env.DB.batch([
   env.DB.prepare("SELECT id,name,COALESCE(address,'') AS address FROM customers ORDER BY id"),
   env.DB.prepare(`SELECT e.id,e.customer_id AS customerId,e.status,COALESCE(${serviceAddressSql(enabled)},'') AS address,${enabled?"CASE WHEN EXISTS(SELECT 1 FROM estimate_service_locations sl WHERE sl.estimate_id=e.id AND sl.customer_id=e.customer_id) THEN 1 ELSE 0 END":"0"} AS addressVerified FROM estimates e JOIN customers c ON c.id=e.customer_id ORDER BY e.id`),
  ]);
  return json({customers:customers.results,jobs:(jobs.results as Record<string,unknown>[]).map(j=>({...j,addressVerified:j.addressVerified===1}))});
 }catch{return json({error:'Customer map records unavailable. Refresh to try again.'},503);}
}
