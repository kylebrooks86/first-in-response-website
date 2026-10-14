import {env} from 'cloudflare:workers';
import {getOwnerUser} from '../../../../owner-auth';
import {inspectPhotoStorage} from '../../../../../lib/photo-storage-integrity';
export async function GET(){
 const user=await getOwnerUser();
 if(!user||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Existing records and bytes were preserved.'},{status:503});
 try{
  const report=await inspectPhotoStorage({all:async<T>(sql:string)=>(await env.DB.prepare(sql).all<T>()).results},env.BUCKET);
  return Response.json(report,{headers:{'cache-control':'no-store'}});
 }catch{
  return Response.json({error:'Photo inspection could not confirm complete coverage. Existing records and bytes were preserved. No cleanup or retry was attempted.',inspectionUncertain:true,writesAttempted:0},{status:503,headers:{'cache-control':'no-store'}});
 }
}
