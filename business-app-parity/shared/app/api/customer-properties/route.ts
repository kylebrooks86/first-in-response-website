import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {customerPropertiesEnabled,propertyWorkflowTestEnabled,type CustomerProperty} from '../../../lib/customer-properties';
import {readOwnerWriteObject} from '../../../lib/customer-write-request-guard.mjs';
const columns='id,customer_id AS customerId,address,designation,active,revision,created_at AS createdAt';
async function owner(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()==='kylebrooks8605@gmail.com');}
function id(value:unknown){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=128?value.trim():'';}
export async function GET(request:Request){
 if(!await owner())return Response.json({error:'Unauthorized'},{status:401});
 if(!customerPropertiesEnabled(env))return Response.json({enabled:false});
 const url=new URL(request.url),customerId=id(url.searchParams.get('customerId')),cursor=url.searchParams.get('cursor'),limit=url.searchParams.get('limit')??'50',selectedId=url.searchParams.get('selectedPropertyId');
 if(selectedId!==null&&(!id(selectedId)||id(selectedId)!==selectedId))return Response.json({error:'Invalid selected property.'},{status:400});
 if(!customerId||!/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit)||cursor!==null&&(!id(cursor)||cursor!==id(cursor)))return Response.json({error:'Invalid property page.'},{status:400});
 try{
  if(!await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first())return Response.json({error:'Customer not found.'},{status:404});
  const [page,count,sole,selected]=await env.DB.batch([
   env.DB.prepare(`SELECT ${columns} FROM customer_properties WHERE customer_id=? AND (? IS NULL OR id>?) ORDER BY id LIMIT ?`).bind(customerId,cursor,cursor,Number(limit)+1),
   env.DB.prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS activeCount FROM customer_properties WHERE customer_id=?').bind(customerId),
   env.DB.prepare(`SELECT ${columns} FROM customer_properties WHERE customer_id=? AND active=1 ORDER BY id LIMIT 2`).bind(customerId),
   env.DB.prepare(`SELECT ${columns} FROM customer_properties WHERE customer_id=? AND id=?`).bind(customerId,selectedId??''),
  ]);
  const rows=(page.results as unknown as CustomerProperty[]).slice(0,Number(limit)),stats=count.results[0] as {total:number;activeCount:number|null},soleRows=sole.results as unknown as CustomerProperty[];
  return Response.json({enabled:true,selectedProperty:selected.results[0]??null,properties:rows,total:Number(stats.total),activeCount:Number(stats.activeCount??0),soleActiveProperty:soleRows.length===1?soleRows[0]:null,nextCursor:page.results.length>Number(limit)?rows.at(-1)?.id:null,estimateAssociationReady:propertyWorkflowTestEnabled(env)});
 }catch{return Response.json({error:'Properties could not be read. No records changed.'},{status:503});}
}
export async function POST(request:Request){
 if(!await owner())return Response.json({error:'Unauthorized'},{status:401});
 if(!customerPropertiesEnabled(env))return Response.json({error:'Property management is not enabled.'},{status:404});
 const parsed=await readOwnerWriteObject(request,8192);
 if(parsed.response)return parsed.response;
 const body=parsed.value as Record<string,unknown>,customerId=id(body.customerId),
  address=typeof body.address==='string'?body.address.trim():'',
  designation=typeof body.designation==='string'?body.designation.trim():'';
 const hasOperation=body.operationId!==undefined;
 const operationId=hasOperation&&typeof body.operationId==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.operationId)
  ?body.operationId:null;
 if(!customerId||!address||address.length>2000||designation.length>200||
    body.designation!=null&&typeof body.designation!=='string'||
    hasOperation&&!operationId||
    Object.keys(body).some(key=>!['customerId','address','designation','operationId'].includes(key)))
  return Response.json({error:'Enter a customer, service address and optional building/unit/area label.'},{status:400});
 const propertyId=operationId??crypto.randomUUID();
 const matching=(row:CustomerProperty)=>row.customerId===customerId&&row.address===address&&
  row.designation===designation&&row.active===1;
 const uncertain=()=>Response.json({error:'Property save is not confirmed. Review stored properties before deliberate retry.',
  saveUncertain:true},{status:503,headers:{'Cache-Control':'private, no-store'}});
 const collision=()=>Response.json({error:'That property save request belongs to another or archived record. Review saved properties before another attempt.'},
  {status:409,headers:{'Cache-Control':'private, no-store'}});
 const stored=()=>env.DB.prepare(`SELECT ${columns} FROM customer_properties WHERE id=?`)
  .bind(propertyId).first<CustomerProperty>();
 try{
  // A lost HTTP response must reuse the same owner-generated UUID. Never
  // create a second address record when the original immutable ID exists.
  if(operationId){
   const previous=await stored();
   if(previous)return matching(previous)?Response.json({property:previous,recoveredAfterUncertainSave:true},
    {headers:{'Cache-Control':'private, no-store'}}):collision();
  }
  let returned:CustomerProperty|null=null,insertReturned=false;
  try{
   returned=await env.DB.prepare(`INSERT INTO customer_properties(id,customer_id,address,designation,active,revision,created_at)
    SELECT ?,id,?,?,1,1,? FROM customers WHERE id=? RETURNING ${columns}`)
    .bind(propertyId,address,designation,new Date().toISOString(),customerId).first<CustomerProperty>();
   insertReturned=true;
  }catch{/* D1 may have committed the INSERT but lost its acknowledgement. */}
  // Never trust a reported INSERT success without independent physical readback.
  const confirmed=await stored();
  if(confirmed)return matching(confirmed)?Response.json({property:confirmed,...(!insertReturned||!returned?{recoveredAfterUncertainSave:true}:{})},
   {status:insertReturned&&returned?201:200,headers:{'Cache-Control':'private, no-store'}}):collision();
  if(insertReturned&&!returned){
   const customer=await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first();
   if(!customer)return Response.json({error:'Customer not found. No property added.'},{status:404});
  }
  return uncertain();
 }catch{return uncertain();}
}
export async function PATCH(request:Request){
 if(!await owner())return Response.json({error:'Unauthorized'},{status:401});
 if(!customerPropertiesEnabled(env))return Response.json({error:'Property management is not enabled.'},{status:404});
 try{
  const body=await request.json() as Record<string,unknown>,customerId=id(body.customerId),propertyId=id(body.propertyId);
  if(!customerId||!propertyId||body.action!=='archive'||!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1||Object.keys(body).some(key=>!['customerId','propertyId','action','expectedRevision'].includes(key)))return Response.json({error:'Explicit archive action and current property revision are required.'},{status:400});
  const property=await env.DB.prepare(`UPDATE customer_properties SET active=0,revision=revision+1 WHERE id=? AND customer_id=? AND active=1 AND revision=? RETURNING ${columns}`).bind(propertyId,customerId,body.expectedRevision).first<CustomerProperty>();
  return property?Response.json({property}):Response.json({error:'Property ownership or revision changed. Nothing was archived by this attempt.'},{status:409});
 }catch{return Response.json({error:'Archive was not confirmed. Review stored status before another deliberate attempt.'},{status:500});}
}
