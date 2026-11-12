import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {customerCreationReceipt} from '../../../../lib/customer-identity';
import {customerNumberForCustomer} from '../../../../lib/customer-numbering.mjs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private'}});
export async function GET(request:Request){
 const owner=await getChatGPTUser();if(owner?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 const requestId=new URL(request.url).searchParams.get('requestId');
 if(!requestId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId))return json({error:'Invalid customer save identifier.'},400);
 try{const customer=await customerCreationReceipt(env.DB,requestId);const customerNumber=customer?await customerNumberForCustomer(env.DB,requestId,env):null;return json({requestId,confirmed:Boolean(customer),customer:customer?{...customer,customerNumber}:null});}
 catch{return json({error:'Customer save status is uncertain. Keep this request and check again.'},503);}
}
