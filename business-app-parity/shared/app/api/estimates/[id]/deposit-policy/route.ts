import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {depositPolicyEnabled,depositPolicyColumns,depositSchedulingPolicy,type DepositPolicyRow} from '../../../../../lib/deposit-policy';
const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const owner=await getChatGPTUser();if(owner?.email?.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401,headers});
 try{const {id}=await params;const row=await env.DB.prepare(`SELECT ${depositPolicyColumns} FROM estimates e WHERE e.id=?`).bind(id).first<DepositPolicyRow>();if(!row)return Response.json({error:'Estimate not found.'},{status:404,headers});return Response.json({estimateId:row.id,customerId:row.customerId,policy:depositSchedulingPolicy(row,depositPolicyEnabled(env))},{headers});}
 catch{return Response.json({error:'Deposit and scheduling status could not be verified. No records changed.'},{status:503,headers});}
}
