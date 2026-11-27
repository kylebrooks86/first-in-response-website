import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {inspectPhotoStorage} from '../../../../../lib/photo-storage-integrity';
const privateHeaders={'cache-control':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff'};
export async function GET(){
 const user=await getChatGPTUser();
 if(typeof user?.email!=='string'||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401,headers:privateHeaders});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Existing records and bytes were preserved.'},{status:503,headers:privateHeaders});
 try{
  const report=await inspectPhotoStorage({all:async<T>(sql:string)=>(await env.DB.prepare(sql).all<T>()).results},env.BUCKET);
  return Response.json(report,{headers:privateHeaders});
 }catch{
  return Response.json({error:'Photo inspection could not confirm complete coverage. Existing records and bytes were preserved. No cleanup or retry was attempted.',inspectionUncertain:true,writesAttempted:0},{status:503,headers:privateHeaders});
 }
}
