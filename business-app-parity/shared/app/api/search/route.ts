import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {CUSTOMER_PHONE_SQL} from '../../../lib/customer-identity';
import {customerPropertiesEnabled} from '../../../lib/customer-properties';
import {serviceLocationsEnabled,serviceAddressSql} from '../../../lib/service-location';
const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
const scopes=['all','customers','estimates','invoices','jobs'];
export async function GET(request:Request){
  const user=await getChatGPTUser();
  if(user?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401,headers});
  const url=new URL(request.url),q=(url.searchParams.get('q')??'').trim(),scope=url.searchParams.get('scope')??'all';
  if(q.length>160||!scopes.includes(scope))return Response.json({error:'Enter a search of up to 160 characters and a supported filter.'},{status:400,headers});
  if(!q)return Response.json({results:[],hasMore:false,scope},{headers});
  try{
    const digits=q.replace(/\D/g,''),phone=digits.length===11&&digits.startsWith('1')?digits.slice(1):digits;
    const phoneSql=CUSTOMER_PHONE_SQL.replaceAll('phone','c.phone');
    const contact=`instr(lower(c.name),lower(?))>0 OR instr(lower(COALESCE(c.email,'')),lower(?))>0 OR (?<>'' AND instr(${phoneSql},?)>0)`;
    const values=[q,q,phone.length>=2?phone:'',phone];
    const address=serviceAddressSql(serviceLocationsEnabled(env));
    const number=q.replace(/^(?:invoice\s*#?\s*|#)/i,'').trim()||q;
    const results:Record<string,unknown>[]=[],more:string[]=[];
    const collect=async(kind:string,sql:string,args:(string|number)[])=>{
      const rows=await env.DB.prepare(sql).bind(...args).all<Record<string,unknown>>();
      if(rows.results.length>8)more.push(kind);
      results.push(...rows.results.slice(0,8).map(row=>({...row,kind})));
    };
    if(scope==='all'||scope==='customers'){
      const property=customerPropertiesEnabled(env)?` OR EXISTS(SELECT 1 FROM customer_properties p WHERE p.customer_id=c.id AND instr(lower(p.address||' '||p.designation),lower(?))>0)`:'';
      await collect('customer',`SELECT c.id,c.name AS title,COALESCE(c.address,'') AS address,COALESCE(c.phone,'') AS phone,COALESCE(c.email,'') AS email,
        CASE WHEN lower(c.name)=lower(?) THEN 0 ELSE 2 END AS rank FROM customers c
        WHERE ${contact} OR instr(lower(COALESCE(c.address,'')),lower(?))>0${property}
        ORDER BY rank,c.name COLLATE NOCASE,c.id LIMIT 9`,[q,...values,q,...(property?[q]:[])]);
    }
    for(const kind of ['estimate','job'])if(scope==='all'||scope===(kind==='estimate'?'estimates':'jobs')){
      await collect(kind,`SELECT e.id,c.name AS title,c.id AS customerId,e.status,e.scheduled_at AS scheduledAt,${address} AS address,
        COALESCE((SELECT GROUP_CONCAT(name,', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'Custom service') AS service,
        CASE WHEN lower(e.id)=lower(?) OR lower(substr(e.id,1,6))=lower(?) THEN 0 ELSE 2 END AS rank
        FROM estimates e JOIN customers c ON c.id=e.customer_id
        WHERE (${contact} OR instr(lower(COALESCE(${address},'')),lower(?))>0 OR instr(lower(e.id),lower(?))>0
          OR EXISTS(SELECT 1 FROM estimate_items ei WHERE ei.estimate_id=e.id AND (instr(lower(ei.name),lower(?))>0 OR instr(lower(COALESCE(ei.description,'')),lower(?))>0)))
        ${kind==='job'?"AND (e.scheduled_at IS NOT NULL OR e.status IN ('scheduled','completed','in_progress','canceled'))":''}
        ORDER BY rank,e.created_at DESC,e.id LIMIT 9`,[q,q,...values,q,q,q,q]);
    }
    if(scope==='all'||scope==='invoices')await collect('invoice',`SELECT inv.id,'Invoice #'||upper(substr(inv.id,1,6)) AS title,c.name AS customer,c.id AS customerId,e.id AS estimateId,
      ${address} AS address,COALESCE((SELECT GROUP_CONCAT(name,', ') FROM invoice_items ii WHERE ii.invoice_id=inv.id),'Custom service') AS service,
      CASE WHEN lower(inv.id)=lower(?) OR lower(substr(inv.id,1,6))=lower(?) THEN 0 ELSE 2 END AS rank
      FROM invoices inv JOIN estimates e ON e.id=inv.estimate_id AND e.customer_id=inv.customer_id JOIN customers c ON c.id=inv.customer_id
      WHERE ${contact} OR instr(lower(COALESCE(${address},'')),lower(?))>0 OR instr(lower(inv.id),lower(?))>0
        OR EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.invoice_id=inv.id AND (instr(lower(ii.name),lower(?))>0 OR instr(lower(COALESCE(ii.description,'')),lower(?))>0))
      ORDER BY rank,inv.created_at DESC,inv.id LIMIT 9`,[number,number,...values,q,number,q,q]);
    results.sort((a,b)=>Number(a.rank)-Number(b.rank));
    return Response.json({results,hasMore:more.length>0,more,scope},{headers});
  }catch{return Response.json({error:'Search is unavailable. Check your connection and try again. No records changed.'},{status:503,headers});}
}
